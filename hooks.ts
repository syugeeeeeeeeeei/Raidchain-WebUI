import { useState, useEffect, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import { ExperimentScenario, ExperimentResult, NodeStatus, UserAccount, SystemAccount, FilterCondition, SortConfig, Toast, NotificationItem, ExperimentConfig, AllocatorStrategy, TransmitterStrategy } from './types';
import { generateMockUsers, generateSystemAccounts, generateMockNodes } from './services/mockData';

// --- 1. useResizerPanel ---
export const useResizerPanel = (initialHeight: number = 320, minHeight: number = 100, maxHeightRatio: number = 0.8) => {
    const [isOpen, setIsOpen] = useState(false);
    const [height, setHeight] = useState(initialHeight);
    const panelRef = useRef<HTMLDivElement>(null);
    const resizerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const resizer = resizerRef.current;
        if (!resizer) return;

        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'row-resize';
        };

        const handleMouseMove = (e: MouseEvent) => {
            const newHeight = window.innerHeight - e.clientY;
            if (newHeight > 80 && newHeight < window.innerHeight * maxHeightRatio) {
                setHeight(newHeight);
                if (!isOpen && newHeight > minHeight) setIsOpen(true);
            }
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            if (panelRef.current && panelRef.current.clientHeight < 120) setIsOpen(false);
        };

        resizer.addEventListener('mousedown', handleMouseDown);
        return () => { resizer.removeEventListener('mousedown', handleMouseDown); };
    }, [isOpen, minHeight, maxHeightRatio]);

    return { isOpen, setIsOpen, height, panelRef, resizerRef };
};

// --- 2. useScenarioExecution ---
export const useScenarioExecution = (
    notify: (type: 'success' | 'error', title: string, message: string) => void,
    onRegisterResult: (result: ExperimentResult) => void
) => {
    const [scenarios, setScenarios] = useState<ExperimentScenario[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExecutionRunning, setIsExecutionRunning] = useState(false);

    const generateScenarios = async (params: {
        projectName: string;
        users: UserAccount[];
        selectedUserId: string;
        mode: 'virtual' | 'upload';
        dataSizeParams: { mode: 'fixed' | 'range', fixed: number, range: { start: number, end: number, step: number } };
        chunkSizeParams: { mode: 'fixed' | 'range', fixed: number, range: { start: number, end: number, step: number } };
        selectedAllocators: Set<AllocatorStrategy>;
        selectedTransmitters: Set<TransmitterStrategy>;
        selectedChains: Set<string>;
        setIsOpen: (isOpen: boolean) => void;
    }) => {
        setIsGenerating(true);
        const newScenarios: ExperimentScenario[] = [];

        const getDataSizes = () => {
            if (params.mode === 'upload') return [params.dataSizeParams.fixed];
            if (params.dataSizeParams.mode === 'fixed') return [params.dataSizeParams.fixed];
            const res = [];
            for (let v = params.dataSizeParams.range.start; v <= params.dataSizeParams.range.end; v += Math.max(1, params.dataSizeParams.range.step)) res.push(parseFloat(v.toFixed(2)));
            return res.length ? res : [params.dataSizeParams.range.start];
        };
        const getChunkSizes = () => {
            if (params.chunkSizeParams.mode === 'fixed') return [params.chunkSizeParams.fixed];
            const res = [];
            for (let v = params.chunkSizeParams.range.start; v <= params.chunkSizeParams.range.end; v += Math.max(1, params.chunkSizeParams.range.step)) res.push(v);
            return res.length ? res : [params.chunkSizeParams.range.start];
        };

        const dataSizes = getDataSizes();
        const chunkSizes = getChunkSizes();

        let idCounter = 1;
        const cleanName = params.projectName.replace(/[^a-zA-Z0-9_]/g, '') || 'Exp';
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const userBudget = params.users.find(u => u.id === params.selectedUserId)?.balance || 0;

        for (const ds of dataSizes) for (const cs of chunkSizes) for (const al of params.selectedAllocators) for (const tr of params.selectedTransmitters) {
            newScenarios.push({
                id: idCounter++,
                uniqueId: `${cleanName}_${timestamp}_${String(idCounter).padStart(3, '0')}`,
                dataSize: ds,
                chunkSize: cs,
                allocator: al,
                transmitter: tr,
                chains: params.selectedChains.size,
                targetChains: Array.from(params.selectedChains),
                budgetLimit: userBudget,
                cost: 0,
                status: 'PENDING',
                failReason: null,
                progress: 0,
                logs: []
            });
        }

        setScenarios(newScenarios);
        params.setIsOpen(true);

        const processed = [...newScenarios];
        for (const c of processed) {
            await new Promise(r => setTimeout(r, 50));
            const cost = (c.dataSize * c.chunkSize * c.chains) / 1000;

            if (Math.random() < 0.1) {
                c.status = 'FAIL';
                c.failReason = 'System timeout: 一時的なシステムエラーが発生しました。';
                c.cost = cost;
            } else if (cost > c.budgetLimit * 0.8) {
                if (Math.random() < 0.3) {
                    c.status = 'FAIL';
                    c.failReason = `Insufficient balance: コスト (${cost.toFixed(2)} TKN) が予算 (${c.budgetLimit.toFixed(2)} TKN) を超える可能性があります。`;
                    c.cost = cost;
                } else {
                    c.status = 'READY';
                    c.cost = parseFloat(cost.toFixed(2));
                }
            } else {
                c.status = 'READY';
                c.cost = parseFloat(cost.toFixed(2));
            }
            setScenarios([...processed]);
        }

        notify(processed.some(s => s.status === 'FAIL') ? 'error' : 'success', '試算完了', `${processed.length}件のシナリオを作成しました。`);
        setIsGenerating(false);
    };

    const executeScenarios = async (projectName: string) => {
        setIsExecutionRunning(true);
        notify('success', '実行開始', '実行可能(READY)なシナリオの処理を開始します...');

        const currentScenarios = [...scenarios];
        let successCount = 0; let failedCount = 0;

        for (let i = 0; i < currentScenarios.length; i++) {
            if (currentScenarios[i].status === 'READY') {
                currentScenarios[i].status = 'RUNNING';
                currentScenarios[i].logs.push('[INFO] Experiment Started.');
                setScenarios([...currentScenarios]);

                await new Promise(r => setTimeout(r, 500));

                const success = Math.random() > 0.1;
                currentScenarios[i].status = success ? 'COMPLETE' : 'FAIL';
                currentScenarios[i].logs.push(success ? '[SUCCESS] Completed.' : '[ERROR] Connection Lost.');

                if (!success) {
                    currentScenarios[i].failReason = 'Connection error: 実行中にネットワーク接続が切れました。';
                    failedCount++;
                } else {
                    successCount++;
                    onRegisterResult({
                        id: `res-${currentScenarios[i].uniqueId}`,
                        scenarioName: `${projectName} #${currentScenarios[i].id}`,
                        executedAt: new Date().toISOString(),
                        status: 'SUCCESS',
                        dataSizeMB: currentScenarios[i].dataSize,
                        chunkSizeKB: currentScenarios[i].chunkSize,
                        totalTxCount: Math.floor((currentScenarios[i].dataSize * 1024) / currentScenarios[i].chunkSize),
                        allocator: currentScenarios[i].allocator,
                        transmitter: currentScenarios[i].transmitter,
                        targetChainCount: currentScenarios[i].chains,
                        usedChains: currentScenarios[i].targetChains,
                        uploadTimeMs: 1234,
                        downloadTimeMs: 567,
                        throughputBps: 1000000,
                        logs: currentScenarios[i].logs
                    });
                }
                setScenarios([...currentScenarios]);
            }
        }
        notify(failedCount > 0 ? 'error' : 'success', '一括実行完了', `${successCount}件成功, ${failedCount}件失敗`);
        setIsExecutionRunning(false);
    };

    const reprocessCondition = async (id: number) => {
        const idx = scenarios.findIndex(s => s.id === id);
        if (idx === -1) return;
        const updated = [...scenarios];
        updated[idx].status = 'PENDING';
        updated[idx].failReason = null;
        setScenarios(updated);
        await new Promise(r => setTimeout(r, 500));
        const c = updated[idx];
        const cost = (c.dataSize * c.chunkSize * c.chains) / 1000;
        c.status = 'READY';
        c.cost = parseFloat(cost.toFixed(2));
        setScenarios([...updated]);
    };

    const handleRecalculateAll = async () => {
        const failedIndices = scenarios.map((s, i) => s.status === 'FAIL' ? i : -1).filter(i => i !== -1);
        if (failedIndices.length === 0) return;

        notify('success', '再試算開始', `${failedIndices.length}件のシナリオを再試算します`);
        const updated = [...scenarios];

        failedIndices.forEach(i => {
            updated[i].status = 'PENDING';
            updated[i].failReason = null;
        });
        setScenarios([...updated]);

        for (const i of failedIndices) {
            await new Promise(r => setTimeout(r, 200));
            const c = updated[i];
            const cost = (c.dataSize * c.chunkSize * c.chains) / 1000;
            c.status = 'READY';
            c.cost = parseFloat(cost.toFixed(2));
            setScenarios([...updated]);
        }
        notify('success', '再試算完了', '全てのシナリオが実行可能になりました');
    };

    return { scenarios, isGenerating, isExecutionRunning, generateScenarios, executeScenarios, reprocessCondition, handleRecalculateAll };
};

// --- 3. useDeploymentControl ---
export const useDeploymentControl = (
    deployedNodeCount: number,
    setDeployedNodeCount: (count: number) => void,
    setIsDockerBuilt: (isBuilt: boolean) => void
) => {
    const [scaleCount, setScaleCount] = useState(deployedNodeCount);
    const [isBuilding, setIsBuilding] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => { setScaleCount(deployedNodeCount); }, [deployedNodeCount]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ja-JP')}] ${msg}`]);

    const handleBuild = () => {
        if (isBuilding) return;
        setLogs([]); setIsBuilding(true);
        addLog(">> Starting Docker Build for targets: [DataChain, MetaChain]...");
        let step = 0;
        const interval = setInterval(() => {
            step++;
            if (step === 1) addLog("Building context: 124.5MB transferred.");
            if (step === 2) addLog("Step 1/5 : FROM golang:1.22-alpine as builder");
            if (step === 3) addLog("Step 2/5 : WORKDIR /app");
            if (step === 4) addLog("Step 3/5 : COPY . .");
            if (step === 5) addLog("Step 4/5 : RUN go build -o datachain ./cmd/datachain");
            if (step === 6) {
                addLog("Successfully built image 'raidchain/node:latest'");
                setIsBuilding(false); setIsDockerBuilt(true); clearInterval(interval);
            }
        }, 800);
    };

    const handleDeploy = () => {
        if (isDeploying) return;
        setLogs([]); setIsDeploying(true);
        addLog(`>> Starting Helm Upgrade (Scale: ${scaleCount})...`);
        setTimeout(() => {
            addLog("Release \"raidchain-core\" does not exist. Installing it now.");
            addLog("Manifest rendered. Applying to namespace 'default'.");
            addLog(`[K8s] Service/datachain-svc created.`);
            for (let i = 0; i < scaleCount; i++) setTimeout(() => addLog(`[K8s] Pod/datachain-${i} scheduled.`), i * 500);
            setTimeout(() => {
                addLog(">> Deployment Sync Completed. System Healthy.");
                setDeployedNodeCount(scaleCount); setIsDeploying(false);
            }, scaleCount * 500 + 1000);
        }, 1000);
    };

    const handleReset = () => {
        setLogs([]); addLog(">> Executing Helm Uninstall..."); addLog("Removing PVCs..."); addLog("Cleaned up resources.");
        setIsDockerBuilt(false); setDeployedNodeCount(0);
    };

    return { scaleCount, setScaleCount, isBuilding, isDeploying, logs, handleBuild, handleDeploy, handleReset };
};

// --- 4. useEconomyManagement ---
export const useEconomyManagement = (
    deployedNodeCount: number,
    addToast: (type: 'success' | 'error', title: string, message: string) => void
) => {
    const [users, setUsers] = useState<UserAccount[]>(generateMockUsers());
    const [systemAccounts, setSystemAccounts] = useState<SystemAccount[]>(generateSystemAccounts(deployedNodeCount));

    // NodeCount変更時のRelayer同期
    useEffect(() => {
        setSystemAccounts(prev => {
            const millionaire = prev.find(a => a.type === 'faucet_source');
            const newAccounts = generateSystemAccounts(deployedNodeCount);
            if (millionaire) {
                newAccounts[0].balance = millionaire.balance;
            }
            return newAccounts;
        });
    }, [deployedNodeCount]);

    const handleCreateUser = () => {
        const newUser: UserAccount = {
            id: `u${Date.now()}`,
            address: `raid1${Math.random().toString(36).substring(7)}${Math.random().toString(36).substring(7)}`,
            balance: 0,
            role: 'client'
        };
        setUsers([...users, newUser]);
    };

    const handleDeleteUser = (id: string) => setUsers(users.filter(u => u.id !== id));

    const handleFaucet = (targetId: string) => {
        const amount = 1000;
        const millionaire = systemAccounts.find(a => a.type === 'faucet_source');
        if (!millionaire || millionaire.balance < amount) {
            addToast('error', 'Faucet Error', 'System pool is empty.');
            return;
        }

        const userTarget = users.find(u => u.id === targetId);
        if (userTarget) {
            setUsers(users.map(u => u.id === targetId ? { ...u, balance: u.balance + amount } : u));
            setSystemAccounts(prev => prev.map(a => a.id === millionaire.id ? { ...a, balance: a.balance - amount } : a));
            addToast('success', 'Success', `Sent 1,000 TKN to ${userTarget.address.substring(0, 8)}...`);
            return;
        }

        const sysTarget = systemAccounts.find(a => a.id === targetId);
        if (sysTarget) {
            setSystemAccounts(prev => prev.map(a => {
                if (a.id === millionaire.id) return { ...a, balance: a.balance - amount };
                if (a.id === targetId) return { ...a, balance: a.balance + amount };
                return a;
            }));
            addToast('success', 'Success', `Refilled 1,000 TKN to ${sysTarget.name}.`);
        }
    };

    return { users, systemAccounts, handleCreateUser, handleDeleteUser, handleFaucet };
};

// --- 5. useTableFilterSort ---
export const useTableFilterSort = (data: ExperimentResult[], initialSort: SortConfig) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>(initialSort);
    const [filters, setFilters] = useState<FilterCondition[]>([]);

    const handleSort = (key: keyof ExperimentResult) => setSortConfig(c => ({ key: key, direction: c.key === key && c.direction === 'desc' ? 'asc' : 'desc' }));
    
    const addFilter = (key: keyof ExperimentResult, value: string, labelPrefix: string) => {
        if (!filters.some(f => f.key === key && f.value === value)) {
            setFilters([...filters, { key: key, value, label: `${labelPrefix}: ${value}` }]);
        }
    };
    
    const removeFilter = (index: number) => setFilters(filters.filter((_, i) => i !== index));

    const processedData = useMemo(() => {
        let processed = [...data];
        
        // Search (Naive implementation assuming objects have string properties)
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            processed = processed.filter(item => 
                Object.values(item as any).some(val => String(val).toLowerCase().includes(lowerTerm))
            );
        }

        // Filter
        if (filters.length > 0) {
            processed = processed.filter(item => filters.every(cond => String((item as any)[cond.key]) === cond.value));
        }

        // Sort
        processed.sort((a, b) => {
            const av = (a as any)[sortConfig.key];
            const bv = (b as any)[sortConfig.key];
            if (av === undefined || bv === undefined) return 0;
            return av < bv ? (sortConfig.direction === 'asc' ? -1 : 1) : (sortConfig.direction === 'asc' ? 1 : -1);
        });

        return processed;
    }, [data, searchTerm, filters, sortConfig]);

    return { processedData, searchTerm, setSearchTerm, sortConfig, handleSort, filters, addFilter, removeFilter };
};

// --- 6. useNotification ---
export const useNotification = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setIsNotificationOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const addToast = (type: 'success' | 'error', title: string, message: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification: NotificationItem = {
            id, type, title, message, timestamp: Date.now(), read: false
        };

        setNotifications(prev => [newNotification, ...prev]);
        setToasts(prev => {
            const updated = [...prev, { id, type, title, message }];
            if (updated.length > 3) return updated.slice(updated.length - 3);
            return updated;
        });
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };

    const clearNotifications = () => setNotifications([]);

    return { toasts, notifications, isNotificationOpen, setIsNotificationOpen, notificationRef, addToast, clearNotifications };
};

// --- 7. useFileUploadTree ---
export const useFileUploadTree = (notify: (type: 'success' | 'error', title: string, message: string) => void) => {
    const [uploadStats, setUploadStats] = useState<{ count: number, sizeMB: number, tree: any, treeOpen: boolean }>({ count: 0, sizeMB: 0, tree: null, treeOpen: true });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const buildTreeFromProcessedFiles = (files: any[], fileCount: number, totalSize: number) => {
        const root: any = { name: 'root', children: {}, type: 'folder', size: 0 };
        files.forEach(file => {
            const parts = file.path.split('/').filter((p: string) => p.length > 0);
            let current = root;
            parts.forEach((part: string, index: number) => {
                if (index === parts.length - 1) current.children[part] = { name: part, type: 'file', size: file.size };
                else {
                    if (!current.children[part]) current.children[part] = { name: part, children: {}, type: 'folder', size: 0 };
                    current = current.children[part];
                }
            });
        });
        setUploadStats({ count: fileCount, sizeMB: parseFloat((totalSize / (1024 * 1024)).toFixed(2)), tree: root, treeOpen: true });
        const sizeMB = parseFloat((totalSize / (1024 * 1024)).toFixed(2));
        notify('success', '解析完了', `${fileCount}ファイルを解析しました。(${sizeMB}MB)`);
        return sizeMB; // Return size for updating state
    };

    const processFiles = async (fileList: File[]) => {
        const processedFiles: any[] = [];
        let totalSize = 0;
        let fileCount = 0;
        const JSZip = (window as any).JSZip;
        for (const file of fileList) {
            if (file.name.endsWith('.zip') && JSZip) {
                try {
                    const arrayBuffer = await new Promise<ArrayBuffer>((res, rej) => { const r = new FileReader(); r.onload = e => e.target?.result ? res(e.target.result as ArrayBuffer) : rej(); r.readAsArrayBuffer(file); });
                    const zip = new JSZip();
                    const zipContent = await zip.loadAsync(arrayBuffer);
                    const entries = Object.keys(zipContent.files).map(name => zipContent.files[name]);
                    for (const zipEntry of entries) {
                        if (!zipEntry.dir) {
                            const size = (zipEntry as any)._data?.uncompressedSize || 0;
                            processedFiles.push({ path: file.name + '/' + zipEntry.name, name: zipEntry.name.split('/').pop(), size: size });
                            totalSize += size; fileCount++;
                        }
                    }
                } catch { processedFiles.push({ path: file.name, name: file.name, size: file.size }); totalSize += file.size; fileCount++; }
            } else { processedFiles.push({ path: file.webkitRelativePath || file.name, name: file.name, size: file.size }); totalSize += file.size; fileCount++; }
        }
        return buildTreeFromProcessedFiles(processedFiles, fileCount, totalSize);
    };

    return { uploadStats, setUploadStats, fileInputRef, processFiles };
};

import React, { useState, useRef, useEffect } from 'react';
import { AllocatorStrategy, TransmitterStrategy, ExperimentConfig, UserAccount, ExperimentPreset, ExperimentScenario, ExperimentResult } from '../types';
import { 
    Settings2, Box, Upload, Database, Puzzle, Zap, List, CheckCircle2, AlertCircle, 
    PlayCircle, Bookmark, Save, RotateCcw, Loader2, X, ChevronDown, 
    FolderOpen, FileCode, Info, Lock, SlidersHorizontal,
    ArrowRight, ArrowLeft, Clock, ChevronUp, AlertTriangle, Terminal
} from 'lucide-react';

interface ExperimentLayerProps {
    users: UserAccount[];
    presets: ExperimentPreset[]; 
    deployedNodeCount: number;
    onRegisterResult: (result: ExperimentResult) => void;
    onSavePreset: (name: string, config: ExperimentConfig, generatorState?: any) => void;
    onDeletePreset?: (id: string) => void;
    notify: (type: 'success' | 'error', title: string, message: string) => void;
}

const ExperimentLayer: React.FC<ExperimentLayerProps> = ({ users, presets, deployedNodeCount, onRegisterResult, onSavePreset, onDeletePreset, notify }) => {
  
  // --- UI State ---
  const [mode, setMode] = useState<'virtual' | 'upload'>('virtual');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isResultsPanelOpen, setIsResultsPanelOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(320);

  // --- Form State ---
  const [projectName, setProjectName] = useState("複合パラメータテスト");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  
  // Parameters
  const [dataSizeParams, setDataSizeParams] = useState({ mode: 'fixed' as 'fixed'|'range', fixed: 500, start: 100, end: 500, step: 100 });
  const [chunkSizeParams, setChunkSizeParams] = useState({ mode: 'fixed' as 'fixed'|'range', fixed: 64, start: 32, end: 128, step: 32 });

  // Chain Selection
  const [selectedChains, setSelectedChains] = useState<Set<string>>(new Set());
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  const [chainVariation, setChainVariation] = useState<'fixed' | 'range'>('fixed');

  // Strategies
  const [selectedAllocators, setSelectedAllocators] = useState<Set<AllocatorStrategy>>(new Set([AllocatorStrategy.ROUND_ROBIN]));
  const [selectedTransmitters, setSelectedTransmitters] = useState<Set<TransmitterStrategy>>(new Set([TransmitterStrategy.ONE_BY_ONE]));

  // File Upload
  const [uploadStats, setUploadStats] = useState<{count: number, sizeMB: number, tree: any, treeOpen: boolean}>({ count: 0, sizeMB: 0, tree: null, treeOpen: true });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scenarios (Formerly Conditions)
  const [scenarios, setScenarios] = useState<ExperimentScenario[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecutionRunning, setIsExecutionRunning] = useState(false);

  // Preset Input
  const [newPresetName, setNewPresetName] = useState("");

  // Modals
  const [errorModal, setErrorModal] = useState<{isOpen: boolean, id: string, reason: string}>({isOpen: false, id: '', reason: ''});
  const [logModal, setLogModal] = useState<{isOpen: boolean, scenario: ExperimentScenario | null}>({isOpen: false, scenario: null});

  // Resize Logic
  const panelRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  // --- Initialization ---
  useEffect(() => {
      if (deployedNodeCount > 0 && selectedChains.size === 0) {
          const all = new Set<string>();
          for(let i=0; i<deployedNodeCount; i++) all.add(`datachain-${i}`);
          setSelectedChains(all);
      }
      if (users.length > 0 && !selectedUserId) {
          setSelectedUserId(users[0].id);
      }
  }, [deployedNodeCount, users]);

  // --- Resizer Handlers ---
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
          if (newHeight > 80 && newHeight < window.innerHeight * 0.8) {
              setPanelHeight(newHeight);
              if (!isResultsPanelOpen && newHeight > 100) {
                  setIsResultsPanelOpen(true);
              }
          }
      };

      const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          // Auto-close if too small
          if (panelRef.current && panelRef.current.clientHeight < 120) {
              setIsResultsPanelOpen(false);
          }
      };

      resizer.addEventListener('mousedown', handleMouseDown);
      return () => {
          resizer.removeEventListener('mousedown', handleMouseDown);
      };
  }, [isResultsPanelOpen]);

  // --- File Processing Logic (JSZip & Webkitdirectory) ---
  
  const buildTreeFromProcessedFiles = (files: any[], fileCount: number, totalSize: number) => {
      const root: any = { name: 'root', children: {}, type: 'folder', size: 0 };
      files.forEach(file => {
          const parts = file.path.split('/').filter((p: string) => p.length > 0);
          let current = root;

          parts.forEach((part: string, index: number) => {
              if (index === parts.length - 1) {
                  // File
                  current.children[part] = { name: part, type: 'file', size: file.size };
              } else {
                  // Folder
                  if (!current.children[part]) {
                      current.children[part] = { name: part, children: {}, type: 'folder', size: 0 };
                  }
                  current = current.children[part];
              }
          });
      });
      
      setUploadStats({
          count: fileCount,
          sizeMB: parseFloat((totalSize / (1024 * 1024)).toFixed(2)),
          tree: root,
          treeOpen: true
      });

      // Lock data size
      const sizeMB = parseFloat((totalSize / (1024 * 1024)).toFixed(2));
      setDataSizeParams(prev => ({ ...prev, mode: 'fixed', fixed: sizeMB }));
      notify('success', '解析完了', `${fileCount}ファイルを解析しました。(${sizeMB}MB)`);
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) resolve(e.target.result as ArrayBuffer);
            else reject(new Error("File read failed"));
        };
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async (fileList: File[]) => {
      const processedFiles: any[] = [];
      let totalSize = 0;
      let fileCount = 0;

      // Access JSZip from window
      const JSZip = (window as any).JSZip;

      for (const file of fileList) {
          if (file.name.endsWith('.zip') && JSZip) {
              try {
                  // Explicitly read file as ArrayBuffer to prevent permission issues
                  const arrayBuffer = await readFileAsArrayBuffer(file);
                  const zip = new JSZip();
                  const zipContent = await zip.loadAsync(arrayBuffer);
                  
                  // JSZip forEach is synchronous
                  zipContent.forEach((relativePath: string, zipEntry: any) => {
                      if (!zipEntry.dir) {
                          // Use internal _data.uncompressedSize if available (common in JSZip v3)
                          // or fallback to 0 if we cannot determine without full extraction
                          const size = zipEntry._data?.uncompressedSize || 0;
                          processedFiles.push({ 
                              path: file.name + '/' + relativePath, 
                              name: relativePath.split('/').pop(), 
                              size: size 
                          });
                          totalSize += size;
                          fileCount++;
                      }
                  });
              } catch (err) {
                  console.error("ZIP Error:", err);
                  notify('error', 'ZIP展開エラー', `ファイル ${file.name} の展開に失敗しました。単一ファイルとして扱います。`);
                  // Fallback to treating as single file
                  processedFiles.push({ path: file.name, name: file.name, size: file.size });
                  totalSize += file.size;
                  fileCount++;
              }
          } else {
              // Normal file or Folder via webkitdirectory
              processedFiles.push({ 
                  path: file.webkitRelativePath || file.name, 
                  name: file.name, 
                  size: file.size 
              });
              totalSize += file.size;
              fileCount++;
          }
      }
      buildTreeFromProcessedFiles(processedFiles, fileCount, totalSize);
  };

  // --- Recursive Tree Renderer (React) ---
  const renderTreeNodes = (node: any) => {
      const children = Object.values(node.children || {});
      return (
          <div className="pl-4 border-l-2 border-gray-100 mb-2">
              {node.name !== 'root' && node.type === 'folder' && (
                   <div className="flex items-center p-3 rounded-xl hover:bg-yellow-50 transition-colors cursor-default group mb-2">
                       <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-500 mr-4 flex-shrink-0 group-hover:bg-yellow-100 transition-colors">
                           <FolderOpen className="w-5 h-5" />
                       </div>
                       <span className="text-base font-bold text-gray-700 group-hover:text-yellow-700 transition-colors">{node.name}</span>
                   </div>
              )}
              {node.type === 'file' && (
                  <div className="group flex items-center justify-between p-3 mb-1 rounded-xl hover:bg-indigo-50 transition-colors cursor-default">
                       <div className="flex items-center overflow-hidden min-w-0">
                           <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mr-4 flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                               <FileCode className="w-5 h-5" />
                           </div>
                           <span className="text-base font-bold text-gray-700 truncate group-hover:text-primary-indigo transition-colors">{node.name}</span>
                       </div>
                       <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full ml-4 whitespace-nowrap group-hover:bg-white group-hover:text-indigo-400 transition-colors">
                           {(node.size/1024).toFixed(1)} KB
                       </span>
                  </div>
              )}
              <div className="pl-2">
                  {children.map((child: any, i) => (
                      <div key={i}>{renderTreeNodes(child)}</div>
                  ))}
              </div>
          </div>
      );
  };

  // --- Logic: Generate Scenarios ---
  const getRangeValues = (params: { mode: string, fixed: number, start: number, end: number, step: number }) => {
      if (params.mode === 'fixed') return [params.fixed];
      const res = [];
      for (let v = params.start; v <= params.end; v += (params.step || 1)) res.push(parseFloat(v.toFixed(2)));
      if (res.length === 0) res.push(params.start);
      return res;
  };

  const generateScenarios = async () => {
      setIsGenerating(true);
      setScenarios([]);
      
      const dataSizes = getRangeValues(dataSizeParams);
      const chunkSizes = getRangeValues(chunkSizeParams);
      const chainCount = selectedChains.size;
      const user = users.find(u => u.id === selectedUserId);
      const budget = user ? user.balance : 0;
      const timestamp = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const cleanName = projectName.replace(/[^a-zA-Z0-9_]/g, '') || 'Exp';

      const newScenarios: ExperimentScenario[] = [];
      let idCounter = 1;

      for(const ds of dataSizes) {
          for(const cs of chunkSizes) {
              for(const al of selectedAllocators) {
                  for(const tr of selectedTransmitters) {
                      newScenarios.push({
                          id: idCounter++,
                          uniqueId: `${cleanName}_${timestamp}_${String(idCounter).padStart(3,'0')}`,
                          dataSize: ds,
                          chunkSize: cs,
                          allocator: al,
                          transmitter: tr,
                          chains: chainCount,
                          targetChains: Array.from(selectedChains),
                          budgetLimit: budget,
                          cost: 0,
                          status: 'PENDING',
                          failReason: null,
                          progress: 0,
                          logs: []
                      });
                  }
              }
          }
      }

      setScenarios(newScenarios);
      setIsResultsPanelOpen(true);

      // Simulate Calculation
      const processed = [...newScenarios];
      for(const c of processed) {
          await new Promise(r => setTimeout(r, 50)); // Delay
          
          const cost = (c.dataSize * c.chunkSize * c.chains) / 1000; // Fake formula
          
          if (Math.random() < 0.1) {
              c.status = 'FAIL';
              c.failReason = 'System timeout: 一時的なシステムエラーが発生しました。';
              c.cost = cost;
          } else if (cost > c.budgetLimit * 0.8 && Math.random() < 0.3) {
              c.status = 'FAIL';
              c.failReason = `Insufficient balance: コスト (${cost.toFixed(2)} TKN) が予算 (${c.budgetLimit.toFixed(2)} TKN) を超える可能性があります。`;
              c.cost = cost;
          } else {
              c.status = 'READY';
              c.cost = parseFloat(cost.toFixed(2));
          }
          setScenarios([...processed]);
      }

      // Notification result
      const failedCount = processed.filter(s => s.status === 'FAIL').length;
      if (failedCount > 0) {
          notify('error', '試算完了', `${processed.length}件中 ${failedCount}件のエラーが発生しました。`);
      } else {
          notify('success', '試算完了', `${processed.length}件のシナリオを作成しました。`);
      }

      setIsGenerating(false);
  };

  const executeScenarios = async () => {
      setIsExecutionRunning(true);
      notify('success', '実行開始', '実行可能(READY)なシナリオの処理を開始します...');
      
      // Create a copy to mutate
      const currentScenarios = [...scenarios];
      let successCount = 0;
      let failedCount = 0;
      
      for(let i=0; i<currentScenarios.length; i++) {
          if(currentScenarios[i].status === 'READY') {
              currentScenarios[i].status = 'RUNNING';
              currentScenarios[i].logs.push('[INFO] Experiment Started.');
              setScenarios([...currentScenarios]);
              
              // Simulation
              await new Promise(r => setTimeout(r, 500));
              
              const success = Math.random() > 0.1;
              currentScenarios[i].status = success ? 'COMPLETE' : 'FAIL';
              currentScenarios[i].logs.push(success ? '[SUCCESS] Completed.' : '[ERROR] Connection Lost.');
              if (!success) {
                  currentScenarios[i].failReason = 'Connection error: 実行中にネットワーク接続が切れました。';
                  failedCount++;
                  notify('error', '実行エラー', `ID: ${currentScenarios[i].id} が失敗しました。`);
              } else {
                  successCount++;
                  notify('success', '実行完了', `ID: ${currentScenarios[i].id} が成功しました。`);
              }
              
              setScenarios([...currentScenarios]);

              if (success) {
                  // Register result
                   const result: ExperimentResult = {
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
                  };
                  onRegisterResult(result);
              }
          }
      }
      
      if (failedCount > 0) {
           notify('error', '一括実行完了', `${successCount}件成功, ${failedCount}件失敗`);
      } else {
           notify('success', '一括実行完了', `全${successCount}件のシナリオが正常に完了しました。`);
      }
      setIsExecutionRunning(false);
  };

  const reprocessScenario = async (id: number) => {
      setScenarios(prev => prev.map(c => c.id === id ? { ...c, status: 'PENDING', failReason: null, cost: 0 } : c));
      notify('success', '再試算', `ID: ${id} の再試算を開始します`);
      // Simulate single process
      setTimeout(() => {
          setScenarios(prev => prev.map(c => {
              if(c.id !== id) return c;
              const cost = (c.dataSize * c.chunkSize * c.chains) / 1000;
              return { ...c, status: 'READY', cost: parseFloat(cost.toFixed(2)) };
          }));
      }, 500);
  };

  // --- Preset Management ---
  const handleSave = () => {
      if (!newPresetName) { notify('error', 'エラー', 'プリセット名を入力してください'); return; }
      
      const generatorState = {
          projectName,
          accountValue: selectedUserId,
          dataSize: dataSizeParams,
          chunkSize: chunkSizeParams,
          allocators: Array.from(selectedAllocators),
          transmitters: Array.from(selectedTransmitters),
          selectedChains: Array.from(selectedChains),
          uploadType: mode === 'virtual' ? 'Virtual' : 'Real'
      };

      const config: ExperimentConfig = {
          allocator: Array.from(selectedAllocators)[0],
          transmitter: Array.from(selectedTransmitters)[0],
          targetChains: Array.from(selectedChains),
          uploadType: mode === 'virtual' ? 'Virtual' : 'Real',
          projectName,
          userId: selectedUserId,
          virtualConfig: { sizeMB: dataSizeParams.fixed, chunkSizeKB: chunkSizeParams.fixed, files: 1 }
      };

      onSavePreset(newPresetName, config, generatorState);
      setNewPresetName("");
  };

  const loadPreset = (s: ExperimentPreset) => {
      if (s.generatorState) {
          const gs = s.generatorState;
          setProjectName(gs.projectName);
          setSelectedUserId(gs.accountValue);
          setDataSizeParams(gs.dataSize);
          setChunkSizeParams(gs.chunkSize);
          setSelectedAllocators(new Set(gs.allocators as AllocatorStrategy[]));
          setSelectedTransmitters(new Set(gs.transmitters as TransmitterStrategy[]));
          const validChains = new Set<string>(gs.selectedChains.filter((c: string) => {
            // Basic check to ensure chain exists in current deployment
            const idx = parseInt(c.split('-')[1]);
            return !isNaN(idx) && idx < deployedNodeCount;
          }));
          setSelectedChains(validChains);
          setMode(gs.uploadType === 'Virtual' ? 'virtual' : 'upload');
      }
      notify('success', 'ロード完了', `プリセット "${s.name}" を読み込みました`);
  };

  const selectedUser = users.find(u => u.id === selectedUserId);
  const successCount = scenarios.filter(c => ['READY', 'RUNNING', 'COMPLETE'].includes(c.status)).length;
  const failCount = scenarios.filter(c => c.status === 'FAIL').length;
  const totalCost = scenarios.reduce((acc, c) => acc + c.cost, 0).toFixed(2);

  return (
    <div className="flex h-full w-full overflow-hidden relative bg-gray-100">
        
        {/* Main Content */}
        <div className={`flex-1 flex flex-col h-full min-w-0 transition-all duration-300 relative z-10 ${isSidebarOpen ? 'mr-96' : 'mr-0'}`}>
            
            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 pb-32 custom-scrollbar">
                
                {/* 1. Basic Settings */}
                <section className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden mb-6">
                    <div className="bg-white px-6 py-5 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center tracking-tight">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mr-3 text-primary-indigo">
                                <SlidersHorizontal className="w-5 h-5" />
                            </div>
                            基本設定
                        </h2>
                        <div className="bg-gray-100 p-1.5 rounded-xl flex text-sm font-bold">
                            <button onClick={() => setMode('virtual')} className={`px-5 py-2 rounded-lg transition-all flex items-center gap-2 ${mode === 'virtual' ? 'bg-white shadow-sm text-primary-indigo' : 'text-gray-500 hover:text-gray-700'}`}>
                                <Box className="w-4 h-4" /> 仮想データ
                            </button>
                            <button onClick={() => setMode('upload')} className={`px-5 py-2 rounded-lg transition-all flex items-center gap-2 ${mode === 'upload' ? 'bg-white shadow-sm text-primary-indigo' : 'text-gray-500 hover:text-gray-700'}`}>
                                <Upload className="w-4 h-4" /> アップロード
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        {mode === 'virtual' ? (
                             <div className="flex items-start bg-blue-50 p-6 rounded-2xl border border-blue-100 animate-fade-in">
                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4 shrink-0">
                                    <Info className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-blue-900 mb-1">仮想データ生成モード</h3>
                                    <p className="text-base text-blue-700 leading-relaxed opacity-90">
                                        ランダムなバイナリデータを動的に生成して実験を行います。物理的なファイルの準備は不要です。
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <div 
                                    className={`upload-area rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer mb-6 group relative ${uploadStats.count > 0 ? 'border-primary-indigo' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('drag-active'); }}
                                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('drag-active'); }}
                                    onDrop={(e) => { 
                                        e.preventDefault(); 
                                        e.stopPropagation(); 
                                        e.currentTarget.classList.remove('drag-active'); 
                                        if(e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); 
                                    }}
                                >
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        multiple 
                                        onChange={e => e.target.files && processFiles(Array.from(e.target.files))} 
                                        {...({webkitdirectory: ""} as any)} 
                                    />
                                    <div className="bg-white w-20 h-20 rounded-full shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300 flex items-center justify-center pointer-events-none text-primary-indigo">
                                        <Upload className="w-8 h-8" />
                                    </div>
                                    <p className="text-xl font-bold text-gray-700 pointer-events-none">フォルダまたはファイルをドロップ</p>
                                    <p className="text-sm text-gray-400 mt-2 pointer-events-none font-medium">※自動で構造解析されます (ZIP対応)</p>
                                </div>

                                {uploadStats.tree && (
                                    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden ring-4 ring-gray-50 transition-all">
                                        <div 
                                            className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur cursor-pointer hover:bg-gray-50"
                                            onClick={() => setUploadStats(p => ({...p, treeOpen: !p.treeOpen}))}
                                        >
                                            <div className="flex items-center">
                                                <div className="w-2 h-6 bg-primary-indigo rounded-full mr-3"></div>
                                                <span className="text-lg font-bold text-gray-700">解析されたディレクトリ構造</span>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <span className="text-sm font-bold bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full border border-indigo-100">
                                                    {uploadStats.count} Files, {uploadStats.sizeMB} MB
                                                </span>
                                                <ChevronUp className={`w-5 h-5 text-gray-400 transition-transform ${uploadStats.treeOpen ? '' : 'rotate-180'}`} />
                                            </div>
                                        </div>
                                        {uploadStats.treeOpen && (
                                            <div className="p-4 font-sans overflow-y-auto max-h-80 custom-scrollbar">
                                                {renderTreeNodes(uploadStats.tree)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* 2. Experiment Parameters */}
                <section className="bg-white rounded-3xl shadow-soft border border-gray-100 mb-8">
                    <div className="bg-white px-6 py-5 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center tracking-tight">
                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mr-3 text-primary-green">
                                <Settings2 className="w-5 h-5" />
                            </div>
                            実験条件パラメータ
                        </h2>
                    </div>

                    <div className="p-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-base font-bold text-gray-700 mb-2 ml-1">プロジェクト名</label>
                                <input 
                                    type="text" 
                                    value={projectName}
                                    onChange={e => setProjectName(e.target.value)}
                                    className="block w-full rounded-xl border-gray-200 bg-gray-50 p-3.5 focus:ring-2 focus:ring-primary-indigo focus:bg-white outline-none transition-all text-base font-medium shadow-sm"
                                />
                            </div>
                            <div className="relative">
                                <label className="block text-base font-bold text-gray-700 mb-2 ml-1">実行アカウント</label>
                                <div 
                                    onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                                    className="block w-full rounded-xl border border-gray-200 bg-white p-3.5 pr-8 cursor-pointer relative shadow-sm hover:border-primary-indigo transition-colors"
                                >
                                    <span className="block truncate text-gray-700 font-medium">
                                        {selectedUser ? `${selectedUser.name} (${selectedUser.balance.toFixed(2)} TKN)` : 'アカウントを選択...'}
                                    </span>
                                    <ChevronDown className="absolute right-3 top-4 w-4 h-4 text-gray-400" />
                                </div>
                                {isAccountDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                                        {users.map(u => (
                                            <div 
                                                key={u.id} 
                                                onClick={() => { setSelectedUserId(u.id); setIsAccountDropdownOpen(false); }}
                                                className={`px-4 py-2 cursor-pointer hover:bg-gray-50 ${selectedUserId === u.id ? 'bg-indigo-50 text-primary-indigo' : ''}`}
                                            >
                                                <div className="font-bold">{u.name}</div>
                                                <div className="text-xs font-mono opacity-70">{u.balance.toFixed(2)} TKN</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center ml-1">
                                <Database className="w-4 h-4 mr-2" /> 数値設定
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                {/* Data Size */}
                                <div className={`bg-gray-50 p-5 rounded-2xl border transition-colors ${mode === 'upload' ? 'border-orange-200 bg-orange-50' : 'border-gray-200 hover:border-primary-indigo/30'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="font-bold text-gray-700 text-base">データサイズ (MB)</label>
                                        <label className="inline-flex items-center text-xs cursor-pointer bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                                            <input 
                                                type="checkbox" 
                                                checked={dataSizeParams.mode === 'range'} 
                                                disabled={mode === 'upload'}
                                                onChange={e => setDataSizeParams(p => ({...p, mode: e.target.checked ? 'range' : 'fixed'}))}
                                                className="text-primary-indigo rounded focus:ring-0"
                                            />
                                            <span className="ml-1 text-gray-500 font-medium">範囲指定</span>
                                        </label>
                                    </div>
                                    {dataSizeParams.mode === 'fixed' ? (
                                        <input type="number" value={dataSizeParams.fixed} disabled={mode === 'upload'} onChange={e => setDataSizeParams(p => ({...p, fixed: Number(e.target.value)}))} className="param-input block w-full rounded-lg border-gray-200 border p-2.5 focus:border-primary-indigo outline-none text-right font-mono text-lg font-bold" />
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="number" value={dataSizeParams.start} onChange={e => setDataSizeParams(p => ({...p, start: Number(e.target.value)}))} className="param-input border border-gray-200 rounded-lg p-2 text-sm font-mono text-right" placeholder="Start" />
                                            <input type="number" value={dataSizeParams.end} onChange={e => setDataSizeParams(p => ({...p, end: Number(e.target.value)}))} className="param-input border border-gray-200 rounded-lg p-2 text-sm font-mono text-right" placeholder="End" />
                                            <input type="number" value={dataSizeParams.step} onChange={e => setDataSizeParams(p => ({...p, step: Number(e.target.value)}))} className="param-input border border-gray-200 rounded-lg p-2 text-sm font-mono text-right" placeholder="Step" />
                                        </div>
                                    )}
                                    {mode === 'upload' && <p className="text-xs text-orange-500 mt-2 font-bold flex items-center justify-end"><Lock className="w-3 h-3 mr-1" />アップロード時は固定</p>}
                                </div>

                                {/* Chunk Size */}
                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 transition-colors hover:border-primary-indigo/30">
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="font-bold text-gray-700 text-base">チャンクサイズ (KB)</label>
                                        <label className="inline-flex items-center text-xs cursor-pointer bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                                            <input type="checkbox" checked={chunkSizeParams.mode === 'range'} onChange={e => setChunkSizeParams(p => ({...p, mode: e.target.checked ? 'range' : 'fixed'}))} className="text-primary-indigo rounded focus:ring-0" />
                                            <span className="ml-1 text-gray-500 font-medium">範囲指定</span>
                                        </label>
                                    </div>
                                    {chunkSizeParams.mode === 'fixed' ? (
                                        <input type="number" value={chunkSizeParams.fixed} onChange={e => setChunkSizeParams(p => ({...p, fixed: Number(e.target.value)}))} className="param-input block w-full rounded-lg border-gray-200 border p-2.5 focus:border-primary-indigo outline-none text-right font-mono text-lg font-bold" />
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="number" value={chunkSizeParams.start} onChange={e => setChunkSizeParams(p => ({...p, start: Number(e.target.value)}))} className="param-input border border-gray-200 rounded-lg p-2 text-sm font-mono text-right" />
                                            <input type="number" value={chunkSizeParams.end} onChange={e => setChunkSizeParams(p => ({...p, end: Number(e.target.value)}))} className="param-input border border-gray-200 rounded-lg p-2 text-sm font-mono text-right" />
                                            <input type="number" value={chunkSizeParams.step} onChange={e => setChunkSizeParams(p => ({...p, step: Number(e.target.value)}))} className="param-input border border-gray-200 rounded-lg p-2 text-sm font-mono text-right" />
                                        </div>
                                    )}
                                </div>

                                {/* Data Chains */}
                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 transition-colors hover:border-primary-indigo/30">
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="font-bold text-gray-700 text-base">Datachain</label>
                                        <span className="text-xs bg-primary-indigo text-white px-2 py-0.5 rounded-full font-bold shadow-sm">{selectedChains.size}</span>
                                    </div>
                                    <div className="relative">
                                        <button 
                                            onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                                            className="w-full text-left bg-white border border-gray-200 rounded-lg p-2.5 text-sm flex justify-between items-center hover:bg-gray-50 shadow-sm"
                                        >
                                            <span className="text-gray-600 font-medium">チェーンを選択...</span>
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                        {isChainDropdownOpen && (
                                            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-3">
                                                <div className="flex justify-end space-x-3 mb-3 border-b border-gray-100 pb-2">
                                                    <button onClick={() => { const s = new Set<string>(); for(let i=0; i<deployedNodeCount; i++) s.add(`datachain-${i}`); setSelectedChains(s); }} className="text-xs font-bold text-primary-indigo hover:bg-indigo-50 px-2 py-1 rounded">All</button>
                                                    <button onClick={() => setSelectedChains(new Set())} className="text-xs font-bold text-gray-500 hover:bg-gray-100 px-2 py-1 rounded">None</button>
                                                </div>
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                                    {Array.from({length: deployedNodeCount}).map((_, i) => `datachain-${i}`).map(id => (
                                                        <label key={id} className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedChains.has(id)} 
                                                                onChange={() => {
                                                                    const newSet = new Set(selectedChains);
                                                                    if(newSet.has(id)) newSet.delete(id); else newSet.add(id);
                                                                    setSelectedChains(newSet);
                                                                }}
                                                                className="rounded text-primary-indigo w-4 h-4 focus:ring-0" 
                                                            />
                                                            <span className="ml-3 text-sm font-bold text-gray-700">{id}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 text-xs text-gray-500 flex items-center font-medium justify-end">
                                        <label className="flex items-center cursor-pointer hover:text-gray-700">
                                            <input type="radio" checked={chainVariation === 'fixed'} onChange={() => setChainVariation('fixed')} className="mr-1.5 text-primary-indigo" /> 固定
                                        </label>
                                        <label className="flex items-center cursor-pointer ml-4 hover:text-gray-700">
                                            <input type="radio" checked={chainVariation === 'range'} onChange={() => setChainVariation('range')} className="mr-1.5 text-primary-indigo" /> 1~Nで変動
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center ml-1">
                                    <Zap className="w-4 h-4 mr-2" /> 配布・送信戦略
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide ml-1">Allocator Strategy</label>
                                        <div className="space-y-4">
                                            {Object.values(AllocatorStrategy).map(s => (
                                                <div 
                                                    key={s} 
                                                    onClick={() => {
                                                        const newSet = new Set(selectedAllocators);
                                                        if(newSet.has(s)) { if(newSet.size > 1) newSet.delete(s); } else newSet.add(s);
                                                        setSelectedAllocators(newSet);
                                                    }}
                                                    className={`rounded-2xl p-5 relative border-2 transition-all cursor-pointer ${selectedAllocators.has(s) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'}`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-bold text-gray-800 text-base">{s}</div>
                                                            <div className="text-xs font-medium text-gray-400 mt-1">Algorithm</div>
                                                        </div>
                                                        {selectedAllocators.has(s) && <CheckCircle2 className="w-6 h-6 text-primary-indigo" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide ml-1">Transmitter Strategy</label>
                                        <div className="space-y-4">
                                            {Object.values(TransmitterStrategy).map(s => (
                                                <div 
                                                    key={s} 
                                                    onClick={() => {
                                                        const newSet = new Set(selectedTransmitters);
                                                        if(newSet.has(s)) { if(newSet.size > 1) newSet.delete(s); } else newSet.add(s);
                                                        setSelectedTransmitters(newSet);
                                                    }}
                                                    className={`rounded-2xl p-5 relative border-2 transition-all cursor-pointer ${selectedTransmitters.has(s) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'}`}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-bold text-gray-800 text-base">{s}</div>
                                                            <div className="text-xs font-medium text-gray-400 mt-1">Method</div>
                                                        </div>
                                                        {selectedTransmitters.has(s) && <CheckCircle2 className="w-6 h-6 text-primary-indigo" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 pb-2">
                                <button 
                                    onClick={generateScenarios} 
                                    disabled={isGenerating}
                                    className="w-full bg-primary-green hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-emerald-200 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center text-xl tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGenerating ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Zap className="w-6 h-6 mr-3" />}
                                    シナリオを作成
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Bottom Panel (Results) */}
            <div 
                ref={panelRef}
                className={`absolute bottom-0 left-0 right-0 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30 rounded-t-[2rem] border-t border-gray-100 flex flex-col transition-all duration-300 ${isResultsPanelOpen ? '' : 'h-16 overflow-hidden'}`}
                style={{ height: isResultsPanelOpen ? panelHeight : '60px' }}
            >
                {/* Resizer */}
                <div ref={resizerRef} className="absolute top-0 left-0 right-0 h-4 w-full cursor-row-resize z-50 group flex justify-center items-center">
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full group-hover:bg-primary-indigo transition-colors"></div>
                </div>

                {/* Header */}
                <div 
                    className="px-8 py-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-[2rem] cursor-pointer hover:bg-gray-50 transition-colors relative z-40"
                    onClick={() => setIsResultsPanelOpen(!isResultsPanelOpen)}
                >
                    <div className="flex items-center">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center tracking-tight">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mr-3 text-primary-indigo">
                                <List className="w-5 h-5" />
                            </div>
                            生成結果 (シナリオ)
                            <span className="ml-3 bg-primary-indigo text-white text-sm font-bold px-2.5 py-0.5 rounded-full shadow-sm shadow-indigo-200">{scenarios.length}</span>
                        </h2>
                        <div className="text-base text-gray-600 ml-8 font-medium">
                            総コスト試算: <span className="font-mono font-bold text-gray-900 text-lg">{totalCost}</span> TKN
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                        <ChevronUp className={`w-5 h-5 transition-transform ${isResultsPanelOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {/* Controls */}
                <div className="px-8 py-3 bg-indigo-50/50 border-b border-indigo-50 flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center space-x-8 text-sm">
                        <div className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            <span className="font-bold text-lg">{successCount}</span>
                            <span className="text-xs text-green-700 font-bold ml-1.5 uppercase">Ready/Success</span>
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <div className="flex items-center text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            <span className="font-bold text-lg">{failCount}</span>
                            <span className="text-xs text-red-700 font-bold ml-1.5 uppercase">Fail</span>
                        </div>
                    </div>
                    <button 
                        onClick={executeScenarios}
                        disabled={scenarios.length === 0 || isExecutionRunning || successCount === 0}
                        className="bg-gray-300 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm transition-all text-base flex items-center disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transform active:scale-95 data-[ready=true]:bg-primary-indigo data-[ready=true]:hover:bg-indigo-700"
                        data-ready={successCount > 0 && !isExecutionRunning}
                    >
                        {isExecutionRunning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <PlayCircle className="w-5 h-5 mr-2" />}
                        実行
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gray-50/50">
                    {scenarios.map(c => {
                        let border = 'border-gray-200';
                        let bg = 'bg-white';
                        let statusIcon = <Loader2 className="w-5 h-5 animate-spin text-status-process" />;
                        let statusText = <span className="text-status-process font-bold">PENDING</span>;

                        if (c.status === 'READY') {
                            border = 'border-status-ready';
                            statusIcon = <CheckCircle2 className="w-5 h-5 text-status-ready" />;
                            statusText = <span className="text-status-ready font-bold">{c.cost.toFixed(2)} TKN</span>;
                        } else if (c.status === 'RUNNING') {
                            border = 'border-status-process';
                            statusIcon = <Loader2 className="w-5 h-5 animate-spin text-status-process" />;
                            statusText = <span className="text-status-process font-bold">RUNNING</span>;
                        } else if (c.status === 'COMPLETE') {
                            border = 'border-status-success';
                            statusIcon = <CheckCircle2 className="w-5 h-5 text-status-success" />;
                            statusText = <span className="text-status-success font-bold">COMPLETE</span>;
                        } else if (c.status === 'FAIL') {
                            border = 'border-status-fail';
                            bg = 'bg-red-50/30';
                            statusIcon = <AlertCircle className="w-5 h-5 text-status-fail" />;
                            statusText = (
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setErrorModal({isOpen: true, id: c.uniqueId, reason: c.failReason || ''}); }}
                                        className="text-status-fail font-bold hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center text-xs"
                                    >
                                        <AlertTriangle className="w-4 h-4 mr-1" /> ERROR
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); reprocessScenario(c.id); }}
                                        className="bg-white text-status-fail border border-status-fail hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-1" /> 再試算
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <div 
                                key={c.uniqueId} 
                                onClick={() => setLogModal({isOpen: true, scenario: c})}
                                className={`p-4 rounded-2xl shadow-sm border-l-4 flex justify-between items-center hover:shadow-md transition-all cursor-pointer mb-1 ${bg} ${border.replace('border-l-4', 'border-l-status-' + c.status.toLowerCase())}`}
                                style={{ borderLeftColor: c.status === 'READY' ? '#1e3a8a' : c.status === 'FAIL' ? '#ef4444' : c.status === 'COMPLETE' ? '#22c55e' : '#eab308' }}
                            >
                                <div className="flex items-center space-x-5 flex-1">
                                    <div className="text-center w-10 shrink-0">
                                        <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Seq</span>
                                        <span className="font-black text-gray-700 text-lg">{c.id}</span>
                                    </div>
                                    <div className="text-sm overflow-hidden">
                                        <div className="font-mono text-xs font-bold text-gray-400 truncate mb-1 opacity-70">{c.uniqueId}</div>
                                        <div className="font-bold text-gray-800 text-base">Size: {c.dataSize}MB / Chunk: {c.chunkSize}KB</div>
                                        <div className="text-gray-500 text-xs mt-1 font-medium flex gap-2">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{c.allocator}</span>
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{c.transmitter}</span>
                                            <span className="text-gray-400">|</span>
                                            <span>Chains: {c.chains}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-2">
                                    {statusText}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Sidebar Toggle Button */}
            <button 
                onClick={() => setIsSidebarOpen(true)} 
                className={`absolute top-4 right-0 bg-white border border-gray-200 shadow-lg rounded-l-xl p-3 text-scenario-accent hover:bg-orange-50 transition-all z-20 ${isSidebarOpen ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'}`}
            >
                <ArrowLeft className="w-5 h-5" />
            </button>

        </div>

        {/* Sidebar */}
        <div className={`fixed right-0 top-16 bottom-0 w-96 bg-gray-100 z-20 transition-transform duration-300 shadow-sidebar flex flex-col ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-full py-4 pl-4 pr-4 flex flex-col w-full">
                <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl h-full flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-50 bg-white flex justify-between items-center shrink-0">
                        <h2 className="font-bold text-gray-700 flex items-center text-lg">
                            <Bookmark className="w-6 h-6 mr-2 text-scenario-accent" />
                            プリセット管理
                        </h2>
                        <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Save Form */}
                    <div className="p-4 border-b border-gray-50 bg-white shrink-0">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newPresetName}
                                onChange={e => setNewPresetName(e.target.value)}
                                placeholder="プリセット名..." 
                                className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:border-scenario-accent focus:ring-2 focus:ring-orange-100 focus:bg-white outline-none transition-all font-medium"
                            />
                            <button onClick={handleSave} className="bg-scenario-accent hover:bg-orange-600 text-white rounded-xl px-3.5 py-2.5 shadow-md shadow-orange-100 transition-colors flex items-center justify-center min-w-[44px]">
                                <Save className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 custom-scrollbar space-y-3">
                        {presets.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                    <FolderOpen className="w-8 h-8" />
                                </div>
                                <p className="text-sm text-gray-400 font-medium">保存されたプリセットはありません</p>
                            </div>
                        ) : (
                            presets.map(s => {
                                const gs = s.generatorState;
                                let dataLabel = "N/A";
                                let chunkLabel = "N/A";
                                if (gs) {
                                    dataLabel = gs.dataSize.mode === 'range' ? `${gs.dataSize.start}-${gs.dataSize.end}MB` : `${gs.dataSize.fixed}MB`;
                                    chunkLabel = gs.chunkSize.mode === 'range' ? 'Range' : `${gs.chunkSize.fixed}KB`;
                                }

                                return (
                                    <div key={s.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative cursor-default">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-gray-800 text-base truncate w-full pr-8">{s.name}</h3>
                                            {onDeletePreset && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDeletePreset(s.id); }}
                                                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full p-1 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center text-xs text-gray-400 mb-3 font-medium">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {new Date(s.lastModified).toLocaleDateString()}
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <div className="flex items-center text-xs font-bold text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                                                <Database className="w-3 h-3 mr-1.5 text-blue-400" />{dataLabel}
                                            </div>
                                            <div className="flex items-center text-xs font-bold text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                                                <Puzzle className="w-3 h-3 mr-1.5 text-purple-400" />{chunkLabel}
                                            </div>
                                        </div>

                                        <button onClick={() => loadPreset(s)} className="w-full bg-white border-2 border-scenario-accent text-scenario-accent text-sm font-bold py-2.5 rounded-xl hover:bg-scenario-accent hover:text-white transition-all flex items-center justify-center group/btn">
                                            <RotateCcw className="w-4 h-4 mr-2 group-hover/btn:rotate-180 transition-transform" /> 適用する
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Error Modal */}
        {errorModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/20" onClick={() => setErrorModal(p => ({...p, isOpen: false}))}>
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 ring-4 ring-white/50 animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center border-b border-gray-100 pb-4 mb-6">
                        <div className="bg-red-50 p-3 rounded-full mr-4 text-status-fail"><AlertCircle className="w-8 h-8" /></div>
                        <h3 className="text-xl font-bold text-gray-800">エラー詳細</h3>
                    </div>
                    <div className="mb-8">
                        <p className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wide">ID: {errorModal.id}</p>
                        <p className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Reason</p>
                        <p className="text-red-600 font-medium bg-red-50 p-4 rounded-xl border border-red-100 text-base leading-relaxed shadow-sm">{errorModal.reason}</p>
                    </div>
                    <div className="flex justify-end">
                        <button onClick={() => setErrorModal(p => ({...p, isOpen: false}))} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">閉じる</button>
                    </div>
                </div>
            </div>
        )}

        {/* Log Modal */}
        {logModal.isOpen && logModal.scenario && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/20" onClick={() => setLogModal(p => ({...p, isOpen: false}))}>
                <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col ring-4 ring-white/50 animate-fade-in" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-3xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                                <Terminal className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">実行ログ</h3>
                                <p className="text-xs text-gray-400 font-mono">{logModal.scenario.uniqueId}</p>
                            </div>
                        </div>
                        <button onClick={() => setLogModal(p => ({...p, isOpen: false}))} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                    <div className="flex-1 bg-slate-900 p-6 overflow-y-auto font-mono text-sm text-slate-300 custom-scrollbar">
                        {logModal.scenario.logs.length === 0 ? (
                            <div className="text-slate-600 italic">No logs available yet...</div>
                        ) : (
                            logModal.scenario.logs.map((line, i) => (
                                <div key={i} className="mb-1 border-l-2 border-slate-700 pl-3 hover:bg-slate-800/50 hover:border-blue-50 transition-colors">
                                    <span className="text-slate-500 text-xs mr-3">{new Date().toLocaleTimeString()}</span>
                                    {line}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ExperimentLayer;

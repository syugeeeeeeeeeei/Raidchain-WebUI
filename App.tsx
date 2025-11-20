import React, { useState, useRef } from 'react';
import { AppLayer, UserAccount, ExperimentResult, ActiveExperimentState, ExperimentConfig, ExperimentScenario } from './types';
import { NAV_ITEMS } from './constants';
import { generateMockUsers, generateMockResults, generateMockScenarios } from './services/mockData';
import MonitoringLayer from './layers/MonitoringLayer';
import DeploymentLayer from './layers/DeploymentLayer';
import EconomyLayer from './layers/EconomyLayer';
import ExperimentLayer from './layers/ExperimentLayer';
import LibraryLayer from './layers/LibraryLayer';
import { LayoutDashboard, Bell, CheckCircle, AlertTriangle, X } from 'lucide-react';

// Toast Notification Type
interface Toast {
  id: string;
  type: 'success' | 'error';
  title: string;
  message: string;
}

const App: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<AppLayer>(AppLayer.MONITORING);

  // --- Global State: Economy ---
  const [users, setUsers] = useState<UserAccount[]>(generateMockUsers());

  // --- Global State: Library ---
  const [results, setResults] = useState<ExperimentResult[]>(generateMockResults());

  // --- Global State: Scenarios ---
  const [scenarios, setScenarios] = useState<ExperimentScenario[]>(generateMockScenarios());

  // --- Global State: Infrastructure ---
  const [deployedNodeCount, setDeployedNodeCount] = useState<number>(5);
  const [isDockerBuilt, setIsDockerBuilt] = useState<boolean>(false);

  // --- Global State: Active Experiment ---
  const [experimentState, setExperimentState] = useState<ActiveExperimentState>({
    isRunning: false,
    progress: 0,
    logs: [],
    statusMessage: "",
    config: null,
    startTime: null,
  });

  // Experiment Logic Ref (to hold interval ID)
  const experimentInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Global State: Toast Notifications ---
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: 'success' | 'error', title: string, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // --- Handlers ---
  
  const handleCreateUser = () => {
    const newUser: UserAccount = {
      id: `u${Date.now()}`,
      address: `raid1${Math.random().toString(36).substring(7)}...`,
      balance: 0,
      role: 'client'
    };
    setUsers([...users, newUser]);
  };

  const handleFaucet = (id: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, balance: u.balance + 1000 } : u));
  };

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  const handleSaveScenario = (name: string, config: ExperimentConfig) => {
      const existingIndex = scenarios.findIndex(s => s.name === name);
      const newScenario: ExperimentScenario = {
          id: existingIndex >= 0 ? scenarios[existingIndex].id : crypto.randomUUID(),
          name,
          config,
          lastModified: new Date().toISOString()
      };

      if (existingIndex >= 0) {
          const next = [...scenarios];
          next[existingIndex] = newScenario;
          setScenarios(next);
          addToast('success', '保存完了', `シナリオ "${name}" を更新しました。`);
      } else {
          setScenarios([...scenarios, newScenario]);
          addToast('success', '保存完了', `新しいシナリオ "${name}" を保存しました。`);
      }
  };

  // --- Experiment Logic ---
  const startExperiment = (config: ExperimentConfig, scenarioName: string, estimatedCost: number) => {
    if (experimentState.isRunning) return;

    // 1. Deduct Cost
    const userId = config.userId;
    if (!userId) return;
    
    setUsers(prev => prev.map(u => {
        if (u.id === userId) {
            return { ...u, balance: u.balance - estimatedCost };
        }
        return u;
    }));

    addToast('success', 'デポジット完了', `アカウントから ${estimatedCost.toLocaleString()} TKN を引き落としました。`);

    // 2. Reset state for new run
    setExperimentState({
      isRunning: true,
      progress: 0,
      logs: [`[System] Initializing experiment: ${scenarioName}...`],
      statusMessage: "Initializing...",
      config: config,
      startTime: Date.now(),
    });

    let p = 0;
    const startTime = Date.now();
    const shouldFail = config.shouldFail || false;
    const failAt = 65; // Fail at 65% if scheduled

    experimentInterval.current = setInterval(() => {
      p += 1;
      
      // Log generation based on progress
      const newLogs: string[] = [];
      const time = new Date().toLocaleTimeString('ja-JP');
      
      if (p === 5) newLogs.push(`[${time}] Splitting data into ${config.virtualConfig?.chunkSizeKB}KB chunks...`);
      if (p === 20) newLogs.push(`[${time}] Generating transactions... Strategy: ${config.allocator}`);
      if (p === 40) newLogs.push(`[${time}] Broadcasting to ${config.targetChains.length} chains...`);
      
      // Error Simulation
      if (shouldFail && p === failAt) {
        clearInterval(experimentInterval.current!);
        const failLogs = [...newLogs, `[${time}] [ERROR] Transaction broadcast timeout on data-2.`, `[${time}] [FATAL] Experiment aborted due to network error.`];
        
        setExperimentState(prev => ({
          ...prev,
          isRunning: false,
          progress: p,
          logs: [...prev.logs, ...failLogs],
          statusMessage: "エラー: 実験が中断されました",
        }));

        // Fail Cost Logic (Partial refund maybe? Let's keep it simple: minimal refund on fail)
        const actualCost = Math.floor(estimatedCost * 0.8); // Consumed 80% before fail
        const refund = estimatedCost - actualCost;
        
        if (refund > 0) {
             setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: u.balance + refund } : u));
        }

        addToast('error', '実験失敗', `エラーにより中断。コスト: ${actualCost} TKN (返金: ${refund} TKN)`);
        
        // Save Failed Result
        saveResult(scenarioName, 'FAILED', config, startTime, Date.now());
        return;
      }

      if (p === 90) newLogs.push(`[${time}] Verifying manifest on MetaChain...`);

      // Update State
      setExperimentState(prev => ({
        ...prev,
        progress: p,
        logs: [...prev.logs, ...newLogs],
        statusMessage: p < 100 ? "実行中..." : "完了",
      }));

      // Completion
      if (p >= 100) {
        clearInterval(experimentInterval.current!);
        const successLogs = [`[${time}] Experiment finished successfully.`];
        
        setExperimentState(prev => ({
          ...prev,
          isRunning: false,
          progress: 100,
          logs: [...prev.logs, ...successLogs],
          statusMessage: "正常完了",
        }));

        // Success Refund Logic
        const actualCost = Math.floor(estimatedCost * 0.9); // Actual is slightly less than estimate
        const refund = estimatedCost - actualCost;

        if (refund > 0) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: u.balance + refund } : u));
        }

        addToast('success', '実験完了', `正常完了。コスト: ${actualCost} TKN (返金: ${refund} TKN)`);
        
        // Save Success Result
        saveResult(scenarioName, 'SUCCESS', config, startTime, Date.now());
      }
    }, 80); // Speed of simulation
  };

  const saveResult = (
    name: string, 
    status: 'SUCCESS' | 'FAILED', 
    config: ExperimentConfig, 
    start: number, 
    end: number
  ) => {
    const sizeMB = config.virtualConfig?.sizeMB || 0;
    const duration = end - start;
    // Simulate random throughput based on success/fail
    const throughput = status === 'SUCCESS' ? (sizeMB * 1024 * 1024 * 8) / (duration / 1000) : 0;
    
    const result: ExperimentResult = {
      id: crypto.randomUUID().slice(0, 8),
      scenarioName: name || "Untitled Scenario",
      executedAt: new Date().toISOString(),
      status: status,
      dataSizeMB: sizeMB,
      chunkSizeKB: config.virtualConfig?.chunkSizeKB || 64,
      totalTxCount: Math.floor((sizeMB * 1024) / 64) + 2, // Approx calc
      allocator: config.allocator,
      transmitter: config.transmitter,
      targetChainCount: config.targetChains.length,
      usedChains: config.targetChains,
      uploadTimeMs: Math.floor(duration * 0.7), // Mock breakdown
      downloadTimeMs: Math.floor(duration * 0.3), // Mock breakdown
      throughputBps: throughput,
    };

    setResults(prev => [result, ...prev]);
  };

  // --- Layer Rendering ---
  const renderLayer = () => {
    switch (activeLayer) {
      case AppLayer.MONITORING: 
        return <MonitoringLayer deployedNodeCount={deployedNodeCount} />;
      case AppLayer.DEPLOYMENT: 
        return <DeploymentLayer 
            setDeployedNodeCount={setDeployedNodeCount} 
            deployedNodeCount={deployedNodeCount}
            setIsDockerBuilt={setIsDockerBuilt}
            isDockerBuilt={isDockerBuilt}
        />;
      case AppLayer.ECONOMY: 
        return <EconomyLayer 
          users={users} 
          onCreateUser={handleCreateUser} 
          onDeleteUser={handleDeleteUser} 
          onFaucet={handleFaucet} 
        />;
      case AppLayer.EXPERIMENT: 
        return <ExperimentLayer 
          activeExperiment={experimentState}
          users={users}
          scenarios={scenarios}
          deployedNodeCount={deployedNodeCount}
          onRunExperiment={startExperiment}
          onSaveScenario={handleSaveScenario}
          notify={addToast}
        />;
      case AppLayer.LIBRARY: 
        return <LibraryLayer results={results} />;
      default: 
        return <MonitoringLayer deployedNodeCount={deployedNodeCount} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      
      {/* Toast Notifications Container */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`flex items-start gap-3 p-4 rounded-lg shadow-xl border transition-all duration-500 transform translate-x-0 ${
              toast.type === 'success' 
                ? 'bg-white border-l-4 border-l-emerald-500 text-slate-800' 
                : 'bg-white border-l-4 border-l-red-500 text-slate-800'
            }`}
          >
             <div className={`mt-0.5 ${toast.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
               {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
             </div>
             <div className="min-w-[200px]">
               <h4 className="font-bold text-sm">{toast.title}</h4>
               <p className="text-xs text-slate-500 mt-1">{toast.message}</p>
             </div>
             <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-slate-400 hover:text-slate-600">
               <X className="w-4 h-4" />
             </button>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20 shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/50">
              <LayoutDashboard className="w-5 h-5 text-white" />
           </div>
           <div>
             <h1 className="font-bold text-lg tracking-tight">RaidChain</h1>
             <p className="text-xs text-slate-400">WebUI Controller v2.0</p>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeLayer === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveLayer(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                <div className="text-left">
                  <div className={`text-sm font-medium ${isActive ? 'text-white' : ''}`}>{item.label}</div>
                  <div className={`text-[10px] ${isActive ? 'text-blue-200' : 'text-slate-600'}`}>{item.subLabel}</div>
                </div>
                {/* Running indicator in nav */}
                {item.id === AppLayer.EXPERIMENT && experimentState.isRunning && (
                   <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-3">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
             <div className="text-xs text-slate-300">
                System Status: <span className="text-emerald-400 font-bold">Online</span>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
           <div>
             <h2 className="text-xl font-bold text-slate-800">
                {NAV_ITEMS.find(n => n.id === activeLayer)?.label} Layer
             </h2>
           </div>
           <div className="flex items-center gap-4">
              {experimentState.isRunning && (
                 <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-blue-700">実験実行中... {experimentState.progress}%</span>
                 </div>
              )}
              <button className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-slate-50">
                 <Bell className="w-5 h-5" />
                 {toasts.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
              </button>
           </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
            <div className="max-w-7xl mx-auto">
               {renderLayer()}
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;
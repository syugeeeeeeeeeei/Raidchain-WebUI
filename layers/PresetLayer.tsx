
import React, { useState } from 'react';
import { ExperimentPreset } from '../types';
import { Trash2, FileText, Clock, Settings2, X, Database, Puzzle } from 'lucide-react';

interface PresetLayerProps {
    presets: ExperimentPreset[];
    onDeletePreset: (id: string) => void;
}

const PresetLayer: React.FC<PresetLayerProps> = ({ presets, onDeletePreset }) => {
    const [selectedPreset, setSelectedPreset] = useState<ExperimentPreset | null>(null);

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('本当にこのプリセットを削除しますか？')) {
            onDeletePreset(id);
            if (selectedPreset?.id === id) {
                setSelectedPreset(null);
            }
        }
    };

    // Helper to safely get size string
    const getSizeDisplay = (preset: ExperimentPreset) => {
        if (preset.generatorState) {
            const { mode, fixed, start, end } = preset.generatorState.dataSize;
            return mode === 'range' ? `${start}-${end}MB` : `${fixed}MB`;
        }
        return `${preset.config.virtualConfig?.sizeMB || 0}MB`;
    };

    // Helper for badge abbreviation
    const getStrategyBadge = (s: string) => {
        const map: {[key: string]: string} = {
            'RoundRobin': 'RR',
            'LeastBusy': 'LB',
            'Random': 'Rnd',
            'Available': 'Av',
            'Hash': 'Hash',
            'OneByOne': '1x1',
            'MultiBurst': 'Burst'
        };
        return map[s] || s.substring(0, 3);
    };

    // Helper to safely get chain count
    const getChainCount = (preset: ExperimentPreset) => {
        if (preset.generatorState) {
            return preset.generatorState.selectedChains.length;
        }
        return preset.config.targetChains.length;
    };

    return (
        <div className="h-full flex gap-8">
            {/* List Section */}
            <div className="flex-1 flex flex-col space-y-8 overflow-hidden">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                             <Settings2 className="w-6 h-6" />
                        </div>
                        保存済みプリセット一覧
                    </h2>
                    <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{presets.length} Presets</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {presets.length === 0 ? (
                        <div className="col-span-full text-center p-16 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <div className="mb-2 font-bold text-lg">No Presets Found</div>
                            <p>保存されたプリセットはありません。実験画面からプリセットを保存してください。</p>
                        </div>
                    ) : (
                        presets.map(preset => (
                            <div 
                                key={preset.id}
                                onClick={() => setSelectedPreset(preset)}
                                className={`bg-white p-5 rounded-xl border transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1 group h-fit ${
                                    selectedPreset?.id === preset.id 
                                    ? 'border-blue-500 ring-2 ring-blue-100 shadow-md' 
                                    : 'border-slate-200 shadow-sm'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            selectedPreset?.id === preset.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-lg ${selectedPreset?.id === preset.id ? 'text-blue-700' : 'text-slate-800'}`}>
                                                {preset.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                {new Date(preset.lastModified).toLocaleString('ja-JP')}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(e, preset.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="削除"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                {/* Config Summary Badges */}
                                <div className="flex flex-wrap gap-2 mt-4 pl-1">
                                    <div className="flex items-center text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                        <Database className="w-3 h-3 mr-1.5 text-blue-500"/>
                                        {getSizeDisplay(preset)}
                                    </div>
                                    <div className="flex items-center text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                        <Puzzle className="w-3 h-3 mr-1.5 text-purple-500"/>
                                        {preset.generatorState ? (preset.generatorState.chunkSize.mode === 'range' ? 'Range' : `${preset.generatorState.chunkSize.fixed}KB`) : `${preset.config.virtualConfig?.chunkSizeKB}KB`}
                                    </div>
                                    <div className="flex items-center text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                        {getChainCount(preset)} Chains
                                    </div>
                                </div>

                                {/* Strategy Badges */}
                                {preset.generatorState && (
                                    <div className="flex flex-wrap gap-1.5 mt-3 pl-1">
                                        {preset.generatorState.allocators.map((a: string) => (
                                            <span key={a} className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-600 rounded border border-indigo-100">{getStrategyBadge(a)}</span>
                                        ))}
                                        <span className="text-gray-300 text-xs py-0.5">|</span>
                                        {preset.generatorState.transmitters.map((t: string) => (
                                            <span key={t} className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 rounded border border-blue-100">{getStrategyBadge(t)}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Detail Panel (Right Side) */}
            <div className={`w-[450px] bg-white border-l border-slate-200 shadow-2xl transition-all duration-300 flex flex-col fixed right-0 top-16 bottom-0 z-20 ${
                selectedPreset ? 'translate-x-0' : 'translate-x-full'
            }`}>
                {selectedPreset && (
                    <>
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Selected Preset</div>
                                <h3 className="font-bold text-xl text-slate-800">{selectedPreset.name}</h3>
                            </div>
                            <button onClick={() => setSelectedPreset(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-8">
                            
                            <div className="space-y-6">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <Settings2 className="w-4 h-4 text-blue-500"/>
                                    設定詳細
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Allocator</div>
                                        <div className="font-mono font-bold text-slate-700">
                                            {selectedPreset.config.allocator}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <div className="text-slate-500 text-xs font-bold uppercase mb-1">Transmitter</div>
                                        <div className="font-mono font-bold text-slate-700">
                                            {selectedPreset.config.transmitter}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="text-slate-500 text-xs mb-2 font-bold uppercase">Upload Type</div>
                                    <div className="font-mono bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2 text-sm font-bold text-slate-700">
                                        {selectedPreset.config.uploadType} Mode
                                    </div>
                                </div>

                                {selectedPreset.config.uploadType === 'Virtual' && selectedPreset.config.virtualConfig && (
                                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-3">
                                        <div className="text-xs font-bold text-blue-600 mb-2 uppercase">仮想データ設定</div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-blue-800">サイズ</span>
                                            <span className="font-mono font-bold">{getSizeDisplay(selectedPreset)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-blue-800">チャンク</span>
                                            <span className="font-mono font-bold">{selectedPreset.config.virtualConfig.chunkSizeKB} KB</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-blue-800">ファイル数</span>
                                            <span className="font-mono font-bold">{selectedPreset.config.virtualConfig.files}</span>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="text-slate-500 text-xs mb-2 font-bold uppercase">Target Chains</div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedPreset.config.targetChains.map(chain => (
                                            <span key={chain} className="px-3 py-1 bg-white text-slate-600 text-xs rounded-lg border border-slate-200 font-mono shadow-sm">
                                                {chain}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PresetLayer;

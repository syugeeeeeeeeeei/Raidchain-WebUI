import React, { useState } from 'react';
import { ExperimentResult } from '../types';
import { Download, Filter, Search, FileText, AlertTriangle, CheckCircle, Clock, X, Database, Server, Network } from 'lucide-react';

interface LibraryLayerProps {
    results: ExperimentResult[];
}

const LibraryLayer: React.FC<LibraryLayerProps> = ({ results }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedResult, setSelectedResult] = useState<ExperimentResult | null>(null);

  const filteredResults = results.filter(r => 
      r.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Formatter helper
  const fmtBytes = (mb: number) => `${mb.toLocaleString()} MB`;
  const fmtTime = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  const fmtSpeed = (bps: number) => `${(bps / 1024 / 1024).toFixed(2)} Mbps`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
        
        {/* Detail Modal */}
        {selectedResult && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${selectedResult.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                {selectedResult.status === 'SUCCESS' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">{selectedResult.scenarioName}</h3>
                                <div className="text-xs text-slate-500 font-mono">ID: {selectedResult.id}</div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedResult(null)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            
                            {/* Section 1: Basic Info */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">基本情報</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-slate-500">実行日時</div>
                                        <div className="font-mono">{new Date(selectedResult.executedAt).toLocaleString('ja-JP')}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500">ステータス</div>
                                        <div className={`font-bold ${selectedResult.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-600'}`}>{selectedResult.status}</div>
                                    </div>
                                </div>
                            </div>

                             {/* Section 2: Scenario Config */}
                             <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">シナリオ設定</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 flex items-center gap-2"><Database className="w-3 h-3"/> データサイズ</span>
                                        <span className="font-mono">{fmtBytes(selectedResult.dataSizeMB)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 flex items-center gap-2"><Network className="w-3 h-3"/> チャンクサイズ</span>
                                        <span className="font-mono">{selectedResult.chunkSizeKB} KB</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">総Tx数</span>
                                        <span className="font-mono">{selectedResult.totalTxCount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Allocator</span>
                                        <span>{selectedResult.allocator}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Transmitter</span>
                                        <span>{selectedResult.transmitter}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Infrastructure Usage */}
                            <div className="space-y-4 md:col-span-2">
                                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">インフラ使用状況</h4>
                                <div className="text-sm mb-2">
                                    <span className="text-slate-500">使用したDataChain数: </span>
                                    <span className="font-bold text-slate-800">{selectedResult.targetChainCount}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedResult.usedChains.map(chain => (
                                        <span key={chain} className="px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200 text-xs font-mono flex items-center gap-1">
                                            <Server className="w-3 h-3" />
                                            {chain}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Section 4: Performance */}
                            <div className="space-y-4 md:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    パフォーマンス指標
                                </h4>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">アップロード時間</div>
                                        <div className="font-mono font-bold text-lg">{fmtTime(selectedResult.uploadTimeMs)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">ダウンロード時間</div>
                                        <div className="font-mono font-bold text-lg">{fmtTime(selectedResult.downloadTimeMs)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 mb-1">スループット</div>
                                        <div className="font-mono font-bold text-lg text-blue-600">{fmtSpeed(selectedResult.throughputBps)}</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="シナリオ名またはIDで検索..." 
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                    <Filter className="w-4 h-4" />
                    フィルター
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                    <Download className="w-4 h-4" />
                    CSV出力
                </button>
            </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-3">実行ID / 日時</th>
                        <th className="px-6 py-3">シナリオ名</th>
                        <th className="px-6 py-3">ステータス</th>
                        <th className="px-6 py-3">戦略</th>
                        <th className="px-6 py-3 text-right">データサイズ</th>
                        <th className="px-6 py-3 text-right">スループット</th>
                        <th className="px-6 py-3">詳細</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredResults.map(r => (
                        <tr key={r.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="font-mono font-medium text-slate-700">{r.id}</div>
                                <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" />
                                    {new Date(r.executedAt).toLocaleString('ja-JP')}
                                </div>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800">{r.scenarioName}</td>
                            <td className="px-6 py-4">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                    r.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' :
                                    r.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                                }`}>
                                    {r.status === 'SUCCESS' ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                    {r.status}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs">
                                {r.allocator} / {r.transmitter}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-slate-600">
                                {fmtBytes(r.dataSizeMB)}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-800">
                                {fmtSpeed(r.throughputBps)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <button 
                                    onClick={() => setSelectedResult(r)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-full"
                                >
                                    <FileText className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {filteredResults.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                    結果が見つかりません。まずは実験を実行してください。
                </div>
            )}
        </div>
    </div>
  );
};

export default LibraryLayer;
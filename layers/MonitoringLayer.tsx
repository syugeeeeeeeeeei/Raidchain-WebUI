import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import TopologyGraph from '../components/TopologyGraph';
import { generateMockNodes } from '../services/mockData';
import { NodeStatus } from '../types';
import { Activity, Box, Network, Zap } from 'lucide-react';
import { Card, Badge, StatusBadge, PageHeader, TableStyles } from '../components/Shared';

interface MonitoringLayerProps {
    deployedNodeCount: number;
}

/**
 * Monitoring Layer
 * 
 * ブロックチェーンネットワークの健全性、トポロジー、トランザクション負荷をリアルタイムで監視する画面。
 * 視覚的なフィードバック（グラフやバッジ）を多用し、異常を即座に検知できるようにしています。
 */
const MonitoringLayer: React.FC<MonitoringLayerProps> = ({ deployedNodeCount }) => {
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [mempoolData, setMempoolData] = useState<any[]>([]);

  // モックデータの定期更新エフェクト
  useEffect(() => {
    setNodes(generateMockNodes(deployedNodeCount));
    const interval = setInterval(() => {
      // Mempoolデータのランダム変動シミュレーション
      setMempoolData(prev => {
        if (prev.length !== deployedNodeCount) {
            return Array.from({ length: deployedNodeCount }, (_, i) => ({ name: `data-${i}`, txs: Math.floor(Math.random() * 200) }));
        }
        return prev.map(item => ({ ...item, txs: Math.max(0, item.txs + (Math.random() > 0.5 ? 10 : -20) + Math.floor(Math.random() * 10)) }));
      });

      // ノード状態（ブロック高など）の更新シミュレーション
      setNodes(currentNodes => {
          if (currentNodes.length !== 2 + deployedNodeCount) return generateMockNodes(deployedNodeCount);
          return currentNodes.map(n => ({
              ...n,
              height: n.height + (Math.random() > 0.8 ? 1 : 0),
              txCount: Math.floor(Math.random() * 50)
          }));
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [deployedNodeCount]);

  return (
    <div className="space-y-8 pb-20">
      {/* ヘッダー部分: 画面の役割を明示 */}
      <PageHeader 
        title="Network Monitoring" 
        description="リアルタイムのネットワークトポロジーとノードの状態監視" 
        icon={Activity}
        iconColor="text-blue-500"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* トポロジーマップ: 視覚的にネットワーク構造を把握する */}
          <div className="lg:col-span-2 space-y-6">
              <Card className="p-1 overflow-hidden bg-slate-900 border-slate-800 shadow-xl">
                  <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                      <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
                          <Network className="w-4 h-4 text-blue-400" /> Topology Map
                      </h3>
                      <Badge color="green" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          Active Nodes: {nodes.filter(n => n.status === 'active').length}
                      </Badge>
                  </div>
                  <div className="p-4 bg-slate-900/50">
                    <TopologyGraph nodes={nodes} />
                  </div>
              </Card>
          </div>

          {/* Mempoolグラフ: 負荷状況の可視化 */}
          <div className="space-y-6">
              <Card className="p-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Zap className="w-5 h-5" /></div>
                      <div>
                        <h3 className="font-bold text-slate-800">Mempool Status</h3>
                        <p className="text-xs text-slate-500">Pending Transactions</p>
                      </div>
                  </div>
                  
                  <div className="flex-1 min-h-[200px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={mempoolData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} interval={0} />
                              <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                              <Tooltip 
                                cursor={{fill: '#f8fafc'}} 
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                              />
                              <Bar dataKey="txs" radius={[4, 4, 0, 0]}>
                                  {mempoolData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.txs > 150 ? '#ef4444' : '#3b82f6'} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
                      各DataChainにおける未処理TXの滞留数
                  </div>
              </Card>
          </div>
      </div>

      {/* ノード一覧テーブル: 詳細情報の表示 */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-800 px-2 flex items-center gap-2">
            <Box className="w-5 h-5 text-slate-400"/> Node Registry
        </h3>
        <div className={TableStyles.Container}>
            <table className="w-full text-left">
                <thead className={TableStyles.Header}>
                    <tr>
                        <th className="px-6 py-4">Chain ID</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Block Height</th>
                        <th className="px-6 py-4 text-right">Latency</th>
                    </tr>
                </thead>
                <tbody>
                    {nodes.map((node) => (
                        <tr key={node.id} className={TableStyles.Row}>
                            <td className={TableStyles.Cell}>
                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-xs">
                                    {node.id}
                                </span>
                            </td>
                            <td className={TableStyles.Cell}>
                                <Badge color={node.type === 'control' ? 'blue' : node.type === 'meta' ? 'indigo' : 'slate'}>
                                    {node.type}
                                </Badge>
                            </td>
                            <td className={TableStyles.Cell}><StatusBadge status={node.status} /></td>
                            <td className={TableStyles.Cell}>
                                <div className="flex justify-end items-center gap-2 font-mono text-slate-600">
                                    <Box className="w-3 h-3 text-slate-300" />
                                    {node.height.toLocaleString()}
                                </div>
                            </td>
                            <td className={TableStyles.Cell}>
                                <div className="text-right font-mono text-slate-500">
                                    <span className={`font-bold ${node.latency > 50 ? 'text-orange-500' : 'text-emerald-500'}`}>
                                        {node.latency}
                                    </span> ms
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default MonitoringLayer;
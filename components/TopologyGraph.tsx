
import React, { useMemo, useState, useEffect } from 'react';
import { NodeStatus, PacketEvent } from '../types';
import { Server, Database, Cpu } from 'lucide-react';
import { useWebSocket } from '../hooks';

interface TopologyGraphProps {
  nodes: NodeStatus[];
}

/**
 * Network Topology Visualization
 * 
 * Event-driven animation powered by Mock WebSocket events.
 */
const TopologyGraph: React.FC<TopologyGraphProps> = ({ nodes }) => {
  const controlNode = nodes.find(n => n.type === 'control');
  const metaNode = nodes.find(n => n.type === 'meta');
  const dataNodes = nodes.filter(n => n.type === 'data');

  // --- Animation State ---
  const [inflightPackets, setInflightPackets] = useState<PacketEvent[]>([]);
  const [nodeFlash, setNodeFlash] = useState<{[id: string]: boolean}>({});

  // Listen for packet events
  useWebSocket<PacketEvent>('/ws/monitoring/packets', (packet) => {
      setInflightPackets(prev => [...prev, packet]);
      // Remove packet after animation duration (1.5s) and trigger flash
      setTimeout(() => {
          setInflightPackets(current => current.filter(p => p.id !== packet.id));
          setNodeFlash(prev => ({ ...prev, [packet.to]: true }));
          setTimeout(() => setNodeFlash(prev => ({ ...prev, [packet.to]: false })), 300);
      }, 1500);
  });

  // --- Layout Constants ---
  const nodeSpacing = 160; 
  const baseWidth = 1000;
  const height = 450;
  
  const canvasWidth = useMemo(() => Math.max(dataNodes.length * nodeSpacing + 200, baseWidth), [dataNodes.length]);
  const controlPos = { x: canvasWidth / 2, y: 80 };
  const metaPos = { x: canvasWidth / 2 + 250, y: 100 };
  
  const dataNodePositions = useMemo(() => {
    const count = dataNodes.length;
    const totalWidth = (count - 1) * nodeSpacing;
    const startX = canvasWidth / 2 - totalWidth / 2;
    return dataNodes.map((node, i) => ({
        ...node,
        x: startX + i * nodeSpacing,
        y: 350
    }));
  }, [dataNodes, canvasWidth]);

  // Helper to find coordinates by node ID
  const getNodePos = (id: string) => {
      if (id === 'control-chain') return controlPos;
      if (id === 'meta-chain') return metaPos;
      const dataNode = dataNodePositions.find(n => n.id === id);
      return dataNode ? { x: dataNode.x, y: dataNode.y } : null;
  };

  const drawOrthogonalLine = (x1: number, y1: number, x2: number, y2: number, midYRatio: number = 0.5) => {
      const midY = y1 + (y2 - y1) * midYRatio; 
      return `M ${x1},${y1} L ${x1},${midY} L ${x2},${midY} L ${x2},${y2}`;
  };

  const drawDirectLine = (x1: number, y1: number, x2: number, y2: number) => `M ${x1},${y1} L ${x2},${y2}`;

  return (
    <div className="relative min-w-full min-h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
      <div className="absolute top-4 left-4 text-slate-400 text-sm font-mono z-10 pointer-events-none">
        Network Topology (Live)<br/>
        <span className="text-[10px] opacity-70">Real-time IBC Packet Visualization</span>
      </div>
      
      <svg 
          width={canvasWidth}
          height={height}
          viewBox={`0 0 ${canvasWidth} ${height}`} 
          className="select-none"
          style={{ minWidth: canvasWidth }}
      >
          <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
          </defs>

          {/* Static Links */}
          {dataNodePositions.map((dn, i) => (
              <path 
                  key={`link-${dn.id}`}
                  d={drawOrthogonalLine(controlPos.x, controlPos.y + 50, dn.x, dn.y - 45, 0.4 + (i % 2) * 0.1)} 
                  fill="none"
                  stroke="#334155"
                  strokeWidth="2"
                  strokeDasharray="5,5"
              />
          ))}
          <path d={drawDirectLine(controlPos.x + 60, controlPos.y, metaPos.x - 50, metaPos.y)} fill="none" stroke="#6366f1" strokeWidth="3" />

          {/* Dynamic Packet Animation */}
          {inflightPackets.map(pkt => {
              const start = getNodePos(pkt.from);
              const end = getNodePos(pkt.to);
              if (!start || !end) return null;
              // Adjust connection points roughly
              const sy = start.y + 50; 
              const ey = end.y - 45;
              const path = drawOrthogonalLine(start.x, sy, end.x, ey, 0.5);
              
              return (
                  <circle key={pkt.id} r="4" fill="#60a5fa">
                      <animateMotion dur="1.5s" repeatCount="1" path={path} fill="freeze" />
                  </circle>
              );
          })}

          {/* Nodes */}
          <foreignObject x={controlPos.x - 60} y={controlPos.y - 50} width="120" height="100">
              <div className="flex flex-col items-center justify-center">
                  <div className="text-[10px] text-blue-300 mb-1 font-mono">Orchestrator</div>
                  <div className={`w-20 h-20 rounded-xl bg-blue-900/90 border-2 ${controlNode?.status === 'active' ? 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'border-red-500'} flex items-center justify-center mb-2 backdrop-blur-sm z-20 relative`}>
                       <Server className="w-10 h-10 text-blue-200" />
                  </div>
                  <span className="text-blue-100 font-bold text-sm bg-slate-900/80 px-3 py-1 rounded-full border border-blue-900/50">ControlChain</span>
              </div>
          </foreignObject>

          <foreignObject x={metaPos.x - 50} y={metaPos.y - 40} width="100" height="100">
              <div className="flex flex-col items-center justify-center">
                   <div className="text-[10px] text-indigo-300 mb-1 font-mono">Registry</div>
                  <div className={`w-16 h-16 rounded-full bg-indigo-900/90 border-2 ${metaNode?.status === 'active' ? 'border-indigo-400' : 'border-red-500'} flex items-center justify-center mb-2 backdrop-blur-sm z-20`}>
                       <Cpu className="w-8 h-8 text-indigo-200" />
                  </div>
                  <span className="text-indigo-200 font-bold text-xs bg-slate-900/80 px-3 py-1 rounded-full border border-indigo-900/50">MetaChain</span>
              </div>
          </foreignObject>

          {dataNodePositions.map((node) => (
              <foreignObject key={node.id} x={node.x - 50} y={node.y - 50} width="100" height="100">
                  <div className={`flex flex-col items-center justify-center transition-transform duration-100 ${nodeFlash[node.id] ? 'scale-110' : ''}`}>
                      <div className="w-2 h-2 bg-slate-500 rounded-full mb-1 opacity-50"></div>
                      <div className={`w-14 h-14 rounded-lg bg-slate-800 border-2 ${nodeFlash[node.id] ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.8)] bg-slate-700' : node.status === 'active' ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-red-500'} flex items-center justify-center mb-2 transition-all duration-200`}>
                          <Database className={`w-7 h-7 ${nodeFlash[node.id] ? 'text-white' : node.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`} />
                      </div>
                      <span className="text-slate-300 font-mono text-[10px] bg-slate-900/90 px-2 py-0.5 rounded whitespace-nowrap border border-slate-700">
                          {node.id}
                      </span>
                      <div className="flex items-center gap-1 mt-1">
                           <span className={`w-1.5 h-1.5 rounded-full ${node.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                           <span className="text-[9px] text-slate-500">H:{node.height}</span>
                      </div>
                  </div>
              </foreignObject>
          ))}

      </svg>
    </div>
  );
};

export default TopologyGraph;

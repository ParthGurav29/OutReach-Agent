import React, { useEffect, useRef } from 'react';

export function TerminalPanel({ logs }) {
  const containerRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getColor = (line) => {
    if (line.startsWith('[→]')) return 'text-orange-400';
    if (line.startsWith('[⚡]')) return 'text-blue-400';
    if (line.startsWith('[~]')) return 'text-white';
    if (line.startsWith('[✓]')) return 'text-green-400';
    if (line.startsWith('[!]')) return 'text-yellow-400';
    if (line.startsWith('[✗]')) return 'text-red-400';
    return 'text-slate-300';
  };

  return (
    <div className="bg-black/90 rounded-xl overflow-hidden border border-slate-700 shadow-2xl h-[calc(100vh-12rem)] flex flex-col">
      {/* Terminal Header */}
      <div className="bg-slate-800/80 px-4 py-2 flex gap-2 items-center border-b border-slate-700">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
        <div className="w-3 h-3 rounded-full bg-green-500"></div>
        <span className="text-xs font-mono text-slate-400 ml-2 border border-slate-700 px-2 rounded-full">
          Agent Terminal
        </span>
      </div>
      
      {/* Logs Body */}
      <div 
        ref={containerRef}
        className="p-4 font-mono text-xs md:text-sm whitespace-pre-wrap overflow-y-auto flex-1 leading-relaxed selection:bg-indigo-500/50 scroll-smooth"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 animate-pulse">Waiting for commands...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`mb-1 relative pl-6 ${getColor(log)} break-words`}>
              <span className="absolute left-0 opacity-40 select-none text-[10px] mt-[3px]">
                {String(i + 1).padStart(3, '0')}
              </span>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';

export function TerminalPanel({ logs, isSearching }) {
  const containerRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isSearching]);

  const getColor = (line) => {
    if (line.startsWith('[→]')) return 'text-[#7D8590]';
    if (line.startsWith('[⚡]')) return 'text-[#FF9900]';
    if (line.startsWith('[~]')) return 'text-[#E6EDF3]';
    if (line.startsWith('[✓]')) return 'text-[#3FB950]';
    if (line.startsWith('[!]')) return 'text-[#D29922]';
    if (line.startsWith('[✗]')) return 'text-[#F85149]';
    return 'text-[#7D8590]';
  };

  return (
    <div className="bg-[#0D1117] rounded-xl overflow-hidden border border-[#30363D] shadow-2xl h-[280px] flex flex-col transition-all">
      {/* Terminal Header */}
      <div className="bg-[#161B22] px-4 py-2 flex gap-2 items-center border-b border-[#30363D]">
        <div className={`w-2.5 h-2.5 rounded-full dot-red${isSearching ? ' animate-traffic' : ''}`} style={{ opacity: isSearching ? undefined : 0.2 }}></div>
        <div className={`w-2.5 h-2.5 rounded-full dot-yellow${isSearching ? ' animate-traffic' : ''}`} style={{ opacity: isSearching ? undefined : 0.2 }}></div>
        <div className={`w-2.5 h-2.5 rounded-full dot-green${isSearching ? ' animate-traffic' : ''}`} style={{ opacity: isSearching ? undefined : 0.2 }}></div>
        <span className="text-[10px] font-mono text-[#7D8590] ml-2 border border-[#30363D] px-2 py-0.5 rounded-full uppercase tracking-widest bg-[#0D1117]">
          Live Pipeline Logs
        </span>
      </div>
      
      {/* Logs Body */}
      <div 
        ref={containerRef}
        className="p-4 font-mono text-[10px] whitespace-pre-wrap overflow-y-auto flex-1 leading-relaxed selection:bg-[#FF9900]/20 scroll-smooth"
      >
        {logs.length === 0 && !isSearching ? (
          <div className="text-[#30363D] italic uppercase tracking-tighter">System Idle. Waiting for input...</div>
        ) : (
          <>
            {logs.map((log, i) => (
              <div key={i} className={`mb-1 relative pl-8 ${getColor(log)} break-words font-medium`}>
                <span className="absolute left-0 opacity-10 select-none text-[8px] mt-[2px] text-[#E6EDF3]">
                  {String(i + 1).padStart(4, '0')}
                </span>
                {log}
              </div>
            ))}
            
            {isSearching && (
              <div className="mt-4 flex items-center gap-3 pl-8 bg-[#1a1000]/50 py-2 rounded-r-lg border-l-2 border-[#FF9900]">
                <span className="text-[10px] text-[#FF9900] font-black uppercase tracking-[0.2em]">Agent calculating</span>
                <div className="flex gap-1.5 mt-0.5">
                  <div className="w-1 h-1 bg-[#FF9900] rounded-full animate-pulse-dot dot-1"></div>
                  <div className="w-1 h-1 bg-[#FF9900] rounded-full animate-pulse-dot dot-2"></div>
                  <div className="w-1 h-1 bg-[#FF9900] rounded-full animate-pulse-dot"></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

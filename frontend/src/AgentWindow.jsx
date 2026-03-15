import { useEffect, useRef } from "react";

export default function AgentWindow({ logs = [] }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getLogColor = (log) => {
    if (log.includes("⚠️") || log.includes("❌") || log.includes("Failed")) return "#ef4444";
    if (log.includes("✅") || log.includes("📩") || log.includes("Connected")) return "#10b981";
    if (log.includes("🔍") || log.includes("🔎") || log.includes("Warming")) return "#60a5fa";
    if (log.includes("⏳") || log.includes("📅") || log.includes("queued")) return "#f59e0b";
    if (log.includes("🚀") || log.includes("▶") || log.includes("Launch")) return "#a78bfa";
    if (log.includes("📊") || log.includes("🎯")) return "#fb923c";
    return "#e2e8f0";
  };

  const getPrefix = (log) => {
    const t = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return t;
  };

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #21262d",
        boxShadow: "0 0 0 1px #30363d, 0 8px 24px rgba(0,0,0,0.4)",
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "24px",
      }}
    >
      {/* Terminal chrome */}
      <div
        style={{
          background: "#161b22",
          borderBottom: "1px solid #21262d",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e", display: "inline-block" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
        <span style={{
          marginLeft: "12px", fontSize: "12px", color: "#8b949e",
          fontFamily: "'Fira Code', 'Courier New', monospace", fontWeight: 500
        }}>
          outreach-agent — bash
        </span>
        <span style={{
          marginLeft: "auto",
          display: "inline-flex", alignItems: "center", gap: "6px",
          fontSize: "11px", color: "#3fb950", fontWeight: 600,
          fontFamily: "Inter, sans-serif"
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#3fb950",
            animation: "agentPulse 1.2s ease-in-out infinite", display: "inline-block"
          }} />
          LIVE
        </span>
      </div>

      {/* Log body */}
      <div
        style={{
          height: "260px",
          overflowY: "auto",
          padding: "16px 20px",
          fontFamily: "'Fira Code', 'Courier New', monospace",
          fontSize: "12.5px",
          lineHeight: "1.7",
        }}
      >
        {logs.map((log, idx) => (
          <div key={idx} style={{ display: "flex", gap: "12px", marginBottom: "2px" }}>
            <span style={{ color: "#484f58", flexShrink: 0, userSelect: "none" }}>
              {String(idx + 1).padStart(3, "0")}
            </span>
            <span style={{ color: "#484f58", flexShrink: 0, userSelect: "none" }}>│</span>
            <span style={{ color: getLogColor(log), wordBreak: "break-all" }}>
              {log}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <div style={{ color: "#484f58", fontStyle: "italic" }}>$ Initializing agent...</div>
        )}
        <div ref={endRef} />
      </div>

      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #484f58; }
      `}</style>
    </div>
  );
}

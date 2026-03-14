import { useState } from "react";

export default function Sidebar({ history, onView, onRerun }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{
      width: collapsed ? "60px" : "280px",
      minWidth: collapsed ? "60px" : "280px",
      borderRight: "1px solid #111827",
      background: "#0a0e14",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s ease, min-width 0.2s ease",
      overflow: "hidden",
      fontFamily: "'IBM Plex Mono', monospace"
    }}>
      <div style={{ padding: "14px", borderBottom: "1px solid #111827", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em" }}>HISTORY</span>}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {history.length === 0 ? (
            <div style={{ padding: "20px 10px", textAlign: "center", color: "#64748b", fontSize: "11px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <div style={{ fontSize: "24px" }}>📭</div>
              No history yet.<br/>Run a campaign to see it here!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.map(entry => (
                <div key={entry.id} style={{
                  background: "#060912", border: "1px solid #1f2937", borderRadius: "4px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>{entry.timestamp}</span>
                    <span style={{ fontSize: "10px", background: "#1e1b4b", color: "#818cf8", padding: "2px 6px", borderRadius: "2px", fontWeight: "600" }}>{entry.totalLeads || entry.prospectsFound || 0} leads</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.4" }} title={entry.goal}>
                    {entry.goal}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => onView(entry)} style={{ flex: 1, padding: "5px", background: "#111827", border: "1px solid #1f2937", color: "#94a3b8", fontSize: "10px", borderRadius: "3px", cursor: "pointer", transition: "all 0.1s" }} onMouseEnter={e => e.target.style.background = "#1f2937"} onMouseLeave={e => e.target.style.background = "#111827"}>View</button>
                    <button onClick={() => onRerun(entry)} style={{ flex: 1, padding: "5px", background: "#1e1b4b", border: "1px solid #4338ca", color: "#a5b4fc", fontSize: "10px", borderRadius: "3px", cursor: "pointer", transition: "all 0.1s" }} onMouseEnter={e => e.target.style.background = "#312e81"} onMouseLeave={e => e.target.style.background = "#1e1b4b"}>Re-run</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {collapsed && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
          <div style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", marginTop: "40px", color: "#64748b", fontSize: "10px", letterSpacing: "0.2em", fontWeight: 700 }}>HISTORY</div>
        </div>
      )}
    </div>
  );
}

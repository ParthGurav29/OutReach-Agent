import { useState } from "react";

export default function Sidebar({ history, onView, onRerun }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{
      width: collapsed ? "60px" : "280px",
      minWidth: collapsed ? "60px" : "280px",
      borderRight: "1px solid #eaedf3",
      background: "#ffffff",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s ease, min-width 0.2s ease",
      overflow: "hidden",
      fontFamily: "Inter, -apple-system, sans-serif",
    }}>
      <div style={{ padding: "14px", borderBottom: "1px solid #eaedf3", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && <span style={{ fontSize: "14px", color: "#1e293b", fontWeight: 700 }}>History</span>}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {history.length === 0 ? (
            <div style={{ padding: "20px 10px", textAlign: "center", color: "#64748b", fontSize: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <div style={{ fontSize: "24px" }}>📭</div>
              No history yet.<br/>Run a campaign to see it here!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {history.map(entry => (
                <div key={entry.id} style={{
                  background: "#ffffff", border: "1px solid #eaedf3", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "8px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{entry.timestamp}</span>
                    <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#4f46e5", padding: "2px 8px", borderRadius: "999px", fontWeight: "600" }}>{entry.totalLeads || entry.prospectsFound || 0} leads</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#1e293b", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.4" }} title={entry.goal}>
                    {entry.goal}
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button onClick={() => onView(entry)} style={{ flex: 1, padding: "6px", background: "#ffffff", border: "1px solid #eaedf3", color: "#64748b", fontSize: "11px", borderRadius: "6px", cursor: "pointer", transition: "all 0.1s" }} onMouseEnter={e => e.target.style.background = "#f8fafc"} onMouseLeave={e => e.target.style.background = "#ffffff"}>View</button>
                    <button onClick={() => onRerun(entry)} style={{ flex: 1, padding: "6px", background: "#f8fafc", border: "1px solid #c7d2fe", color: "#4f46e5", fontSize: "11px", borderRadius: "6px", cursor: "pointer", transition: "all 0.1s" }} onMouseEnter={e => e.target.style.background = "#e0e7ff"} onMouseLeave={e => e.target.style.background = "#f8fafc"}>Re-run</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {collapsed && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
          <div style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", marginTop: "40px", color: "#64748b", fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700 }}>HISTORY</div>
        </div>
      )}
    </div>
  );
}

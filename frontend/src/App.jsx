import { useState, useRef, useEffect } from "react";


const SESSION_ID = window.crypto?.randomUUID
  ? window.crypto.randomUUID()
  : Math.random().toString(36).substring(2);

const STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  DONE: "done",
  ERROR: "error",
};

function WordCount({ count }) {
  const color =
    count >= 80 && count <= 120
      ? "#4ade80"
      : count === 0
      ? "#6b7280"
      : "#f87171";
  return (
    <span style={{ color, fontWeight: 600 }}>
      {count}w
    </span>
  );
}

function EmailCard({ item, index , onSend}) {
  const [open, setOpen] = useState(index === 0);
  const { prospect, score, email } = item;

  return (
    <div
      style={{
        border: "1px solid #1f2937",
        borderLeft: "3px solid #6366f1",
        marginBottom: "10px",
        background: open ? "#0d1117" : "#0a0e14",
        borderRadius: "4px",
        overflow: "hidden",
        transition: "background 0.2s",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#e2e8f0",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "13px",
          textAlign: "left",
        }}
      >
        <span>
          <span style={{ color: "#6366f1", marginRight: "10px" }}>
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span style={{ color: "#f1f5f9", fontWeight: 600 }}>
            {prospect?.name}
          </span>
          <span style={{ color: "#64748b", marginLeft: "10px" }}>
            {prospect?.role}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              background: "#1e1b4b",
              color: "#818cf8",
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            score {score}
          </span>
          <WordCount count={email?.word_count ?? 0} />
          <span style={{ color: "#4b5563", fontSize: "16px" }}>
            {open ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "12px",
            lineHeight: "1.8",
            color: "#94a3b8",
            borderTop: "1px solid #1f2937",
            paddingTop: "14px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#475569" }}>SUBJECT → </span>
            <span style={{ color: "#e2e8f0" }}>{email?.subject}</span>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <span style={{ color: "#475569" }}>HOOK → </span>
            <span style={{ color: "#a5b4fc" }}>{email?.personalisation_used}</span>
          </div>
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: "#111827",
              borderRadius: "4px",
              color: "#cbd5e1",
              lineHeight: "1.9",
              whiteSpace: "pre-wrap",
            }}
          >
            {email?.body}
            <div style={{ marginTop: "14px", display: "flex", gap: "10px" }}>
  <button
    onClick={() => onSend(index)}
    style={{
      background: "#16a34a",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      color: "#ecfdf5",
      fontSize: "11px",
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: "0.05em",
    }}
  >
    SEND EMAIL
  </button>
</div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryPanel({ memory }) {
  if (!memory || memory.campaigns_run === 0) return null;
  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #1f2937",
        borderLeft: "3px solid #f59e0b",
        borderRadius: "4px",
        padding: "10px 14px",
        marginBottom: "20px",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        color: "#92400e",
        display: "flex",
        gap: "24px",
      }}
    >
      <span style={{ color: "#f59e0b" }}>SESSION MEMORY</span>
      <span>campaigns run: <b style={{ color: "#fcd34d" }}>{memory.campaigns_run}</b></span>
      <span>prospects seen: <b style={{ color: "#fcd34d" }}>{memory.prospects_targeted}</b></span>
    </div>
  );
}

function LogLine({ line }) {
  const isError = line.startsWith("⚠️") || line.startsWith("ERROR");
  const isSuccess = line.startsWith("✅") || line.startsWith("🏆");
  const isHeader = line.startsWith("===");
  return (
    <div
      style={{
        color: isError
          ? "#f87171"
          : isSuccess
          ? "#4ade80"
          : isHeader
          ? "#6366f1"
          : "#4b5563",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        lineHeight: "1.6",
        whiteSpace: "pre-wrap",
      }}
    >
      {line}
    </div>
  );
}

export default function App() {
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [memory, setMemory] = useState({ campaigns_run: 0, prospects_targeted: 0 });
  const [activeTab, setActiveTab] = useState("emails");
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);


  const sendEmail = async (prospectIndex) => {
    try {
      setLogs((prev) => [...prev, `📤 Sending email to prospect #${prospectIndex + 1}...`]);

      // Force it to hit your FastAPI port directly!
      const res = await fetch("http://127.0.0.1:8000/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prospect_id: prospectIndex,
          session_id: SESSION_ID,
        }),
      });

      // FIX 1: Show the actual HTTP status code if it fails
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} Error: ${text}`);
      }

      const data = await res.json();

      // FIX 2: Check if the backend caught an error gracefully
      if (data.sent === false || data.error) {
        throw new Error(`Backend rejected: ${data.error}`);
      }

      setLogs((prev) => [
        ...prev,
        `✅ Email sent successfully to prospect #${prospectIndex + 1}`,
      ]);

      return data;

    } catch (err) {
      setLogs((prev) => [
        ...prev,
        `⚠️ Email send failed: ${err.message}`,
      ]);
    }
  };

  const runCampaign = async () => {
    if (!goal.trim()) return;
    setStatus(STATUS.RUNNING);
    setResult(null);
    setError(null);
    setLogs([`▶ Starting campaign...`, `Goal: ${goal}`, `Session: ${SESSION_ID.slice(0, 8)}...`]);

    try {
      const res = await fetch("/run-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, session_id: SESSION_ID }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();

      setResult(data);
      setStatus(STATUS.DONE);
      setLogs((prev) => [
        ...prev,
        `✅ Done — ${data.prospects_found} prospects found`,
        `✅ ${data.outreach_targets?.length ?? 0} emails drafted`,
      ]);

      setMemory((prev) => ({
        campaigns_run: prev.campaigns_run + 1,
        prospects_targeted:
          prev.prospects_targeted + (data.prospects_found ?? 0),
      }));
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message);
      setLogs((prev) => [...prev, `⚠️ Error: ${err.message}`]);
    }
  };

  const isRunning = status === STATUS.RUNNING;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#060912",
        color: "#e2e8f0",
        fontFamily: "'IBM Plex Mono', monospace",
        padding: "0",
        margin: "0",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #111827",
          padding: "18px 32px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#070b10",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background:
              status === STATUS.RUNNING
                ? "#f59e0b"
                : status === STATUS.DONE
                ? "#4ade80"
                : status === STATUS.ERROR
                ? "#f87171"
                : "#6366f1",
            boxShadow:
              status === STATUS.RUNNING
                ? "0 0 8px #f59e0b"
                : status === STATUS.DONE
                ? "0 0 8px #4ade80"
                : "none",
            animation: isRunning ? "pulse 1s infinite" : "none",
          }}
        />
        <span style={{ fontSize: "13px", color: "#64748b", letterSpacing: "0.15em" }}>
          OUTREACH AGENT
        </span>
        <span style={{ marginLeft: "auto", fontSize: "11px", color: "#1f2937" }}>
          {SESSION_ID.slice(0, 8)}
        </span>
      </div>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 24px" }}>
        <MemoryPanel memory={memory} />

        {/* Goal Input */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "11px",
              color: "#475569",
              letterSpacing: "0.12em",
              marginBottom: "8px",
            }}
          >
            CAMPAIGN GOAL
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) runCampaign();
              }}
              placeholder="e.g. Find SaaS founders building B2B tools who could benefit from AI-powered outreach automation..."
              rows={3}
              disabled={isRunning}
              style={{
                flex: 1,
                background: "#0d1117",
                border: "1px solid #1f2937",
                borderRadius: "4px",
                color: "#e2e8f0",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "13px",
                padding: "12px 14px",
                resize: "vertical",
                outline: "none",
                lineHeight: "1.7",
                opacity: isRunning ? 0.5 : 1,
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
              onBlur={(e) => (e.target.style.borderColor = "#1f2937")}
            />
            <button
              onClick={runCampaign}
              disabled={isRunning || !goal.trim()}
              style={{
                padding: "0 22px",
                background: isRunning ? "#1e1b4b" : "#4338ca",
                color: isRunning ? "#818cf8" : "#e0e7ff",
                border: "none",
                borderRadius: "4px",
                cursor: isRunning || !goal.trim() ? "not-allowed" : "pointer",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                opacity: !goal.trim() && !isRunning ? 0.4 : 1,
                transition: "all 0.2s",
                minWidth: "120px",
                alignSelf: "stretch",
              }}
            >
              {isRunning ? (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "14px",
                      height: "14px",
                      border: "2px solid #818cf8",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  <span style={{ fontSize: "10px" }}>RUNNING</span>
                </span>
              ) : (
                <>RUN AGENT<br /><span style={{ fontSize: "10px", opacity: 0.6 }}>⌘↵</span></>
              )}
            </button>
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div
            style={{
              background: "#0a0e14",
              border: "1px solid #111827",
              borderRadius: "4px",
              padding: "12px 16px",
              maxHeight: "140px",
              overflowY: "auto",
              marginBottom: "28px",
            }}
          >
            {logs.map((line, i) => (
              <LogLine key={i} line={line} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#1c0a0a",
              border: "1px solid #7f1d1d",
              borderRadius: "4px",
              padding: "12px 16px",
              color: "#f87171",
              fontSize: "12px",
              marginBottom: "24px",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: "0",
                marginBottom: "20px",
                borderBottom: "1px solid #1f2937",
              }}
            >
              {["emails", "raw"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 20px",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
                    color: activeTab === tab ? "#a5b4fc" : "#475569",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "11px",
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    fontWeight: activeTab === tab ? 700 : 400,
                    marginBottom: "-1px",
                    transition: "color 0.15s",
                  }}
                >
                  {tab === "emails"
                    ? `emails (${result.outreach_targets?.length ?? 0})`
                    : "raw json"}
                </button>
              ))}
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: "11px",
                  color: "#374151",
                  alignSelf: "center",
                  paddingRight: "4px",
                }}
              >
                {result.prospects_found} prospects found
              </span>
            </div>

            {activeTab === "emails" && (
              <div>
                {result.outreach_targets?.map((item, i) => (
                  <EmailCard
                  key={i}
                  item={item}
                  index={i}
                  onSend={sendEmail}
                />
              ))}
              </div>
            )}

            {activeTab === "raw" && (
              <pre
                style={{
                  background: "#0a0e14",
                  border: "1px solid #111827",
                  borderRadius: "4px",
                  padding: "20px",
                  color: "#64748b",
                  fontSize: "11px",
                  lineHeight: "1.7",
                  overflowX: "auto",
                  maxHeight: "600px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #060912; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0a0e14; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 2px; }
      `}</style>
    </div>
  );
}
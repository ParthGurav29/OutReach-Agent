import { useState, useRef, useEffect } from "react";

const SESSION_ID = crypto.randomUUID();
const STATUS = { IDLE: "idle", RUNNING: "running", DONE: "done", ERROR: "error" };

const ROLES = ["Founder", "CEO", "CTO", "CMO", "HR Manager", "Talent Acquisition", "CHRO", "Director", "Head of Growth", "Marketing Manager", "Product Manager", "Sales Head"];
const INDUSTRIES = ["SaaS", "AI / ML", "Fintech", "Edtech", "Ecommerce", "Healthcare", "Media", "Consulting", "IT Services", "Startup"];
const LOCATIONS = ["Mumbai", "Bangalore", "Delhi", "Hyderabad", "Pune", "Chennai", "India", "Global"];
const COMPANY_SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];

function filtersToGoal(filters, seeking, senderName) {
  const parts = [];
  if (filters.roles.length)        parts.push(`roles: ${filters.roles.join(", ")}`);
  if (filters.industries.length)   parts.push(`industries: ${filters.industries.join(", ")}`);
  if (filters.locations.length)    parts.push(`locations: ${filters.locations.join(", ")}`);
  if (filters.companySizes.length) parts.push(`company size: ${filters.companySizes.join(", ")} employees`);
  if (filters.keywords.trim())     parts.push(`keywords: ${filters.keywords.trim()}`);
  const who = senderName ? `I'm ${senderName}` : "I'm reaching out";
  const seek = seeking.trim() ? `, seeking ${seeking.trim()}` : "";
  return `${who}${seek}. Find professionals matching — ${parts.join(" | ")}`;
}

function exportCSV(targets) {
  const headers = ["Name", "Role", "Company", "Email", "Email Confidence", "Score", "Subject", "Body"];
  const rows = targets.map(t => [
    t.prospect?.name || "",
    t.prospect?.role || "",
    t.prospect?.company || "",
    t.prospect?.email || "",
    t.prospect?.email_confidence || "",
    t.score || "",
    t.email?.subject || "",
    (t.email?.body || "").replace(/\n/g, " "),
  ]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `leads_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ConfidenceBadge({ confidence }) {
  const map = {
    high:             { color: "#4ade80", bg: "#052e16", label: "verified" },
    smtp:             { color: "#4ade80", bg: "#052e16", label: "smtp ✓" },
    "low (catch-all)":{ color: "#fbbf24", bg: "#1c1400", label: "catch-all" },
    low:              { color: "#f87171", bg: "#1c0a0a", label: "guessed" },
    "low (smtp blocked)": { color: "#f87171", bg: "#1c0a0a", label: "guessed" },
    "low (pattern guess)":{ color: "#f87171", bg: "#1c0a0a", label: "guessed" },
    pattern_fallback: { color: "#f87171", bg: "#1c0a0a", label: "guessed" },
    unresolved:       { color: "#6b7280", bg: "#111", label: "not found" },
  };
  const style = map[confidence] || map["unresolved"];
  return (
    <span style={{ background: style.bg, color: style.color, padding: "1px 6px", borderRadius: "3px", fontSize: "10px", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
      {style.label}
    </span>
  );
}

function ChipGroup({ label, options, selected, onChange }) {
  const toggle = opt => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.12em", marginBottom: "7px", fontFamily: "'IBM Plex Mono', monospace" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)} style={{
              padding: "3px 9px", borderRadius: "3px",
              border: active ? "1px solid #6366f1" : "1px solid #1f2937",
              background: active ? "#1e1b4b" : "#0d1117",
              color: active ? "#a5b4fc" : "#475569",
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
              cursor: "pointer", transition: "all 0.12s", fontWeight: active ? 700 : 400,
            }}>
              {active ? "✓ " : ""}{opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WordCount({ count }) {
  const color = count >= 80 && count <= 120 ? "#4ade80" : count === 0 ? "#6b7280" : "#f87171";
  return <span style={{ color, fontWeight: 600, fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace" }}>{count}w</span>;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} style={{
      background: "transparent", border: "1px solid #1f2937", borderRadius: "3px",
      color: copied ? "#4ade80" : "#475569", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: "10px", padding: "2px 8px", cursor: "pointer",
    }}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function EmailCard({ item, index, sessionId, prospectId }) {
  const [open, setOpen] = useState(index === 0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const { prospect, score, email } = item;
  const hasEmail = !!prospect?.email;

  const sendEmail = async () => {
    setSending(true);
    try {
      const res = await fetch("/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect_id: prospectId, session_id: sessionId }),
      });
      const data = await res.json();
      setSent(data.sent ? "sent" : "failed");
    } catch {
      setSent("failed");
    }
    setSending(false);
  };

  return (
    <div style={{
      border: "1px solid #1f2937",
      borderLeft: `3px solid ${hasEmail ? "#6366f1" : "#374151"}`,
      marginBottom: "8px", background: open ? "#0d1117" : "#0a0e14",
      borderRadius: "4px", overflow: "hidden",
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer",
        color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", textAlign: "left",
      }}>
        <span>
          <span style={{ color: "#6366f1", marginRight: "8px" }}>#{String(index + 1).padStart(2, "0")}</span>
          <span style={{ fontWeight: 600 }}>{prospect?.name}</span>
          <span style={{ color: "#64748b", marginLeft: "8px", fontSize: "11px" }}>{prospect?.role}</span>
        </span>
        <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {hasEmail && <ConfidenceBadge confidence={prospect?.email_confidence} />}
          {!hasEmail && <span style={{ fontSize: "10px", color: "#4b5563" }}>❌ no email</span>}
          <span style={{ background: "#1e1b4b", color: "#818cf8", padding: "1px 6px", borderRadius: "999px", fontSize: "10px", fontWeight: 700 }}>{score}</span>
          <WordCount count={email?.word_count ?? 0} />
          <span style={{ color: "#4b5563", fontSize: "12px" }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 14px 14px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", lineHeight: "1.8", color: "#94a3b8", borderTop: "1px solid #1f2937", paddingTop: "12px" }}>
          {hasEmail && (
            <div style={{ marginBottom: "6px" }}>
              <span style={{ color: "#475569" }}>EMAIL → </span>
              <span style={{ color: "#4ade80" }}>{prospect.email}</span>
              <span style={{ marginLeft: "8px" }}><ConfidenceBadge confidence={prospect.email_confidence} /></span>
            </div>
          )}
          <div style={{ marginBottom: "6px" }}>
            <span style={{ color: "#475569" }}>SUBJECT → </span>
            <span style={{ color: "#e2e8f0" }}>{email?.subject}</span>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span style={{ color: "#475569" }}>HOOK → </span>
            <span style={{ color: "#a5b4fc" }}>{email?.personalisation_used}</span>
          </div>
          <div style={{ padding: "10px", background: "#111827", borderRadius: "4px", color: "#cbd5e1", lineHeight: "1.9", whiteSpace: "pre-wrap", marginBottom: "10px" }}>
            {email?.body}
          </div>
          {/* Action row */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <CopyButton text={`Subject: ${email?.subject}\n\n${email?.body}`} />
            {hasEmail && (
              <button
                onClick={sendEmail}
                disabled={sending || sent === "sent"}
                style={{
                  background: sent === "sent" ? "#052e16" : sent === "failed" ? "#1c0a0a" : "#1e1b4b",
                  border: `1px solid ${sent === "sent" ? "#4ade80" : sent === "failed" ? "#f87171" : "#6366f1"}`,
                  color: sent === "sent" ? "#4ade80" : sent === "failed" ? "#f87171" : "#818cf8",
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px",
                  padding: "2px 10px", borderRadius: "3px",
                  cursor: sending || sent === "sent" ? "not-allowed" : "pointer",
                }}
              >
                {sending ? "sending..." : sent === "sent" ? "✓ sent" : sent === "failed" ? "✗ failed" : "send →"}
              </button>
            )}
            {!hasEmail && (
              <span style={{ fontSize: "10px", color: "#374151" }}>no email — send manually via LinkedIn</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep]             = useState("form");
  const [senderName, setSenderName] = useState("");
  const [seeking, setSeeking]       = useState("");
  const [filters, setFilters]       = useState({ roles: [], industries: [], locations: [], companySizes: [], keywords: "" });
  const [status, setStatus]         = useState(STATUS.IDLE);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const [logs, setLogs]             = useState([]);
  const [activeTab, setActiveTab]   = useState("emails");
  const [history, setHistory]       = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const isRunning = status === STATUS.RUNNING;
  const hasFilters = filters.roles.length || filters.industries.length ||
    filters.locations.length || filters.companySizes.length || filters.keywords.trim();
  const canRun = senderName.trim() && seeking.trim() && hasFilters;

  const updateFilter = key => val => setFilters(f => ({ ...f, [key]: val }));

  const runCampaign = async (overrideFilters) => {
    const activeFilters = overrideFilters || filters;
    const goal = filtersToGoal(activeFilters, seeking, senderName);
    setStatus(STATUS.RUNNING);
    setStep("results");
    setResult(null);
    setError(null);
    setLogs([`▶ Starting campaign...`, `Goal: ${goal}`, `Sender: ${senderName} — seeking: ${seeking}`]);

    try {
      const res = await fetch("/run-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          session_id: SESSION_ID,
          sender_name: senderName,
          seeking,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data);
      setStatus(STATUS.DONE);
      setLogs(prev => [...prev,
        `✅ ${data.prospects_found} prospects found`,
        `✅ ${data.outreach_targets?.length ?? 0} emails drafted`,
      ]);
      // Save to history
      setHistory(prev => [{
        id: Date.now(),
        goal,
        filters: { ...activeFilters },
        seeking,
        prospectsFound: data.prospects_found,
        emailsDrafted: data.outreach_targets?.length ?? 0,
        timestamp: new Date().toLocaleTimeString(),
        result: data,
      }, ...prev.slice(0, 9)]);
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message);
      setLogs(prev => [...prev, `⚠️ ${err.message}`]);
    }
  };

  const refineAndRerun = () => {
    setStep("form");
    setStatus(STATUS.IDLE);
  };

  const loadFromHistory = (entry) => {
    setFilters(entry.filters);
    setSeeking(entry.seeking);
    setResult(entry.result);
    setStatus(STATUS.DONE);
    setStep("results");
    setShowHistory(false);
  };

  // ── FORM ─────────────────────────────────────────────────────────────────────
  const FormStep = () => (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9", marginBottom: "4px", fontFamily: "'IBM Plex Mono', monospace" }}>
          Build Your Lead Filter
        </div>
        <div style={{ fontSize: "11px", color: "#475569", fontFamily: "'IBM Plex Mono', monospace" }}>
          Fill in who you are + what you want → agent writes personalised outreach
        </div>
      </div>

      {/* Step 1 — About You */}
      <div style={{ background: "#0a0e14", border: "1px solid #111827", borderLeft: "3px solid #6366f1", borderRadius: "6px", padding: "18px 20px", marginBottom: "14px" }}>
        <div style={{ fontSize: "10px", color: "#6366f1", letterSpacing: "0.15em", marginBottom: "14px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
          STEP 1 — ABOUT YOU
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "10px", color: "#475569", letterSpacing: "0.1em", marginBottom: "5px", fontFamily: "'IBM Plex Mono', monospace" }}>
              YOUR NAME
            </label>
            <input value={senderName} onChange={e => setSenderName(e.target.value)}
              placeholder="e.g. Parth"
              style={{ width: "100%", background: "#060912", border: "1px solid #1f2937", borderRadius: "4px", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "#6366f1"}
              onBlur={e => e.target.style.borderColor = "#1f2937"}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "10px", color: "#475569", letterSpacing: "0.1em", marginBottom: "5px", fontFamily: "'IBM Plex Mono', monospace" }}>
              WHAT ARE YOU SEEKING?
            </label>
            <input value={seeking} onChange={e => setSeeking(e.target.value)}
              placeholder="e.g. ML internship / freelance clients / pilot customers"
              style={{ width: "100%", background: "#060912", border: "1px solid #1f2937", borderRadius: "4px", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", padding: "8px 10px", outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "#6366f1"}
              onBlur={e => e.target.style.borderColor = "#1f2937"}
            />
          </div>
        </div>
      </div>

      {/* Step 2 — Target Filters */}
      <div style={{ background: "#0a0e14", border: "1px solid #111827", borderLeft: "3px solid #4338ca", borderRadius: "6px", padding: "18px 20px", marginBottom: "14px" }}>
        <div style={{ fontSize: "10px", color: "#818cf8", letterSpacing: "0.15em", marginBottom: "14px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>
          STEP 2 — TARGET LEADS
        </div>
        <ChipGroup label="ROLE / JOB TITLE" options={ROLES} selected={filters.roles} onChange={updateFilter("roles")} />
        <ChipGroup label="INDUSTRY" options={INDUSTRIES} selected={filters.industries} onChange={updateFilter("industries")} />
        <ChipGroup label="LOCATION" options={LOCATIONS} selected={filters.locations} onChange={updateFilter("locations")} />
        <ChipGroup label="COMPANY SIZE" options={COMPANY_SIZES} selected={filters.companySizes} onChange={updateFilter("companySizes")} />
        <div>
          <div style={{ fontSize: "10px", color: "#475569", letterSpacing: "0.12em", marginBottom: "6px", fontFamily: "'IBM Plex Mono', monospace" }}>KEYWORDS (optional)</div>
          <input value={filters.keywords} onChange={e => setFilters(f => ({ ...f, keywords: e.target.value }))}
            placeholder="e.g. Series A, B2B, actively hiring..."
            style={{ width: "100%", background: "#060912", border: "1px solid #1f2937", borderRadius: "4px", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", padding: "7px 10px", outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = "#6366f1"}
            onBlur={e => e.target.style.borderColor = "#1f2937"}
          />
        </div>
      </div>

      {/* Goal Preview */}
      {canRun && (
        <div style={{ background: "#0d1117", border: "1px solid #1f2937", borderLeft: "3px solid #4ade80", borderRadius: "4px", padding: "10px 14px", marginBottom: "16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#64748b" }}>
          <span style={{ color: "#4ade80", marginRight: "8px" }}>GOAL →</span>
          {filtersToGoal(filters, seeking, senderName)}
        </div>
      )}

      {/* Warnings */}
      {!senderName.trim() && <div style={{ fontSize: "10px", color: "#f59e0b", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "6px" }}>⚠ Enter your name</div>}
      {!seeking.trim() && <div style={{ fontSize: "10px", color: "#f59e0b", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "6px" }}>⚠ Enter what you're seeking</div>}
      {!hasFilters && <div style={{ fontSize: "10px", color: "#f59e0b", fontFamily: "'IBM Plex Mono', monospace", marginBottom: "6px" }}>⚠ Select at least one filter</div>}

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <button onClick={() => runCampaign()} disabled={!canRun} style={{
          padding: "11px 28px", background: canRun ? "#4338ca" : "#1e1b4b",
          color: canRun ? "#e0e7ff" : "#4b5563", border: "none", borderRadius: "4px",
          cursor: canRun ? "pointer" : "not-allowed", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em",
        }}>
          GENERATE LEADS →
        </button>
        {history.length > 0 && (
          <button onClick={() => setShowHistory(s => !s)} style={{
            padding: "11px 16px", background: "transparent", border: "1px solid #1f2937",
            color: "#475569", borderRadius: "4px", cursor: "pointer",
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
          }}>
            history ({history.length})
          </button>
        )}
      </div>

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div style={{ marginTop: "16px", background: "#0a0e14", border: "1px solid #111827", borderRadius: "6px", overflow: "hidden" }}>
          {history.map((entry, i) => (
            <div key={entry.id} onClick={() => loadFromHistory(entry)} style={{
              padding: "10px 14px", borderBottom: i < history.length - 1 ? "1px solid #111827" : "none",
              cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#0d1117"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {entry.seeking} → {entry.filters.roles.slice(0, 2).join(", ")} {entry.filters.locations.slice(0, 1).join("")}
                </div>
                <div style={{ fontSize: "10px", color: "#374151", fontFamily: "'IBM Plex Mono', monospace", marginTop: "2px" }}>
                  {entry.prospectsFound} prospects · {entry.emailsDrafted} emails · {entry.timestamp}
                </div>
              </div>
              <span style={{ fontSize: "10px", color: "#4b5563" }}>load →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── RESULTS ───────────────────────────────────────────────────────────────────
  const ResultsStep = () => (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={refineAndRerun} style={{
          background: "transparent", border: "1px solid #1f2937", borderRadius: "4px",
          color: "#475569", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
          padding: "5px 12px", cursor: "pointer",
        }}>
          ← Refine Filters
        </button>
        {result && (
          <button onClick={() => exportCSV(result.outreach_targets || [])} style={{
            background: "#0d1117", border: "1px solid #1f2937", borderRadius: "4px",
            color: "#64748b", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
            padding: "5px 12px", cursor: "pointer",
          }}>
            export CSV ↓
          </button>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div style={{ background: "#0a0e14", border: "1px solid #111827", borderRadius: "4px", padding: "10px 14px", maxHeight: "110px", overflowY: "auto", marginBottom: "20px" }}>
          {logs.map((line, i) => (
            <div key={i} style={{ color: line.startsWith("⚠") ? "#f87171" : line.startsWith("✅") ? "#4ade80" : "#374151", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", lineHeight: "1.6" }}>{line}</div>
          ))}
          {isRunning && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <span style={{ display: "inline-block", width: "9px", height: "9px", border: "2px solid #6366f1", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <span style={{ color: "#6366f1", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>Pipeline running...</span>
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      )}

      {error && (
        <div style={{ background: "#1c0a0a", border: "1px solid #7f1d1d", borderRadius: "4px", padding: "10px 14px", color: "#f87171", fontSize: "11px", marginBottom: "16px", fontFamily: "'IBM Plex Mono', monospace" }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div>
          {/* Stats bar */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "16px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>
            <span style={{ color: "#4ade80" }}>✅ {result.outreach_targets?.filter(t => t.prospect?.email).length ?? 0} with email</span>
            <span style={{ color: "#818cf8" }}>📋 {result.prospects_found} total prospects</span>
            <span style={{ color: "#64748b" }}>✉️ {result.outreach_targets?.length ?? 0} emails drafted</span>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1f2937", marginBottom: "14px" }}>
            {["emails", "raw"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "6px 16px", background: "transparent", border: "none",
                borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
                color: activeTab === tab ? "#a5b4fc" : "#475569",
                fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px",
                cursor: "pointer", textTransform: "uppercase", fontWeight: activeTab === tab ? 700 : 400, marginBottom: "-1px",
              }}>
                {tab === "emails" ? `emails (${result.outreach_targets?.length ?? 0})` : "raw json"}
              </button>
            ))}
          </div>

          {activeTab === "emails" && result.outreach_targets?.map((item, i) => (
            <EmailCard key={i} item={item} index={i} sessionId={SESSION_ID} prospectId={i} />
          ))}

          {activeTab === "raw" && (
            <pre style={{ background: "#0a0e14", border: "1px solid #111827", borderRadius: "4px", padding: "16px", color: "#64748b", fontSize: "11px", lineHeight: "1.7", overflowX: "auto", maxHeight: "600px", overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060912", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #111827", padding: "14px 28px", display: "flex", alignItems: "center", gap: "10px", background: "#070b10" }}>
        <div style={{
          width: "7px", height: "7px", borderRadius: "50%",
          background: status === STATUS.RUNNING ? "#f59e0b" : status === STATUS.DONE ? "#4ade80" : status === STATUS.ERROR ? "#f87171" : "#6366f1",
          animation: isRunning ? "pulse 1s infinite" : "none",
        }} />
        <span style={{ fontSize: "11px", color: "#64748b", letterSpacing: "0.15em", fontFamily: "'IBM Plex Mono', monospace" }}>OUTREACH AGENT</span>
        {senderName && <span style={{ fontSize: "11px", color: "#374151", fontFamily: "'IBM Plex Mono', monospace" }}>/ {senderName}</span>}
        {seeking && <span style={{ fontSize: "11px", color: "#1e1b4b", fontFamily: "'IBM Plex Mono', monospace" }}>→ {seeking}</span>}
        <span style={{ marginLeft: "auto", fontSize: "10px", color: "#1f2937", fontFamily: "'IBM Plex Mono', monospace" }}>{SESSION_ID.slice(0, 8)}</span>
      </div>

      {step === "form" ? <FormStep /> : <ResultsStep />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #060912; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0e14; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 2px; }
      `}</style>
    </div>
  );
}
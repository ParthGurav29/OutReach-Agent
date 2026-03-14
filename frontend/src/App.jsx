import { useState, useRef, useEffect } from "react";
import AgentWindow from "./AgentWindow";
import Sidebar from "./Sidebar";

const SESSION_ID = crypto.randomUUID();
const STATUS = { IDLE: "idle", RUNNING: "running", DONE: "done", ERROR: "error" };

const AGENT_STEP_IDS = ["searching", "enriching", "drafting-v1", "generating", "ready"];

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
    high:             { color: "#166534", bg: "#dcfce7", label: "verified" },
    smtp:             { color: "#166534", bg: "#dcfce7", label: "smtp ✓" },
    "low (catch-all)":{ color: "#9a3412", bg: "#ffedd5", label: "catch-all" },
    low:              { color: "#991b1b", bg: "#fee2e2", label: "guessed" },
    "low (smtp blocked)": { color: "#991b1b", bg: "#fee2e2", label: "guessed" },
    "low (pattern guess)":{ color: "#991b1b", bg: "#fee2e2", label: "guessed" },
    pattern_fallback: { color: "#991b1b", bg: "#fee2e2", label: "guessed" },
    unresolved:       { color: "#475569", bg: "#f1f5f9", label: "not found" },
  };
  const style = map[confidence] || map["unresolved"];
  return (
    <span style={{ background: style.bg, color: style.color, padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600 }}>
      {style.label}
    </span>
  );
}

function ChipGroup({ label, options, selected, onChange }) {
  const toggle = opt => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)} style={{
              padding: "6px 14px", borderRadius: "999px",
              border: active ? "1px solid #c7d2fe" : "1px solid #eaedf3",
              background: active ? "#e0e7ff" : "#f8fafc",
              color: active ? "#4f46e5" : "#64748b",
              fontSize: "13px", fontWeight: active ? 600 : 500,
              cursor: "pointer", transition: "all 0.15s",
            }}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{
      background: "#ffffff", border: "1px solid #eaedf3", borderRadius: "6px",
      color: copied ? "#10b981" : "#64748b", fontSize: "12px", fontWeight: 500, padding: "6px 12px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s"
    }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function SaveButton() {
  const [saved, setSaved] = useState(false);
  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <button onClick={save} style={{
      background: "#ffffff", border: "1px solid #eaedf3", borderRadius: "6px",
      color: saved ? "#10b981" : "#64748b", fontSize: "12px", fontWeight: 500, padding: "6px 12px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s"
    }}>
      {saved ? "✓ Saved" : "Save Edit"}
    </button>
  );
}

function EmailCard({ item, index, sessionId, prospectId }) {
  const [open, setOpen] = useState(index === 0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const { prospect, score, email } = item;
  const hasEmail = !!prospect?.email;

  const variants = email?.variants || (email?.subject ? [
    { type: "Direct", subject: email.subject, body: email.body, personalisation_used: email.personalisation_used, word_count: email.word_count }
  ] : []);

  const [activeTab, setActiveTab] = useState(variants[0]?.type || "Direct");

  const [edits, setEdits] = useState(() => {
    const init = {};
    variants.forEach(v => {
      init[v.type] = { subject: v.subject || "", body: v.body || "" };
    });
    return init;
  });

  const currentType = activeTab;
  const activeVariantInfo = variants.find(v => v.type === activeTab) || variants[0] || {};
  const editState = edits[currentType] || { subject: activeVariantInfo.subject || "", body: activeVariantInfo.body || "" };

  const handleEdit = (field, value) => {
    setEdits(prev => ({
      ...prev,
      [currentType]: { ...prev[currentType], [field]: value }
    }));
  };

  const sendEmail = async () => {
    setSending(true);
    try {
      const res = await fetch("/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prospect_id: prospectId, 
          session_id: sessionId,
          subject: editState.subject,
          body: editState.body
        }),
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
      background: "#ffffff",
      border: "1px solid #eaedf3",
      borderLeft: `4px solid ${hasEmail ? "#4f46e5" : "#cbd5e1"}`,
      marginBottom: "16px",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      overflow: "hidden",
    }}>
      <div onClick={() => setOpen(o => !o)} style={{
        padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer",
      }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <span style={{ color: "#4f46e5", fontWeight: 700, fontSize: "14px", marginTop: "2px" }}>#{String(index + 1).padStart(2, "0")}</span>
          <div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              {prospect?.name}
              {!hasEmail && <span style={{ fontSize: "12px", background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "999px", fontWeight: 500 }}>No Email</span>}
              {hasEmail && <ConfidenceBadge confidence={prospect?.email_confidence} />}
            </div>
            <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>{prospect?.role}</div>
            <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "2px" }}>{prospect?.company}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ background: "#f1f5f9", color: "#4f46e5", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 }}>Score {score}</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#64748b", fontSize: "12px", fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            {editState.body.split(/\s+/).filter(w => w.length > 0).length}w
          </span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 20px 20px 20px", borderTop: "1px solid #eaedf3", paddingTop: "20px" }}>
          {/* Variant Tabs */}
          {variants.length > 0 && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              {variants.map(v => (
                <button
                  key={v.type}
                  onClick={() => setActiveTab(v.type)}
                  style={{
                    background: activeTab === v.type ? "#f1f5f9" : "transparent",
                    border: "none", borderRadius: "6px",
                    color: activeTab === v.type ? "#1e293b" : "#64748b",
                    fontWeight: activeTab === v.type ? 600 : 500,
                    fontSize: "13px", padding: "6px 12px", cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  {v.type}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Subject</div>
            <input 
              value={editState.subject}
              onChange={e => handleEdit("subject", e.target.value)}
              style={{
                width: "100%", background: "#ffffff", border: "1px solid #eaedf3", borderRadius: "8px",
                color: "#1e293b", fontSize: "14px", padding: "10px 14px", outline: "none", boxSizing: "border-box", transition: "border 0.2s"
              }}
              onFocus={e => e.target.style.borderColor = "#c7d2fe"}
              onBlur={e => e.target.style.borderColor = "#eaedf3"}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Hook</div>
            <div style={{ color: "#1e293b", fontSize: "14px", padding: "2px 4px" }}>
              {activeVariantInfo.personalisation_used || email?.personalisation_used}
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <div style={{ color: "#64748b", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Body</div>
            <textarea
              value={editState.body}
              onChange={e => handleEdit("body", e.target.value)}
              style={{
                width: "100%", minHeight: "160px", background: "#ffffff", border: "1px solid #eaedf3", borderRadius: "8px",
                color: "#1e293b", fontSize: "14px", lineHeight: "1.6", padding: "12px 14px", outline: "none", resize: "vertical", boxSizing: "border-box", transition: "border 0.2s"
              }}
              onFocus={e => e.target.style.borderColor = "#c7d2fe"}
              onBlur={e => e.target.style.borderColor = "#eaedf3"}
            />
          </div>
          
          {/* Action row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eaedf3", paddingTop: "16px" }}>
            <div style={{ display: "flex", gap: "12px" }}>
              <CopyButton text={`Subject: ${editState.subject}\n\n${editState.body}`} />
              <SaveButton />
            </div>
            {hasEmail ? (
              <button
                onClick={sendEmail}
                disabled={sending || sent === "sent"}
                style={{
                  background: sent === "sent" ? "#16a34a" : sent === "failed" ? "#dc2626" : "#10b981",
                  color: "#ffffff", padding: "8px 16px", borderRadius: "8px", border: "none", fontSize: "13px",
                  fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", cursor: sending || sent === "sent" ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(16, 185, 129, 0.2)", transition: "all 0.2s"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                {sending ? "Sending..." : sent === "sent" ? "Sent ✓" : sent === "failed" ? "Failed ✗" : "Send Email"}
              </button>
            ) : (
              <span style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>Send manually via LinkedIn</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Skeletons() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{
          background: "#ffffff", border: "1px solid #eaedf3", borderLeft: "4px solid #cbd5e1",
          marginBottom: "16px", borderRadius: "12px", height: "72px", display: "flex", alignItems: "center", padding: "0 20px",
          animation: "skeletonPulse 1.5s infinite", boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}>
          <div style={{ width: "24px", height: "14px", background: "#f1f5f9", borderRadius: "4px", marginRight: "16px" }} />
          <div>
            <div style={{ width: "140px", height: "14px", background: "#f1f5f9", borderRadius: "4px", marginBottom: "8px" }} />
            <div style={{ width: "80px", height: "10px", background: "#f8fafc", borderRadius: "4px" }} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes skeletonPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </>
  );
}

function PaginationBar({ page, totalPages, totalLeads, onPageChange }) {
  if (totalLeads === 0) {
    return <div style={{ color: "#64748b", fontSize: "14px", padding: "32px 0", textAlign: "center", border: "2px dashed #eaedf3", borderRadius: "12px", marginBottom: "20px" }}>No leads found for this search.</div>;
  }

  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, page + 2);
  if (end - start < 4) {
    if (start === 1) end = Math.min(totalPages, 5);
    else if (end === totalPages) start = Math.max(1, totalPages - 4);
  }

  const pills = [];
  for (let i = start; i <= end; i++) pills.push(i);

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", background: "#ffffff", padding: "12px 20px", borderRadius: "12px", border: "1px solid #eaedf3", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "13px" }}>
        <span style={{ color: "#4f46e5", fontWeight: 600 }}>Batch {page} of {totalPages}</span>
        <span style={{ color: "#cbd5e1" }}>•</span>
        <span style={{ color: "#64748b" }}>{totalLeads} total leads</span>
      </div>
      
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button disabled={page === 1} onClick={() => onPageChange(page - 1)} style={{ background: "transparent", border: "1px solid #eaedf3", color: page === 1 ? "#cbd5e1" : "#64748b", padding: "6px 12px", borderRadius: "6px", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 500 }}>Prev</button>
        
        {pills.map(p => (
           <button key={p} onClick={() => onPageChange(p)} style={{ background: p === page ? "#4f46e5" : "transparent", color: p === page ? "#ffffff" : "#64748b", border: p === page ? "1px solid #4f46e5" : "1px solid #eaedf3", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: p === page ? 600 : 500, minWidth: "32px", textAlign: "center" }}>{p}</button>
        ))}

        <button disabled={page === totalPages} onClick={() => onPageChange(page + 1)} style={{ background: "transparent", border: "1px solid #eaedf3", color: page === totalPages ? "#cbd5e1" : "#64748b", padding: "6px 12px", borderRadius: "6px", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 500 }}>Next</button>
      </div>
    </div>
  );
}

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
  const [history, setHistory]       = useState(() => {
    try {
      const stored = localStorage.getItem("ag_campaign_history");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const logsEndRef = useRef(null);
  
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [isPaginating, setIsPaginating] = useState(false);

  const [agentStep, setAgentStep] = useState(AGENT_STEP_IDS[0]);
  const [agentLead, setAgentLead] = useState("");

  useEffect(() => {
    if (status !== STATUS.RUNNING) return;
    setAgentStep(AGENT_STEP_IDS[0]);
    setAgentLead("");
    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      if (idx < AGENT_STEP_IDS.length - 1) {
        setAgentStep(AGENT_STEP_IDS[idx]);
      } else {
        clearInterval(timer);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status === STATUS.DONE || status === STATUS.ERROR) {
      setAgentStep("ready");
    }
  }, [status]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  const isRunning = status === STATUS.RUNNING;
  const hasFilters = filters.roles.length || filters.industries.length ||
    filters.locations.length || filters.companySizes.length || filters.keywords.trim();
  const canRun = senderName.trim() && seeking.trim() && hasFilters;

  const updateFilter = key => val => setFilters(f => ({ ...f, [key]: val }));

  const fetchPage = async (newPage) => {
    setIsPaginating(true);
    setPage(newPage);
    try {
      const activeFilters = filters;
      const goal = filtersToGoal(activeFilters, seeking, senderName);
      const res = await fetch(`/run-campaign?page=${newPage}&limit=10`, {
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
      setPage(data.current_page || 1);
      setTotalPages(data.total_pages_count || 1);
      setTotalLeads(data.total_leads_count || 0);
    } catch (err) {
      setError(err.message);
    }
    setIsPaginating(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runCampaign = async (overrideFilters, overrideSeeking, overrideSender) => {
    const activeFilters = overrideFilters || filters;
    const activeSeeking = overrideSeeking !== undefined ? overrideSeeking : seeking;
    const activeSender = overrideSender !== undefined ? overrideSender : senderName;
    const goal = filtersToGoal(activeFilters, activeSeeking, activeSender);
    setStatus(STATUS.RUNNING);
    setStep("results");
    setResult(null);
    setError(null);
    setPage(1);
    setTotalPages(1);
    setTotalLeads(0);
    setLogs([`▶ Starting campaign...`, `Goal: ${goal}`, `Sender: ${activeSender} — seeking: ${activeSeeking}`]);

    try {
      const res = await fetch("/run-campaign?page=1&limit=10", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal,
          session_id: SESSION_ID,
          sender_name: activeSender,
          seeking: activeSeeking,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data);
      setPage(data.current_page || 1);
      setTotalPages(data.total_pages_count || 1);
      setTotalLeads(data.total_leads_count || 0);
      setStatus(STATUS.DONE);
      setLogs(prev => [...prev,
        `✅ ${data.prospects_found} prospects found`,
        `✅ ${data.outreach_targets?.length ?? 0} emails drafted`,
      ]);
      setHistory(prev => {
        const next = [{
          id: Date.now(),
          goal,
          filters: { ...activeFilters },
          seeking: activeSeeking,
          senderName: activeSender,
          prospectsFound: data.prospects_found,
          emailsDrafted: data.outreach_targets?.length ?? 0,
          timestamp: new Date().toLocaleTimeString(),
          result: data,
          page: data.current_page || 1,
          totalPages: data.total_pages_count || 1,
          totalLeads: data.total_leads_count || 0,
        }, ...prev];
        try { localStorage.setItem("ag_campaign_history", JSON.stringify(next)); } catch (e) {}
        return next;
      });
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(err.message);
      setLogs(prev => [...prev, `⚠️ ${err.message}`]);
    }
  };

  const refineAndRerun = () => {
    setStep("form");
    setStatus(STATUS.IDLE);
    setAgentStep(AGENT_STEP_IDS[0]);
    setAgentLead("");
  };

  const loadFromHistory = (entry) => {
    setFilters(entry.filters);
    setSeeking(entry.seeking);
    if (entry.senderName) setSenderName(entry.senderName);
    setResult(entry.result);
    setPage(entry.page || 1);
    setTotalPages(entry.totalPages || 1);
    setTotalLeads(entry.totalLeads || 0);
    setStatus(STATUS.DONE);
    setStep("results");
  };

  const rerunFromHistory = (entry) => {
    setFilters(entry.filters);
    setSeeking(entry.seeking);
    if (entry.senderName) setSenderName(entry.senderName);
    runCampaign(entry.filters, entry.seeking, entry.senderName);
  };

  const FormStep = () => (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ marginBottom: "32px", textAlign: "center" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#1e293b", margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>
          Build Your Campaign
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
          Define who you are and who you want to reach. The AI will find leads and write highly-personalised emails.
        </p>
      </div>

      <div style={{ background: "#ffffff", borderRadius: "12px", padding: "32px", marginBottom: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)", border: "1px solid #eaedf3" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>About You</div>
        <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px" }}>Help the agent understand your value proposition.</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>
              Your Name
            </label>
            <input value={senderName} onChange={e => setSenderName(e.target.value)}
              placeholder="e.g. Parth"
              style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#1e293b", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
              onFocus={e => { e.target.style.borderColor = "#c7d2fe"; e.target.style.background = "#ffffff"; }}
              onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>
              What are you seeking?
            </label>
            <input value={seeking} onChange={e => setSeeking(e.target.value)}
              placeholder="e.g. ML internship, pilot customers..."
              style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#1e293b", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
              onFocus={e => { e.target.style.borderColor = "#c7d2fe"; e.target.style.background = "#ffffff"; }}
              onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
            />
          </div>
        </div>
      </div>

      <div style={{ background: "#ffffff", borderRadius: "12px", padding: "32px", marginBottom: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)", border: "1px solid #eaedf3" }}>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", marginBottom: "8px" }}>Target Leads</div>
        <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px" }}>Select the demographics of your ideal prospects.</div>
        
        <ChipGroup label="Role / Job Title" options={ROLES} selected={filters.roles} onChange={updateFilter("roles")} />
        <ChipGroup label="Industry" options={INDUSTRIES} selected={filters.industries} onChange={updateFilter("industries")} />
        <ChipGroup label="Location" options={LOCATIONS} selected={filters.locations} onChange={updateFilter("locations")} />
        <ChipGroup label="Company Size" options={COMPANY_SIZES} selected={filters.companySizes} onChange={updateFilter("companySizes")} />
        
        <div style={{ marginTop: "8px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#1e293b", marginBottom: "8px" }}>
            Additional Keywords (Optional)
          </label>
          <input value={filters.keywords} onChange={e => setFilters(f => ({ ...f, keywords: e.target.value }))}
            placeholder="e.g. Series A, B2B, actively hiring..."
            style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#1e293b", fontSize: "14px", padding: "12px 14px", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
            onFocus={e => { e.target.style.borderColor = "#c7d2fe"; e.target.style.background = "#ffffff"; }}
            onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#f8fafc"; }}
          />
        </div>
      </div>

      {canRun && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "4px solid #10b981", borderRadius: "8px", padding: "16px", marginBottom: "24px", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
          <span style={{ color: "#10b981", fontWeight: 700, marginRight: "8px" }}>Directive →</span>
          {filtersToGoal(filters, seeking, senderName)}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        {!canRun && (
          <div style={{ fontSize: "12px", color: "#94a3b8", display: "flex", gap: "16px" }}>
            {!senderName.trim() && <span>⚠ Missing Name</span>}
            {!seeking.trim() && <span>⚠ Missing Goal</span>}
            {!hasFilters && <span>⚠ Missing Filters</span>}
          </div>
        )}
        <button onClick={() => runCampaign()} disabled={!canRun} style={{
          padding: "14px 40px", background: canRun ? "#4f46e5" : "#e2e8f0",
          color: canRun ? "#ffffff" : "#94a3b8", border: "none", borderRadius: "999px",
          cursor: canRun ? "pointer" : "not-allowed", fontSize: "15px", fontWeight: 600,
          boxShadow: canRun ? "0 4px 12px rgba(79, 70, 229, 0.2)" : "none", transition: "all 0.2s"
        }}>
          Generate Leads
        </button>
      </div>
    </div>
  );

  const ResultsStep = () => (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <button onClick={refineAndRerun} style={{
          background: "#ffffff", border: "1px solid #eaedf3", borderRadius: "8px",
          color: "#475569", fontSize: "13px", fontWeight: 600, padding: "8px 16px", cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.02)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "8px"
        }} onMouseEnter={e => e.target.style.background = "#f8fafc"} onMouseLeave={e => e.target.style.background = "#ffffff"}>
          ← Refine Filters
        </button>
        {result && (
          <button onClick={() => exportCSV(result.outreach_targets || [])} style={{
            background: "#ffffff", border: "1px solid #eaedf3", borderRadius: "8px",
            color: "#475569", fontSize: "13px", fontWeight: 600, padding: "8px 16px", cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "8px"
          }} onMouseEnter={e => e.target.style.background = "#f8fafc"} onMouseLeave={e => e.target.style.background = "#ffffff"}>
            Export CSV ↓
          </button>
        )}
      </div>

      {(isRunning || status === STATUS.DONE || status === STATUS.ERROR) && (
        <AgentWindow currentStep={agentStep} activeLead={agentLead} />
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "16px 20px", color: "#dc2626", fontSize: "14px", fontWeight: 500, marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{ animation: "fadeIn 0.5s ease" }}>
          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #eaedf3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>Campaign Progress</div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Session: {SESSION_ID.slice(0, 8)}</div>
              </div>
              <span style={{ background: "#dcfce7", color: "#166534", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 }}>{status === STATUS.DONE ? "Completed" : "Running"}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: "12px" }}>
              <span>Overall Progress</span>
              <span>{status === STATUS.DONE ? "100%" : (status === STATUS.RUNNING ? "50%" : "0%")}</span>
            </div>
            
            <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "999px", marginBottom: "32px", overflow: "hidden" }}>
              <div style={{ width: status === STATUS.DONE ? "100%" : (status === STATUS.RUNNING ? "50%" : "0%"), height: "100%", background: "#0f172a", borderRadius: "999px", transition: "width 0.8s ease" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #eaedf3", padding: "20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ background: "#dcfce7", borderRadius: "50%", minWidth: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b" }}>Prospects Found</div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>{result.prospects_found || 0} prospects identified</div>
                </div>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #eaedf3", padding: "20px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ background: "#dcfce7", borderRadius: "50%", minWidth: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b" }}>Emails Drafted</div>
                  <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>{result.outreach_targets?.length ?? 0} emails ready to send</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #eaedf3" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>Generated Emails</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px" }}>{result.prospects_found || 0} prospects found</div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
              {["emails", "raw"].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: "8px 18px", background: activeTab === tab ? "#1e293b" : "#ffffff",
                  border: activeTab === tab ? "1px solid #1e293b" : "1px solid #eaedf3",
                  borderRadius: "999px", color: activeTab === tab ? "#ffffff" : "#64748b",
                  fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                }}>
                  {tab === "emails" ? `Emails (${result.outreach_targets?.length ?? 0})` : "Raw JSON"}
                </button>
              ))}
            </div>

            {activeTab === "emails" && (
              <>
                <PaginationBar page={page} totalPages={totalPages} totalLeads={totalLeads} onPageChange={fetchPage} />
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {isPaginating ? <Skeletons /> : result.outreach_targets?.map((item, i) => (
                    <EmailCard key={i} item={item} index={(page - 1) * 10 + i} sessionId={SESSION_ID} prospectId={(page - 1) * 10 + i} />
                  ))}
                </div>
                {!isPaginating && result.outreach_targets?.length > 0 && totalPages > 1 && (
                  <div style={{ marginTop: "16px" }}>
                    <PaginationBar page={page} totalPages={totalPages} totalLeads={totalLeads} onPageChange={fetchPage} />
                  </div>
                )}
              </>
            )}

            {activeTab === "raw" && (
              <pre style={{ background: "#f8fafc", border: "1px solid #eaedf3", borderRadius: "8px", padding: "20px", color: "#334155", fontSize: "13px", lineHeight: "1.6", overflowX: "auto", maxHeight: "600px", overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f6fa", color: "#1e293b", fontFamily: "Inter, -apple-system, sans-serif" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex" }}>
        <Sidebar history={history} onView={loadFromHistory} onRerun={rerunFromHistory} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid #eaedf3", padding: "16px 32px", display: "flex", alignItems: "center", gap: "12px", background: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
          <div style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: status === STATUS.RUNNING ? "#f59e0b" : status === STATUS.DONE ? "#10b981" : status === STATUS.ERROR ? "#ef4444" : "#4f46e5",
            animation: isRunning ? "pulse 1.5s infinite" : "none",
          }} />
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", letterSpacing: "0.05em" }}>OUTREACH AGENT</span>
          {senderName && <span style={{ fontSize: "14px", color: "#64748b" }}>/ {senderName}</span>}
          {seeking && <span style={{ fontSize: "14px", color: "#4f46e5", fontWeight: 500 }}>→ {seeking}</span>}
          <span style={{ marginLeft: "auto", fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>{SESSION_ID.slice(0, 8)}</span>
        </div>

        {step === "form" ? <FormStep /> : <ResultsStep />}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #f5f6fa; font-family: 'Inter', -apple-system, sans-serif; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        input::placeholder { color: #94a3b8; }
      `}</style>
    </div>
  );
}
import { useState, useRef, useEffect, useCallback } from "react";
import AgentWindow from "./AgentWindow";
import Sidebar from "./Sidebar";

const SESSION_ID = crypto.randomUUID();
const STATUS = { IDLE: "idle", RUNNING: "running", DONE: "done", ERROR: "error" };

const ROLES = ["Founder","CEO","CTO","CMO","HR Manager","Talent Acquisition","CHRO","Director","Head of Growth","Marketing Manager","Product Manager","Sales Head"];
const INDUSTRIES = ["SaaS","AI / ML","Fintech","Edtech","Ecommerce","Healthcare","Media","Consulting","IT Services","Startup"];
const LOCATIONS = ["Mumbai","Bangalore","Delhi","Hyderabad","Pune","Chennai","India","Global"];
const COMPANY_SIZES = ["1–10","11–50","51–200","201–500","500+"];

function filtersToGoal(filters, seeking, senderName) {
  const parts = [];
  if (filters.roles.length)        parts.push(`roles: ${filters.roles.join(", ")}`);
  if (filters.industries.length)   parts.push(`industries: ${filters.industries.join(", ")}`);
  if (filters.locations.length)    parts.push(`locations: ${filters.locations.join(", ")}`);
  if (filters.companySizes.length) parts.push(`company size: ${filters.companySizes.join(", ")} employees`);
  if (filters.keywords.trim())     parts.push(`keywords: ${filters.keywords.trim()}`);
  const who  = senderName ? `I'm ${senderName}` : "I'm reaching out";
  const seek = seeking.trim() ? `, seeking ${seeking.trim()}` : "";
  return `${who}${seek}. Find professionals matching — ${parts.join(" | ")}`;
}

function exportCSV(targets) {
  const headers = ["Name","Role","Company","LinkedIn","Score","DM Type","DM Body"];
  const rows = targets.map(t => [
    t.prospect?.name || "",
    t.prospect?.role || "",
    t.prospect?.company || "",
    t.prospect?.linkedin_url || "",
    t.score || "",
    t.email?.variants?.[0]?.type || "",
    (t.email?.body || "").replace(/\n/g," "),
  ]);
  const csv = [headers,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `linkedin_leads_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Stable sub-components (defined OUTSIDE App to avoid focus bug) ──────────

function ChipGroup({ label, options, selected, onChange }) {
  const toggle = opt => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  return (
    <div style={{ marginBottom:"20px" }}>
      <div style={{ fontSize:"12px", color:"#64748b", fontWeight:600, marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.05em" }}>{label}</div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
        {options.map(opt => {
          const active = selected.includes(opt);
          return (
            <button key={opt} onClick={() => toggle(opt)} style={{
              padding:"6px 14px", borderRadius:"999px",
              border: active ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
              background: active ? "#e0e7ff" : "#f8fafc",
              color: active ? "#4f46e5" : "#64748b",
              fontSize:"13px", fontWeight: active ? 600 : 500,
              cursor:"pointer", transition:"all 0.15s",
            }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"6px", color: copied ? "#10b981" : "#64748b", fontSize:"12px", fontWeight:500, padding:"6px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", transition:"all 0.2s" }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function CadenceBadge({ cadence }) {
  if (!cadence) return null;
  const step = cadence.current_step || 0;
  const total = cadence.steps?.length || 7;
  const label = cadence.current_status || "Day 0: Profile Viewed";
  const pct   = Math.round((step / (total - 1)) * 100);
  const colors = step === 0 ? ["#e0e7ff","#4f46e5"] : step < 3 ? ["#fef3c7","#d97706"] : step < 5 ? ["#dcfce7","#16a34a"] : ["#f3e8ff","#7c3aed"];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
      <span style={{ background:colors[0], color:colors[1], padding:"3px 10px", borderRadius:"999px", fontSize:"11px", fontWeight:600, whiteSpace:"nowrap" }}>
        {label}
      </span>
      <div style={{ width:"48px", height:"4px", background:"#e2e8f0", borderRadius:"999px", overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:colors[1], borderRadius:"999px", transition:"width 0.4s" }} />
      </div>
      <span style={{ fontSize:"10px", color:"#94a3b8", fontWeight:500 }}>{step}/{total-1}</span>
    </div>
  );
}

function ProspectCard({ item, index, sessionId, prospectId }) {
  const [open, setOpen]       = useState(index === 0);
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(null);
  const { prospect, score, email, cadence } = item;

  const variants = email?.variants || (email?.body ? [
    { type:"Compliment", subject:"LinkedIn DM", body:email.body, personalisation_used:"" }
  ] : []);

  const [activeTab, setActiveTab] = useState(variants[0]?.type || "Compliment");
  const [edits, setEdits] = useState(() => {
    const init = {};
    variants.forEach(v => { init[v.type] = { body: v.body || "" }; });
    return init;
  });

  const activeVariant = variants.find(v => v.type === activeTab) || variants[0] || {};
  const editState     = edits[activeTab] || { body: activeVariant.body || "" };

  const handleEdit = (value) => setEdits(prev => ({ ...prev, [activeTab]: { body: value } }));

  const sendDM = async () => {
    setSending(true);
    try {
      const res = await fetch("/send-email", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ prospect_id:prospectId, session_id:sessionId, subject:"LinkedIn DM", body:editState.body }),
      });
      const data = await res.json();
      setSent(data.sent ? "sent" : "failed");
    } catch { setSent("failed"); }
    setSending(false);
  };

  const dmTypeMeta = {
    Compliment:  { icon:"🌟", color:"#7c3aed", bg:"#f3e8ff" },
    Commonality: { icon:"🤝", color:"#1d4ed8", bg:"#dbeafe" },
    Question:    { icon:"💡", color:"#d97706", bg:"#fef3c7" },
  };

  return (
    <div style={{
      background:"#ffffff", border:"1px solid #e2e8f0",
      borderLeft:`4px solid #4f46e5`,
      marginBottom:"16px", borderRadius:"12px",
      boxShadow:"0 1px 3px rgba(0,0,0,0.05)",
      overflow:"hidden", maxWidth:"896px", width:"100%", margin:"0 auto 16px",
    }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", cursor:"pointer" }}>
        <div style={{ display:"flex", gap:"12px", alignItems:"flex-start" }}>
          <span style={{ color:"#4f46e5", fontWeight:700, fontSize:"14px", marginTop:"2px" }}>#{String(index + 1).padStart(2,"0")}</span>
          <div>
            <div style={{ fontWeight:700, color:"#1e293b", fontSize:"16px" }}>{prospect?.name}</div>
            <div style={{ color:"#64748b", fontSize:"13px", marginTop:"2px" }}>{prospect?.role} {prospect?.company ? `@ ${prospect.company}` : ""}</div>
            <div style={{ marginTop:"6px" }}>
              <CadenceBadge cadence={cadence} />
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ background:"#f1f5f9", color:"#4f46e5", padding:"4px 10px", borderRadius:"999px", fontSize:"12px", fontWeight:600 }}>Score {score}</span>
          <span style={{ fontSize:"18px" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding:"0 20px 20px", borderTop:"1px solid #e2e8f0", paddingTop:"20px" }}>
          {/* CCQ Variant Tabs */}
          {variants.length > 0 && (
            <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
              {variants.map(v => {
                const meta = dmTypeMeta[v.type] || {};
                const isActive = activeTab === v.type;
                return (
                  <button key={v.type} onClick={() => setActiveTab(v.type)} style={{
                    padding:"7px 14px", borderRadius:"8px",
                    border: isActive ? `1.5px solid ${meta.color || "#4f46e5"}` : "1px solid #e2e8f0",
                    background: isActive ? (meta.bg || "#e0e7ff") : "#f8fafc",
                    color: isActive ? (meta.color || "#4f46e5") : "#64748b",
                    fontWeight: isActive ? 700 : 500, fontSize:"13px",
                    cursor:"pointer", transition:"all 0.2s",
                    display:"flex", alignItems:"center", gap:"6px",
                  }}>
                    {meta.icon} {v.type}
                  </button>
                );
              })}
            </div>
          )}

          {activeVariant.personalisation_used && (
            <div style={{ marginBottom:"12px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"#475569" }}>
              <span style={{ fontWeight:600, color:"#4f46e5" }}>Hook: </span>{activeVariant.personalisation_used}
            </div>
          )}

          <div style={{ marginBottom:"16px" }}>
            <div style={{ color:"#64748b", fontSize:"12px", fontWeight:600, marginBottom:"6px" }}>LinkedIn DM Body</div>
            <textarea value={editState.body} onChange={e => handleEdit(e.target.value)}
              style={{ width:"100%", minHeight:"140px", background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:"8px", color:"#1e293b", fontSize:"14px", lineHeight:"1.7", padding:"12px 14px", outline:"none", resize:"vertical", boxSizing:"border-box", transition:"border 0.2s" }}
              onFocus={e => e.target.style.borderColor="#c7d2fe"}
              onBlur={e => e.target.style.borderColor="#e2e8f0"}
            />
            <div style={{ textAlign:"right", fontSize:"11px", color:"#94a3b8", marginTop:"4px" }}>
              {editState.body.split(/\s+/).filter(w => w.length > 0).length} words
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid #e2e8f0", paddingTop:"16px" }}>
            <div style={{ display:"flex", gap:"10px" }}>
              <CopyButton text={editState.body} />
            </div>
            <button onClick={sendDM} disabled={sending || sent === "sent"}
              style={{
                background: sent === "sent" ? "#16a34a" : sent === "failed" ? "#dc2626" : "#4f46e5",
                border:"none", borderRadius:"8px", color:"#fff", fontSize:"13px", fontWeight:600,
                padding:"8px 18px", cursor: (sending || sent === "sent") ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", gap:"8px", transition:"all 0.2s",
                opacity: sent === "sent" ? 0.8 : 1,
              }}>
              {sending ? "Sending..." : sent === "sent" ? "Sent ✓" : sent === "failed" ? "Failed ✗" : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z"/></svg> Send DM</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Skeletons() {
  return (
    <>
      {Array.from({length:6}).map((_,i) => (
        <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderLeft:"4px solid #cbd5e1", marginBottom:"16px", borderRadius:"12px", height:"80px", animation:"skeletonPulse 1.5s infinite", maxWidth:"896px", width:"100%", margin:"0 auto 16px" }} />
      ))}
      <style>{`@keyframes skeletonPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }`}</style>
    </>
  );
}

function PaginationBar({ page, totalPages, totalLeads, onPageChange }) {
  if (totalLeads === 0) {
    return <div style={{ color:"#64748b", fontSize:"14px", padding:"32px 0", textAlign:"center", border:"2px dashed #e2e8f0", borderRadius:"12px", marginBottom:"20px" }}>No leads found for this search.</div>;
  }
  let start = Math.max(1, page - 2);
  let end   = Math.min(totalPages, page + 2);
  if (end - start < 4) {
    if (start === 1) end = Math.min(totalPages, 5);
    else if (end === totalPages) start = Math.max(1, totalPages - 4);
  }
  const pills = [];
  for (let i = start; i <= end; i++) pills.push(i);
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", background:"#fff", padding:"12px 20px", borderRadius:"12px", border:"1px solid #e2e8f0", maxWidth:"896px", width:"100%", margin:"0 auto 20px", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"12px", fontSize:"13px" }}>
        <span style={{ color:"#4f46e5", fontWeight:600 }}>Batch {page} of {totalPages}</span>
        <span style={{ color:"#cbd5e1" }}>•</span>
        <span style={{ color:"#64748b" }}>{totalLeads} total leads</span>
      </div>
      <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
        <button disabled={page===1} onClick={() => onPageChange(page-1)} style={{ background:"transparent", border:"1px solid #e2e8f0", color: page===1 ? "#cbd5e1" : "#64748b", padding:"6px 12px", borderRadius:"6px", cursor: page===1 ? "not-allowed" : "pointer", fontSize:"13px" }}>Prev</button>
        {pills.map(p => (
          <button key={p} onClick={() => onPageChange(p)} style={{ background: p===page ? "#4f46e5" : "transparent", color: p===page ? "#fff" : "#64748b", border: p===page ? "1px solid #4f46e5" : "1px solid #e2e8f0", padding:"6px 12px", borderRadius:"6px", cursor:"pointer", fontSize:"13px", fontWeight: p===page ? 600 : 500, minWidth:"32px" }}>{p}</button>
        ))}
        <button disabled={page===totalPages} onClick={() => onPageChange(page+1)} style={{ background:"transparent", border:"1px solid #e2e8f0", color: page===totalPages ? "#cbd5e1" : "#64748b", padding:"6px 12px", borderRadius:"6px", cursor: page===totalPages ? "not-allowed" : "pointer", fontSize:"13px" }}>Next</button>
      </div>
    </div>
  );
}

// ─── Campaign Stats Bar ──────────────────────────────────────────────────────
function CampaignStatsBar({ totalLeads, launched, replyRate, meetings }) {
  const stats = [
    { icon:"👥", label:"Leads Found",    value: totalLeads,               color:"#4f46e5" },
    { icon:"🚀", label:"Launched",       value: launched,                 color:"#0ea5e9" },
    { icon:"📊", label:"Reply Rate",     value: `${replyRate}%`,          color:"#10b981" },
    { icon:"📅", label:"Meetings Booked",value: meetings,                 color:"#f59e0b" },
  ];
  return (
    <div style={{ display:"flex", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
      {stats.map(s => (
        <div key={s.label} style={{ flex:"1 1 140px", background:"#fff", border:"1px solid #e2e8f0", borderRadius:"12px", padding:"16px 20px", display:"flex", alignItems:"center", gap:"12px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize:"22px" }}>{s.icon}</span>
          <div>
            <div style={{ fontSize:"20px", fontWeight:800, color:s.color, lineHeight:"1" }}>{s.value}</div>
            <div style={{ fontSize:"11px", color:"#94a3b8", fontWeight:600, marginTop:"2px", textTransform:"uppercase", letterSpacing:"0.04em" }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep]             = useState("form");
  const [senderName, setSenderName] = useState("");
  const [seeking, setSeeking]       = useState("");
  const [filters, setFilters]       = useState({ roles:[], industries:[], locations:[], companySizes:[], keywords:"" });
  const [status, setStatus]         = useState(STATUS.IDLE);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const [logs, setLogs]             = useState([]);
  const [activeTab, setActiveTab]   = useState("leads");
  const [launched, setLaunched]     = useState(false);
  const [launching, setLaunching]   = useState(false);

  const [history, setHistory] = useState(() => {
    try { const s = localStorage.getItem("ag_campaign_history"); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });

  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [isPaginating, setIsPaginating] = useState(false);

  const sseRef    = useRef(null);
  const logsEndRef = useRef(null);

  const isRunning = status === STATUS.RUNNING;
  const hasFilters = filters.roles.length || filters.industries.length || filters.locations.length || filters.companySizes.length || filters.keywords.trim();
  const canRun    = senderName.trim() && seeking.trim() && hasFilters;

  const updateFilter = useCallback(key => val => setFilters(f => ({...f, [key]: val})), []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [logs]);

  // ── SSE connection ──────────────────────────────────────────────
  const connectSSE = useCallback((sessionId) => {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(`/stream-campaign?session_id=${sessionId}`);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.log === "__DONE__" || data.log === "__KEEPALIVE__") return;
        setLogs(prev => [...prev, data.log]);
      } catch {}
    };
    es.onerror = () => { es.close(); sseRef.current = null; };
  }, []);

  // ── Fetch page ─────────────────────────────────────────────────
  const fetchPage = async (newPage) => {
    setIsPaginating(true);
    setPage(newPage);
    try {
      const goal = filtersToGoal(filters, seeking, senderName);
      const res  = await fetch(`/run-campaign?page=${newPage}&limit=10`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ goal, session_id:SESSION_ID, sender_name:senderName, seeking }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      setPage(data.current_page || 1);
      setTotalPages(data.total_pages_count || 1);
      setTotalLeads(data.total_leads_count || 0);
    } catch(err) { setError(err.message); }
    setIsPaginating(false);
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  // ── Run campaign ───────────────────────────────────────────────
  const runCampaign = async (overrideFilters, overrideSeeking, overrideSender) => {
    const af = overrideFilters || filters;
    const as = overrideSeeking !== undefined ? overrideSeeking : seeking;
    const an = overrideSender  !== undefined ? overrideSender  : senderName;
    const goal = filtersToGoal(af, as, an);

    setStatus(STATUS.RUNNING);
    setStep("results");
    setResult(null);
    setError(null);
    setPage(1); setTotalPages(1); setTotalLeads(0);
    setLaunched(false);
    setLogs([`▶ Starting LinkedIn campaign...`, `Goal: ${goal}`, `Sender: ${an} — seeking: ${as}`]);

    connectSSE(SESSION_ID);

    try {
      const res = await fetch("/run-campaign?page=1&limit=10", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ goal, session_id:SESSION_ID, sender_name:an, seeking:as }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data);
      setPage(data.current_page || 1);
      setTotalPages(data.total_pages_count || 1);
      setTotalLeads(data.total_leads_count || 0);
      setStatus(STATUS.DONE);
      setLogs(prev => [...prev, `✅ ${data.prospects_found} prospects found`, `💬 ${data.outreach_targets?.length ?? 0} DMs drafted`]);
      setHistory(prev => {
        const next = [{ id:Date.now(), goal, filters:{...af}, seeking:as, senderName:an, prospectsFound:data.prospects_found, emailsDrafted:data.outreach_targets?.length ?? 0, timestamp:new Date().toLocaleTimeString(), result:data, page:data.current_page||1, totalPages:data.total_pages_count||1, totalLeads:data.total_leads_count||0 }, ...prev];
        try { localStorage.setItem("ag_campaign_history", JSON.stringify(next)); } catch {}
        return next;
      });
    } catch(err) {
      setStatus(STATUS.ERROR);
      setError(err.message);
      setLogs(prev => [...prev, `⚠️ ${err.message}`]);
    }
  };

  // ── Launch campaign ────────────────────────────────────────────
  const launchCampaign = async () => {
    setLaunching(true);
    setLogs(prev => [...prev, "🚀 Launch Campaign triggered — starting warm-up sequence..."]);
    connectSSE(SESSION_ID);
    try {
      const res = await fetch("/launch-campaign", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ session_id:SESSION_ID }),
      });
      const data = await res.json();
      if (data.launched) {
        setLaunched(true);
        setLogs(prev => [...prev, `🔍 Warming ${data.warming_up} profiles...`]);
      } else {
        setLogs(prev => [...prev, `⚠️ ${data.error || "Launch failed"}`]);
      }
    } catch(err) { setLogs(prev => [...prev, `⚠️ ${err.message}`]); }
    setLaunching(false);
  };

  const refineAndRerun = () => { setStep("form"); setStatus(STATUS.IDLE); };
  const loadFromHistory = (entry) => {
    setFilters(entry.filters); setSeeking(entry.seeking);
    if (entry.senderName) setSenderName(entry.senderName);
    setResult(entry.result); setPage(entry.page||1);
    setTotalPages(entry.totalPages||1); setTotalLeads(entry.totalLeads||0);
    setStatus(STATUS.DONE); setStep("results"); setLaunched(false);
  };
  const rerunFromHistory = (entry) => {
    setFilters(entry.filters); setSeeking(entry.seeking);
    if (entry.senderName) setSenderName(entry.senderName);
    runCampaign(entry.filters, entry.seeking, entry.senderName);
  };

  // ── Form Step ──────────────────────────────────────────────────
  const renderFormStep = () => (
    <div style={{ maxWidth:"800px", margin:"0 auto", padding:"40px 24px" }}>
      <div style={{ marginBottom:"32px", textAlign:"center" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"#e0e7ff", border:"1px solid #c7d2fe", borderRadius:"999px", padding:"6px 16px", marginBottom:"16px" }}>
          <span style={{ fontSize:"14px" }}>🔗</span>
          <span style={{ fontSize:"12px", fontWeight:700, color:"#4f46e5", letterSpacing:"0.04em" }}>LINKEDIN STRATEGY</span>
        </div>
        <h1 style={{ fontSize:"28px", fontWeight:800, color:"#1e293b", margin:"0 0 8px 0", letterSpacing:"-0.02em" }}>Build Your LinkedIn Campaign</h1>
        <p style={{ fontSize:"14px", color:"#64748b", margin:0 }}>Define your target. The AI will find leads, enrich via LinkedIn, and draft personalised CCQ DMs.</p>
      </div>

      <div style={{ background:"#fff", borderRadius:"12px", padding:"32px", marginBottom:"24px", boxShadow:"0 4px 16px rgba(0,0,0,0.03)", border:"1px solid #e2e8f0" }}>
        <div style={{ fontSize:"18px", fontWeight:700, color:"#1e293b", marginBottom:"8px" }}>About You</div>
        <div style={{ fontSize:"13px", color:"#64748b", marginBottom:"24px" }}>Help the agent understand your value proposition.</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#1e293b", marginBottom:"8px" }}>Your Name</label>
            <input id="input-sender-name" value={senderName} onChange={e => setSenderName(e.target.value)}
              placeholder="e.g. Parth"
              style={{ width:"100%", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"8px", color:"#1e293b", fontSize:"14px", padding:"12px 14px", outline:"none", boxSizing:"border-box", transition:"all 0.2s" }}
              onFocus={e => { e.target.style.borderColor="#c7d2fe"; e.target.style.background="#fff"; }}
              onBlur={e => { e.target.style.borderColor="#e2e8f0"; e.target.style.background="#f8fafc"; }}
            />
          </div>
          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#1e293b", marginBottom:"8px" }}>What are you seeking?</label>
            <input id="input-seeking" value={seeking} onChange={e => setSeeking(e.target.value)}
              placeholder="e.g. ML internship, pilot customers..."
              style={{ width:"100%", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"8px", color:"#1e293b", fontSize:"14px", padding:"12px 14px", outline:"none", boxSizing:"border-box", transition:"all 0.2s" }}
              onFocus={e => { e.target.style.borderColor="#c7d2fe"; e.target.style.background="#fff"; }}
              onBlur={e => { e.target.style.borderColor="#e2e8f0"; e.target.style.background="#f8fafc"; }}
            />
          </div>
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:"12px", padding:"32px", marginBottom:"24px", boxShadow:"0 4px 16px rgba(0,0,0,0.03)", border:"1px solid #e2e8f0" }}>
        <div style={{ fontSize:"18px", fontWeight:700, color:"#1e293b", marginBottom:"8px" }}>Target Leads</div>
        <div style={{ fontSize:"13px", color:"#64748b", marginBottom:"24px" }}>Select the demographics of your ideal LinkedIn prospects.</div>
        <ChipGroup label="Role / Job Title" options={ROLES} selected={filters.roles} onChange={updateFilter("roles")} />
        <ChipGroup label="Industry" options={INDUSTRIES} selected={filters.industries} onChange={updateFilter("industries")} />
        <ChipGroup label="Location" options={LOCATIONS} selected={filters.locations} onChange={updateFilter("locations")} />
        <ChipGroup label="Company Size" options={COMPANY_SIZES} selected={filters.companySizes} onChange={updateFilter("companySizes")} />
        <div style={{ marginTop:"8px" }}>
          <label style={{ display:"block", fontSize:"12px", fontWeight:600, color:"#1e293b", marginBottom:"8px" }}>Additional Keywords (Optional)</label>
          <input id="input-keywords" value={filters.keywords} onChange={e => setFilters(f => ({...f, keywords:e.target.value}))}
            placeholder="e.g. Series A, B2B, actively hiring..."
            style={{ width:"100%", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:"8px", color:"#1e293b", fontSize:"14px", padding:"12px 14px", outline:"none", boxSizing:"border-box", transition:"all 0.2s" }}
            onFocus={e => { e.target.style.borderColor="#c7d2fe"; e.target.style.background="#fff"; }}
            onBlur={e => { e.target.style.borderColor="#e2e8f0"; e.target.style.background="#f8fafc"; }}
          />
        </div>
      </div>

      {canRun && (
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderLeft:"4px solid #10b981", borderRadius:"8px", padding:"16px", marginBottom:"24px", fontSize:"13px", color:"#475569", lineHeight:"1.6" }}>
          <span style={{ color:"#10b981", fontWeight:700, marginRight:"8px" }}>Directive →</span>
          {filtersToGoal(filters, seeking, senderName)}
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"12px" }}>
        {!canRun && (
          <div style={{ fontSize:"12px", color:"#94a3b8", display:"flex", gap:"16px" }}>
            {!senderName.trim() && <span>⚠ Missing Name</span>}
            {!seeking.trim() && <span>⚠ Missing Goal</span>}
            {!hasFilters && <span>⚠ Missing Filters</span>}
          </div>
        )}
        <button id="btn-generate-leads" onClick={() => runCampaign()} disabled={!canRun} style={{
          padding:"14px 48px", background: canRun ? "#4f46e5" : "#e2e8f0",
          color: canRun ? "#fff" : "#94a3b8", border:"none", borderRadius:"999px",
          cursor: canRun ? "pointer" : "not-allowed", fontSize:"15px", fontWeight:700,
          boxShadow: canRun ? "0 4px 16px rgba(79,70,229,0.3)" : "none", transition:"all 0.2s",
        }}>
          🔍 Generate Leads
        </button>
      </div>
    </div>
  );

  // ── Results Step ───────────────────────────────────────────────
  const renderResultsStep = () => (
    <div style={{ maxWidth:"1280px", margin:"0 auto", padding:"32px 24px" }}>
      {/* Top Controls */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <button onClick={refineAndRerun} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"8px", color:"#475569", fontSize:"13px", fontWeight:600, padding:"8px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:"8px" }}>
          ← Refine Filters
        </button>
        <div style={{ display:"flex", gap:"10px" }}>
          {result && (
            <button onClick={() => exportCSV(result.outreach_targets || [])} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:"8px", color:"#475569", fontSize:"13px", fontWeight:600, padding:"8px 16px", cursor:"pointer" }}>
              Export CSV ↓
            </button>
          )}
          {result && status === STATUS.DONE && (
            <button id="btn-launch-campaign" onClick={launchCampaign} disabled={launching || launched}
              style={{
                background: launched ? "#16a34a" : launching ? "#6d28d9" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                border:"none", borderRadius:"8px", color:"#fff", fontSize:"13px", fontWeight:700,
                padding:"8px 20px", cursor: (launching || launched) ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", gap:"8px", boxShadow:"0 4px 12px rgba(79,70,229,0.35)", transition:"all 0.2s",
              }}>
              {launching ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Launching...</>
              ) : launched ? "✓ Campaign Live" : <><span style={{fontSize:"16px"}}>🚀</span> Launch Campaign</>}
            </button>
          )}
        </div>
      </div>

      {/* Campaign Stats Bar */}
      {result && (
        <CampaignStatsBar
          totalLeads={totalLeads}
          launched={launched ? Math.min(result.outreach_targets?.length || 0, 10) : 0}
          replyRate={0}
          meetings={0}
        />
      )}

      {/* Live Terminal — only visible while running or launching */}
      {(isRunning || launching) && <AgentWindow logs={logs} />}

      {/* Error */}
      {error && (
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"12px", padding:"16px 20px", color:"#dc2626", fontSize:"14px", fontWeight:500, marginBottom:"24px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ animation:"fadeIn 0.5s ease" }}>
          {/* Progress Card */}
          <div style={{ background:"#fff", borderRadius:"12px", padding:"24px", marginBottom:"24px", border:"1px solid #e2e8f0", maxWidth:"896px", width:"100%", margin:"0 auto 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <div>
                <div style={{ fontSize:"17px", fontWeight:700, color:"#1e293b" }}>Campaign Progress</div>
                <div style={{ fontSize:"12px", color:"#94a3b8", marginTop:"2px" }}>Session: {SESSION_ID.slice(0,8)}</div>
              </div>
              <span style={{ background: status===STATUS.DONE ? "#dcfce7" : "#fef3c7", color: status===STATUS.DONE ? "#16a34a" : "#d97706", padding:"5px 14px", borderRadius:"999px", fontSize:"12px", fontWeight:600 }}>
                {status===STATUS.DONE ? "✓ Completed" : "⟳ Running"}
              </span>
            </div>
            <div style={{ width:"100%", height:"6px", background:"#f1f5f9", borderRadius:"999px", overflow:"hidden" }}>
              <div style={{ width: status===STATUS.DONE ? "100%" : status===STATUS.RUNNING ? "50%" : "0%", height:"100%", background:"linear-gradient(90deg,#4f46e5,#7c3aed)", borderRadius:"999px", transition:"width 0.8s ease" }} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginTop:"20px" }}>
              {[
                { label:"Prospects Found", value:`${result.prospects_found || 0}`, icon:"👥" },
                { label:"DMs Drafted", value:`${result.outreach_targets?.length ?? 0}`, icon:"💬" },
              ].map(s => (
                <div key={s.label} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", padding:"16px", borderRadius:"10px", display:"flex", alignItems:"center", gap:"12px" }}>
                  <span style={{ fontSize:"22px" }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize:"22px", fontWeight:800, color:"#1e293b" }}>{s.value}</div>
                    <div style={{ fontSize:"12px", color:"#64748b", marginTop:"2px" }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tab Switcher */}
          <div style={{ display:"flex", gap:"10px", marginBottom:"24px", maxWidth:"896px", width:"100%", margin:"0 auto 24px" }}>
            {[["leads",`DMs (${result.outreach_targets?.length ?? 0})`],["raw","Raw JSON"]].map(([tab,label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding:"8px 18px", background: activeTab===tab ? "#1e293b" : "#fff",
                border: activeTab===tab ? "1px solid #1e293b" : "1px solid #e2e8f0",
                borderRadius:"999px", color: activeTab===tab ? "#fff" : "#64748b",
                fontSize:"13px", fontWeight:600, cursor:"pointer", transition:"all 0.2s",
              }}>{label}</button>
            ))}
          </div>

          {/* Leads Grid */}
          {activeTab === "leads" && (
            <div>
              <PaginationBar page={page} totalPages={totalPages} totalLeads={totalLeads} onPageChange={fetchPage} />
              <div style={{ display:"flex", flexDirection:"column" }}>
                {isPaginating ? <Skeletons /> : result.outreach_targets?.map((item, i) => (
                  <ProspectCard key={i} item={item} index={(page-1)*10+i} sessionId={SESSION_ID} prospectId={(page-1)*10+i} />
                ))}
              </div>
              {!isPaginating && result.outreach_targets?.length > 0 && totalPages > 1 && (
                <div style={{ marginTop:"8px" }}>
                  <PaginationBar page={page} totalPages={totalPages} totalLeads={totalLeads} onPageChange={fetchPage} />
                </div>
              )}
            </div>
          )}

          {activeTab === "raw" && (
            <pre style={{ background:"#0d1117", border:"1px solid #21262d", borderRadius:"10px", padding:"20px", color:"#58a6ff", fontSize:"12px", lineHeight:"1.6", overflowX:"auto", maxHeight:"600px", overflowY:"auto", whiteSpace:"pre-wrap", wordBreak:"break-word", maxWidth:"896px", margin:"0 auto" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#f8fafc", color:"#1e293b", fontFamily:"Inter,-apple-system,sans-serif" }}>
      <div style={{ position:"sticky", top:0, height:"100vh", display:"flex" }}>
        <Sidebar history={history} onView={loadFromHistory} onRerun={rerunFromHistory} />
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* Header */}
        <div style={{ borderBottom:"1px solid #e2e8f0", padding:"16px 32px", display:"flex", alignItems:"center", gap:"12px", background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.03)" }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background: isRunning ? "#f59e0b" : status===STATUS.DONE ? "#10b981" : status===STATUS.ERROR ? "#ef4444" : "#4f46e5", animation: isRunning ? "pulse 1.5s infinite" : "none" }} />
          <span style={{ fontSize:"13px", fontWeight:700, color:"#1e293b", letterSpacing:"0.06em" }}>OUTREACH AGENT</span>
          <span style={{ background:"#e0e7ff", color:"#4f46e5", fontSize:"11px", fontWeight:700, padding:"2px 8px", borderRadius:"4px", letterSpacing:"0.05em" }}>LINKEDIN</span>
          {senderName && <span style={{ fontSize:"14px", color:"#64748b" }}>/ {senderName}</span>}
          {seeking && <span style={{ fontSize:"14px", color:"#4f46e5", fontWeight:500 }}>→ {seeking}</span>}
          <span style={{ marginLeft:"auto", fontSize:"12px", color:"#94a3b8" }}>{SESSION_ID.slice(0,8)}</span>
        </div>

        {step === "form" ? renderFormStep() : renderResultsStep()}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin:0; background:#f8fafc; font-family:'Inter',-apple-system,sans-serif; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes spin   { 100%{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }
        ::-webkit-scrollbar-thumb:hover { background:#94a3b8; }
        input::placeholder, textarea::placeholder { color:#94a3b8; }
        button:active { transform:scale(0.97); }
      `}</style>
    </div>
  );
}
import React, { useState, useEffect } from 'react';

export function ProspectDrawer({ prospect, isOpen, onClose }) {
  // ALL hooks must be at the top — never after a conditional return
  const [activeTab, setActiveTab] = useState('dm');

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Reset tab when drawer opens on a new prospect
  useEffect(() => {
    if (isOpen) setActiveTab('dm');
  }, [isOpen, prospect]);

  // Guard AFTER all hooks
  if (!isOpen || !prospect) return null;

  const {
    name = "Unknown Prospect",
    role = "Unknown Role",
    company = "",
    location = "Unknown Location",
    url = "",
    profile = {},
    recency = [],
    tone = {},
    red_flags = [],
    icebreakers = [],
    drafts = {}
  } = prospect || {};

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    /* Backdrop — semi-transparent, clicking it closes the drawer */
    <div
      className="fixed inset-0 z-[1000] flex"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      {/* Drawer panel — slides in from the right, explicit bg so it's never transparent */}
      <div
        className="ml-auto h-full w-full max-w-4xl flex flex-col overflow-hidden animate-slide-in"
        style={{ background: '#0D1117', boxShadow: '-10px 0 60px rgba(0,0,0,0.7)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrollable content */}
        <div className="flex-1 flex flex-col overflow-y-auto">

          {/* Drawer Header */}
          <div className="sticky top-0 z-10 bg-[#161B22] border-b border-[#30363D] px-8 py-5 flex justify-between items-center shadow-2xl">
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black text-[#E6EDF3] tracking-tight">{name}</h2>
                <span className="text-[10px] bg-[#1a1000] text-[#FF9900] px-3 py-1 rounded-full font-black uppercase tracking-[0.2em] border border-[#FF9900]/30 shadow-[0_0_15px_rgba(255,153,0,0.1)]">Full Intelligence Report</span>
              </div>
              <div className="text-[#7D8590] font-bold text-sm mt-1.5 flex items-center gap-2">
                <span className="text-[#FF9900]/70">💼</span> {role} {company ? `@ ${company}` : ''} <span className="mx-2 opacity-20">|</span> <span className="text-[#FF9900]/70">📍</span> {location}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#E6EDF3] hover:text-[#0D1117] bg-[#30363D] hover:bg-[#FF9900] px-6 py-2.5 rounded-lg transition-all border border-[#30363D] font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-lg active:scale-95"
            >
              <span>Close File</span> <span className="text-lg opacity-50">✕</span>
            </button>
          </div>

          <div className="max-w-6xl mx-auto w-full p-10 flex flex-col gap-16">

            {/* Section: Background */}
            <section className="animate-fade-in">
              <h3 className="text-xs font-black text-[#FF9900] uppercase tracking-[0.4em] mb-6 border-b border-[#30363D] pb-3 opacity-80">Background Analysis</h3>
              <div className="bg-[#161B22] p-8 rounded-2xl border border-[#30363D] shadow-inner flex gap-6 text-[#E6EDF3] leading-relaxed relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#FF9900] opacity-30 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-xl font-medium font-serif italic text-[#E6EDF3]/90 leading-loose">
                  {profile?.summary || "No summary available."}
                </p>
              </div>

              <div className="mt-6 flex gap-4 text-[10px] flex-wrap">
                {(profile?.links ? Object.entries(profile.links) : []).map(([k, v]) => v ? (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="px-5 py-3 bg-[#161B22] border border-[#30363D] rounded-lg hover:border-[#FF9900] hover:text-[#FF9900] transition-all capitalize text-[#7D8590] font-black tracking-widest flex items-center gap-3 shadow-md group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span> {k === 'linkedin' ? 'LinkedIn Intelligence' : k}
                  </a>
                ) : null)}
                {url && !profile?.links?.linkedin && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="px-5 py-3 bg-[#161B22] border border-[#30363D] rounded-lg hover:border-[#FF9900] hover:text-[#FF9900] transition-all capitalize text-[#7D8590] font-black tracking-widest flex items-center gap-3 shadow-md group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span> LinkedIn Intelligence
                  </a>
                )}
              </div>
            </section>

            {/* Section: Recent Signals */}
            <section className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <h3 className="text-xs font-black text-[#FF9900] uppercase tracking-[0.4em] mb-6 border-b border-[#30363D] pb-3 opacity-80">Timeline Pulse</h3>
              <div className="grid gap-4">
                {(recency || []).length > 0 ? (recency || []).map((r, i) => (
                  <div key={i} className={`p-6 rounded-2xl border flex justify-between items-center gap-6 transition-all ${r?.is_fresh ? 'bg-[#1a1000] border-[#FF9900]/50 shadow-[0_0_15px_rgba(255,153,0,0.05)] border-l-4 border-l-[#FF9900]' : 'bg-[#161B22] border-[#30363D] opacity-60 hover:opacity-100'}`}>
                    <div className="flex-1">
                      <p className={`text-lg font-black tracking-tight ${r?.is_fresh ? 'text-[#FF9900]' : 'text-[#E6EDF3]'}`}>{r?.action}</p>
                      <div className="mt-3 text-[9px] font-black px-3 py-1 rounded bg-[#0D1117] inline-block text-[#7D8590] border border-[#30363D] uppercase tracking-widest">
                        Signal Intercepted via {r?.source}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-xs font-black text-[#E6EDF3] block">{r?.time_ago}</span>
                      {!r?.is_fresh && <div className="text-[9px] text-[#D29922] font-black uppercase mt-1 opacity-50">Historical Data</div>}
                    </div>
                  </div>
                )) : (
                  <p className="text-[#30363D] italic text-sm font-black uppercase tracking-widest">No recent trajectory signals found.</p>
                )}
              </div>
            </section>

            {/* Section: Communication Analysis */}
            <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-xs font-black text-[#FF9900] uppercase tracking-[0.4em] mb-6 border-b border-[#30363D] pb-3 opacity-80">Psychological Profile</h3>
              <div className="bg-[#161B22] p-10 rounded-2xl border border-[#30363D] shadow-2xl relative">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
                  {[
                    { label: 'Linguistic Style', val: tone?.style || 'Adaptive' },
                    { label: 'Formality Level', val: tone?.formality || 'Modern' },
                    { label: 'Vocabulary Depth', val: tone?.vocabulary || 'Expert' },
                    { label: 'Emoji Density', val: tone?.emoji_usage || 'Dynamic' }
                  ].map((t, idx) => (
                    <div key={idx} className="bg-[#0D1117] p-5 rounded-xl border border-[#30363D] flex flex-col items-center justify-center text-center group hover:border-[#FF9900]/30 transition-all">
                      <span className="text-[9px] uppercase font-black text-[#7D8590] mb-2 tracking-[0.2em]">{t.label}</span>
                      <span className="font-black text-[#E6EDF3] capitalize text-sm group-hover:text-[#FF9900] transition-colors">{t.val}</span>
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <span className="absolute -top-6 -left-2 text-6xl text-[#30363D] font-serif opacity-30">"</span>
                  <p className="text-[#E6EDF3] leading-relaxed mb-8 border-l-2 border-[#FF9900]/50 pl-8 py-4 text-xl italic font-serif opacity-90">
                    {tone?.analysis_paragraph || "Deep tone analysis unavailable for this profile."}
                  </p>
                </div>

                {tone?.quote && tone.quote !== "null" && (
                  <div className="bg-[#0D1117] p-6 rounded-xl border border-[#30363D] text-[#7D8590] text-sm font-mono italic flex gap-4 items-start">
                    <span className="text-[#3FB950] font-black">SCAN_LOG:</span>
                    <span>"{tone.quote}"</span>
                  </div>
                )}
              </div>
            </section>

            {/* Section: Threat Detection */}
            <section className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <h3 className="text-xs font-black text-[#FF9900] uppercase tracking-[0.4em] mb-6 border-b border-[#30363D] pb-3 opacity-80">Threat Detection</h3>
              {(red_flags || []).length > 0 ? (
                <div className="flex flex-col gap-4">
                  {(red_flags || []).map((f, i) => (
                    <div key={i} className="bg-[#161B22] border border-[#F85149]/30 rounded-2xl p-6 flex gap-6 items-start shadow-xl border-l-8 border-l-[#F85149]">
                      <div className="text-[#F85149] font-black text-[10px] uppercase tracking-widest pt-1 px-3 py-1 bg-[#F85149]/10 rounded border border-[#F85149]/20">{f?.severity}</div>
                      <div>
                        <h4 className="font-black text-[#E6EDF3] text-lg tracking-tight">{f?.flag}</h4>
                        <p className="text-sm text-[#7D8590] mt-1 font-medium italic">Detection logic: {f?.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#161B22] border border-[#3FB950]/20 border-l-8 border-l-[#3FB950] rounded-2xl p-8 text-[#3FB950] flex items-center gap-6 shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-[#3FB950]/10 flex items-center justify-center text-2xl border border-[#3FB950]/30 shadow-[0_0_20px_rgba(63,185,80,0.1)]">✓</div>
                  <div>
                    <span className="font-black uppercase tracking-[0.2em] text-xs">Clearance Granted</span>
                    <p className="text-[#E6EDF3] font-bold tracking-tight text-lg mt-1">Zero critical engagement blockers identified.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Section: Strategic Outreach */}
            <section className="mb-24 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <h3 className="text-xs font-black text-[#FF9900] uppercase tracking-[0.4em] mb-6 border-b border-[#30363D] pb-3 opacity-80">Strategic Outreach</h3>

              <div className="flex gap-4 mb-8 p-1.5 bg-[#161B22] rounded-xl w-fit border border-[#30363D]">
                <button
                  onClick={() => setActiveTab('dm')}
                  className={`py-3 px-10 font-black text-[10px] uppercase tracking-[0.2em] transition-all rounded-lg ${activeTab === 'dm' ? 'bg-[#FF9900] text-[#0D1117] shadow-[0_0_20px_rgba(255,153,0,0.2)]' : 'text-[#7D8590] hover:text-[#E6EDF3] hover:bg-[#30363D]'}`}
                >
                  LinkedIn DM
                </button>
                <button
                  onClick={() => setActiveTab('email')}
                  className={`py-3 px-10 font-black text-[10px] uppercase tracking-[0.2em] transition-all rounded-lg ${activeTab === 'email' ? 'bg-[#FF9900] text-[#0D1117] shadow-[0_0_20px_rgba(255,153,0,0.2)]' : 'text-[#7D8590] hover:text-[#E6EDF3] hover:bg-[#30363D]'}`}
                >
                  Cold Email
                </button>
              </div>

              {activeTab === 'dm' && (
                <div className="flex flex-col gap-8">
                  <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative border-t-4 border-t-[#FF9900]">
                    <div className="bg-[#0D1117] border-b border-[#30363D] px-8 py-4 flex justify-between items-center text-[10px] font-black text-[#7D8590] uppercase tracking-widest">
                      <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FF9900]"></div> Personalization Core</span>
                      <button onClick={() => handleCopy(drafts?.dm_draft)} className="text-[#FF9900] hover:text-[#0D1117] font-black border border-[#FF9900]/50 hover:bg-[#FF9900] px-5 py-2 rounded-lg transition-all active:scale-90">Copy Final Version</button>
                    </div>
                    <div className="p-10 text-[#E6EDF3] whitespace-pre-wrap leading-relaxed font-serif text-2xl tracking-tight bg-gradient-to-br from-[#161B22] to-[#0D1117]">
                      {(drafts || {}).dm_draft || "Draft generation failed. Check system logs."}
                    </div>
                  </div>
                  <div className="bg-[#1a1000] border border-[#FF9900]/20 p-8 rounded-2xl shadow-inner flex gap-6">
                    <div className="text-2xl opacity-50">💡</div>
                    <div>
                      <span className="font-black text-[#FF9900] text-[10px] uppercase tracking-[0.3em] block mb-2">Tactical Rationale:</span>
                      <p className="text-[#E6EDF3]/80 text-sm leading-loose italic font-medium">{(drafts || {}).dm_rationale || "Strategic context not provided."}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'email' && (
                <div className="flex flex-col gap-8">
                  <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative border-t-4 border-t-[#FF9900]">
                    <div className="bg-[#0D1117] border-b border-[#30363D] px-8 py-4 flex justify-between items-center text-[10px] font-black text-[#7D8590] uppercase tracking-widest">
                      <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FF9900]"></div> Messaging Core</span>
                      <button onClick={() => handleCopy(drafts?.email_draft)} className="text-[#FF9900] hover:text-[#0D1117] font-black border border-[#FF9900]/50 hover:bg-[#FF9900] px-5 py-2 rounded-lg transition-all active:scale-90">Copy Final Version</button>
                    </div>
                    <div className="p-10 text-[#E6EDF3] whitespace-pre-wrap leading-relaxed font-serif text-2xl tracking-tight bg-gradient-to-br from-[#161B22] to-[#0D1117]">
                      {(drafts || {}).email_draft || "Draft generation failed. Check system logs."}
                    </div>
                  </div>
                  <div className="bg-[#1a1000] border border-[#FF9900]/20 p-8 rounded-2xl shadow-inner flex gap-6">
                    <div className="text-2xl opacity-50">💡</div>
                    <div>
                      <span className="font-black text-[#FF9900] text-[10px] uppercase tracking-[0.3em] block mb-2">Tactical Rationale:</span>
                      <p className="text-[#E6EDF3]/80 text-sm leading-loose italic font-medium">{(drafts || {}).email_rationale || "Strategic context not provided."}</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

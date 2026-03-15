import React, { useState, useEffect } from 'react';

export function ProspectDrawer({ prospect, isOpen, onClose }) {
  // All hooks at the top — never after a conditional return
  const [activeTab, setActiveTab] = useState('dm');

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Reset tab when a new prospect opens
  useEffect(() => {
    if (isOpen) setActiveTab('dm');
  }, [isOpen, prospect]);

  // Guard after all hooks
  if (!isOpen || !prospect) return null;

  const {
    name = 'Unknown Prospect',
    role = 'Unknown Role',
    company = '',
    location = 'Unknown Location',
    url = '',
    profile = {},
    recency = [],
    tone = {},
    red_flags = [],
    icebreakers = [],
    drafts = {}
  } = prospect || {};

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text || '');
    alert('Copied to clipboard!');
  };

  const inputClass = 'bg-[#161B22] border border-[#444c56] rounded-md p-1.5 text-xs text-[#E6EDF3] placeholder:text-[#30363D] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all';

  return (
    /* ── Backdrop ── blurred, semi-transparent, click to close */
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* ── Centered Modal ── */}
      <div
        className="modal-animate flex flex-col overflow-hidden rounded-2xl border border-[#30363D] shadow-[0_30px_80px_rgba(0,0,0,0.8)]"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '680px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          background: '#0D1117',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sticky Modal Header ── */}
        <div
          className="flex-shrink-0 border-b border-[#30363D] flex justify-between items-start gap-4 z-10"
          style={{ background: '#0D1117', padding: '16px 24px' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-black text-[#E6EDF3] tracking-tight truncate">{name}</h2>
              <span className="text-[9px] bg-[#1a1000] text-[#FF9900] px-2 py-0.5 rounded-full font-black uppercase tracking-[0.2em] border border-[#FF9900]/30 whitespace-nowrap flex-shrink-0">
                Full Intelligence Report
              </span>
            </div>
            <div className="text-[#7D8590] font-bold text-xs mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[#FF9900]/70">💼</span>
              <span>{role}{company ? ` @ ${company}` : ''}</span>
              <span className="opacity-20 mx-1">|</span>
              <span className="text-[#FF9900]/70">📍</span>
              <span>{location}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-[#E6EDF3] hover:text-[#0D1117] bg-[#30363D] hover:bg-[#FF9900] px-4 py-2 rounded-lg transition-all border border-[#30363D] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95"
          >
            <span>Close</span> <span className="opacity-50">✕</span>
          </button>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-10 p-6">

            {/* Section: Background Analysis */}
            <section>
              <h3 className="text-[10px] font-black text-[#FF9900] uppercase tracking-[0.4em] mb-4 border-b border-[#30363D] pb-2 opacity-80">
                Background Analysis
              </h3>
              <div className="bg-[#161B22] p-5 rounded-xl border border-[#30363D] shadow-inner flex gap-4 text-[#E6EDF3] leading-relaxed relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#FF9900] opacity-30 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-sm font-medium font-serif italic text-[#E6EDF3]/90 leading-loose">
                  {profile?.summary || 'No summary available.'}
                </p>
              </div>
              <div className="mt-4 flex gap-3 flex-wrap">
                {(profile?.links ? Object.entries(profile.links) : []).map(([k, v]) => v ? (
                  <a key={k} href={v} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg hover:border-[#FF9900] hover:text-[#FF9900] transition-all capitalize text-[#7D8590] font-black tracking-wider text-[10px] flex items-center gap-2 group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                    {k === 'linkedin' ? 'LinkedIn' : k}
                  </a>
                ) : null)}
                {url && !profile?.links?.linkedin && (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#161B22] border border-[#30363D] rounded-lg hover:border-[#FF9900] hover:text-[#FF9900] transition-all text-[#7D8590] font-black tracking-wider text-[10px] flex items-center gap-2 group">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span> LinkedIn
                  </a>
                )}
              </div>
            </section>

            {/* Section: Timeline Pulse */}
            <section>
              <h3 className="text-[10px] font-black text-[#FF9900] uppercase tracking-[0.4em] mb-4 border-b border-[#30363D] pb-2 opacity-80">
                Timeline Pulse
              </h3>
              <div className="flex flex-col gap-3">
                {(recency || []).length > 0 ? (recency || []).map((r, i) => (
                  <div key={i} className={`p-4 rounded-xl border flex justify-between items-center gap-4 transition-all ${r?.is_fresh ? 'bg-[#1a1000] border-[#FF9900]/50 border-l-4 border-l-[#FF9900]' : 'bg-[#161B22] border-[#30363D] opacity-60 hover:opacity-100'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black tracking-tight truncate ${r?.is_fresh ? 'text-[#FF9900]' : 'text-[#E6EDF3]'}`}>{r?.action}</p>
                      <div className="mt-1.5 text-[8px] font-black px-2 py-0.5 rounded bg-[#0D1117] inline-block text-[#7D8590] border border-[#30363D] uppercase tracking-widest">
                        via {r?.source}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap flex-shrink-0">
                      <span className="text-[10px] font-black text-[#E6EDF3] block">{r?.time_ago}</span>
                      {!r?.is_fresh && <div className="text-[8px] text-[#D29922] font-black uppercase mt-0.5 opacity-50">Historical</div>}
                    </div>
                  </div>
                )) : (
                  <p className="text-[#30363D] italic text-xs font-black uppercase tracking-widest">No recent trajectory signals found.</p>
                )}
              </div>
            </section>

            {/* Section: How They Communicate */}
            <section>
              <h3 className="text-[10px] font-black text-[#FF9900] uppercase tracking-[0.4em] mb-4 border-b border-[#30363D] pb-2 opacity-80">
                How They Communicate
              </h3>
              <div className="bg-[#161B22] p-5 rounded-xl border border-[#30363D] shadow-xl">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Style', val: tone?.style || 'Adaptive' },
                    { label: 'Formality', val: tone?.formality || 'Modern' },
                    { label: 'Vocabulary', val: tone?.vocabulary || 'Expert' },
                    { label: 'Emoji Use', val: tone?.emoji_usage || 'Dynamic' }
                  ].map((t, idx) => (
                    <div key={idx} className="bg-[#0D1117] p-3 rounded-lg border border-[#30363D] flex flex-col items-center text-center group hover:border-[#FF9900]/30 transition-all">
                      <span className="text-[8px] uppercase font-black text-[#7D8590] mb-1 tracking-[0.2em]">{t.label}</span>
                      <span className="font-black text-[#E6EDF3] capitalize text-xs group-hover:text-[#FF9900] transition-colors">{t.val}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[#E6EDF3] leading-relaxed border-l-2 border-[#FF9900]/50 pl-4 py-2 text-sm italic font-serif opacity-90">
                  {tone?.analysis_paragraph || 'Deep tone analysis unavailable for this profile.'}
                </p>
                {tone?.quote && tone.quote !== 'null' && (
                  <div className="bg-[#0D1117] p-4 rounded-lg border border-[#30363D] text-[#7D8590] text-xs font-mono italic flex gap-3 items-start mt-4">
                    <span className="text-[#3FB950] font-black flex-shrink-0">SCAN_LOG:</span>
                    <span>"{tone.quote}"</span>
                  </div>
                )}
              </div>
            </section>

            {/* Section: Before You Reach Out */}
            <section>
              <h3 className="text-[10px] font-black text-[#FF9900] uppercase tracking-[0.4em] mb-4 border-b border-[#30363D] pb-2 opacity-80">
                Before You Reach Out
              </h3>
              {(red_flags || []).length > 0 ? (
                <div className="flex flex-col gap-3">
                  {(red_flags || []).map((f, i) => (
                    <div key={i} className="bg-[#161B22] border border-[#F85149]/30 rounded-xl p-4 flex gap-4 items-start border-l-4 border-l-[#F85149]">
                      <div className="text-[#F85149] font-black text-[8px] uppercase tracking-widest px-2 py-1 bg-[#F85149]/10 rounded border border-[#F85149]/20 flex-shrink-0">{f?.severity}</div>
                      <div>
                        <h4 className="font-black text-[#E6EDF3] text-sm tracking-tight">{f?.flag}</h4>
                        <p className="text-xs text-[#7D8590] mt-0.5 font-medium italic">{f?.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#161B22] border border-[#3FB950]/20 border-l-4 border-l-[#3FB950] rounded-xl p-4 text-[#3FB950] flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#3FB950]/10 flex items-center justify-center text-base border border-[#3FB950]/30 flex-shrink-0">✓</div>
                  <div>
                    <span className="font-black uppercase tracking-[0.2em] text-[9px]">Clearance Granted</span>
                    <p className="text-[#E6EDF3] font-bold tracking-tight text-sm mt-0.5">Zero critical engagement blockers identified.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Section: Conversation Starters */}
            {(icebreakers || []).length > 0 && (
              <section>
                <h3 className="text-[10px] font-black text-[#FF9900] uppercase tracking-[0.4em] mb-4 border-b border-[#30363D] pb-2 opacity-80">
                  Conversation Starters
                </h3>
                <div className="flex flex-col gap-2">
                  {(icebreakers || []).map((ic, i) => (
                    <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-lg p-3 flex gap-3 items-start hover:border-[#FF9900]/30 transition-all group">
                      <span className="text-[#FF9900] font-black text-[10px] flex-shrink-0 mt-0.5">{i + 1}.</span>
                      <div>
                        <p className="text-[#E6EDF3] text-xs font-medium leading-snug">{ic?.text}</p>
                        {ic?.source && <p className="text-[8px] text-[#7D8590] mt-1 italic">{ic.source}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Section: Your Outreach Drafts */}
            <section className="mb-4">
              <h3 className="text-[10px] font-black text-[#FF9900] uppercase tracking-[0.4em] mb-4 border-b border-[#30363D] pb-2 opacity-80">
                Your Outreach Drafts
              </h3>

              {/* Tab Switcher */}
              <div className="flex gap-2 mb-5 p-1 bg-[#161B22] rounded-lg w-fit border border-[#30363D]">
                <button
                  onClick={() => setActiveTab('dm')}
                  className={`py-2 px-6 font-black text-[10px] uppercase tracking-[0.2em] transition-all rounded-md ${activeTab === 'dm' ? 'bg-[#FF9900] text-[#0D1117] shadow-md' : 'text-[#7D8590] hover:text-[#E6EDF3] hover:bg-[#30363D]'}`}
                >
                  LinkedIn DM
                </button>
                <button
                  onClick={() => setActiveTab('email')}
                  className={`py-2 px-6 font-black text-[10px] uppercase tracking-[0.2em] transition-all rounded-md ${activeTab === 'email' ? 'bg-[#FF9900] text-[#0D1117] shadow-md' : 'text-[#7D8590] hover:text-[#E6EDF3] hover:bg-[#30363D]'}`}
                >
                  Cold Email
                </button>
              </div>

              {activeTab === 'dm' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden border-t-2 border-t-[#FF9900]">
                    <div className="bg-[#0D1117] border-b border-[#30363D] px-4 py-3 flex justify-between items-center">
                      <span className="text-[9px] font-black text-[#7D8590] uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#FF9900]"></div> Personalization Core
                      </span>
                      <button
                        onClick={() => handleCopy(drafts?.dm_draft)}
                        className="text-[#FF9900] hover:text-[#0D1117] font-black border border-[#FF9900]/50 hover:bg-[#FF9900] px-3 py-1 rounded-lg transition-all text-[9px] uppercase tracking-widest active:scale-90"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="p-5 text-[#E6EDF3] whitespace-pre-wrap leading-relaxed font-serif text-sm">
                      {(drafts || {}).dm_draft || 'Draft generation failed. Check system logs.'}
                    </div>
                  </div>
                  {(drafts || {}).dm_rationale && (
                    <div className="bg-[#1a1000] border border-[#FF9900]/20 p-4 rounded-xl flex gap-3">
                      <div className="text-lg opacity-50 flex-shrink-0">💡</div>
                      <div>
                        <span className="font-black text-[#FF9900] text-[9px] uppercase tracking-[0.3em] block mb-1">Tactical Rationale:</span>
                        <p className="text-[#E6EDF3]/80 text-xs leading-relaxed italic font-medium">{drafts.dm_rationale}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'email' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden border-t-2 border-t-[#FF9900]">
                    <div className="bg-[#0D1117] border-b border-[#30363D] px-4 py-3 flex justify-between items-center">
                      <span className="text-[9px] font-black text-[#7D8590] uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-[#FF9900]"></div> Messaging Core
                      </span>
                      <button
                        onClick={() => handleCopy(drafts?.email_draft)}
                        className="text-[#FF9900] hover:text-[#0D1117] font-black border border-[#FF9900]/50 hover:bg-[#FF9900] px-3 py-1 rounded-lg transition-all text-[9px] uppercase tracking-widest active:scale-90"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="p-5 text-[#E6EDF3] whitespace-pre-wrap leading-relaxed font-serif text-sm">
                      {(drafts || {}).email_draft || 'Draft generation failed. Check system logs.'}
                    </div>
                  </div>
                  {(drafts || {}).email_rationale && (
                    <div className="bg-[#1a1000] border border-[#FF9900]/20 p-4 rounded-xl flex gap-3">
                      <div className="text-lg opacity-50 flex-shrink-0">💡</div>
                      <div>
                        <span className="font-black text-[#FF9900] text-[9px] uppercase tracking-[0.3em] block mb-1">Tactical Rationale:</span>
                        <p className="text-[#E6EDF3]/80 text-xs leading-relaxed italic font-medium">{drafts.email_rationale}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

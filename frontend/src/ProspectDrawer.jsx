import React, { useState } from 'react';

export function ProspectDrawer({ prospect, isOpen, onClose }) {
  if (!isOpen || !prospect) return null;

  const [activeTab, setActiveTab] = useState('dm');

  const {
    name, role, company, location, url, profile, recency, tone, red_flags, icebreakers, drafts
  } = prospect;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm p-4 w-full sm:p-0">
      <div className="w-full max-w-4xl h-full bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto flex flex-col transform transition-transform duration-300 relative">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-800/90 backdrop-blur border-b border-slate-700 px-8 py-5 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{name}</h2>
            <div className="text-slate-400 font-medium">
              {role} @ {company} · {location}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2 rounded-full transition-colors"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-8 flex flex-col gap-12">
          
          {/* Section: Who They Are */}
          <section>
            <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">Who They Are</h3>
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex gap-4 text-slate-300 leading-relaxed max-w-2xl">
              <span className="font-semibold w-24 shrink-0 text-slate-400">Summary:</span>
              <span>{profile?.summary || "No summary available."}</span>
            </div>
            
            <div className="mt-4 flex gap-3 text-sm flex-wrap">
              {profile?.links && Object.entries(profile.links).map(([k, v]) => v ? (
                <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 capitalize text-indigo-300">
                  {k === 'linkedin' ? 'LinkedIn' : k}
                </a>
              ) : null)}
              {url && !profile?.links?.linkedin && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 capitalize text-indigo-300">
                  LinkedIn Profile
                </a>
              )}
            </div>
          </section>

          {/* Section: What They're Working On */}
          <section>
            <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">What They're Working On</h3>
            <div className="flex flex-col gap-4">
              {recency?.length > 0 ? recency.map((r, i) => (
                <div key={i} className={`p-4 rounded-xl border flex justify-between items-start gap-4 ${r.is_fresh ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-slate-800 border-slate-700'}`}>
                  <div className="flex-1">
                    <p className={`font-semibold ${r.is_fresh ? 'text-indigo-200' : 'text-slate-300'}`}>{r.action}</p>
                    <div className="mt-2 text-xs font-mono px-2 py-0.5 rounded bg-black/30 inline-block text-slate-400 border border-slate-600">
                      via {r.source}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-400">{r.time_ago}</span>
                    {!r.is_fresh && <div className="text-[10px] text-amber-500/70 uppercase mt-1">May be outdated</div>}
                  </div>
                </div>
              )) : (
                <p className="text-slate-400 italic">No recent signals found.</p>
              )}
            </div>
          </section>

          {/* Section: How They Communicate */}
          <section>
            <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">How They Communicate</h3>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-sm">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase text-slate-500 mb-1">Style</span>
                  <span className="font-bold text-slate-200 capitalize">{tone?.style || "Unknown"}</span>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase text-slate-500 mb-1">Formality</span>
                  <span className="font-bold text-slate-200 capitalize">{tone?.formality || "Neutral"}</span>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase text-slate-500 mb-1">Vocabulary</span>
                  <span className="font-bold text-slate-200 capitalize">{tone?.vocabulary || "Standard"}</span>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase text-slate-500 mb-1">Emoji Use</span>
                  <span className="font-bold text-slate-200 capitalize">{tone?.emoji_usage || "None"}</span>
                </div>
              </div>

              <p className="text-slate-300 leading-relaxed mb-4 border-l-2 border-indigo-500 pl-4">
                {tone?.analysis_paragraph || "No tone analysis available."}
              </p>

              {tone?.quote && tone.quote !== "null" && tone.quote !== null && (
                <div className="bg-slate-900/80 p-4 rounded border border-slate-700 text-slate-400 text-sm font-mono italic">
                  "{tone.quote}"
                </div>
              )}
            </div>
          </section>

          {/* Section: Before You Reach Out */}
          <section>
            <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">Before You Reach Out</h3>
            {red_flags?.length > 0 ? (
              <div className="flex flex-col gap-3">
                {red_flags.map((f, i) => (
                  <div key={i} className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-4 items-start">
                    <div className="text-red-500 font-bold w-12 text-center pt-0.5">{f.severity}</div>
                    <div>
                      <h4 className="font-bold text-red-200">{f.flag}</h4>
                      <p className="text-sm text-red-400/80 mt-1">{f.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 flex items-center gap-3">
                <span className="text-xl">✅</span>
                <span className="font-semibold tracking-wide">No red flags found — good to go.</span>
              </div>
            )}
          </section>

          {/* Section: Conversation Starters */}
          <section>
            <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">Conversation Starters</h3>
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              {icebreakers?.length > 0 ? icebreakers[0]?.text ? icebreakers.map((ib, i) => (
                <div key={i} className="bg-slate-800 border border-slate-600 rounded-xl p-5 hover:border-indigo-500 transition-colors shadow-lg flex flex-col justify-between group cursor-pointer" onClick={() => handleCopy(ib.text)}>
                  <p className="text-slate-200 font-medium group-hover:text-white mb-6">"{ib.text}"</p>
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs font-mono text-slate-500">{ib.source}</span>
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                  </div>
                </div>
              )) : (
                <p className="text-slate-400 italic">Icebreakers unavailable (parsing error)</p>
              ) : (
                 <p className="text-slate-400 italic">No specific icebreakers could be generated.</p>
              )}
            </div>
          </section>

          {/* Section: Your Outreach Drafts */}
          <section className="mb-12">
            <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-widest mb-4 border-b border-slate-700 pb-2">Your Outreach Drafts</h3>
            
            <div className="flex gap-1 mb-4 border-b border-slate-700">
              <button 
                onClick={() => setActiveTab('dm')}
                className={`py-2 px-6 font-bold tracking-wide transition-colors ${activeTab === 'dm' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
              >
                LinkedIn DM
              </button>
              <button 
                onClick={() => setActiveTab('email')}
                className={`py-2 px-6 font-bold tracking-wide transition-colors ${activeTab === 'email' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Cold Email
              </button>
            </div>

            {activeTab === 'dm' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-lg relative">
                  <div className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex justify-between items-center text-xs font-mono text-slate-500">
                    Draft (approx. {drafts?.dm_draft?.split(' ').length || 0} words)
                    <button onClick={() => handleCopy(drafts?.dm_draft)} className="text-indigo-400 hover:text-indigo-300 font-bold px-2 border border-indigo-500/30 rounded py-0.5 tracking-widest uppercase">Copy Text</button>
                  </div>
                  <div className="p-6 text-slate-200 whitespace-pre-wrap leading-relaxed font-medium">
                    {drafts?.dm_draft || "No draft generated."}
                  </div>
                </div>
                <div className="bg-indigo-500/10 border-l-4 border-indigo-500 p-4 text-sm text-indigo-200">
                  <span className="font-bold text-indigo-400 mr-2 uppercase tracking-wide">Why this works:</span> 
                  {drafts?.dm_rationale || "No rationale provided."}
                </div>
              </div>
            )}

            {activeTab === 'email' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="bg-slate-800 border border-slate-600 rounded-xl overflow-hidden shadow-lg relative">
                  <div className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex justify-between items-center text-xs font-mono text-slate-500">
                    Draft (approx. {drafts?.email_draft?.split(' ').length || 0} words)
                    <button onClick={() => handleCopy(drafts?.email_draft)} className="text-indigo-400 hover:text-indigo-300 font-bold px-2 border border-indigo-500/30 rounded py-0.5 tracking-widest uppercase">Copy Text</button>
                  </div>
                  <div className="p-6 text-slate-200 whitespace-pre-wrap leading-relaxed font-medium">
                    {drafts?.email_draft || "No draft generated."}
                  </div>
                </div>
                <div className="bg-indigo-500/10 border-l-4 border-indigo-500 p-4 text-sm text-indigo-200">
                  <span className="font-bold text-indigo-400 mr-2 uppercase tracking-wide">Why this works:</span> 
                  {drafts?.email_rationale || "No rationale provided."}
                </div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

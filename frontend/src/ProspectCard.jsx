import React from 'react';

// Platform Icons (SVG)
const GithubIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/></svg>;
const TwitterIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const LinkedinIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>;
const MediumIcon = () => <svg width="20" height="20" viewBox="0 0 1043.63 592.71" fill="currentColor"><path d="M588.67 296.36c0 163.67-131.78 296.35-294.33 296.35S0 460 0 296.36 131.78 0 294.34 0s294.33 132.69 294.33 296.36M911.56 296.36c0 154.06-65.89 279-147.17 279s-147.17-124.94-147.17-279 65.88-279 147.16-279 147.17 124.9 147.17 279M1043.63 296.36c0 138-23.17 249.94-51.76 249.94s-51.75-111.91-51.75-249.94 23.17-249.94 51.75-249.94 51.76 111.9 51.76 249.94"/></svg>;
const GlobeIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const SubstackIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM22.539 12.32H1.46v11.68l10.53-5.857 10.54 5.857v-11.68zM1.46 1.484h21.08v2.836H1.46z"/></svg>;

export function ProspectCard({ prospect, onOpen }) {
  const {
    name, role, company, location, richness, score, match_reason,
    github_url, twitter_url, blog_url, medium_url, linkedin_url, url, recency
  } = prospect;

  // Richness coloring
  const richnessColors = {
    HIGH: 'bg-green-500/20 text-green-400 border-green-500/30',
    MED: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    LOW: 'bg-red-500/20 text-red-500 border-red-500/30'
  };

  // Score badge coloring
  const getScoreBadge = (sc) => {
    if (sc >= 80) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
    if (sc >= 60) return 'bg-amber-500/20 text-amber-500 border-amber-500/50';
    return 'bg-rose-500/20 text-rose-500 border-rose-500/50';
  };

  // Setup platform data
  const isSubstack = blog_url?.toLowerCase().includes('substack');
  const platformData = [
    { id: 'github', name: 'GitHub', url: github_url, icon: <GithubIcon /> },
    { id: 'twitter', name: 'Twitter/X', url: twitter_url, icon: <TwitterIcon /> },
    { id: 'linkedin', name: 'LinkedIn', url: linkedin_url || url, icon: <LinkedinIcon /> },
    { id: 'medium', name: 'Medium', url: medium_url, icon: <MediumIcon /> },
    { id: 'blog', name: isSubstack ? 'Substack' : 'Blog', url: blog_url, icon: isSubstack ? <SubstackIcon /> : <GlobeIcon /> }
  ];

  // Most recent signal
  const freshSignal = recency?.find(r => r.is_fresh) || recency?.[0];
  let signalEmoji = '🔗';
  if (freshSignal) {
    const src = freshSignal.source?.toLowerCase() || '';
    if (src.includes('github')) signalEmoji = '🔨';
    else if (src.includes('twitter')) signalEmoji = '💬';
    else if (src.includes('blog') || src.includes('medium') || src.includes('substack')) signalEmoji = '✍️';
    else if (src.includes('linkedin')) signalEmoji = '💼';
  }

  const roleCompany = company ? `${role} @ ${company}` : role;

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-indigo-500/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 transition-all flex flex-col gap-4 relative h-full">
      
      {/* Score Badge */}
      <div className={`absolute top-4 right-4 w-11 h-11 rounded-full flex flex-col items-center justify-center font-bold border-2 ${getScoreBadge(score)} shadow-sm`} title="Relevance Score">
        <span className="text-sm leading-none mt-0.5">{score}</span>
      </div>

      {/* Header Info */}
      <div className="pr-14">
        <h3 className="text-xl font-bold text-slate-100 leading-tight mb-1">{name}</h3>
        <p className="text-sm font-medium text-slate-400 mb-1">{roleCompany}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <span>📍</span> {location}
        </p>
      </div>

      {/* Richness + Platforms */}
      <div className="flex items-center gap-4 mt-1">
        <span className={`text-[10px] px-2 py-0.5 rounded border font-bold tracking-wider relative -top-[1px] ${richnessColors[richness] || richnessColors.LOW}`}>
          {richness} RICHNESS
        </span>
        
        <div className="flex gap-2">
          {platformData.map(p => {
             const hasUrl = !!p.url;
             return (
               <a 
                 key={p.id}
                 href={hasUrl ? p.url : undefined}
                 target={hasUrl ? "_blank" : undefined}
                 rel={hasUrl ? "noopener noreferrer" : undefined}
                 title={hasUrl ? `${p.name}: ${p.url}` : `${p.name}: Not found`}
                 onClick={(e) => { if (!hasUrl) e.preventDefault(); }}
                 className={`flex items-center justify-center transition-opacity ${hasUrl ? 'text-slate-300 hover:text-indigo-400 cursor-pointer opacity-100' : 'text-slate-500 opacity-25 cursor-default'}`}
               >
                 {p.icon}
               </a>
             );
          })}
        </div>
      </div>

      <hr className="border-slate-700 my-1" />

      {/* Match Reason */}
      <p className="text-sm text-slate-400 italic leading-relaxed line-clamp-2">
        "{match_reason}"
      </p>

      {/* What they're working on */}
      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 mt-1 flex-1 flex flex-col justify-start">
        <h4 className="text-[10px] uppercase font-bold text-indigo-400/80 mb-2 tracking-wider">What They're Working On</h4>
        {freshSignal ? (
          <div>
            <p className="text-xs text-slate-300 line-clamp-2 leading-snug">
              {signalEmoji} {freshSignal.action} <span className="text-slate-500 ml-1">· {freshSignal.time_ago} [{freshSignal.source}]</span>
            </p>
            {recency?.length > 1 && (
              <button onClick={() => onOpen(prospect)} className="text-[10px] mt-2 bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full hover:bg-slate-600 transition-colors">
                +{recency.length - 1} more
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic mt-auto">No recent signals found.</p>
        )}
      </div>

      {/* Action Button */}
      <button 
        onClick={() => onOpen(prospect)}
        className="w-full mt-3 bg-slate-700 hover:bg-indigo-600 hover:text-white transition-colors text-slate-200 font-semibold py-2.5 px-4 rounded-lg border border-slate-600 hover:border-indigo-500 shadow-sm flex items-center justify-center gap-2 group"
      >
        View Full Profile <span className="group-hover:translate-x-1 transition-transform opacity-70">→</span>
      </button>

    </div>
  );
}

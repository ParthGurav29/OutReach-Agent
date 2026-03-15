import React from 'react';

// Platform Icons (SVG)
const GithubIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z"/></svg>;
const TwitterIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
const LinkedinIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>;
const MediumIcon = () => <svg width="18" height="18" viewBox="0 0 1043.63 592.71" fill="currentColor"><path d="M588.67 296.36c0 163.67-131.78 296.35-294.33 296.35S0 460 0 296.36 131.78 0 294.34 0s294.33 132.69 294.33 296.36M911.56 296.36c0 154.06-65.89 279-147.17 279s-147.17-124.94-147.17-279 65.88-279 147.16-279 147.17 124.9 147.17 279M1043.63 296.36c0 138-23.17 249.94-51.76 249.94s-51.75-111.91-51.75-249.94 23.17-249.94 51.75-249.94 51.76 111.9 51.76 249.94"/></svg>;
const GlobeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const SubstackIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM22.539 12.32H1.46v11.68l10.53-5.857 10.54 5.857v-11.68zM1.46 1.484h21.08v2.836H1.46z"/></svg>;

export function ProspectCard({ prospect, onOpen }) {
  const {
    name, role, company, location, richness, score, match_reason,
    github_url, twitter_url, blog_url, medium_url, linkedin_url, url, recency
  } = prospect;

  // Richness coloring
  const richnessColors = {
    HIGH: 'bg-[#3FB950]/10 text-[#3FB950] border-[#3FB950]/30',
    MED: 'bg-[#D29922]/10 text-[#D29922] border-[#D29922]/30',
    LOW: 'bg-[#F85149]/10 text-[#F85149] border-[#F85149]/30'
  };

  // Score badge coloring
  const getScoreBadge = (sc) => {
    if (sc >= 80) return 'border-[#3FB950] text-[#3FB950] bg-[#3FB950]/5';
    if (sc >= 60) return 'border-[#D29922] text-[#D29922] bg-[#D29922]/5';
    return 'border-[#F85149] text-[#F85149] bg-[#F85149]/5';
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
    <div className="bg-[#161B22] rounded-xl p-6 border border-[#30363D] hover:border-[#FF9900] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(255,153,0,0.1)] transition-all flex flex-col gap-4 relative h-full group">
      
      {/* Score Badge */}
      <div className={`absolute top-4 right-4 w-10 h-10 rounded-full flex flex-col items-center justify-center font-black border-2 ${getScoreBadge(score)} shadow-inner z-10 transition-transform group-hover:scale-110`} title="Relevance Score">
        <span className="text-xs leading-none">{score}</span>
      </div>

      {/* Header Info */}
      <div className="pr-12">
        <h3 className="text-lg font-black text-[#E6EDF3] leading-tight mb-1 line-clamp-1 group-hover:text-[#FF9900] transition-colors">{name}</h3>
        <p className="text-[11px] font-bold text-[#7D8590] mb-1 uppercase tracking-tight line-clamp-1">{roleCompany}</p>
        <p className="text-[10px] text-[#7D8590] flex items-center gap-1 font-bold">
          <span className="opacity-50">📍</span> {location}
        </p>
      </div>

      {/* Richness + Platforms */}
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[9px] px-2 py-0.5 rounded border font-black tracking-widest uppercase ${richnessColors[richness] || richnessColors.LOW}`}>
          {richness}
        </span>
        
        <div className="flex gap-2.5">
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
                 className={`flex items-center justify-center transition-all ${hasUrl ? 'text-[#E6EDF3] hover:text-[#FF9900] hover:scale-125 cursor-pointer opacity-80 hover:opacity-100' : 'text-[#30363D] opacity-30 cursor-default'}`}
               >
                 {p.icon}
               </a>
             );
          })}
        </div>
      </div>

      <hr className="border-[#30363D] border-1" />

      {/* Match Reason */}
      <div className="flex-1">
        <p className="text-[11px] text-[#7D8590] italic leading-relaxed line-clamp-2 border-l-2 border-[#30363D] pl-3 group-hover:border-[#FF9900]/30 transition-colors">
          "{match_reason}"
        </p>
      </div>

      {/* What they're working on */}
      <div className="bg-[#0D1117] rounded-lg p-3 border border-[#30363D] mt-auto">
        <h4 className="text-[9px] uppercase font-black text-[#7D8590] mb-2 tracking-widest">Digital Footprint</h4>
        {freshSignal ? (
          <div>
            <p className="text-[10px] text-[#E6EDF3] line-clamp-2 leading-snug font-medium">
              <span className="mr-1 opacity-70">{signalEmoji}</span> {freshSignal.action}
            </p>
            <div className="flex justify-between items-center mt-3">
              <span className="text-[9px] font-bold text-[#30363D] uppercase group-hover:text-[#7D8590] transition-colors">{freshSignal.time_ago}</span>
              {recency?.length > 1 && (
                <button onClick={() => onOpen(prospect)} className="text-[9px] bg-[#161B22] text-[#E6EDF3] border border-[#30363D] px-2 py-0.5 rounded font-black hover:bg-[#FF9900] hover:text-[#0D1117] hover:border-[#FF9900] transition-all uppercase tracking-tighter">
                  +{recency.length - 1} more
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-[#30363D] italic">No recent activity signals found.</p>
        )}
      </div>

      {/* Action Button */}
      <button 
        onClick={() => onOpen(prospect)}
        className="w-full mt-1 bg-[#FF9900] hover:bg-orange-500 text-[#0D1117] font-black py-2.5 px-4 rounded-md transition-all shadow-xl flex items-center justify-center gap-2 group/btn uppercase tracking-widest text-[10px]"
      >
        Analyze Lead <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
      </button>

    </div>
  );
}

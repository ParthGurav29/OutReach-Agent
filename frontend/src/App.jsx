import React, { useState, useEffect, useRef } from 'react';
import { TerminalPanel } from './TerminalPanel';
import { ProspectCard } from './ProspectCard';
import { ProspectDrawer } from './ProspectDrawer';

export default function App() {
  const [goal, setGoal] = useState('');
  
  // Filters State
  const [jobRole, setJobRole] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [experience, setExperience] = useState('Any');
  const [platforms, setPlatforms] = useState([]);
  const [leadCount, setLeadCount] = useState(10);
  const [jobType, setJobType] = useState('Any');
  const [companySize, setCompanySize] = useState('Any');
  const [keywords, setKeywords] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [logs, setLogs] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [selectedProspect, setSelectedProspect] = useState(null);

  useEffect(() => {
    // Generate a unique session ID on load
    setSessionId(Math.random().toString(36).substring(2, 10));
  }, []);

  const handleRunCampaign = async () => {
    if (!goal.trim()) return;
    
    setIsProcessing(true);
    setHasFinished(false);
    setLogs([]);
    setProspects([]);
    
    // Construct Enriched Goal
    let enrichedGoal = goal;
    const filterParts = [];
    if (jobRole.trim()) filterParts.push(`Role: ${jobRole.trim()}`);
    if (filterLocation.trim()) filterParts.push(`Location: ${filterLocation.trim()}`);
    if (industry && industry !== "Any") filterParts.push(`Industry: ${industry}`);
    if (experience && experience !== "Any") filterParts.push(`Experience: ${experience}`);
    if (jobType && jobType !== "Any") filterParts.push(`Job Type: ${jobType}`);
    if (companySize && companySize !== "Any") filterParts.push(`Company Size: ${companySize}`);
    if (keywords.trim()) filterParts.push(`Keywords: ${keywords.trim()}`);
    if (platforms.length > 0) filterParts.push(`Must have presence on: ${platforms.join(", ")}`);

    if (filterParts.length > 0) {
      enrichedGoal = `${goal} | ${filterParts.join(" | ")}`;
    }
    
    // Connect SSE
    const eventSource = new EventSource(`http://127.0.0.1:8000/stream-campaign?session_id=${sessionId}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'keepalive') return;
        if (data.type === 'done') {
          setIsProcessing(false);
          setHasFinished(true);
          eventSource.close();
          return;
        }
        if (data.type === 'log') {
          setLogs(prev => [...prev, data.content]);
        }
        if (data.type === 'card') {
          setProspects(prev => [...prev, data.content]);
        }
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    };
    
    eventSource.onerror = () => {
      console.error("SSE connection error");
      eventSource.close();
      setIsProcessing(false);
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/run-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          goal: enrichedGoal, 
          session_id: sessionId,
          lead_count: leadCount
        })
      });
      if (!res.ok) throw new Error("Trigger failed");
    } catch (err) {
      console.error("Campaign run failed", err);
      setIsProcessing(false);
      eventSource.close();
      setLogs(prev => [...prev, "[!] API Error or timeout"]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] text-[#E6EDF3] font-sans flex flex-col items-center py-4 overflow-x-hidden">
      <div className="w-full max-w-7xl px-4 flex flex-col gap-4">
        
        {/* Header */}
        <div className="bg-[#161B22] p-4 rounded-xl border border-[#30363D] shadow-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-[#E6EDF3]">
                Outreach Agent
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#0D1117] px-3 py-1.5 rounded-full border border-[#30363D] shadow-inner">
                <div className="w-2 h-2 rounded-full bg-[#3FB950] animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#3FB950]">Session Active</span>
              </div>
            </div>
          </div>
          
          {/* Filters Panel */}
          <div className="bg-[#0D1117] p-3 rounded-lg border border-[#30363D] flex flex-col gap-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[10px] font-bold text-[#7D8590] uppercase tracking-[0.2em]">Targeting Filters</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#7D8590] uppercase">Leads:</span>
                <div className="flex bg-[#161B22] rounded-md p-0.5 border border-[#30363D]">
                  {[10, 20, 30, 50].map(cnt => (
                    <button
                      key={cnt}
                      onClick={() => setLeadCount(cnt)}
                      className={`px-3 py-0.5 text-[10px] font-bold rounded transition-all ${leadCount === cnt ? 'bg-[#FF9900] text-[#0D1117] shadow-lg' : 'text-[#7D8590] hover:bg-[#30363D]'}`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#7D8590] uppercase px-1">Job Role</label>
                <input 
                  value={jobRole} onChange={e => setJobRole(e.target.value)} disabled={isProcessing}
                  placeholder="e.g. Backend Engineer" 
                  className="bg-[#161B22] border border-[#444c56] rounded-md p-1.5 text-xs text-[#E6EDF3] placeholder:text-[#30363D] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#7D8590] uppercase px-1">Location</label>
                <input 
                  value={filterLocation} onChange={e => setFilterLocation(e.target.value)} disabled={isProcessing}
                  placeholder="e.g. Mumbai, Remote" 
                  className="bg-[#161B22] border border-[#444c56] rounded-md p-1.5 text-xs text-[#E6EDF3] placeholder:text-[#30363D] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#7D8590] uppercase px-1">Industry</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} disabled={isProcessing} className="bg-[#161B22] border border-[#444c56] rounded-md p-1.5 text-xs text-[#E6EDF3] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all appearance-none cursor-pointer">
                  <option value="">Any Industry</option>
                  <option value="Tech">Tech</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Education">Education</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#7D8590] uppercase px-1">Experience</label>
                <select value={experience} onChange={e => setExperience(e.target.value)} disabled={isProcessing} className="bg-[#161B22] border border-[#444c56] rounded-md p-1.5 text-xs text-[#E6EDF3] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all appearance-none cursor-pointer">
                  <option value="Any">Any Experience</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                  <option value="C-Suite">C-Suite</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#7D8590] uppercase px-1">Job Type</label>
                <div className="flex bg-[#161B22] rounded-md p-0.5 border border-[#444c56] h-[34px]">
                  {['Any', 'Onsite', 'Remote', 'Hybrid'].map(type => (
                    <button
                      key={type}
                      onClick={() => setJobType(type)}
                      className={`flex-1 text-[10px] font-bold rounded transition-all ${jobType === type ? 'bg-[#FF9900] text-[#0D1117] shadow-sm' : 'text-[#7D8590] hover:bg-[#30363D]'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#7D8590] uppercase px-1">Company Size</label>
                <select value={companySize} onChange={e => setCompanySize(e.target.value)} disabled={isProcessing} className="bg-[#161B22] border border-[#444c56] rounded-md p-1.5 text-xs text-[#E6EDF3] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all appearance-none cursor-pointer">
                  <option value="Any">Any size</option>
                  <option value="Startup (1-50)">Startup (1–50)</option>
                  <option value="Small (51-200)">Small (51–200)</option>
                  <option value="Mid-size (201-1000)">Mid-size (201–1000)</option>
                  <option value="Enterprise (1000+)">Enterprise (1000+)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-2">
                <label className="text-[10px] font-bold text-[#7D8590] uppercase px-1">Keywords</label>
                <input 
                  value={keywords} onChange={e => setKeywords(e.target.value)} disabled={isProcessing}
                  placeholder="e.g. open source, YC alumni, fintech" 
                  className="bg-[#161B22] border border-[#444c56] rounded-md p-1.5 text-xs text-[#E6EDF3] placeholder:text-[#30363D] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all w-full"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-1 px-1">
              <span className="text-[10px] font-bold text-[#7D8590] uppercase tracking-wider">Must be on:</span>
              <div className="flex flex-wrap gap-2">
                {['GitHub', 'Twitter', 'LinkedIn', 'Blog', 'Medium'].map(platform => {
                  const isSelected = platforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => {
                        if (isSelected) setPlatforms(platforms.filter(p => p !== platform));
                        else setPlatforms([...platforms, platform]);
                      }}
                      disabled={isProcessing}
                      className={`px-3 py-1 rounded-md text-[9px] font-black transition-all border uppercase tracking-tighter ${
                        isSelected 
                          ? 'bg-[#FF9900] text-[#0D1117] border-[#FF9900] shadow-[0_0_10px_rgba(255,153,0,0.2)]' 
                          : 'bg-[#161B22] text-[#7D8590] border-[#30363D] hover:border-[#FF9900] hover:text-[#E6EDF3]'
                      }`}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 items-end bg-[#1a1000] p-4 rounded-lg border border-[#30363D]/50">
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isProcessing && goal.trim() ? handleRunCampaign() : null}
                disabled={isProcessing}
                placeholder="Find Python freelancers in Mumbai for a short-term contract..."
                className="w-full bg-[#161B22] border border-[#444c56] rounded-md p-4 text-sm text-[#E6EDF3] placeholder:text-[#30363D] focus:ring-1 focus:ring-[#FF9900] focus:border-[#FF9900] focus:outline-none transition-all shadow-inner leading-relaxed"
                autoFocus
              />
            <button
              onClick={handleRunCampaign}
              disabled={!goal.trim() || isProcessing}
              className={`px-10 h-[48px] rounded-md font-black text-xs uppercase tracking-widest transition-all shadow-xl ${
                !goal.trim() || isProcessing 
                  ? 'bg-[#30363D] text-[#7D8590] cursor-not-allowed'
                  : 'bg-[#FF9900] text-[#0D1117] hover:bg-orange-500 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[#0D1117]/30 border-t-[#0D1117] animate-spin"></div>
                  Agent Busy
                </span>
              ) : "Run Pipeline"}
            </button>
          </div>
        </div>

        {/* Dynamic Layout */}
        <div className="flex flex-col gap-6 items-start w-full">
          
          {/* TERMINAL: Wider initially, hide when finished */}
          {!hasFinished && (
            <div 
              className={`transition-all duration-700 ease-in-out w-full origin-top animate-fade-in ${
                isProcessing ? 'opacity-100' : 'opacity-100'
              }`}
            >
              <TerminalPanel logs={logs} isSearching={isProcessing} />
            </div>
          )}
          
          {/* RESULTS GRID */}
          {(isProcessing || prospects.length > 0) && (
          <div className="transition-all duration-700 ease-in-out flex flex-col gap-4 w-full">
            <h2 className="text-xs font-black border-b border-[#30363D] pb-3 mb-2 text-[#7D8590] uppercase tracking-[0.3em] flex justify-between items-center">
              <span>Pipeline Output</span>
              <span className="text-[#FF9900] bg-[#1a1000] px-3 py-1 rounded-full border border-[#FF9900]/20 text-[10px] tracking-normal font-bold">
                {prospects.length} PROSPECTS IDENTIFIED
              </span>
            </h2>
            
            {(prospects.length === 0 && hasFinished) && (
              <div className="text-center p-12 bg-[#161B22] rounded-xl border border-dashed border-[#30363D] text-[#7D8590] animate-fade-in">
                <span className="text-2xl block mb-2">🔍</span>
                <p className="font-medium italic">No prospects found matching these filters. Try broadening your goal.</p>
                <button onClick={() => { setHasFinished(false); setLogs([]); }} className="mt-4 text-[10px] uppercase font-bold text-[#FF9900] hover:underline">Reset Search</button>
              </div>
            )}
            
            <div 
              className="grid gap-6 px-1" 
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {prospects.map((p, i) => (
                <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <ProspectCard 
                    prospect={p} 
                    onOpen={() => setSelectedProspect(p)} 
                  />
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
        <footer className="w-full py-12 mt-12 border-t border-[#30363D] flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 opacity-30 grayscale hover:grayscale-0 transition-all cursor-default group">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7D8590]">Outreach Agent</span>
            <div className="w-1 h-1 rounded-full bg-[#FF9900] group-hover:scale-150 transition-transform"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7D8590]">CoreDeployment v3.73</span>
          </div>
          <a 
            href="https://parth-gurav-portfolio.netlify.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#7D8590] hover:text-[#FF9900] text-[13px] font-bold transition-all flex items-center gap-2 group"
          >
            Built by <span className="text-[#E6EDF3] group-hover:text-[#FF9900]">Parth Gurav</span> · BE IT '28, Mumbai · <span className="underline underline-offset-4 decoration-[#30363D] group-hover:decoration-[#FF9900]">parth-gurav-portfolio.netlify.app</span> <span className="text-[#FF9900] group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </footer>
      </div>
      
      <ProspectDrawer 
        prospect={selectedProspect} 
        isOpen={selectedProspect !== null} 
        onClose={() => setSelectedProspect(null)} 
      />
    </div>
  );
}
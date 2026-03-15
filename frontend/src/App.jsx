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
        body: JSON.stringify({ goal: enrichedGoal, session_id: sessionId })
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
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center py-8">
      <div className="w-full max-w-7xl px-4 flex flex-col gap-6">
        
        {/* Header */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 directly to-indigo-400 bg-clip-text text-transparent">
              ReachAgent — Antigravity Edition
            </h1>
            <p className="text-slate-400 mt-1">
              Autonomous Prospect Research Agent (Nova Pro + Nova Micro)
            </p>
          </div>
          
          {/* Filters Panel */}
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Optional Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Job Role</label>
                <input 
                  value={jobRole} onChange={e => setJobRole(e.target.value)} disabled={isProcessing}
                  placeholder="e.g. Backend Engineer" 
                  className="bg-slate-800 border border-slate-600 rounded p-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Location</label>
                <input 
                  value={filterLocation} onChange={e => setFilterLocation(e.target.value)} disabled={isProcessing}
                  placeholder="e.g. Mumbai, Remote" 
                  className="bg-slate-800 border border-slate-600 rounded p-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Industry</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} disabled={isProcessing} className="bg-slate-800 border border-slate-600 rounded p-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none">
                  <option value="">Any</option>
                  <option value="Tech">Tech</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Education">Education</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Experience Level</label>
                <select value={experience} onChange={e => setExperience(e.target.value)} disabled={isProcessing} className="bg-slate-800 border border-slate-600 rounded p-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none">
                  <option value="Any">Any</option>
                  <option value="Junior">Junior</option>
                  <option value="Mid">Mid</option>
                  <option value="Senior">Senior</option>
                  <option value="Lead">Lead</option>
                  <option value="C-Suite">C-Suite</option>
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-semibold text-slate-400">Platform Presence</label>
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
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors border ${
                        isSelected 
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' 
                          : 'bg-slate-800 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {platform}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 items-end">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-300">Target Goal</label>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isProcessing && goal.trim() ? handleRunCampaign() : null}
                disabled={isProcessing}
                placeholder="Find Python freelancers in Mumbai for a short-term contract"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                autoFocus
              />
            </div>
            <button
              onClick={handleRunCampaign}
              disabled={!goal.trim() || isProcessing}
              className={`px-8 py-3 rounded-lg font-bold text-white transition-all shadow-lg ${
                !goal.trim() || isProcessing 
                  ? 'bg-slate-600 cursor-not-allowed opacity-70'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30 hover:-translate-y-1'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-white animate-spin"></div>
                  Agent Running
                </span>
              ) : "Run Campaign"}
            </button>
          </div>
        </div>

        {/* Dynamic Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {/* LEFT: Terminal (30%) - Fades out and collapses when done */}
          <div 
            className={`transition-all duration-700 ease-in-out shrink-0 sticky top-8 origin-left ${
              hasFinished 
                ? 'w-0 opacity-0 overflow-hidden scale-95 border-0 m-0' 
                : 'w-full lg:w-[33.333%] opacity-100 scale-100'
            }`}
          >
            <TerminalPanel logs={logs} />
          </div>
          
          {/* RIGHT: Cards Grid (70% -> 100%) */}
          <div 
            className={`transition-all duration-700 ease-in-out flex flex-col gap-4 ${
              hasFinished ? 'w-full' : 'w-full lg:w-[66.666%]'
            }`}
          >
            <h2 className="text-xl font-bold border-b border-slate-700 pb-2 mb-4">
              Prospect Pool <span className="text-slate-500 font-normal ml-2">({prospects.length} found)</span>
            </h2>
            
            {prospects.length === 0 && !isProcessing && logs.length > 0 && (
              <div className="text-center p-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-600 text-slate-400">
                No prospects found — try a broader goal.
              </div>
            )}
            
            <div 
              className="grid gap-4" 
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
            >
              {prospects.map((p, i) => (
                <ProspectCard 
                  key={i} 
                  prospect={p} 
                  onOpen={() => setSelectedProspect(p)} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <ProspectDrawer 
        prospect={selectedProspect} 
        isOpen={selectedProspect !== null} 
        onClose={() => setSelectedProspect(null)} 
      />
    </div>
  );
}
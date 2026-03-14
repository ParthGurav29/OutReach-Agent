import re

with open('frontend/src/AgentWindow.jsx', 'r') as f:
    content = f.read()

# Replace fonts
content = content.replace("fontFamily: \"'IBM Plex Mono', monospace\",", "fontFamily: 'Inter, sans-serif',")
# Replace background
content = content.replace('background: "#0a0e14"', 'background: "#ffffff"')
content = content.replace('border: "1px solid #1a2236"', 'border: "1px solid #eaedf3",\n        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"')
content = content.replace('borderLeft: "3px solid #6366f1",', '')
content = content.replace('color: "#6366f1",\n          letterSpacing: "0.15em",', 'color: "#1e293b",\n          fontSize: "16px",')
content = content.replace('AGENT THINKING', 'Agent Thinking')
content = content.replace('color: "#2d3748"', 'color: "#cbd5e1"')
content = content.replace('color: isDone\n                      ? "#4ade80"\n                      : isActive\n                      ? "#e2e8f0"\n                      : "#334155"', 
                          'color: isDone\n                      ? "#10b981"\n                      : isActive\n                      ? "#1e293b"\n                      : "#94a3b8"')
content = content.replace('color: isDone ? "#1e4030" : isActive ? "#475569" : "#1f2937"', 
                          'color: isDone ? "#64748b" : isActive ? "#64748b" : "#cbd5e1"')

with open('frontend/src/AgentWindow.jsx', 'w') as f:
    f.write(content)


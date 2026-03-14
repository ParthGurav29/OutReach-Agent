/**
 * AgentWindow — Live step-by-step agent status panel.
 *
 * Props:
 *   currentStep  {string}  – ID of the active step (see STEPS below)
 *   activeLead   {string}  – Prospect name to inject into the drafting step label
 */

const STEPS = (activeLead) => [
  {
    id: "searching",
    icon: "🔎",
    label: "Searching prospects",
    detail: "Running diversified LinkedIn queries via Tavily",
  },
  {
    id: "enriching",
    icon: "📬",
    label: "Enriching lead data",
    detail: "Extracting profiles, resolving domains & verifying emails",
  },
  {
    id: "drafting-v1",
    icon: "✍️",
    label: activeLead ? `Drafting Variant 1 — ${activeLead}` : "Drafting Variant 1",
    detail: "Generating personalised first draft via Nova Micro",
  },
  {
    id: "generating",
    icon: "🔁",
    label: "Generating Variants 2 and 3",
    detail: "Creating alternatives and selecting the best-scoring email",
  },
  {
    id: "ready",
    icon: "✅",
    label: "Ready",
    detail: "All leads processed — results ready below",
  },
];

const STEP_IDS = ["searching", "enriching", "drafting-v1", "generating", "ready"];

export default function AgentWindow({ currentStep, activeLead }) {
  const currentIdx = STEP_IDS.indexOf(currentStep);
  const steps = STEPS(activeLead);

  return (
    <div
      style={{
        background: "#0a0e14",
        border: "1px solid #1a2236",
        borderLeft: "3px solid #6366f1",
        borderRadius: "6px",
        padding: "14px 18px",
        marginBottom: "20px",
        maxHeight: "220px",
        overflowY: "auto",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          fontSize: "10px",
          color: "#6366f1",
          letterSpacing: "0.15em",
          fontWeight: 700,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background:
              currentStep === "ready" ? "#4ade80" : "#6366f1",
            animation:
              currentStep !== "ready" ? "agentPulse 1.2s ease-in-out infinite" : "none",
          }}
        />
        AGENT THINKING
      </div>

      {/* Step list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {steps.map((step, idx) => {
          const isDone    = idx < currentIdx;
          const isActive  = idx === currentIdx;
          const isPending = idx > currentIdx;

          return (
            <div
              key={step.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                opacity: isPending ? 0.35 : 1,
                transition: "opacity 0.3s ease",
              }}
            >
              {/* Status icon column */}
              <div style={{ width: "18px", flexShrink: 0, textAlign: "center", paddingTop: "1px" }}>
                {isDone ? (
                  <span style={{ color: "#4ade80", fontSize: "12px" }}>✓</span>
                ) : isActive ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#6366f1",
                      animation: "agentPulse 1.2s ease-in-out infinite",
                      marginTop: "3px",
                    }}
                  />
                ) : (
                  <span style={{ color: "#2d3748", fontSize: "12px" }}>○</span>
                )}
              </div>

              {/* Text column */}
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: isActive ? 700 : 400,
                    color: isDone
                      ? "#4ade80"
                      : isActive
                      ? "#e2e8f0"
                      : "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>{step.icon}</span>
                  <span>{step.label}</span>
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: isDone ? "#1e4030" : isActive ? "#475569" : "#1f2937",
                    marginTop: "2px",
                    lineHeight: "1.5",
                  }}
                >
                  {step.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

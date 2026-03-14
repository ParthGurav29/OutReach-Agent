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
        background: "#ffffff",
        border: "1px solid #eaedf3",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        borderRadius: "12px",
        padding: "20px 24px",
        marginBottom: "20px",
        maxHeight: "260px",
        overflowY: "auto",
        fontFamily: "Inter, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
          fontSize: "16px",
          color: "#1e293b",
          fontWeight: 700,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background:
              currentStep === "ready" ? "#10b981" : "#4f46e5",
            animation:
              currentStep !== "ready" ? "agentPulse 1.2s ease-in-out infinite" : "none",
          }}
        />
        Agent Thinking
      </div>

      {/* Step list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                gap: "12px",
                opacity: isPending ? 0.4 : 1,
                transition: "opacity 0.3s ease",
              }}
            >
              {/* Status icon column */}
              <div style={{ width: "20px", flexShrink: 0, textAlign: "center", paddingTop: "2px" }}>
                {isDone ? (
                  <span style={{ color: "#10b981", fontSize: "14px" }}>✓</span>
                ) : isActive ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#4f46e5",
                      animation: "agentPulse 1.2s ease-in-out infinite",
                      marginTop: "4px",
                    }}
                  />
                ) : (
                  <span style={{ color: "#cbd5e1", fontSize: "14px" }}>○</span>
                )}
              </div>

              {/* Text column */}
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: isActive ? 600 : 500,
                    color: isDone
                      ? "#10b981"
                      : isActive
                      ? "#1e293b"
                      : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{step.icon}</span>
                  <span>{step.label}</span>
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: isDone ? "#64748b" : isActive ? "#64748b" : "#94a3b8",
                    marginTop: "4px",
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

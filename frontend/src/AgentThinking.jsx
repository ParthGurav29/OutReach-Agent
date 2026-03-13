function AgentThinking({ trace }) {

  if (!trace) return null

  return (
    <div style={{
      background:"#111",
      color:"white",
      padding:"20px",
      borderRadius:"10px",
      marginTop:"20px"
    }}>

      <h2>🧠 Agent Thinking</h2>

      <p>🔍 Search Queries: {trace.search_queries?.length}</p>
      <p>👥 Prospects Found: {trace.prospects_found}</p>
      <p>📊 Prospects Scored: {trace.prospects_scored?.length}</p>
      <p>✉️ Email Variants: {trace.email_variants?.length}</p>
      <p>🧪 Quality Checks: {trace.quality_scores?.length}</p>

    </div>
  )
}

export default AgentThinking
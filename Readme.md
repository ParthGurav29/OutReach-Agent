# Outreach Agent Project Overview : 
https://out-reach-agent.vercel.app/

## 🛸 Introduction
The **Outreach Agent** is a state-of-the-art autonomous research and personalized messaging system. It combines multiple AI models (Amazon Nova Pro & Micro) with web search and profile enrichment tools to identify high-quality prospects and generate hyper-personalized outreach content (LinkedIn DMs and Cold Emails).

---

## 🏗️ Technical Architecture

### 1. Frontend: React Dashboad
The frontend provides a rich, dark-themed experience built with **React** and **Tailwind CSS**.
- **[App.jsx](file:///Users/parthmangeshgurav/Desktop/OutReach%20Agent/frontend/src/App.jsx)**: Core state management for targeting filters, sender profiles, and pipeline execution.
- **[ProspectDrawer.jsx](file:///Users/parthmangeshgurav/Desktop/OutReach%20Agent/frontend/src/ProspectDrawer.jsx)**: A sophisticated intelligence report modal that displays deep-dive analysis (Background, Timeline Pulse, Communication Tone, Red Flags).
- **[TerminalPanel.jsx](file:///Users/parthmangeshgurav/Desktop/OutReach%20Agent/frontend/src/TerminalPanel.jsx)**: Interactive log monitor that displays real-time agent "thinking" using SSE (Server-Sent Events), featuring sequential animation dots for search status.
- **[ProspectCard.jsx](file:///Users/parthmangeshgurav/Desktop/OutReach%20Agent/frontend/src/ProspectCard.jsx)**: High-density UI cards showing prospect scores, roles, and match reasons.

### 2. Backend: FastAPI Engine
A high-performance **FastAPI** backend orchestrates the agentic workflows.
- **[main.py](file:///Users/parthmangeshgurav/Desktop/OutReach%20Agent/backend/main.py)**: Handles API endpoints, in-memory session persistence, and SSE streaming for real-time logs.
- **[agents/orchestrator.py](file:///Users/parthmangeshgurav/Desktop/OutReach%20Agent/backend/agents/orchestrator.py)**: The central logic hub. It coordinates the lifecycle of a campaign: Planning → Searching → Extracting → Enriching → Analyzing → Drafting.

---

## 🧠 Agentic Logic & AI Tools

### Core AI Infrastructure
- **[nova_client.py](file:///Users/parthmangeshgurav/Desktop/OutReach%20Agent/backend/tools/nova_client.py)**: A unified wrapper for **AWS Bedrock**, specializing in **Amazon Nova Pro** (for complex planning) and **Nova Micro** (for rapid, granular analysis).

### Specialized Tools (`backend/tools/`)
- **`planner.py`**: (Located in `agents/`) Uses Nova Pro to generate search strategies.
- **`nova_micro_tools.py`**: The consolidated hub for all micro-agents:
    - **Snippet Extractor**: Rapidly parses search results for names/companies.
    - **Profile Builder**: Synthesizes cross-platform data into a professional profile.
    - **Tone Analyzer**: Deciphers a prospect's writing style and formality.
    - **Red Flag Detector**: Identifies engagement blockers.
    - **Icebreaker Generator**: Creates context-aware openers.
    - **Message Drafter**: Implements the **CCQ Framework** (Compliment, Commonality, Question) for high-conversion LinkedIn DMs.

---

## 🔌 Integrations
- **Web Search**: Powered by **Tavily** for real-time results. Now supports **Automatic API Key Rotation** across multiple keys.
- **Profile Enrichment**: Uses **Proxycurl** for deep LinkedIn data extraction.

---

## 🛠️ Deployment Readiness
- **Configurable API**: Support for `VITE_API_BASE_URL` env variable in the frontend.
- **Clean Architecture**: Removed 15+ legacy files and test scripts.
- **Dependency Management**: Centralized `requirements.txt` for backend deployment.

import { useEffect, useRef, useState } from 'react'
import './App.css'

const API = import.meta.env.VITE_API_URL ?? ''

const AGENT_STUBS = [
  { domain: 'problem_user',         name: 'Problem & User Agent',                      status: 'Evaluating problem & user fit…',        _loading: true },
  { domain: 'market_competition',   name: 'Competition, Differentiation & Market Agent', status: 'Web searching market trends & competitors…', _loading: true },
  { domain: 'business_distribution',name: 'Business Model & Distribution Agent',         status: 'Web searching pricing benchmarks…',         _loading: true },
  { domain: 'tech_product',         name: 'Technical Feasibility & Product Agent',       status: 'Assessing technical feasibility…',       _loading: true },
]

function AgentCard({ agent, isActive }) {
  if (agent._loading) {
    return (
      <div className="agent-card agent-card--loading">
        <div className="agent-card-header">
          <h3>{agent.name}</h3>
          <span className="confidence confidence--muted">—</span>
        </div>
        <div className="confidence-bar">
          <div className="confidence-bar-fill confidence-bar--indeterminate" />
        </div>
        <p className="agent-status-text">{agent.status}</p>
      </div>
    )
  }

  return (
    <div className={`agent-card${isActive ? ' agent-card--active' : ''}`}>
      <div className="agent-card-header">
        <h3>{agent.name}</h3>
        <span className="confidence">{agent.confidence}/100</span>
      </div>
      <div className="confidence-bar">
        <div className="confidence-bar-fill" style={{ width: `${agent.confidence}%` }} />
      </div>
      <ul>
        {agent.insights.map((insight, i) => <li key={i}>{insight}</li>)}
      </ul>
      <div className="key-risk"><strong>Key risk:</strong> {agent.key_risk}</div>
      {agent.sources && agent.sources.length > 0 && (
        <div className="agent-sources">
          <span className="agent-sources-label">Sources</span>
          <ul className="agent-sources-list">
            {agent.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function App() {
  // Phase state machine: idle → analyzing → clarifying → verdict-loading → done
  const [phase, setPhase] = useState('idle')
  const [idea, setIdea] = useState('')
  const [agents, setAgents] = useState([])
  const [pendingDomains, setPendingDomains] = useState([])
  const [history, setHistory] = useState([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [verdict, setVerdict] = useState(null)
  const [error, setError] = useState(null)

  // Speech state
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [delivery, setDelivery] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const verdictRef = useRef(null)

  useEffect(() => {
    if (phase === 'done' && verdict) {
      verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [phase, verdict])

  const isbusy = phase === 'analyzing' || phase === 'verdict-loading' || transcribing

  async function handleAnalyze(e) {
    e.preventDefault()
    if (!idea.trim()) return
    setPhase('analyzing')
    setAgents(AGENT_STUBS.map(s => ({ ...s })))
    setPendingDomains([])
    setHistory([])
    setVerdict(null)
    setError(null)
    try {
      const res = await fetch(`${API}/api/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const receivedAgents = []
      let finalPendingDomains = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.type === 'agent') {
            receivedAgents.push(data.agent)
            setAgents(prev => prev.map(a => a.domain === data.agent.domain ? data.agent : a))
          } else if (data.type === 'done') {
            finalPendingDomains = data.pending_domains
          }
        }
      }

      setPendingDomains(finalPendingDomains)
      if (finalPendingDomains.length === 0) {
        await fetchVerdict(idea, receivedAgents, [])
      } else {
        setPhase('clarifying')
      }
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }

  async function handleClarify(e) {
    e.preventDefault()
    if (!currentAnswer.trim()) return
    const domain = pendingDomains[0]
    const agentForDomain = agents.find(a => a.domain === domain)
    const question = agentForDomain?.clarifying_question ?? ''
    setPhase('analyzing')
    setError(null)
    try {
      const res = await fetch(`${API}/api/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          agents,
          history,
          domain,
          question,
          answer: currentAnswer,
        }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setAgents(data.agents)
      setPendingDomains(data.pending_domains)
      setHistory(data.history)
      setCurrentAnswer('')
      if (data.pending_domains.length === 0) {
        await fetchVerdict(idea, data.agents, data.history)
      } else {
        setPhase('clarifying')
      }
    } catch (err) {
      setError(err.message)
      setPhase('clarifying')
    }
  }

  async function fetchVerdict(ideaVal, agentsVal, historyVal) {
    setPhase('verdict-loading')
    try {
      const res = await fetch(`${API}/api/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: ideaVal, agents: agentsVal, history: historyVal }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setVerdict(data)
      setPhase('done')
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }

  function handleReset() {
    setPhase('idle')
    setIdea('')
    setAgents([])
    setPendingDomains([])
    setHistory([])
    setCurrentAnswer('')
    setVerdict(null)
    setError(null)
    setDelivery(null)
  }

  // ── Speech ──────────────────────────────────────────────────────────────
  async function transcribeAudio(blob) {
    setTranscribing(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', blob, 'pitch.webm')
      const res = await fetch(`${API}/speech/transcribe`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || `Transcription error: ${res.status}`)
      const text = data?.text
      if (!text || typeof text !== 'string') throw new Error('No transcript returned')
      if (typeof data?.delivery_score === 'number' && typeof data?.delivery_feedback === 'string') {
        setDelivery({ score: data.delivery_score, feedback: data.delivery_feedback, metrics: data?.delivery_metrics || null })
      } else {
        setDelivery(null)
      }
      const cleaned = text.trim().replace(/\s+/g, ' ')
      setIdea(cleaned.endsWith('.') || cleaned.endsWith('?') || cleaned.endsWith('!') ? cleaned : `${cleaned}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setTranscribing(false)
    }
  }

  async function startRecording() {
    setError(null)
    if (recording || transcribing || isbusy) return
    setIdea('')
    setAgents([])
    setDelivery(null)
    setVerdict(null)
    setPhase('idle')
    if (!navigator.mediaDevices?.getUserMedia) { setError('Audio recording is not supported in this browser.'); return }
    if (!window.MediaRecorder) { setError('MediaRecorder is not supported in this browser.'); return }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      await transcribeAudio(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  function stopRecording() {
    if (!recording) return
    setRecording(false)
    try { mediaRecorderRef.current?.stop() } catch { setError('Failed to stop recording.') }
  }

  // ── Current clarifying question ─────────────────────────────────────────
  const activeDomain = pendingDomains[0]
  const activeAgent = agents.find(a => a.domain === activeDomain)

  return (
    <div className="container">
      <h1>Startup Idea Validator</h1>

      {/* ── Input form (only when idle or done) ── */}
      {(phase === 'idle' || phase === 'done') && (
        <form onSubmit={handleAnalyze} className="input-form">
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder="Describe your startup idea..."
            rows={4}
          />
          <div className="actions">
            <button
              type="button"
              className={recording ? 'secondary danger' : 'secondary'}
              onClick={recording ? stopRecording : startRecording}
              disabled={isbusy || transcribing}
            >
              {recording ? 'Stop recording' : transcribing ? 'Transcribing…' : 'Record pitch'}
            </button>
            <button type="submit" disabled={isbusy || recording || transcribing}>
              {phase === 'done' ? 'Analyze again' : 'Analyze'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="error">{error}</div>}

      {/* ── Verdict loading ── */}
      {phase === 'verdict-loading' && (
        <div className="loading-state">Generating verdict…</div>
      )}

      {/* ── Agent cards ── */}
      {agents.length > 0 && (
        <div className="agents-grid">
          {agents.map(agent => (
            <AgentCard
              key={agent.domain}
              agent={agent}
              isActive={phase === 'clarifying' && agent.domain === activeDomain}
            />
          ))}
        </div>
      )}

      {/* ── Clarifying question panel ── */}
      {phase === 'clarifying' && activeAgent && (
        <div className="clarify-panel">
          <div className="clarify-label">
            <span className="clarify-agent">{activeAgent.name}</span> wants to ask:
          </div>
          <p className="clarify-question">{activeAgent.clarifying_question}</p>
          <form onSubmit={handleClarify} className="clarify-form">
            <textarea
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              placeholder="Your answer..."
              rows={3}
            />
            <div className="actions">
              <span className="clarify-progress">
                {pendingDomains.length} question{pendingDomains.length !== 1 ? 's' : ''} remaining
              </span>
              <button type="submit" disabled={!currentAnswer.trim()}>Submit answer</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Verdict ── */}
      {phase === 'done' && verdict && (
        <div ref={verdictRef} className={`verdict-banner verdict-banner--${verdict.verdict.toLowerCase().replace(' ', '-')}`}>
          <div className="verdict-label">Verdict</div>
          <div className="verdict-value">{verdict.verdict}</div>
          <div className="verdict-confidence">
            <span className="verdict-confidence-label">Overall confidence</span>
            <span className="verdict-confidence-score">{verdict.confidence_score}/100</span>
          </div>
          {verdict.takeaway && (
            <div className="verdict-takeaway">{verdict.takeaway}</div>
          )}
          {verdict.summary && (
            <div className="verdict-section">
              <strong>Overview</strong>
              <p className="verdict-summary">{verdict.summary}</p>
            </div>
          )}
          {verdict.strengths && verdict.strengths.length > 0 && (
            <div className="verdict-section">
              <strong>Strengths</strong>
              <ul>{verdict.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          <div className="verdict-section">
            <strong>Top risks</strong>
            <ul>{verdict.top_risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
          {verdict.insight && (
            <div className="verdict-section">
              <strong>Key insight</strong>
              <p className="verdict-insight">{verdict.insight}</p>
            </div>
          )}
          <div className="verdict-section">
            <strong>Suggestions</strong>
            <ul>{verdict.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          {verdict.strengthen && verdict.strengthen.length > 0 && (
            <div className="verdict-section">
              <strong>How to strengthen</strong>
              <ul>{verdict.strengthen.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {verdict.next_steps && verdict.next_steps.length > 0 && (
            <div className="verdict-section">
              <strong>Next steps</strong>
              <ol>{verdict.next_steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
          <button className="secondary" onClick={handleReset} style={{ marginTop: 16 }}>
            Start over
          </button>
        </div>
      )}

      {/* ── Delivery score (from speech) ── */}
      {delivery && phase === 'idle' && (
        <div className="delivery-card">
          <div className="delivery-top">
            <div className="delivery-title">Delivery score</div>
            <div className="delivery-score">{delivery.score}/100</div>
          </div>
          {delivery.metrics && (
            <div className="delivery-metrics">
              <span className="delivery-pill">Pace: {delivery.metrics?.pace?.label}</span>
              <span className="delivery-pill">Fillers: {delivery.metrics?.fillers?.label}</span>
              <span className="delivery-pill">Pauses: {delivery.metrics?.pauses?.label}</span>
            </div>
          )}
          <div className="delivery-feedback">{delivery.feedback}</div>
        </div>
      )}
    </div>
  )
}

export default App

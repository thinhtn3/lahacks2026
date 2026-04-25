import { useState } from 'react'
import './App.css'

function App() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!prompt.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('http://localhost:8000/agents/market-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setResult(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Startup Idea Validator</h1>

      <form onSubmit={handleSubmit} className="input-form">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe your startup idea..."
          rows={4}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="agent-card">
          <h2>Market Analyst <span className="confidence">{result.confidence}/100</span></h2>
          <ul>
            {result.insights.map((insight, i) => <li key={i}>{insight}</li>)}
          </ul>
          <div className="key-risk"><strong>Key risk:</strong> {result.key_risk}</div>
        </div>
      )}
    </div>
  )
}

export default App

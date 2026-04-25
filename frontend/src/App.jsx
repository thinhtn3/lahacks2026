import { useRef, useState } from "react";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Voice → text (browser records audio, backend transcribes via ElevenLabs).
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/agents/market-analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function transcribeAudio(blob) {
    setTranscribing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", blob, "pitch.webm");

      const res = await fetch("http://localhost:8000/speech/transcribe", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `Transcription error: ${res.status}`);
      }
      const text = data?.text;
      if (!text || typeof text !== "string")
        throw new Error("No transcript returned");

      if (
        typeof data?.delivery_score === "number" &&
        typeof data?.delivery_feedback === "string"
      ) {
        setDelivery({
          score: data.delivery_score,
          feedback: data.delivery_feedback,
          metrics: data?.delivery_metrics || null,
        });
      } else {
        setDelivery(null);
      }

      // Drop the transcript into the same prompt box the app already uses.
      const cleaned =
        text
          .trim()
          .replace(/\s+/g, " ")
          .replace(/[.?!]$/, (m) => m) || text.trim();
      setPrompt(
        cleaned.endsWith(".") || cleaned.endsWith("?") || cleaned.endsWith("!")
          ? cleaned
          : `${cleaned}.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    setError(null);
    if (recording || transcribing || loading) return;

    // Start each new pitch from a clean slate.
    setPrompt("");
    setResult(null);
    setDelivery(null);

    // These two checks cover most browser compatibility issues.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    if (!window.MediaRecorder) {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      // Always stop the mic, then transcribe the recorded audio.
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      await transcribeAudio(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    try {
      mediaRecorderRef.current?.stop();
    } catch (e) {
      setError("Failed to stop recording.");
    }
  }

  return (
    <div className="container">
      <h1>Startup Idea Validator</h1>

      <form onSubmit={handleSubmit} className="input-form">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your startup idea..."
          rows={4}
        />
        <div className="actions">
          <button
            type="button"
            className={recording ? "secondary danger" : "secondary"}
            onClick={recording ? stopRecording : startRecording}
            disabled={loading || transcribing}
          >
            {recording
              ? "Stop recording"
              : transcribing
                ? "Transcribing…"
                : "Record pitch"}
          </button>

          <button type="submit" disabled={loading || recording || transcribing}>
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </form>

      {error && <div className="error">{error}</div>}

      {result && (
        <>
          <div className="agent-card">
            <h2>
              Market Analyst{" "}
              <span className="confidence">{result.confidence}/100</span>
            </h2>
            <ul>
              {result.insights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
            <div className="key-risk">
              <strong>Key risk:</strong> {result.key_risk}
            </div>
          </div>

          {delivery && (
            <div className="delivery-card">
              <div className="delivery-top">
                <div className="delivery-title">Delivery score</div>
                <div className="delivery-score">{delivery.score}/100</div>
              </div>
              {delivery.metrics && (
                <div className="delivery-metrics">
                  <span className="delivery-pill">
                    Pace: {delivery.metrics?.pace?.label}
                  </span>
                  <span className="delivery-pill">
                    Fillers: {delivery.metrics?.fillers?.label}
                  </span>
                  <span className="delivery-pill">
                    Pauses: {delivery.metrics?.pauses?.label}
                  </span>
                </div>
              )}
              <div className="delivery-feedback">{delivery.feedback}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VerdictCard({ verdict, top_risks, suggestions }) {
  const color = { Invest: "green", Pass: "red", "Needs Work": "yellow" }[
    verdict
  ];
  return (
    <div className={`verdict-card verdict-${color}`}>
      <div className="verdict-label">Verdict</div>
      <div className="verdict-value">{verdict}</div>
      <div className="verdict-sections">
        <div>
          <strong>Top Risks</strong>
          <ul>
            {top_risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Suggestions</strong>
          <ul>
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const AGENT_NAMES = ["Problem Validator", "Market Analyst", "Risk Analyst"];

export default function App() {
  const [idea, setIdea] = useState("");
  const [phase, setPhase] = useState("input"); // input | analyzing | clarify | verdicting | done
  const [agents, setAgents] = useState(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState(null);
  const [clarifyingAnswer, setClarifyingAnswer] = useState("");
  const [verdictData, setVerdictData] = useState(null);
  const [error, setError] = useState(null);

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!idea.trim()) return;
    setPhase("analyzing");
    setAgents(null);
    setVerdictData(null);
    setError(null);

    try {
      const res = await fetch(`${BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setAgents(data.agents);

      if (data.conflict?.has_conflict) {
        setClarifyingQuestion(data.clarifying_question);
        setPhase("clarify");
      } else {
        await runVerdict(data.agents, null, null);
      }
    } catch (err) {
      setError(err.message);
      setPhase("input");
    }
  }

  async function runVerdict(priorAgents, question, answer) {
    setPhase("verdicting");
    try {
      const res = await fetch(`${BASE}/api/verdict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          prior_agents: priorAgents,
          clarifying_question: question,
          clarifying_answer: answer,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setAgents(data.agents);
      setVerdictData({
        verdict: data.verdict,
        top_risks: data.top_risks,
        suggestions: data.suggestions,
      });
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setPhase("clarify");
    }
  }

  async function handleClarify(e) {
    e.preventDefault();
    if (!clarifyingAnswer.trim()) return;
    await runVerdict(agents, clarifyingQuestion, clarifyingAnswer);
  }

  function reset() {
    setPhase("input");
    setIdea("");
    setAgents(null);
    setClarifyingQuestion(null);
    setClarifyingAnswer("");
    setVerdictData(null);
    setError(null);
  }

  const loading = phase === "analyzing" || phase === "verdicting";

  return (
    <div className="container">
      <h1>Startup Idea Validator</h1>

      {phase === "input" && (
        <form onSubmit={handleAnalyze} className="input-form">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Describe your startup idea..."
            rows={4}
          />
          <button type="submit">Analyze</button>
        </form>
      )}

      {error && <div className="error">{error}</div>}

      {(loading || agents) && (
        <div className="cards">
          {AGENT_NAMES.map((name) => (
            <AgentCard
              key={name}
              agent={agents?.find((a) => a.name === name) ?? null}
              loading={loading && !agents}
            />
          ))}
        </div>
      )}

      {phase === "clarify" && (
        <div className="clarify-box">
          <p className="conflict-notice">
            Agents disagree — one clarification needed
          </p>
          <p className="clarify-question">{clarifyingQuestion}</p>
          <form onSubmit={handleClarify} className="clarify-form">
            <textarea
              value={clarifyingAnswer}
              onChange={(e) => setClarifyingAnswer(e.target.value)}
              placeholder="Your answer..."
              rows={3}
            />
            <button type="submit">Submit &amp; Get Verdict</button>
          </form>
        </div>
      )}

      {phase === "verdicting" && (
        <div className="status">Synthesizing verdict...</div>
      )}

      {phase === "done" && verdictData && (
        <>
          <VerdictCard {...verdictData} />
          <button className="reset-btn" onClick={reset}>
            Start Over
          </button>
        </>
      )}
    </div>
  );
}

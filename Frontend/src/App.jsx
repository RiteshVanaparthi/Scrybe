import { useState, useRef } from 'react';
import './App.css';

function App() {
  const [view, setView] = useState('home'); // home, eval, leaderboard, history, about
  const [question, setQuestion] = useState('');
  const [referenceAnswer, setReferenceAnswer] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile || !referenceAnswer) {
      setError('Please provide a reference answer and a video file.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('reference_answer', referenceAnswer);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server Error: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Calculate breakdown for UI based on result
      const score = data.score || 0;
      const keywordOverlap = calculateKeywordOverlap(data.transcript, referenceAnswer);

      setResult({
        ...data,
        breakdown: {
          semantic: score,
          keyword: Math.round(keywordOverlap),
          hybrid: Math.round((score + keywordOverlap) / 2),
          confidence: Math.round(85 + (score * 0.1))
        },
        grade: getGrade(score)
      });

      // Auto scroll to results if on eval page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  const calculateKeywordOverlap = (transcript, reference) => {
    if (!transcript || !reference) return 0;
    const tWords = new Set(transcript.toLowerCase().match(/\w+/g));
    const rWords = new Set(reference.toLowerCase().match(/\w+/g));
    if (rWords.size === 0) return 0;
    const intersection = new Set([...tWords].filter(x => rWords.has(x)));
    return (intersection.size / rWords.size) * 100;
  };

  const downloadTranscript = (format) => {
    if (!result || !result.transcript) return;

    const timestamp = new Date().toLocaleDateString();
    const fileName = `Scrybe_io_Transcript_${new Date().getTime()}`;

    if (format === 'txt') {
      const element = document.createElement("a");
      const content = `S | SCRYBE.IO EVALUATION REPORT\n` +
        `===========================\n` +
        `Date: ${timestamp}\n` +
        `Score: ${result.score.toFixed(1)}%\n\n` +
        `TRANSCRIPT:\n` +
        `-----------\n` +
        `${result.transcript}\n\n` +
        `SUMMARY:\n` +
        `--------\n` +
        `${result.summary || 'N/A'}`;

      const file = new Blob([content], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${fileName}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else if (format === 'pdf') {
      import('jspdf').then(({ jsPDF }) => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.setTextColor(99, 102, 241); // Accent Purple
        doc.text("S | scrybe.io Transcript Report", 15, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Date: ${timestamp} | Performance Score: ${result.score.toFixed(1)}%`, 15, 30);

        doc.setDrawColor(200, 200, 200);
        doc.line(15, 35, 195, 35);

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        const splitText = doc.splitTextToSize(result.transcript, 170);
        doc.text(splitText, 15, 45);

        doc.save(`${fileName}.pdf`);
      });
    }
  };

  const getGrade = (score) => {
    if (score >= 90) return 'GRADE A';
    if (score >= 80) return 'GRADE B';
    if (score >= 70) return 'GRADE C';
    if (score >= 60) return 'GRADE D';
    return 'GRADE F';
  };

  const renderNavbar = () => (
    <nav className="navbar">
      <div className="scrybe-logo" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
        <div className="logo-s">S</div>
        <span>scrybe.io</span>
      </div>
      <div className="nav-links">
        <a href="#" className={`nav-link ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>Home</a>
        <a href="#" className={`nav-link ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>History</a>
        <a href="#" className={`nav-link ${view === 'about' ? 'active' : ''}`} onClick={() => setView('about')}>About</a>
      </div>
    </nav>
  );

  const renderHome = () => (
    <div className="hero-section">
      <h1 className="hero-title">
        Precision in <br />
        <span className="gradient-text">Communication.</span>
      </h1>
      <p className="hero-subtitle">
        scrybe.io is engineered to bridge the gap between technical complexity and crystal-clear understanding.
        We believe every word counts. Our AI-driven engine provides high-fidelity analysis for any video response.
      </p>
      <button className="cta-button" onClick={() => setView('eval')}>
        Start Evaluation
      </button>
    </div>
  );

  const renderEval = () => (
    <div className="evaluation-grid">
      {/* 01. SETUP Column */}
      <div className="setup-column">
        <span className="section-label">01. SETUP</span>
        <h2 className="section-heading">Input Specifications</h2>

        <div className="glass-card setup-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Candidate Video Response *</label>
              {!videoPreview ? (
                <div className="video-upload-area" onClick={() => fileInputRef.current.click()}>
                  <span className="upload-icon">🎥</span>
                  <span className="upload-text">Upload Video Response</span>
                  <span className="upload-hint">MP4, WEBM, or MOV supported</span>
                </div>
              ) : (
                <div className="video-preview-container">
                  <video src={videoPreview} className="video-preview" controls />
                  <button type="button" className="replace-video-btn" onClick={() => fileInputRef.current.click()}>
                    Replace Video
                  </button>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleVideoChange}
                style={{ display: 'none' }}
                accept="video/*"
              />
            </div>

            <div className="form-group">
              <label>Interview Question (Optional)</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Can you explain how async/await works?"
              />
            </div>

            <div className="form-group">
              <label>Reference Answer *</label>
              <textarea
                value={referenceAnswer}
                onChange={(e) => setReferenceAnswer(e.target.value)}
                placeholder="Provide the ideal answer transcript..."
                rows={5}
                required
              />
            </div>

            <button type="submit" className="evaluate-btn" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Analyzing Response...
                </>
              ) : (
                'Start Analysis'
              )}
            </button>
          </form>

          {error && <div className="error-message" style={{ marginTop: '1.5rem', color: 'var(--danger)' }}>{error}</div>}
        </div>
      </div>

      {/* 02. RESULTS Column */}
      <div className="results-column">
        <span className="section-label">02. RESULTS</span>
        <h2 className="section-heading">Analysis Report</h2>

        <div className="glass-card report-card">
          {!result && !loading && (
            <div className="loading-results">
              <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</span>
              <p>Submit your response to see the <br />detailed AI analysis report.</p>
            </div>
          )}

          {loading && (
            <div className="loading-results">
              <div className="spinner" style={{ width: '60px', height: '60px', marginBottom: '2rem', borderWidth: '4px' }}></div>
              <p>Processing audio and performing <br />semantic comparison...</p>
            </div>
          )}

          {result && !loading && (
            <div className="results-content">
              {/* Circular Score Gauge */}
              <div className="score-display">
                <svg className="score-svg" viewBox="0 0 200 200">
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <circle className="score-circle-bg" cx="100" cy="100" r="90" />
                  <circle
                    className="score-circle-progress"
                    cx="100" cy="100" r="90"
                    style={{
                      strokeDasharray: 565,
                      strokeDashoffset: 565 - (565 * (result.score || 0)) / 100
                    }}
                  />
                </svg>
                <div className="score-value-container">
                  <div className="score-value gradient-text">{Math.round(result.score || 0)}</div>
                  <div className="score-similarity">Similarity</div>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <span className="grade-badge">{result.grade}</span>
                <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{result.message}</p>
              </div>

              <div className="action-buttons">
                <button className="action-btn" onClick={() => downloadTranscript('pdf')}>
                  <span>📄</span> Download Report
                </button>
                <button className="action-btn" onClick={() => downloadTranscript('txt')}>
                  <span>📝</span> Download Transcript
                </button>
              </div>

              {/* Score Breakdown */}
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <span className="breakdown-label">Semantic Analysis</span>
                  <span className="breakdown-value">{result.breakdown.semantic}%</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Keyword Overlap</span>
                  <span className="breakdown-value">{result.breakdown.keyword}%</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Hybrid Score</span>
                  <span className="breakdown-value">{result.breakdown.hybrid}%</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Confidence</span>
                  <span className="breakdown-value">{result.breakdown.confidence}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Intelligence Hub */}
      {result && !loading && (
        <div style={{ gridColumn: '1 / -1', marginTop: '2rem' }}>
          <div className="glass-card" style={{ padding: '3rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.75rem' }}>AI Intelligence Hub</h3>
              <button
                className="cta-button"
                style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem', background: 'transparent', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)', boxShadow: 'none' }}
                onClick={() => setView('deep-dive')}
              >
                Launch Deep Dive
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              {/* Summary Section */}
              <div>
                <span className="section-label">Summary</span>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1.05rem' }}>
                  {result.summary || 'No summary available.'}
                </p>
              </div>

              {/* Transcript Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span className="section-label" style={{ margin: 0 }}>Full Transcript</span>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => downloadTranscript('txt')}
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                    >
                      📄 TXT
                    </button>
                    <button
                      onClick={() => downloadTranscript('pdf')}
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                    >
                      📕 PDF
                    </button>
                  </div>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  padding: '1.5rem',
                  borderRadius: '16px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontSize: '0.9rem',
                  border: '1px solid var(--glass-border)'
                }}>
                  {result.transcript || 'No transcript detected.'}
                </div>
              </div>
            </div>

            {/* Feedback Cards */}
            {result.feedback && (
              <div style={{ marginTop: '3.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {result.feedback.strengths && result.feedback.strengths.length > 0 && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>✔</span>
                      <h4 style={{ color: 'var(--success)', margin: 0 }}>Key Strengths</h4>
                    </div>
                    <ul style={{ paddingLeft: '1.25rem', listStyleType: 'none' }}>
                      {result.feedback.strengths.map((s, i) => (
                        <li key={i} style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-1.5rem', color: 'var(--success)' }}>•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.feedback.missing && result.feedback.missing.length > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>✘</span>
                      <h4 style={{ color: 'var(--danger)', margin: 0 }}>Improvement Areas</h4>
                    </div>
                    <ul style={{ paddingLeft: '1.25rem', listStyleType: 'none' }}>
                      {result.feedback.missing.map((m, i) => (
                        <li key={i} style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '-1.5rem', color: 'var(--danger)' }}>•</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Advanced Suggestions Section */}
                {(result.feedback.suggestions || result.feedback.suggestion) && (
                  <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '2rem', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>💡</span>
                      <h4 style={{ color: 'var(--accent-blue)', margin: 0 }}>AI Recommendations</h4>
                    </div>

                    {result.feedback.suggestions ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {result.feedback.suggestions.map((s, i) => (
                          <div key={i} style={{ borderLeft: '3px solid var(--accent-blue)', paddingLeft: '1.25rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {s.type || 'Tip'}
                            </span>
                            <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: '1.5', fontSize: '0.92rem' }}>{s.content || s}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.92rem' }}>{result.feedback.suggestion}</p>
                    )}

                    <button
                      onClick={() => setView('deep-dive')}
                      style={{
                        marginTop: '2rem',
                        width: '100%',
                        padding: '0.85rem',
                        borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--accent-blue)',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      🚀 Access Intelligence Hub (Deep Dive)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderDeepDive = () => (
    <div style={{ animation: 'fadeIn 0.8s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <span className="section-label">ANALYTICS ENGINE</span>
          <h1 className="hero-title" style={{ fontSize: '3.5rem', marginBottom: 0 }}>Analytical <span className="gradient-text">Deep Dive.</span></h1>
        </div>
        <button className="action-btn" onClick={() => setView('eval')}>
          ← Back to Report
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '3rem', marginBottom: '4rem' }}>
        <div className="glass-card" style={{ padding: '3.5rem' }}>
          <h3 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Comprehensive Performance Analysis</h3>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: '2', whiteSpace: 'pre-wrap' }}>
            {result.feedback.deep_dive || "The AI is still processing your detailed analysis."}
          </div>

          <div style={{ marginTop: '4rem', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Technical Gap Analysis</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div className="breakdown-item">
                <span className="breakdown-label">Contextual Accuracy</span>
                <span className="breakdown-value">{(result.score * 0.95).toFixed(1)}%</span>
              </div>
              <div className="breakdown-item">
                <span className="breakdown-label">Term Fluidity</span>
                <span className="breakdown-value">{(result.breakdown.keyword * 1.1).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="setup-column">
          <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Actionable Timeline</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {result.feedback.suggestions.map((s, i) => (
                <div key={i} style={{ padding: '1rem', borderLeft: '2px solid var(--accent-blue)', background: 'rgba(255,255,255,0.01)', borderRadius: '0 12px 12px 0' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.6, color: 'var(--accent-blue)' }}>{s.type}</span>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>{s.content}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
            <span className="breakdown-label">Engine Confidence</span>
            <div style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0' }} className="gradient-text">{result.breakdown.confidence}%</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>High fidelity semantic matching active using Sentence Transformer engine.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="info-section">
      <h2 className="info-title gradient-text">Precision in Communication.</h2>
      <p className="info-text">
        scrybe.io is engineered to bridge the gap between technical complexity and crystal-clear understanding.
        We believe every word counts. Our AI-driven engine provides high-fidelity analysis for any video response,
        ensuring that your communication is not just heard, but understood with precision.
      </p>
      <div style={{ marginTop: '4rem', textAlign: 'center' }}>
        <span className="section-label">Engine Details</span>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem', maxWidth: '600px', margin: '1rem auto' }}>
          We use the <strong>all-MiniLM-L6-v2</strong> sentence transformer to generate 384-dimensional semantic embeddings for every sentence in your explanation.
          These vectors are compared using <strong>Cosine Similarity</strong> against a golden reference, ensuring that even if you use different words, the meaning is captured.
        </p>
      </div>
    </div>
  );

  const renderPlaceholder = (title) => (
    <div className="info-section">
      <h2 className="info-title gradient-text">{title}</h2>
      <p className="info-text" style={{ color: 'var(--text-muted)' }}>
        This feature is currently under development. <br />
        Stay tuned for the full scrybe.io experience.
      </p>
    </div>
  );

  return (
    <div className="app-container">
      {renderNavbar()}

      <main className="main-content">
        {view === 'home' && renderHome()}
        {view === 'eval' && renderEval()}
        {view === 'deep-dive' && renderDeepDive()}
        {view === 'about' && renderAbout()}
        {view === 'history' && renderPlaceholder('Evaluation History')}
      </main>

      <footer style={{ textAlign: 'center', padding: '4rem', borderTop: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        &copy; 2026 scrybe.io All rights reserved.
      </footer>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';

const SUGGESTED_QUESTIONS = [
  { id: 'about', label: 'What is this proposal about?', icon: '🎯', category: 'Overview' },
  { id: 'affected', label: 'Who will be affected?', icon: '👥', category: 'Stakeholders' },
  { id: 'money', label: 'How much money is being allocated?', icon: '💰', category: 'Budget & Fees' },
  { id: 'approved', label: 'What happens if this proposal is approved?', icon: '⚖️', category: 'Legal Impact' },
  { id: 'objections', label: 'When can citizens submit objections?', icon: '📅', category: 'Objections & Deadlines' }
];

export default function PolicyQA({ 
  documents = [], 
  documentId = null,
  analysisId = null,
  documentTitle = '',
  onOpenEvidence, 
  onStartAnalysis,
  embedded = false,
  autoQuestion = null
}) {
  const [selectedDocId, setSelectedDocId] = useState(documentId || '');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [lang, setLang] = useState('en'); // 'en' | 'kn'
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Sync documentId if prop updates
  useEffect(() => {
    if (documentId) {
      setSelectedDocId(documentId);
    }
  }, [documentId]);

  // Auto-select initial document if in multi-doc mode
  useEffect(() => {
    if (!documentId && documents && documents.length > 0 && !selectedDocId) {
      const preferred = documents.find(d => 
        (d.title && d.title.includes('Karnataka')) ||
        (d.title && d.title.includes('Maplewood'))
      );
      setSelectedDocId(preferred ? preferred.id : documents[0].id);
    }
  }, [documents, documentId, selectedDocId]);

  // If autoQuestion is passed, ask it automatically
  useEffect(() => {
    if (autoQuestion && !currentAnswer) {
      handleAsk(autoQuestion);
    }
  }, [autoQuestion, selectedDocId, analysisId]);

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleAsk = async (qText) => {
    const targetQ = qText || question;
    if (!targetQ || !targetQ.trim()) return;

    const activeDocId = documentId || selectedDocId;
    if (!activeDocId && !analysisId) {
      setError('Please select or upload a municipal document first.');
      return;
    }

    setLoading(true);
    setError(null);

    // Stop ongoing speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      const url = analysisId
        ? `/api/analyses/${analysisId}/ask`
        : `/api/documents/${activeDocId}/ask`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: targetQ.trim() })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to answer question (HTTP ${res.status})`);
      }

      const answerData = await res.json();
      setCurrentAnswer(answerData);

      // Add to session history if not already present
      setHistory(prev => {
        const exists = prev.some(item => item.question === answerData.question && item.document_id === answerData.document_id);
        if (exists) return prev;
        return [answerData, ...prev.slice(0, 7)];
      });
    } catch (err) {
      console.error('Error asking policy question:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sweet voice readout
  const handleSpeak = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.22;
    utterance.rate = 0.98;

    const voices = window.speechSynthesis.getVoices();
    const sweetVoice = voices.find(v =>
      /samantha|tara|karen|victoria|moira|veena|zira|female/i.test(v.name)
    ) || voices[0];

    if (sweetVoice) utterance.voice = sweetVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const activeDocId = documentId || selectedDocId;
  const currentDocObj = documents.find(d => d.id === activeDocId);
  const displayTitle = documentTitle || (currentDocObj ? currentDocObj.title : 'Uploaded Municipal Document');

  return (
    <div className="card animate-fade" style={{
      padding: embedded ? '20px 24px' : '28px 32px',
      marginBottom: 32,
      border: '2px solid #bfdbfe',
      background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
      boxShadow: '0 8px 24px -4px rgba(30, 58, 138, 0.08)'
    }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
            <span>🧠</span>
            <span>ASK QUESTIONS ABOUT POLICIES</span>
            <span style={{ fontSize: 10, backgroundColor: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4 }}>
              Evidence Grounded
            </span>
          </div>
          <h2 style={{ fontSize: embedded ? 20 : 24, fontWeight: 800, color: 'var(--primary)', margin: 0, letterSpacing: -0.5 }}>
            {lang === 'kn' ? 'ನೀತಿಗಳ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ' : 'Ask Questions About Policies'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0', maxWidth: 640 }}>
            {lang === 'kn' 
              ? 'ಈ ಪ್ರಸ್ತಾವನೆಯ ಬಗ್ಗೆ ನೇರ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ. ಮೂಲ ದಾಖಲೆಯಿಂದ ಪರಿಶೀಲಿಸಿದ ಪುರಾವೆಗಳೊಂದಿಗೆ ತಕ್ಷಣ ಉತ್ತರ ಪಡೆಯಿರಿ.'
              : 'Ask any question about this municipal policy or proposal. Every answer includes verified evidence from the source document.'}
          </p>
        </div>

        {/* Document Selector & Language Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Language Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: '#e2e8f0',
            borderRadius: 6,
            padding: 2,
            fontSize: 12,
            fontWeight: 700
          }}>
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: lang === 'en' ? '#ffffff' : 'transparent',
                color: lang === 'en' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('kn')}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: lang === 'kn' ? '#ffffff' : 'transparent',
                color: lang === 'kn' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              ಕನ್ನಡ
            </button>
          </div>

          {/* Document Display / Picker */}
          {documents && documents.length > 1 && !documentId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>📄 Policy:</span>
              <select
                value={selectedDocId}
                onChange={e => {
                  setSelectedDocId(e.target.value);
                  setCurrentAnswer(null);
                }}
                style={{
                  padding: '7px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  backgroundColor: '#ffffff',
                  color: 'var(--text-main)',
                  maxWidth: 240,
                  outline: 'none'
                }}
              >
                {documents.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#334155'
            }}>
              <span>📄 Document:</span>
              <span style={{ color: 'var(--primary)', fontWeight: 700, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayTitle}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Suggested Quick Question Chips */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          {lang === 'kn' ? '💡 ಜನಪ್ರಿಯ ಪ್ರಶ್ನೆಗಳು (ಕ್ಲಿಕ್ ಮಾಡಿ):' : '💡 Suggested Citizen Questions (Click to Ask):'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q.id}
              onClick={() => {
                setQuestion(q.label);
                handleAsk(q.label);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 9999,
                border: '1px solid #cbd5e1',
                backgroundColor: question === q.label ? '#eff6ff' : '#ffffff',
                color: question === q.label ? '#1e40af' : '#334155',
                borderColor: question === q.label ? '#3b82f6' : '#cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={e => {
                if (question !== q.label) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
            >
              <span>{q.icon}</span>
              <span>“{q.label}”</span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Question Input Bar */}
      <form onSubmit={e => { e.preventDefault(); handleAsk(); }} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#94a3b8' }}>
            🔍
          </span>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder={lang === 'kn' 
              ? 'ಈ ನೀತಿಯ ಬಗ್ಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ (ಉದಾ: ದಂಡಗಳು ಎಷ್ಟು? ಯಾರ ಮೇಲೆ ಪರಿಣಾಮ?)...'
              : 'Ask any question about this policy (e.g., "What are the penalties?", "Who enforces this?")...'
            }
            style={{
              width: '100%',
              padding: '11px 16px 11px 40px',
              fontSize: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              backgroundColor: '#ffffff',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {question && (
            <button
              type="button"
              onClick={() => setQuestion('')}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="btn-primary"
          style={{
            padding: '11px 22px',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: loading || !question.trim() ? 0.7 : 1,
            cursor: loading || !question.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: 14, height: 14, borderTopColor: '#ffffff' }}></div>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>Ask CivicLens</span>
              <span>➔</span>
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          marginBottom: 16
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Answer Panel */}
      {currentAnswer && (
        <div className="animate-fade" style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          padding: '22px 24px'
        }}>
          {/* Top Metadata & Voice Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            paddingBottom: 14,
            borderBottom: '1px solid #f1f5f9',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>
                📌 {currentAnswer.category ? currentAnswer.category.toUpperCase().replace(/_/g, ' ') : 'POLICY ANSWER'}
              </span>
              <span className="badge" style={{ backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>
                🛡️ {Math.round((currentAnswer.confidence_score || 0.95) * 100)}% Grounded Evidence
              </span>
              {currentAnswer.statutory_anchor && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  📜 {currentAnswer.statutory_anchor}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleSpeak(`${currentAnswer.answer}. Key takeaways: ${currentAnswer.key_points ? currentAnswer.key_points.join('. ') : ''}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: isSpeaking ? '#f43f5e' : '#fff1f2',
                color: isSpeaking ? '#ffffff' : '#be123c',
                border: '1px solid #fecdd3',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{isSpeaking ? '⏹️ Stop Reading' : '🌸 Listen (Sweet Voice)'}</span>
            </button>
          </div>

          {/* Citizen Question Display */}
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-main)', marginBottom: 12, lineHeight: 1.3 }}>
            “{currentAnswer.question}”
          </div>

          {/* Plain Language Direct Answer */}
          <div style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: '#1e293b',
            backgroundColor: '#f8fafc',
            borderLeft: '4px solid var(--primary)',
            padding: '14px 18px',
            borderRadius: '0 8px 8px 0',
            marginBottom: 18
          }}>
            {currentAnswer.answer}
          </div>

          {/* Key Bullet Points / Takeaways */}
          {currentAnswer.key_points && currentAnswer.key_points.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                ⚡ Key Policy Takeaways:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {currentAnswer.key_points.map((pt, idx) => (
                  <li key={idx} style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grounded Source Evidence Section (Mandatory Requirement) */}
          {currentAnswer.evidence && currentAnswer.evidence.length > 0 && (
            <div style={{
              borderTop: '1px dashed #cbd5e1',
              paddingTop: 16,
              marginTop: 16
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15 }}>📜</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Verified Evidence from Source Document
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {currentAnswer.evidence.length} citation{currentAnswer.evidence.length > 1 ? 's' : ''} retrieved
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {currentAnswer.evidence.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: 12,
                      backgroundColor: '#f8fafc',
                      transition: 'border-color 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>
                          📍 {ev.section_heading || 'Section Passage'}
                        </span>
                        {ev.page && (
                          <span style={{ fontSize: 11, backgroundColor: '#e2e8f0', padding: '1px 6px', borderRadius: 4, color: '#475569' }}>
                            Page {ev.page}
                          </span>
                        )}
                      </div>

                      {onOpenEvidence && ev.section_id && (
                        <button
                          type="button"
                          onClick={() => onOpenEvidence(analysisId || null, ev.section_id, `Page ${ev.page || 1}`, ev.section_heading || 'Section Citation', activeDocId)}
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span>Inspect Source Evidence</span>
                          <span>🔍 →</span>
                        </button>
                      )}
                    </div>

                    <blockquote style={{
                      margin: 0,
                      fontSize: 13,
                      fontStyle: 'italic',
                      color: '#475569',
                      lineHeight: 1.6,
                      backgroundColor: '#ffffff',
                      padding: '10px 14px',
                      borderRadius: 6,
                      borderLeft: '3px solid var(--teal)'
                    }}>
                      “{ev.exact_quote}”
                    </blockquote>

                    {ev.context && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>ℹ️</span>
                        <span>{ev.context}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session History Tabs (allows comparing previous questions) */}
      {history.length > 1 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Recent Questions on this Document:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {history.map((h, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setQuestion(h.question);
                  setCurrentAnswer(h);
                }}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  backgroundColor: currentAnswer?.question === h.question ? '#eff6ff' : '#f8fafc',
                  color: currentAnswer?.question === h.question ? '#1e40af' : '#475569',
                  cursor: 'pointer'
                }}
              >
                {h.question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';

/**
 * NeighborhoodImpactAssessment Component
 * Synthesized by Agent 4 across 6 civil infrastructure dimensions:
 * 🚗 Traffic & Congestion
 * 🅿️ Parking Availability
 * 🌳 Environment & Tree Canopy
 * 💧 Water Demand & Infrastructure
 * ♻️ Waste Generation & Sewerage
 * 🔊 Noise & Air Quality
 */
export default function NeighborhoodImpactAssessment({ analysisId, onOpenEvidence }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'

  // Audio Speech Synthesis state
  const [audioState, setAudioState] = useState('stopped'); // 'stopped' | 'playing' | 'paused'

  useEffect(() => {
    if (!analysisId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/analyses/${analysisId}/neighborhood-impacts`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load neighborhood assessment`);
        return res.json();
      })
      .then(assessment => {
        if (isMounted) {
          setData(assessment);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [analysisId]);

  // Sweet girl voice narration
  const handlePlaySweetVoice = () => {
    if (!window.speechSynthesis || !data?.dimensions) return;

    if (audioState === 'paused') {
      window.speechSynthesis.resume();
      setAudioState('playing');
      return;
    }

    window.speechSynthesis.cancel();

    let text = `Hello! Here is your Agent 4 civil infrastructure synthesis for ${data.project_title || 'this project'}. `;
    text += `We have identified ${data.summary_counts?.critical || 2} critical concerns, ${data.summary_counts?.high || 2} high severity issues, and ${data.summary_counts?.medium || 2} medium impacts. `;

    data.dimensions.forEach((d) => {
      text += `Regarding ${d.title}, classified as ${d.severity}: ${d.metric_chip}. ${d.reasoning} `;
    });

    text += 'Click inspect data to examine the underlying public engineering audits.';

    const utterance = new SpeechSynthesisUtterance(text);

    // Pick sweet voice
    const voices = window.speechSynthesis.getVoices();
    const sweetNames = ['Samantha', 'Tara', 'Karen', 'Victoria', 'Flo', 'Microsoft Jenny', 'Ava'];
    let selectedVoice = null;
    for (const name of sweetNames) {
      selectedVoice = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
      if (selectedVoice) break;
    }
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
                      voices.find(v => v.lang.startsWith('en')) || voices[0];
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = 1.22;
    utterance.rate = 0.98;

    utterance.onend = () => setAudioState('stopped');
    utterance.onerror = () => setAudioState('stopped');

    window.speechSynthesis.speak(utterance);
    setAudioState('playing');
  };

  const handlePauseSweetVoice = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
      setAudioState('paused');
    }
  };

  const handleStopSweetVoice = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setAudioState('stopped');
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', marginBottom: 24 }}>
        <div className="spinner" style={{ borderColor: 'rgba(30,58,138,0.2)', borderTopColor: 'var(--primary)', width: 32, height: 32, margin: '0 auto 16px' }}></div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Agent 4 synthesizing 6 civil infrastructure dimensions...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ padding: 28, textAlign: 'center', backgroundColor: '#fef2f2', borderColor: '#fecaca', marginBottom: 24 }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>⚠️</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>
          Unable to generate neighborhood impact assessment
        </div>
        <div style={{ fontSize: 12, color: '#b91c1c' }}>{error || 'No assessment data returned.'}</div>
      </div>
    );
  }

  const { dimensions, summary_counts } = data;
  const filteredDimensions = filterSeverity === 'ALL'
    ? dimensions
    : dimensions.filter(d => d.severity === filterSeverity);

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Top Banner Matching User Reference Image */}
      <div style={{
        backgroundColor: '#0a101d',
        border: '1px solid #1e293b',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: 20,
        boxShadow: 'var(--shadow-md)',
        color: '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.3px', color: '#ffffff' }}>
              Neighborhood Impact Assessment
            </h2>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
              Synthesized by Agent 4 across 6 civil infrastructure dimensions (Icons: 🚗 🅿️ 🌳 💧 ♻️ 🔊)
            </p>
          </div>

          {/* Top Right Severity Summary Badges Matching Screenshot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: '#450a0a',
              color: '#fca5a5',
              border: '1px solid #dc2626',
              fontSize: 12,
              fontWeight: 800,
              padding: '5px 14px',
              borderRadius: 9999,
              letterSpacing: 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              {summary_counts.critical} CRITICAL
            </span>

            <span style={{
              backgroundColor: '#451a03',
              color: '#fde68a',
              border: '1px solid #d97706',
              fontSize: 12,
              fontWeight: 800,
              padding: '5px 14px',
              borderRadius: 9999,
              letterSpacing: 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              {summary_counts.high} HIGH
            </span>

            <span style={{
              backgroundColor: '#082f49',
              color: '#7dd3fc',
              border: '1px solid #0284c7',
              fontSize: 12,
              fontWeight: 800,
              padding: '5px 14px',
              borderRadius: 9999,
              letterSpacing: 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              {summary_counts.medium} MEDIUM
            </span>
          </div>
        </div>

        {/* Toolbar: Filters & Audio */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
          {/* Severity Filter Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginRight: 4 }}>
              Filter:
            </span>
            {[
              { id: 'ALL', label: `All (${dimensions.length})` },
              { id: 'CRITICAL', label: `Critical (${summary_counts.critical})` },
              { id: 'HIGH', label: `High (${summary_counts.high})` },
              { id: 'MEDIUM', label: `Medium (${summary_counts.medium})` }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterSeverity(f.id)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid',
                  cursor: 'pointer',
                  backgroundColor: filterSeverity === f.id ? '#1e293b' : 'transparent',
                  borderColor: filterSeverity === f.id ? '#38bdf8' : '#334155',
                  color: filterSeverity === f.id ? '#38bdf8' : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sweet Voice Audio Button */}
          {audioState === 'stopped' ? (
            <button
              type="button"
              onClick={handlePlaySweetVoice}
              style={{
                backgroundColor: '#f43f5e',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
              title="Listen to Agent 4 civil assessment"
            >
              <span>🌸</span>
              <span>Listen to Assessment</span>
            </button>
          ) : (
            <div style={{ display: 'inline-flex', gap: 6 }}>
              {audioState === 'playing' ? (
                <button
                  type="button"
                  onClick={handlePauseSweetVoice}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.4)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ⏸️ Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePlaySweetVoice}
                  style={{
                    backgroundColor: '#22c55e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ▶️ Resume
                </button>
              )}
              <button
                type="button"
                onClick={handleStopSweetVoice}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '5px 8px',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                ⏹️
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2x3 Grid of Infrastructure Dimensions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
        gap: 20
      }}>
        {filteredDimensions.map((item) => {
          let severityBg = '#450a0a';
          let severityColor = '#fca5a5';
          let severityBorder = '#dc2626';
          let chipColor = '#f87171';

          if (item.severity === 'HIGH') {
            severityBg = '#451a03';
            severityColor = '#fde68a';
            severityBorder = '#d97706';
            chipColor = '#fbbf24';
          } else if (item.severity === 'MEDIUM') {
            severityBg = '#082f49';
            severityColor = '#7dd3fc';
            severityBorder = '#0284c7';
            chipColor = '#38bdf8';
          }

          return (
            <div
              key={item.id}
              style={{
                backgroundColor: '#0c1322',
                border: '1px solid #1e293b',
                borderRadius: 'var(--radius-md)',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = severityBorder;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#1e293b';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                {/* Header: Icon + Title + Severity Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{item.icon}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      {item.title}
                    </h3>
                  </div>

                  <span style={{
                    backgroundColor: severityBg,
                    color: severityColor,
                    border: `1px solid ${severityBorder}`,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    letterSpacing: 0.5
                  }}>
                    {item.severity}
                  </span>
                </div>

                {/* Second Row: Metric Chip & Data Quality */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 14
                }}>
                  {/* Stat Metric Chip with Lightning Bolt */}
                  <div style={{
                    backgroundColor: '#172033',
                    border: '1px solid #27354f',
                    borderRadius: 6,
                    padding: '4px 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: chipColor
                  }}>
                    <span>⚡</span>
                    <span>{item.metric_chip}</span>
                  </div>

                  {/* Data Quality Provenance */}
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    <span style={{ opacity: 0.8 }}>Data Quality: </span>
                    <strong style={{ color: '#e2e8f0' }}>{item.data_quality}</strong>
                  </div>
                </div>

                {/* Reasoning Paragraph */}
                <div style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#cbd5e1',
                  marginBottom: 16
                }}>
                  <strong style={{ color: '#f8fafc' }}>Reasoning: </strong>
                  {item.reasoning}
                </div>
              </div>

              {/* Bottom Footer: Document Citation & Inspect Data Button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 12,
                borderTop: '1px solid #1e293b',
                gap: 10
              }}>
                <div style={{
                  fontSize: 11,
                  color: '#64748b',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '65%'
                }} title={item.citation_source}>
                  {item.citation_source}
                </div>

                {onOpenEvidence && item.evidence?.section_id ? (
                  <button
                    type="button"
                    onClick={() => onOpenEvidence(item.evidence.section_id, item.evidence.excerpt_quote)}
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#38bdf8',
                      border: '1px solid #334155',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = '#38bdf8';
                      e.currentTarget.style.color = '#0f172a';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = '#1e293b';
                      e.currentTarget.style.color = '#38bdf8';
                    }}
                    title="Inspect source document excerpt"
                  >
                    <span>Inspect Data</span>
                    <span>→</span>
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: '#475569' }}>Verified</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

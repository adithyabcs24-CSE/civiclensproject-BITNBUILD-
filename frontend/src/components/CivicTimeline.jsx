import React, { useState, useEffect } from 'react';

/**
 * CivicTimeline Component (Feature 11: 📅 Civic Timeline)
 * Turns complicated municipal documents into an interactive chronological timeline
 * with plain text format (down arrows ↓), one-click copy, evidence grounding,
 * calendar .ics export, and sweet girl voice audio readout.
 */
export default function CivicTimeline({ analysisId, documentTitle, onOpenEvidence }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [viewMode, setViewMode] = useState('visual'); // 'visual' | 'plaintext'
  const [copied, setCopied] = useState(false);

  // Audio Speech Synthesis state
  const [audioState, setAudioState] = useState('stopped'); // 'stopped' | 'playing' | 'paused'
  const [speechUtterance, setSpeechUtterance] = useState(null);

  useEffect(() => {
    if (!analysisId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/analyses/${analysisId}/timeline`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load timeline`);
        return res.json();
      })
      .then(data => {
        if (isMounted) {
          setTimelineData(data);
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

  // Copy Plain Text to Clipboard
  const handleCopyPlainText = () => {
    if (!timelineData?.plain_text) return;
    navigator.clipboard.writeText(timelineData.plain_text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }).catch(err => {
      console.error('Clipboard copy error:', err);
    });
  };

  // Download iCalendar (.ics) file for citizen calendar apps
  const handleDownloadICS = () => {
    if (!timelineData?.milestones) return;

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CivicLens AI//Civic Timeline//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    timelineData.milestones.forEach((m, idx) => {
      // Try to parse ISO date or use today's timestamp
      let dtStart = '20241129T170000Z';
      if (m.date && m.date.includes('-')) {
        const clean = m.date.replace(/[^0-9]/g, '');
        if (clean.length === 8) {
          dtStart = `${clean}T090000Z`;
        }
      }

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:civic-${analysisId}-${idx}@civiclens.ai`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dtStart}`,
        `SUMMARY:🏛️ ${m.milestone} - ${timelineData.project_title || 'Civic Proceeding'}`,
        `DESCRIPTION:${m.description.replace(/\n/g, ' ')} | Responsible: ${m.responsible_entity}`,
        `STATUS:CONFIRMED`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${(timelineData.project_title || 'civic_timeline').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Sweet voice narration for timeline
  const handlePlaySweetVoice = () => {
    if (!window.speechSynthesis || !timelineData?.milestones) return;

    if (audioState === 'paused') {
      window.speechSynthesis.resume();
      setAudioState('playing');
      return;
    }

    window.speechSynthesis.cancel();

    let text = `Hello! Here is your civic timeline for ${timelineData.project_title || 'this proposal'}. `;
    timelineData.milestones.forEach((m, idx) => {
      text += `Step ${idx + 1}: On ${m.date_display || m.date}, ${m.milestone}. ${m.description} `;
      if (m.citizen_action_hint) {
        text += `Citizen action: ${m.citizen_action_hint}. `;
      }
    });
    text += 'Stay engaged with your local community!';

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
    utterance.pitch = 1.22; // Sweet, cheerful tone
    utterance.rate = 0.98;

    utterance.onend = () => setAudioState('stopped');
    utterance.onerror = () => setAudioState('stopped');

    setSpeechUtterance(utterance);
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
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <div className="spinner" style={{ borderColor: 'rgba(30,58,138,0.2)', borderTopColor: 'var(--primary)', width: 32, height: 32, margin: '0 auto 16px' }}></div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Extracting chronological procedural timeline & dates...
        </div>
      </div>
    );
  }

  if (error || !timelineData) {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center', backgroundColor: '#fef2f2', borderColor: '#fecaca' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#991b1b', marginBottom: 4 }}>
          Unable to generate timeline
        </div>
        <div style={{ fontSize: 13, color: '#b91c1c' }}>{error || 'No timeline data found.'}</div>
      </div>
    );
  }

  const { milestones, plain_text, project_title, location } = timelineData;

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Header Banner */}
      <div className="card" style={{
        padding: '24px 28px',
        marginBottom: 20,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #2563eb 100%)',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>📅</span>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                backgroundColor: 'rgba(255,255,255,0.18)',
                padding: '3px 10px',
                borderRadius: 9999
              }}>
                Procedural Roadmap
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: 'rgba(255,255,255,0.12)',
                padding: '3px 10px',
                borderRadius: 9999
              }}>
                {milestones.length} Key Milestones
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px 0', color: '#ffffff' }}>
              Civic Timeline: {project_title}
            </h2>
            <p style={{ fontSize: 14, color: '#cbd5e1', margin: 0, maxWidth: 620, lineHeight: 1.5 }}>
              Complicated municipal proceedings translated into an evidence-grounded chronological schedule for citizens of {location}.
            </p>
          </div>

          {/* Action Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* View Mode Switcher */}
            <div style={{
              display: 'inline-flex',
              backgroundColor: 'rgba(255,255,255,0.15)',
              padding: 3,
              borderRadius: 'var(--radius-sm)'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('visual')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: viewMode === 'visual' ? '#ffffff' : 'transparent',
                  color: viewMode === 'visual' ? '#1e3a8a' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Visual Roadmap
              </button>
              <button
                type="button"
                onClick={() => setViewMode('plaintext')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 4,
                  backgroundColor: viewMode === 'plaintext' ? '#ffffff' : 'transparent',
                  color: viewMode === 'plaintext' ? '#1e3a8a' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Plain Text (↓)
              </button>
            </div>

            {/* Sweet Voice Narration */}
            {audioState === 'stopped' ? (
              <button
                type="button"
                onClick={handlePlaySweetVoice}
                style={{
                  backgroundColor: '#f43f5e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                }}
                title="Listen to timeline in sweet voice"
              >
                <span>🌸</span>
                <span>Listen to Timeline</span>
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
                      padding: '7px 12px',
                      fontSize: 12,
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
                      padding: '7px 12px',
                      fontSize: 12,
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
                    padding: '7px 10px',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  ⏹️
                </button>
              </div>
            )}

            {/* Calendar Export */}
            <button
              type="button"
              onClick={handleDownloadICS}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '7px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
              title="Add milestones and objection deadlines to Apple Calendar / Google Calendar / Outlook"
            >
              <span>📅</span>
              <span>Add to Calendar (.ics)</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: PLAIN TEXT FORMAT (AS REQUESTED BY USER) */}
      {viewMode === 'plaintext' && (
        <div className="card" style={{ padding: 24, marginBottom: 24, backgroundColor: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>📋</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
                Plain text
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyPlainText}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: copied ? '#dcfce7' : 'var(--surface-alt)',
                color: copied ? '#166534' : 'var(--text-main)',
                border: `1px solid ${copied ? '#86efac' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Copied to Clipboard!' : 'Copy'}</span>
            </button>
          </div>

          <div style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text-main)',
            backgroundColor: 'var(--surface-alt)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '20px 24px',
            whiteSpace: 'pre-wrap',
            userSelect: 'all'
          }}>
            {plain_text}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💡</span>
            <span>Tip: Click <strong>Copy</strong> above to paste this plain-text procedural schedule into emails, community group chats, or meeting notes.</span>
          </div>
        </div>
      )}

      {/* VIEW 2: INTERACTIVE VISUAL ROADMAP */}
      {viewMode === 'visual' && (
        <div className="card" style={{ padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', margin: '0 0 4px 0' }}>
                Chronological Progression
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Trace the complete decision timeline from submission to final ordinance vote.
              </p>
            </div>

            {/* Quick Copy shortcut even in visual mode */}
            <button
              type="button"
              onClick={handleCopyPlainText}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: copied ? '#dcfce7' : '#f8fafc',
                color: copied ? '#166534' : '#475569',
                border: `1px solid ${copied ? '#86efac' : '#e2e8f0'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer'
              }}
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Copied' : 'Copy Plain Text'}</span>
            </button>
          </div>

          {/* Timeline Track */}
          <div style={{ position: 'relative', paddingLeft: 36 }}>
            {/* Vertical connector line */}
            <div style={{
              position: 'absolute',
              top: 14,
              bottom: 24,
              left: 17,
              width: 3,
              backgroundColor: '#e2e8f0',
              borderRadius: 2
            }} />

            {milestones.map((item, idx) => {
              const isDeadline = item.phase === 'statutory_deadline';
              const isCurrent = item.phase === 'current';
              const isCompleted = item.phase === 'completed';

              let badgeBg = '#f1f5f9';
              let badgeColor = '#475569';
              let badgeBorder = '#cbd5e1';
              let badgeText = 'Upcoming';
              let icon = '⏳';
              let dotBg = '#94a3b8';

              if (isCompleted) {
                badgeBg = '#dcfce7';
                badgeColor = '#166534';
                badgeBorder = '#86efac';
                badgeText = 'Completed';
                icon = '✓';
                dotBg = '#22c55e';
              } else if (isCurrent) {
                badgeBg = '#dbeafe';
                badgeColor = '#1e40af';
                badgeBorder = '#93c5fd';
                badgeText = 'Active Phase';
                icon = '🔵';
                dotBg = '#3b82f6';
              } else if (isDeadline) {
                badgeBg = '#fee2e2';
                badgeColor = '#991b1b';
                badgeBorder = '#fca5a5';
                badgeText = 'Statutory Deadline';
                icon = '🚨';
                dotBg = '#ef4444';
              }

              return (
                <div
                  key={item.id || idx}
                  style={{
                    position: 'relative',
                    marginBottom: idx === milestones.length - 1 ? 0 : 28,
                    animation: `fadeIn 0.3s ease-out ${idx * 0.05}s`
                  }}
                >
                  {/* Step Node Icon on line */}
                  <div style={{
                    position: 'absolute',
                    left: -36,
                    top: 2,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: dotBg,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    boxShadow: isCurrent ? '0 0 0 4px rgba(59, 130, 246, 0.25)' : 'none',
                    border: '2px solid #ffffff',
                    zIndex: 2
                  }}>
                    {icon}
                  </div>

                  {/* Milestone Card */}
                  <div style={{
                    backgroundColor: isDeadline ? 'var(--surface-alt)' : 'var(--surface)',
                    border: `1px solid ${isDeadline ? 'var(--conf-low-border)' : 'var(--border)'}`,
                    borderLeft: `4px solid ${dotBg}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    boxShadow: isDeadline ? '0 2px 8px rgba(234, 88, 12, 0.08)' : 'var(--shadow-sm)'
                  }}>
                    {/* Top Row: Date & Phase */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 800,
                          color: isDeadline ? 'var(--accent)' : 'var(--primary)',
                          letterSpacing: '-0.2px'
                        }}>
                          📅 {item.date_display || item.date}
                        </span>
                        {item.responsible_entity && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: 'var(--surface-alt)',
                            color: 'var(--text-muted)',
                            padding: '2px 8px',
                            borderRadius: 4
                          }}>
                            🏛️ {item.responsible_entity}
                          </span>
                        )}
                      </div>

                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 9999,
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`
                      }}>
                        {badgeText}
                      </span>
                    </div>

                    {/* Milestone Title */}
                    <h4 style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--primary)',
                      margin: '0 0 8px 0',
                      lineHeight: 1.3
                    }}>
                      {item.milestone}
                    </h4>

                    {/* Plain English Description */}
                    <p style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: '#475569',
                      margin: '0 0 12px 0'
                    }}>
                      {item.description}
                    </p>

                    {/* Action Hint Card for Citizens */}
                    {item.citizen_action_hint && (
                      <div style={{
                        backgroundColor: isDeadline ? '#fef3c7' : '#f0fdf4',
                        border: `1px solid ${isDeadline ? '#fde68a' : '#bbf7d0'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: isDeadline ? '#92400e' : '#166534',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8
                      }}>
                        <span style={{ fontSize: 14 }}>⚡</span>
                        <div>
                          <strong>Citizen Action:</strong> {item.citizen_action_hint}
                        </div>
                      </div>
                    )}

                    {/* Evidence Quote Link */}
                    {item.evidence && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        paddingTop: 10,
                        borderTop: '1px dashed #e2e8f0'
                      }}>
                        <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', maxWidth: '80%' }}>
                          "{item.evidence.excerpt_quote}"
                        </div>
                        {onOpenEvidence && item.evidence.section_id && (
                          <button
                            type="button"
                            onClick={() => onOpenEvidence(item.evidence.section_id, item.evidence.excerpt_quote)}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: 'var(--primary)',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              padding: '4px 10px',
                              borderRadius: 4,
                              cursor: 'pointer',
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

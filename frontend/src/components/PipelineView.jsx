import React, { useEffect, useState } from 'react';

const STAGES = [
  {
    key: 'document',
    label: 'Document Agent',
    description: 'Classifies document type, extracts entities, and aligns DB sections.',
    icon: '📄'
  },
  {
    key: 'policy',
    label: 'Policy Agent',
    description: 'Identifies concrete municipal policies and regulatory changes.',
    icon: '📜'
  },
  {
    key: 'impact',
    label: 'Impact Agent',
    description: 'Projects localized impacts with hedged probabilistic statements.',
    icon: '🎯'
  },
  {
    key: 'evidence',
    label: 'Evidence Agent',
    description: 'Anti-hallucination gate: verifies grounding, audits claims, drops fabrications.',
    icon: '🛡️'
  },
  {
    key: 'report',
    label: 'Citizen Report Agent',
    description: 'Synthesizes plain-English report, questions, and citizen action checklist.',
    icon: '📊'
  }
];

const STAGE_ORDER = ['pending', 'document', 'policy', 'impact', 'evidence', 'report', 'complete'];

export default function PipelineView({ analysisId, onComplete, onBack }) {
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!analysisId) return;

    let isMounted = true;
    let timerId = null;

    const fetchStatus = () => {
      fetch(`/api/analyses/${analysisId}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Failed to fetch analysis status (HTTP ${res.status})`);
          }
          return res.json();
        })
        .then(data => {
          if (!isMounted) return;
          setAnalysis(data);
          setPollCount(p => p + 1);

          if (data.status === 'complete') {
            // Give user 1.2s to appreciate the all-green completion state before navigating
            setTimeout(() => {
              if (isMounted) {
                onComplete(analysisId);
              }
            }, 1200);
          } else if (data.status !== 'failed') {
            timerId = setTimeout(fetchStatus, 900);
          }
        })
        .catch(err => {
          if (!isMounted) return;
          setError(err.message);
          timerId = setTimeout(fetchStatus, 2000);
        });
    };

    fetchStatus();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [analysisId, onComplete]);

  const currentStatus = analysis?.status || 'pending';
  const currentIdx = STAGE_ORDER.indexOf(currentStatus);

  // Helper to determine stage status
  const getStageState = (stageKey) => {
    const stageIdx = STAGE_ORDER.indexOf(stageKey);
    if (currentStatus === 'failed') {
      // Find where it failed
      if (stageIdx === currentIdx + 1) return 'failed';
      if (stageIdx <= currentIdx) return 'done';
      return 'pending';
    }
    if (currentStatus === 'complete' || stageIdx < currentIdx) {
      return 'done';
    }
    if (stageIdx === currentIdx) {
      return 'active';
    }
    return 'pending';
  };

  return (
    <div className="animate-fade" style={{ maxWidth: 840, margin: '0 auto', padding: '36px 20px 80px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <button 
          onClick={onBack}
          className="btn-secondary btn-sm"
          style={{ position: 'absolute', left: 24, top: 84 }}
        >
          ← Dashboard
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ⚡ Autonomous Agent Pipeline
          </span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
          Processing Civic Intelligence
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Locality: <strong>{analysis?.locality || 'Analyzing locality'}</strong> · Multi-agent sequential verification
        </p>
      </div>

      {/* Main Status Container */}
      <div className="card" style={{ padding: '32px 36px', marginBottom: 28 }}>
        {/* Stages Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {STAGES.map((stage, idx) => {
            const state = getStageState(stage.key);

            let borderColor = 'var(--border)';
            let bgColor = '#ffffff';
            let iconBg = '#f1f5f9';
            let iconColor = '#64748b';
            let badgeText = 'Waiting';
            let badgeStyle = { backgroundColor: '#f1f5f9', color: '#64748b' };

            if (state === 'done') {
              borderColor = '#a7f3d0';
              bgColor = '#f0fdf4';
              iconBg = '#dcfce7';
              iconColor = '#15803d';
              badgeText = 'Verified & Stored';
              badgeStyle = { backgroundColor: '#dcfce7', color: '#15803d' };
            } else if (state === 'active') {
              borderColor = '#38bdf8';
              bgColor = '#f0f9ff';
              iconBg = '#e0f2fe';
              iconColor = '#0284c7';
              badgeText = 'Running Agent...';
              badgeStyle = { backgroundColor: '#e0f2fe', color: '#0369a1', animation: 'pulse 1.8s infinite' };
            } else if (state === 'failed') {
              borderColor = '#fca5a5';
              bgColor = '#fef2f2';
              iconBg = '#fee2e2';
              iconColor = '#b91c1c';
              badgeText = 'Failed';
              badgeStyle = { backgroundColor: '#fee2e2', color: '#b91c1c' };
            }

            // Intermediate data preview count
            let stageDetail = null;
            if (stage.key === 'document' && analysis?.document_json) {
              const docJson = typeof analysis.document_json === 'string' ? JSON.parse(analysis.document_json) : analysis.document_json;
              stageDetail = `Classified as ${docJson.doc_type} (${docJson.sections?.length || 0} sections aligned)`;
            } else if (stage.key === 'policy' && analysis?.policy_json) {
              const polJson = typeof analysis.policy_json === 'string' ? JSON.parse(analysis.policy_json) : analysis.policy_json;
              stageDetail = `${polJson.policies?.length || 0} municipal policies extracted & grounded`;
            } else if (stage.key === 'impact' && analysis?.impact_json) {
              const impJson = typeof analysis.impact_json === 'string' ? JSON.parse(analysis.impact_json) : analysis.impact_json;
              stageDetail = `${impJson.impacts?.length || 0} localized impact projections generated`;
            } else if (stage.key === 'evidence' && analysis?.evidence_json) {
              const evJson = typeof analysis.evidence_json === 'string' ? JSON.parse(analysis.evidence_json) : analysis.evidence_json;
              stageDetail = `${evJson.impacts?.length || 0} impacts verified; ungrounded items dropped`;
            } else if (stage.key === 'report' && analysis?.report_json) {
              stageDetail = `Citizen report synthesized with action checklist`;
            }

            return (
              <div 
                key={stage.key}
                style={{
                  border: `1.5px solid ${borderColor}`,
                  backgroundColor: bgColor,
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    backgroundColor: iconBg,
                    color: iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {state === 'done' ? '✓' : stage.icon}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                        STAGE {idx + 1}
                      </span>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        {stage.label}
                      </h4>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                      {stage.description}
                    </div>
                    {stageDetail && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', marginTop: 4 }}>
                        ↳ {stageDetail}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  <span className="badge" style={badgeStyle}>
                    {state === 'active' && <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, borderColor: 'rgba(2,132,199,0.3)', borderTopColor: '#0284c7' }}></span>}
                    {badgeText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion Notification */}
        {currentStatus === 'complete' && (
          <div style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            textAlign: 'center',
            color: '#065f46',
            fontWeight: 600,
            fontSize: 14,
            animation: 'fadeIn 0.3s ease'
          }}>
            🎉 Pipeline Complete! Transitioning to your Citizen Impact Report...
          </div>
        )}

        {/* Failure View */}
        {currentStatus === 'failed' && (
          <div style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Pipeline Execution Failed</h4>
            </div>
            <p style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 14 }}>
              The agent pipeline encountered an error and could not complete all verification stages. Partial stage outputs have been retained in the database.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={onBack} className="btn-secondary btn-sm">
                ← Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Real-time details footer */}
      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
        Analysis ID: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>{analysisId}</code> · Poll count: {pollCount}
      </div>
    </div>
  );
}

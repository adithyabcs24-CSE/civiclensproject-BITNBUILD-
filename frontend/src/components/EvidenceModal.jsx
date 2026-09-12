import React, { useEffect, useState } from 'react';

export default function EvidenceModal({ analysisId, sectionId, excerptLocation, claimTitle, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!analysisId || !sectionId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/analyses/${analysisId}/evidence/${sectionId}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Section citation not found (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [analysisId, sectionId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content animate-fade" 
        onClick={e => e.stopPropagation()}
        style={{ padding: 0 }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16 }}>🔍</span>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--teal)', letterSpacing: 0.5 }}>
                Verified Evidence Source
              </span>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              {claimTitle ? `Citation for: "${claimTitle}"` : 'Source Document Passage'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{
              fontSize: 20,
              color: 'var(--text-muted)',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              transition: 'background 0.15s',
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ borderColor: 'rgba(15,118,110,0.3)', borderTopColor: 'var(--teal)', width: 24, height: 24, marginBottom: 12 }}></div>
              <div style={{ fontSize: 14 }}>Retrieving verified source text...</div>
            </div>
          )}

          {error && (
            <div style={{
              padding: 16,
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 14
            }}>
              <strong>Error fetching evidence citation:</strong> {error}
            </div>
          )}

          {data && (
            <div>
              {/* Evidence Anchor Metadata Box */}
              <div style={{
                backgroundColor: 'var(--teal-light)',
                border: '1px solid #99f6e4',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 20,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                fontSize: 13,
                color: '#115e59'
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Location Anchor:</span> {excerptLocation || 'Identified in section'}
                </div>
                {data.page && (
                  <div>
                    <span style={{ fontWeight: 600 }}>Document Page:</span> {data.page}
                  </div>
                )}
                <div>
                  <span style={{ fontWeight: 600 }}>Section Sequence:</span> #{data.order_index + 1}
                </div>
              </div>

              {/* Heading */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Section Heading
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                  {data.heading || '(Untitled Document Section)'}
                </div>
              </div>

              {/* Verbatim Source Text */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Original Source Passage
                </div>
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 320,
                  overflowY: 'auto'
                }}>
                  {data.text}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomLeftRadius: 'var(--radius-lg)',
          borderBottomRightRadius: 'var(--radius-lg)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Section ID: <code style={{ fontSize: 11, background: '#e2e8f0', padding: '2px 5px', borderRadius: 4 }}>{sectionId}</code>
          </div>
          <button onClick={onClose} className="btn-secondary btn-sm">
            Close Citation
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';

export default function NewAnalysisModal({ isOpen, onClose, onAnalysisCreated, documents }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'select'
  const [selectedDocId, setSelectedDocId] = useState('');
  const [locality, setLocality] = useState('Ward 150 Bellandur');
  
  // Upload fields
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState('infrastructure_plan');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let targetDocId = selectedDocId;

      // If uploading a new document first
      if (mode === 'upload') {
        if (!uploadFile) {
          throw new Error('Please select a PDF or TXT file to upload.');
        }

        const formData = new FormData();
        formData.append('file', uploadFile);
        if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
        formData.append('doc_type', uploadDocType);

        const uploadRes = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errJson = await uploadRes.json().catch(() => ({}));
          throw new Error(errJson.error || `Upload failed (HTTP ${uploadRes.status})`);
        }

        const uploadData = await uploadRes.json();
        targetDocId = uploadData.document_id;
      }

      if (!targetDocId) {
        throw new Error('Please select or upload a document.');
      }

      // Initiate Analysis
      const analysisRes = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: targetDocId,
          locality: locality.trim() || 'General Locality',
        }),
      });

      if (!analysisRes.ok) {
        const errJson = await analysisRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Analysis initiation failed (HTTP ${analysisRes.status})`);
      }

      const analysisData = await analysisRes.json();
      setLoading(false);
      onClose();
      onAnalysisCreated(analysisData.id);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSelectSeed = (filename) => {
    const doc = documents.find(d => d.original_filename === filename);
    if (doc) {
      setSelectedDocId(doc.id);
      setMode('select');
      if (filename.includes('maplewood')) {
        setLocality('Ward 4 - Greenway Corridor');
      } else if (filename.includes('karnataka')) {
        setLocality('Ward 150 Bellandur');
      } else {
        setLocality('Lakeview District');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content animate-fade"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 600, padding: 0 }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
        }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
              Start New Citizen Impact Analysis
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Run the 5-stage agent pipeline with anti-hallucination verification
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 18
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Quick Select Real Document */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              📄 Pre-Loaded Real Document
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleSelectSeed('karnataka_municipal_corporations_act.pdf')}
                className="btn-secondary btn-sm"
                style={{ fontSize: 13, backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#166534', fontWeight: 700, padding: '8px 14px' }}
              >
                🏛️ The Karnataka Municipal Corporations Act, 1976 (BBMP)
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            marginBottom: 20
          }}>
            <button
              type="button"
              onClick={() => setMode('upload')}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: mode === 'upload' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: mode === 'upload' ? '2px solid var(--primary)' : '2px solid transparent',
                textAlign: 'center'
              }}
            >
              📤 Upload Real Municipal Document (PDF / TXT)
            </button>
            <button
              type="button"
              onClick={() => setMode('select')}
              style={{
                flex: 1,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: mode === 'select' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: mode === 'select' ? '2px solid var(--primary)' : '2px solid transparent',
                textAlign: 'center'
              }}
            >
              📁 Select Ingested Document
            </button>
          </div>

          {/* Mode 1: Upload New Document */}
          {mode === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  Select PDF or Plain Text File *
                </label>
                <input
                  type="file"
                  accept=".pdf,.txt,text/plain,application/pdf"
                  onChange={e => {
                    const file = e.target.files[0];
                    setUploadFile(file);
                    if (file && !uploadTitle) {
                      setUploadTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: '#ffffff'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. The Karnataka Municipal Corporations Act or City Council Notice"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                  Document Type
                </label>
                <select
                  value={uploadDocType}
                  onChange={e => setUploadDocType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="infrastructure_plan">Infrastructure Plan / Statutory Act</option>
                  <option value="zoning_proposal">Zoning Proposal</option>
                  <option value="budget">Budget Proposal</option>
                  <option value="council_agenda">Council Agenda</option>
                  <option value="public_notice">Public Notice</option>
                  <option value="environmental_review">Environmental Review</option>
                </select>
              </div>
            </div>
          )}

          {/* Mode 2: Select Existing Document */}
          {mode === 'select' && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
                Choose Ingested Municipal Document
              </label>
              <select
                value={selectedDocId}
                onChange={e => setSelectedDocId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  backgroundColor: '#ffffff',
                  color: 'var(--text-main)'
                }}
              >
                {[...documents].sort((a, b) => {
                  if (a.title.includes('Karnataka')) return -1;
                  if (b.title.includes('Karnataka')) return 1;
                  return 0;
                }).map(doc => (
                  <option key={doc.id} value={doc.id}>
                    [{doc.doc_type}] {doc.title} ({doc.section_count} sections)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Locality Input (Target for Analysis) */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 6 }}>
              Target Locality / Ward / Neighborhood *
            </label>
            <input
              type="text"
              placeholder="e.g. Ward 4, Lakeview District, Greenway Corridor, Downtown"
              value={locality}
              onChange={e => setLocality(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                fontWeight: 500
              }}
              required
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Impact statements will be evaluated and projected specifically for this locality.
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ minWidth: 160 }}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Initiating...</span>
                </>
              ) : (
                <>
                  <span>Launch Pipeline</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import NewAnalysisModal from './components/NewAnalysisModal';
import PipelineView from './components/PipelineView';
import CitizenReport from './components/CitizenReport';
import EvidenceModal from './components/EvidenceModal';

export default function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'pipeline' | 'report'
  const [activeAnalysisId, setActiveAnalysisId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preselectedDocId, setPreselectedDocId] = useState(null);

  // Evidence Modal State
  const [evidenceModal, setEvidenceModal] = useState({
    isOpen: false,
    analysisId: null,
    documentId: null,
    sectionId: null,
    excerptLocation: '',
    claimTitle: ''
  });

  const fetchDocuments = () => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => setDocuments(data.documents || []))
      .catch(err => console.error('Failed to load documents:', err));
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleStartNewAnalysis = (docId = null) => {
    setPreselectedDocId(docId);
    setIsModalOpen(true);
  };

  const handleAnalysisCreated = (newAnalysisId) => {
    setActiveAnalysisId(newAnalysisId);
    setView('pipeline');
    fetchDocuments(); // Refresh documents in background
  };

  const handlePipelineComplete = (analysisId) => {
    setActiveAnalysisId(analysisId);
    setView('report');
  };

  const handleOpenEvidence = (analysisId, sectionId, excerptLocation, claimTitle, documentId = null) => {
    setEvidenceModal({
      isOpen: true,
      analysisId,
      documentId,
      sectionId,
      excerptLocation,
      claimTitle
    });
  };

  const handleCloseEvidence = () => {
    setEvidenceModal(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentView={view}
        onNavigate={(target) => {
          setView(target);
          if (target === 'dashboard') {
            fetchDocuments();
          }
        }}
        onNewAnalysis={() => handleStartNewAnalysis()}
      />

      <main style={{ flex: 1 }}>
        {view === 'dashboard' && (
          <Dashboard
            onStartAnalysis={(docId) => handleStartNewAnalysis(docId)}
            onOpenReport={(id) => {
              setActiveAnalysisId(id);
              setView('report');
            }}
            onOpenPipeline={(id) => {
              setActiveAnalysisId(id);
              setView('pipeline');
            }}
            onOpenEvidence={handleOpenEvidence}
          />
        )}

        {view === 'pipeline' && activeAnalysisId && (
          <PipelineView
            analysisId={activeAnalysisId}
            onComplete={handlePipelineComplete}
            onBack={() => setView('dashboard')}
          />
        )}

        {view === 'report' && activeAnalysisId && (
          <CitizenReport
            analysisId={activeAnalysisId}
            onBack={() => setView('dashboard')}
            onOpenEvidence={handleOpenEvidence}
          />
        )}
      </main>

      {/* New Analysis Modal */}
      <NewAnalysisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAnalysisCreated={handleAnalysisCreated}
        documents={documents}
        initialDocId={preselectedDocId}
      />

      {/* Evidence Inspection Modal */}
      {evidenceModal.isOpen && (
        <EvidenceModal
          analysisId={evidenceModal.analysisId}
          documentId={evidenceModal.documentId}
          sectionId={evidenceModal.sectionId}
          excerptLocation={evidenceModal.excerptLocation}
          claimTitle={evidenceModal.claimTitle}
          onClose={handleCloseEvidence}
        />
      )}
    </div>
  );
}

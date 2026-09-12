import React, { useEffect, useState } from 'react';
import CivicMap from './CivicMap';
import ActionToolkit from './ActionToolkit';
import CivicCalculators from './CivicCalculators';
import EvidenceLineageGraph from './EvidenceLineageGraph';
import PolicyQA from './PolicyQA';
import CivicTimeline from './CivicTimeline';
import NeighborhoodImpactAssessment from './NeighborhoodImpactAssessment';

const CATEGORY_COLORS = {
  housing: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '🏠' },
  traffic: { bg: '#fef3c7', border: '#fde68a', text: '#b45309', icon: '🚦' },
  cost: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', icon: '💰' },
  environment: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', icon: '🌱' },
  noise: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', icon: '🔊' },
  safety: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', icon: '🛡️' },
  other: { bg: '#f8fafc', border: '#e2e8f0', text: '#475569', icon: '📋' }
};

const TRANSLATIONS = {
  en: {
    back: '← Back to Dashboard',
    print: '🖨️ Print Citizen Bulletin',
    locality: 'Locality',
    officialReport: 'Official Citizen Impact Report',
    whatHappening: 'What Is Happening',
    whyMatters: 'Why It Matters to You',
    whoAffected: 'Who May Be Affected',
    importantDates: 'Important Dates & Public Milestones',
    localizedImpacts: 'Localized Impact Projections',
    groundedNotice: 'Grounded & verified by Evidence Agent',
    policies: 'Identified Policies & Directives',
    questions: 'Questions to Ask Your Officials',
    checklist: 'Citizen Action Checklist',
    disclaimerTitle: '⚖️ Official CivicLens AI Transparency Notice',
    disclaimerText: 'CivicLens AI provides informational summaries only and is not a substitute for reviewing official government documents or consulting your local government office.',
    tabs: {
      overview: '📊 Overview & Impacts',
      infrastructure: '🏗️ Neighborhood Assessment',
      timeline: '📅 Civic Timeline',
      qa: '🧠 Ask Questions About Policies',
      map: '🗺️ Civic Map & Hotspots',
      lineage: '🌳 Evidence Lineage Graph',
      toolkit: '⚡ Action Toolkit (RTI & Letters)',
      calculators: '🧮 Statutory Calculators'
    },
    listenAudio: '🌸 60s Voice Briefing (Sweet Voice)',
    pauseAudio: '⏸️ Pause',
    resumeAudio: '▶️ Resume',
    stopAudio: '⏹️ Stop'
  },
  kn: {
    back: '← ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ',
    print: '🖨️ ನಾಗರಿಕ ಪ್ರಕಟಣೆ ಮುದ್ರಿಸಿ',
    locality: 'ಸ್ಥಳೀಯ ವಾರ್ಡ್',
    officialReport: 'ಕರ್ನಾಟಕ ಪೌರ ನಿಗಮಗಳ ಕಾಯ್ದೆ - ಅಧಿಕೃತ ನಾಗರಿಕ ಪರಿಣಾಮ ವರದಿ',
    whatHappening: 'ಪ್ರಸ್ತುತ ಪ್ರಕ್ರಿಯೆ ಮತ್ತು ನಡಾವಳಿ',
    whyMatters: 'ನಾಗರಿಕರಿಗೆ ಇದರ ಪ್ರಾಮುಖ್ಯತೆ',
    whoAffected: 'ಯಾರ ಮೇಲೆ ಪರಿಣಾಮ ಬೀರಲಿದೆ',
    importantDates: 'ಮುಖ್ಯ ದಿನಾಂಕಗಳು ಮತ್ತು ಸಾರ್ವಜನಿಕ ಹಂತಗಳು',
    localizedImpacts: 'ಸ್ಥಳೀಯ ನಾಗರಿಕ ಪರಿಣಾಮಗಳು',
    groundedNotice: 'ಪುರಾವೆ ಏಜೆಂಟ್‌ನಿಂದ ದೃಢೀಕರಿಸಲ್ಪಟ್ಟಿದೆ',
    policies: 'ಕಾನೂನು ನಿಯಮಾವಳಿಗಳು ಮತ್ತು ನಿರ್ದೇಶನಗಳು',
    questions: 'ಅಧಿಕಾರಿಗಳಿಗೆ ಕೇಳಬೇಕಾದ ಪ್ರಶ್ನೆಗಳು',
    checklist: 'ನಾಗರಿಕರ ಕಾರ್ಯಸೂಚಿ ಪಟ್ಟಿ',
    disclaimerTitle: '⚖️ ಅಧಿಕೃತ ಸಿವಿಕ್ಲೆನ್ಸ್ AI ಪಾರದರ್ಶಕತೆ ಸೂಚನೆ',
    disclaimerText: 'ಸಿವಿಕ್ಲೆನ್ಸ್ AI ಮಾಹಿತಿ ಉದ್ದೇಶಗಳಿಗಾಗಿ ಮಾತ್ರ ಸಾರಾಂಶಗಳನ್ನು ಒದಗಿಸುತ್ತದೆ ಮತ್ತು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ದಾಖಲೆಗಳು ಅಥವಾ ಕಚೇರಿಗಳನ್ನು ಸಂಪರ್ಕಿಸುವುದಕ್ಕೆ ಬದಲಿಯಾಗಿರುವುದಿಲ್ಲ.',
    tabs: {
      overview: '📊 ವರದಿ ಮತ್ತು ಪರಿಣಾಮಗಳು',
      infrastructure: '🏗️ ಮೂಲಸೌಕರ್ಯ ಮೌಲ್ಯಮಾಪನ',
      timeline: '📅 ಕಾಲಾನುಕ್ರಮ ವೇಳಾಪಟ್ಟಿ',
      qa: '🧠 ನೀತಿಗಳ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳು',
      map: '🗺️ ನಕ್ಷೆ ಮತ್ತು ವಲಯಗಳು',
      lineage: '🌳 ಪುರಾವೆ ವಂಶಾವಳಿ ನಕ್ಷೆ',
      toolkit: '⚡ ನಾಗರಿಕ ಅರ್ಜಿ ಮತ್ತು ಆರ್‌ಟಿಐ',
      calculators: '🧮 ಕಾಯ್ದೆ ಲೆಕ್ಕಾಚಾರಗಳು'
    },
    listenAudio: '🌸 60 ಸೆಕೆಂಡ್ ಧ್ವನಿ ವಿವರಣೆ (ಇಂಪಾದ ಧ್ವನಿ)',
    pauseAudio: '⏸️ ವಿರಾಮ',
    resumeAudio: '▶️ ಮುಂದುವರಿಸಿ',
    stopAudio: '⏹️ ನಿಲ್ಲಿಸಿ'
  }
};

export default function CitizenReport({ analysisId, onBack, onOpenEvidence }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedActions, setCheckedActions] = useState({});
  const [activeTab, setActiveTab] = useState('overview'); // overview | qa | map | toolkit | calculators
  const [lang, setLang] = useState('en'); // en | kn
  const [followedItems, setFollowedItems] = useState(new Set());
  
  // Audio Speech Synthesis state
  const [audioState, setAudioState] = useState('stopped'); // stopped | playing | paused
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState('');
  const [pitchLevel, setPitchLevel] = useState(1.22); // sweet female pitch boost

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    fetch('/api/alerts/subscriptions')
      .then(r => r.json())
      .then(d => {
        if (d.subscriptions) {
          setFollowedItems(new Set(d.subscriptions.map(s => s.target_value)));
        }
      })
      .catch(() => {});
  }, []);

  const handleQuickFollow = async (type, val) => {
    if (!val) return;
    try {
      const res = await fetch('/api/alerts/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: type, target_value: val })
      });
      if (res.ok) {
        setFollowedItems(prev => new Set([...prev, val]));
      }
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  useEffect(() => {
    if (!analysisId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/analyses/${analysisId}/report`)
      .then(res => {
        if (res.status === 202) {
          throw new Error('Analysis is still running. Please view progress in the Pipeline View.');
        }
        if (!res.ok) {
          throw new Error(`Failed to load report (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then(data => {
        const reportData = data.report || data;
        setReport(reportData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [analysisId]);

  // Load and configure sweet female voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const populateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      setAvailableVoices(voices);

      // Preferred sweet female voices
      const sweetNames = ['Samantha', 'Tara', 'Karen', 'Victoria', 'Flo', 'Shelley', 'Google UK English Female', 'Microsoft Jenny', 'Microsoft Zira', 'Ava'];
      let bestVoice = null;

      for (const name of sweetNames) {
        const found = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase()));
        if (found) {
          bestVoice = found;
          break;
        }
      }

      if (!bestVoice) {
        bestVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
                    voices.find(v => v.lang.startsWith('en')) ||
                    voices[0];
      }

      if (bestVoice) {
        setSelectedVoiceName(bestVoice.name);
      }
    };

    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleAction = (idx) => {
    setCheckedActions(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handlePlayAudio = () => {
    if (!window.speechSynthesis || !report) return;

    if (audioState === 'paused') {
      window.speechSynthesis.resume();
      setAudioState('playing');
      return;
    }

    window.speechSynthesis.cancel();

    // Friendly, sweet, accessible speech text
    const textToSpeak = `Hello! Here is your quick civic briefing for ${report.location}. Regarding: ${report.project_title}. What is happening: ${report.what_is_happening}. Why it matters: ${report.why_it_matters}. Who may be affected: ${report.who_may_be_affected}. Please review your suggested citizen actions below. Have a wonderful day!`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Apply sweet female voice selection
    const voiceObj = availableVoices.find(v => v.name === selectedVoiceName);
    if (voiceObj) {
      utterance.voice = voiceObj;
    }

    // Set sweet girl acoustics: elevated pitch for warmth & cheer, relaxed cadence
    utterance.pitch = pitchLevel; // ~1.22 gives that sweet, clear girl tone
    utterance.rate = 0.98;

    utterance.onend = () => setAudioState('stopped');
    utterance.onerror = () => setAudioState('stopped');

    window.speechSynthesis.speak(utterance);
    setAudioState('playing');
  };

  const handlePauseAudio = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
      setAudioState('paused');
    }
  };

  const handleStopAudio = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setAudioState('stopped');
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 860, margin: '40px auto', padding: '60px 20px', textAlign: 'center' }}>
        <div className="spinner" style={{ borderColor: 'rgba(30,58,138,0.2)', borderTopColor: 'var(--primary)', width: 32, height: 32, marginBottom: 16 }}></div>
        <h3 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 8 }}>Loading Citizen Impact Report...</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Retrieving verified policies, impact statements, and citations.</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ maxWidth: 860, margin: '40px auto', padding: '0 20px' }}>
        <div className="card" style={{ borderLeft: '4px solid #ef4444', padding: 32 }}>
          <h3 style={{ color: '#991b1b', marginBottom: 12 }}>Unable to Load Citizen Report</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>{error || 'No report data returned.'}</p>
          <button onClick={onBack} className="btn-secondary">
            ← Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const whyItMattersLower = (report.why_it_matters || '').toLowerCase();
  const isLowInfo = whyItMattersLower.includes('insufficient') ||
                    whyItMattersLower.includes('not contain enough detail') ||
                    whyItMattersLower.includes('limited detail') ||
                    whyItMattersLower.includes('preliminary');

  // Group impacts by category
  const impactsByCategory = {};
  if (Array.isArray(report.impacts)) {
    report.impacts.forEach(imp => {
      const cat = (imp.category || 'other').toLowerCase();
      if (!impactsByCategory[cat]) {
        impactsByCategory[cat] = [];
      }
      impactsByCategory[cat].push(imp);
    });
  }

  // Filter top female voices for the picker
  const sweetVoiceOptions = availableVoices.filter(v =>
    v.lang.startsWith('en') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('tara') || v.name.toLowerCase().includes('karen')
  );

  return (
    <div className="animate-fade" style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px 80px' }}>
      {/* Top Bar Navigation & Utility Controls */}
      <div className="no-print" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <button onClick={onBack} className="btn-secondary btn-sm">
          {t.back}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Bilingual Language Switcher */}
          <div style={{
            display: 'inline-flex',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            backgroundColor: '#ffffff'
          }}>
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: lang === 'en' ? 'var(--primary)' : 'transparent',
                color: lang === 'en' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              🇬🇧 English
            </button>
            <button
              type="button"
              onClick={() => setLang('kn')}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: lang === 'kn' ? 'var(--primary)' : 'transparent',
                color: lang === 'kn' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              🇮🇳 ಕನ್ನಡ
            </button>
          </div>

          {/* Sweet Girl Voice Selector */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            backgroundColor: '#fdf2f8',
            border: '1px solid #fbcfe8',
            borderRadius: 'var(--radius-sm)'
          }}>
            <span style={{ fontSize: 13 }}>🌸</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9d174d' }}>Voice:</span>
            <select
              value={selectedVoiceName}
              onChange={(e) => setSelectedVoiceName(e.target.value)}
              style={{
                fontSize: 11,
                border: '1px solid #f472b6',
                borderRadius: 4,
                padding: '2px 4px',
                backgroundColor: '#ffffff',
                color: '#831843',
                cursor: 'pointer'
              }}
            >
              {sweetVoiceOptions.length > 0 ? (
                sweetVoiceOptions.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name.replace(/English|United States|India/g, '').trim()}
                  </option>
                ))
              ) : (
                <option value="">Default Sweet Voice</option>
              )}
            </select>
          </div>

          {/* Web Speech Audio Briefing Controls */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {audioState === 'stopped' && (
              <button
                type="button"
                onClick={handlePlayAudio}
                className="btn-secondary btn-sm"
                style={{ backgroundColor: '#fdf2f8', borderColor: '#fbcfe8', color: '#9d174d', fontWeight: 600 }}
                title="Listen to sweet girl plain-language voice summary"
              >
                {t.listenAudio}
              </button>
            )}
            {audioState === 'playing' && (
              <>
                <button
                  type="button"
                  onClick={handlePauseAudio}
                  className="btn-secondary btn-sm"
                  style={{ backgroundColor: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}
                >
                  {t.pauseAudio}
                </button>
                <button
                  type="button"
                  onClick={handleStopAudio}
                  className="btn-secondary btn-sm"
                >
                  {t.stopAudio}
                </button>
              </>
            )}
            {audioState === 'paused' && (
              <>
                <button
                  type="button"
                  onClick={handlePlayAudio}
                  className="btn-secondary btn-sm"
                  style={{ backgroundColor: '#dcfce7', borderColor: '#bbf7d0', color: '#15803d' }}
                >
                  {t.resumeAudio}
                </button>
                <button
                  type="button"
                  onClick={handleStopAudio}
                  className="btn-secondary btn-sm"
                >
                  {t.stopAudio}
                </button>
              </>
            )}
          </div>

          {/* Print Bulletin */}
          <button 
            type="button"
            onClick={() => window.print()}
            className="btn-secondary btn-sm"
          >
            {t.print}
          </button>
        </div>
      </div>

      {/* Audio Wave Indicator Banner when Speaking */}
      {audioState === 'playing' && (
        <div style={{
          backgroundColor: '#fdf2f8',
          border: '1px solid #fbcfe8',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🌸</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#9d174d' }}>
                Sweet Voice Briefing Active ({selectedVoiceName || 'Samantha'} • 1.2x Sweet Pitch)
              </div>
              <div style={{ fontSize: 11, color: '#be185d' }}>
                Speaking synthesized citizen explanation of "{report.project_title}"
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStopAudio}
            style={{ fontSize: 11, color: '#be185d', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Stop Audio
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="card" style={{
        padding: '32px 36px',
        marginBottom: 20,
        borderTop: '5px solid var(--primary)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderColor: '#bae6fd' }}>
            📍 {t.locality}: {report.location}
          </span>
          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}>
            {t.officialReport}
          </span>

          {/* 1-Click Follow Actions */}
          <button
            type="button"
            onClick={() => handleQuickFollow('neighborhood', report.location)}
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: followedItems.has(report.location) ? '#dcfce7' : '#eff6ff',
              color: followedItems.has(report.location) ? '#166534' : '#1e40af',
              border: `1px solid ${followedItems.has(report.location) ? '#bbf7d0' : '#bfdbfe'}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
            title={`Follow updates for ${report.location}`}
          >
            <span>🔔</span>
            <span>{followedItems.has(report.location) ? '✓ Following Locality' : `+ Follow ${report.location}`}</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFollow('project', report.project_title)}
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: followedItems.has(report.project_title) ? '#dcfce7' : '#eff6ff',
              color: followedItems.has(report.project_title) ? '#166534' : '#1e40af',
              border: `1px solid ${followedItems.has(report.project_title) ? '#bbf7d0' : '#bfdbfe'}`,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.15s ease'
            }}
            title="Follow updates for this project"
          >
            <span>🔔</span>
            <span>{followedItems.has(report.project_title) ? '✓ Following Project' : '+ Follow Project'}</span>
          </button>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--primary)', lineHeight: 1.3, marginBottom: 14 }}>
          {report.project_title}
        </h1>

        <div style={{
          fontSize: 15,
          lineHeight: 1.7,
          color: 'var(--text-main)',
          backgroundColor: 'var(--surface-alt)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          borderLeft: '4px solid var(--accent)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>
            {t.whatHappening}
          </div>
          {report.what_is_happening}
        </div>
      </div>

      {/* Feature Navigation Bar (Tabs) */}
      <div className="no-print civic-tab-bar" style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        padding: '6px',
        backgroundColor: 'var(--surface-alt)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        overflowX: 'auto'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`civic-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
        >
          {t.tabs.overview}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('infrastructure')}
          className={`civic-tab-btn ${activeTab === 'infrastructure' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'infrastructure' ? 'var(--primary)' : undefined,
            fontWeight: 700
          }}
        >
          {t.tabs.infrastructure}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`civic-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'timeline' ? 'var(--primary)' : undefined,
            fontWeight: 700
          }}
        >
          {t.tabs.timeline}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('qa')}
          className={`civic-tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
          style={{
            borderColor: activeTab === 'qa' ? 'var(--primary)' : undefined,
            fontWeight: 700
          }}
        >
          {t.tabs.qa}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`civic-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
        >
          {t.tabs.map}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('lineage')}
          className={`civic-tab-btn ${activeTab === 'lineage' ? 'active' : ''}`}
        >
          {t.tabs.lineage}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('toolkit')}
          className={`civic-tab-btn ${activeTab === 'toolkit' ? 'active' : ''}`}
        >
          {t.tabs.toolkit}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calculators')}
          className={`civic-tab-btn ${activeTab === 'calculators' ? 'active' : ''}`}
        >
          {t.tabs.calculators}
        </button>
      </div>

      {/* VIEW: NEIGHBORHOOD IMPACT ASSESSMENT (DEDICATED TAB) */}
      {activeTab === 'infrastructure' && (
        <div className="animate-fade">
          <NeighborhoodImpactAssessment
            analysisId={analysisId}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      )}

      {/* VIEW: CIVIC TIMELINE (DEDICATED TAB) */}
      {activeTab === 'timeline' && (
        <div className="animate-fade">
          <CivicTimeline
            analysisId={analysisId}
            documentTitle={report.project_title}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      )}

      {/* VIEW: ASK QUESTIONS ABOUT POLICIES (DEDICATED TAB) */}
      {activeTab === 'qa' && (
        <div className="animate-fade">
          <PolicyQA
            documentId={report.document_id}
            analysisId={analysisId}
            documentTitle={report.project_title}
            onOpenEvidence={onOpenEvidence}
            embedded={false}
          />
        </div>
      )}

      {/* VIEW: CIVIC MAP */}
      {activeTab === 'map' && (
        <div className="animate-fade">
          <CivicMap
            analysisId={analysisId}
            locality={report.location}
            policies={report.policies}
            impacts={report.impacts}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      )}

      {/* VIEW: EVIDENCE LINEAGE GRAPH */}
      {activeTab === 'lineage' && (
        <div className="animate-fade">
          <EvidenceLineageGraph
            report={report}
            analysisId={analysisId}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      )}

      {/* VIEW: ACTION TOOLKIT */}
      {activeTab === 'toolkit' && (
        <div className="animate-fade">
          <ActionToolkit
            analysisId={analysisId}
            report={report}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      )}

      {/* VIEW: STATUTORY CALCULATORS */}
      {activeTab === 'calculators' && (
        <div className="animate-fade">
          <CivicCalculators
            analysisId={analysisId}
            report={report}
            onOpenEvidence={onOpenEvidence}
          />
        </div>
      )}

      {/* VIEW: OVERVIEW & IMPACTS (DEFAULT) */}
      {(activeTab === 'overview' || typeof window !== 'undefined') && (
        <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
          {/* Low-Information Banner */}
          {isLowInfo && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderLeft: '5px solid #d97706',
              borderRadius: 'var(--radius-md)',
              padding: '18px 22px',
              marginBottom: 24,
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>⚠️</span>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                  Notice of Limited Document Detail
                </h4>
                <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.5 }}>
                  {report.why_it_matters}
                </div>
                <div style={{ fontSize: 12, color: '#92400e', marginTop: 6, fontStyle: 'italic' }}>
                  CivicLens AI flagged this document as preliminary. Speculative long-term impacts were intentionally omitted to avoid false confidence.
                </div>
              </div>
            </div>
          )}

          {/* Interactive Policy Q&A Embedded inside Document Report */}
          <PolicyQA
            documentId={report.document_id}
            analysisId={analysisId}
            documentTitle={report.project_title}
            onOpenEvidence={onOpenEvidence}
            embedded={true}
          />

          {/* Two Column Context Grid: Why It Matters & Who May Be Affected */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                  {t.whyMatters}
                </h3>
              </div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                {report.why_it_matters}
              </p>
            </div>

            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>👥</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                  {t.whoAffected}
                </h3>
              </div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                {report.who_may_be_affected}
              </p>
            </div>
          </div>

          {/* Important Dates Timeline */}
          {Array.isArray(report.important_dates) && report.important_dates.length > 0 && (
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🗓️</span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                    {t.importantDates}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    padding: '5px 12px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>📅 Open Civic Timeline & Plain Text (↓)</span>
                  <span>→</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {report.important_dates.map((dateObj, idx) => (
                  <div 
                    key={idx}
                    style={{
                      backgroundColor: 'var(--surface-alt)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      borderLeft: '3px solid var(--accent)'
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 2 }}>
                      {dateObj.date && dateObj.date !== 'null' && dateObj.date !== 'TBD' ? dateObj.date : 'Date Pending'}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                      {dateObj.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Neighborhood Impact Assessment (Agent 4 Civil Infrastructure Synthesis) */}
          <NeighborhoodImpactAssessment
            analysisId={analysisId}
            onOpenEvidence={onOpenEvidence}
          />

          {/* Localized Impacts Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                  {t.localizedImpacts} ({report.location})
                </h2>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t.groundedNotice}
              </span>
            </div>

            {Object.keys(impactsByCategory).length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                No localized impacts met the anti-hallucination evidence threshold.
              </div>
            ) : (
              Object.entries(impactsByCategory).map(([category, items]) => {
                const catMeta = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
                return (
                  <div key={category} style={{ marginBottom: 18 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      color: catMeta.text
                    }}>
                      <span>{catMeta.icon}</span>
                      <span>{category} Impacts</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'none' }}>
                        ({items.length})
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {items.map((imp) => {
                        const conf = (imp.confidence || 'medium').toLowerCase();
                        const badgeClass = conf === 'high' ? 'badge-high' : (conf === 'low' ? 'badge-low' : 'badge-medium');

                        return (
                          <div 
                            key={imp.id} 
                            className="card"
                            style={{
                              padding: '16px 18px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              backgroundColor: '#ffffff'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                              <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6, flex: 1, margin: 0 }}>
                                {imp.statement}
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <span className={`badge ${badgeClass}`} title={`Confidence: ${conf}`}>
                                  ● {conf} Confidence
                                </span>
                                {imp.inferred && (
                                  <span className="badge badge-inferred" title="Reasonable contextual inference downgraded to low confidence">
                                    ℹ️ Inferred
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Evidence Citation Link */}
                            {imp.evidence && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingTop: 8,
                                borderTop: '1px dashed var(--border)',
                                fontSize: 12
                              }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                  Anchor: {imp.evidence.excerpt_location || 'Source document'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onOpenEvidence(analysisId, imp.evidence.section_id, imp.evidence.excerpt_location, imp.statement)}
                                  style={{
                                    color: 'var(--teal)',
                                    fontWeight: 600,
                                    fontSize: 12,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  <span>📄 View source evidence</span>
                                  <span>→</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Proposed Policies Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>📜</span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                {t.policies}
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {Array.isArray(report.policies) && report.policies.map((pol) => {
                const conf = (pol.confidence || 'medium').toLowerCase();
                const badgeClass = conf === 'high' ? 'badge-high' : (conf === 'low' ? 'badge-low' : 'badge-medium');

                return (
                  <div 
                    key={pol.id} 
                    className="card"
                    style={{
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                          {pol.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleQuickFollow('policy', pol.name)}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 4,
                              border: `1px solid ${followedItems.has(pol.name) ? '#bbf7d0' : '#bfdbfe'}`,
                              backgroundColor: followedItems.has(pol.name) ? '#dcfce7' : '#eff6ff',
                              color: followedItems.has(pol.name) ? '#166534' : '#1e40af',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                            title={`Follow updates for ${pol.name}`}
                          >
                            🔔 {followedItems.has(pol.name) ? 'Following' : 'Follow'}
                          </button>
                          <span className={`badge ${badgeClass}`}>
                            {conf}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 12 }}>
                        {pol.description}
                      </p>
                    </div>

                    {pol.evidence && (
                      <div style={{
                        paddingTop: 8,
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12
                      }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {pol.evidence.excerpt_location ? pol.evidence.excerpt_location.substring(0, 24) + '…' : 'Cited section'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenEvidence(analysisId, pol.evidence.section_id, pol.evidence.excerpt_location, pol.name)}
                          style={{
                            color: 'var(--teal)',
                            fontWeight: 600,
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <span>View evidence</span>
                          <span>→</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suggested Questions & Citizen Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 32 }}>
            {/* Questions for Officials */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>❓</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  {t.questions}
                </h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.isArray(report.suggested_questions) && report.suggested_questions.map((q, idx) => (
                  <li 
                    key={idx}
                    style={{
                      fontSize: 13,
                      color: 'var(--text-main)',
                      lineHeight: 1.5,
                      padding: '10px 12px',
                      backgroundColor: 'var(--surface-alt)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--accent)'
                    }}
                  >
                    "{q}"
                  </li>
                ))}
              </ul>
            </div>

            {/* Citizen Action Checklist */}
            <div className="card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  {t.checklist}
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.isArray(report.citizen_actions) && report.citizen_actions.map((act, idx) => {
                  const isChecked = Boolean(checkedActions[idx]);
                  return (
                    <label 
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        fontSize: 13,
                        color: isChecked ? 'var(--text-muted)' : 'var(--text-main)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                        cursor: 'pointer',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isChecked ? 'var(--surface-alt)' : 'var(--surface)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAction(idx)}
                        style={{ marginTop: 2, cursor: 'pointer', accentColor: 'var(--teal)' }}
                      />
                      <span>{act}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Transparency Notice Footer */}
      <footer style={{
        marginTop: 36,
        padding: '20px 24px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--surface-alt)',
        border: '1px solid var(--border)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 12,
        lineHeight: 1.6
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
          {t.disclaimerTitle}
        </div>
        {t.disclaimerText}
      </footer>
    </div>
  );
}

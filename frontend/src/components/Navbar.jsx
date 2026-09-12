import React from 'react';

export default function Navbar({ currentView, onNavigate, onNewAnalysis }) {
  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo & Brand */}
        <div 
          onClick={() => onNavigate('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)'
          }}>
            🏛️
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', letterSpacing: -0.3 }}>
              CivicLens <span style={{ color: 'var(--accent)', fontWeight: 600 }}>AI</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Evidence-Linked Citizen Intelligence
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => onNavigate('dashboard')}
            style={{
              fontSize: 14,
              fontWeight: currentView === 'dashboard' ? 600 : 500,
              color: currentView === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: currentView === 'dashboard' ? 'var(--surface-alt)' : 'transparent',
              transition: 'all 0.15s ease'
            }}
          >
            Dashboard
          </button>

          <button
            onClick={onNewAnalysis}
            className="btn-primary"
            style={{ padding: '8px 16px' }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            <span>New Analysis</span>
          </button>
        </div>
      </div>
    </header>
  );
}

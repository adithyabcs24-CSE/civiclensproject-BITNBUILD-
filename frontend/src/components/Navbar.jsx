import React from 'react';
import ThemeSelector from './ThemeSelector';

export default function Navbar({ currentView, onNavigate, onNewAnalysis, unreadAlertsCount = 0, onOpenAlerts }) {
  return (
    <header style={{
      backgroundColor: 'var(--surface)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => onNavigate('dashboard')}
            style={{
              fontSize: 14,
              fontWeight: currentView === 'dashboard' ? 600 : 500,
              color: currentView === 'dashboard' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: currentView === 'dashboard' ? 'var(--surface-alt)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Dashboard
          </button>

          {/* Policy Alerts Notification Bell */}
          <button
            onClick={onOpenAlerts}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: unreadAlertsCount > 0 ? '#1e40af' : '#475569',
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: unreadAlertsCount > 0 ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${unreadAlertsCount > 0 ? '#bfdbfe' : '#e2e8f0'}`,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="View policy alerts for followed neighborhoods, projects, policies, & departments"
          >
            <span style={{ fontSize: 15 }}>🔔</span>
            <span>Alerts</span>
            {unreadAlertsCount > 0 && (
              <span style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: 9999,
                lineHeight: 1.2
              }}>
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Appearance Theme Selector */}
          <ThemeSelector />

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

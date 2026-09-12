import React, { useState, useEffect } from 'react';

const SUGGESTED_FOLLOWS = {
  neighborhood: ['Ward 150 Bellandur', 'Greenway Corridor', 'Koramangala 4th Block', 'Indiranagar', 'Whitefield Zone', 'Lakeview District'],
  project: ['Greenway Transit-Oriented Mixed-Use Overlay', 'BBMP UAV Property Tax & Rainwater Mandate', 'Bellandur Lake Stormwater & Wetland Reclamation', 'Outer Ring Road Bus Priority Lane'],
  policy: ['Mandatory Rainwater Harvesting (Sec 295A)', 'Unit Area Value Property Tax (Sec 108A)', 'Solid Waste Segregation Bye-laws (Sec 431-A)', 'Section 321 Demolition & Regularization Orders', '15% Inclusionary Affordable Housing Mandate'],
  department: ['Bruhat Bengaluru Mahanagara Palike (BBMP)', 'Department of Urban Planning and Zoning Services', 'Department of Public Works', 'Bangalore Water Supply and Sewerage Board (BWSSB)']
};

export default function PolicyAlertsModal({ isOpen, onClose, onAlertsUpdated }) {
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'manage'
  const [alerts, setAlerts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [isSpeakingId, setIsSpeakingId] = useState(null);

  // New follow form
  const [newType, setNewType] = useState('neighborhood');
  const [newVal, setNewVal] = useState('');
  const [followSuccessMsg, setFollowSuccessMsg] = useState('');

  const loadAlertsAndSubs = async () => {
    setLoading(true);
    try {
      const [altsRes, subsRes] = await Promise.all([
        fetch('/api/alerts').then(r => r.json()),
        fetch('/api/alerts/subscriptions').then(r => r.json())
      ]);

      setAlerts(altsRes.alerts || []);
      setUnreadCount(altsRes.unread_count || 0);
      setSubscriptions(subsRes.subscriptions || []);
      if (onAlertsUpdated) onAlertsUpdated(altsRes.unread_count || 0);
    } catch (err) {
      console.error('Failed to load alerts & subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAlertsAndSubs();
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkRead = async (id) => {
    try {
      const res = await fetch(`/api/alerts/${id}/read`, { method: 'POST' });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: 1 } : a));
        setUnreadCount(prev => Math.max(0, prev - 1));
        if (onAlertsUpdated) onAlertsUpdated(Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/alerts/mark-all-read', { method: 'POST' });
      if (res.ok) {
        setAlerts(prev => prev.map(a => ({ ...a, read: 1 })));
        setUnreadCount(0);
        if (onAlertsUpdated) onAlertsUpdated(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleFollow = async (type, val) => {
    const targetVal = val || newVal;
    if (!targetVal || !targetVal.trim()) return;

    try {
      const res = await fetch('/api/alerts/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: type || newType,
          target_value: targetVal.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setNewVal('');
        setFollowSuccessMsg(`Following ${type || newType}: "${targetVal.trim()}"`);
        setTimeout(() => setFollowSuccessMsg(''), 3000);
        loadAlertsAndSubs();
      }
    } catch (err) {
      console.error('Failed to subscribe:', err);
    }
  };

  const handleUnfollow = async (id) => {
    try {
      const res = await fetch(`/api/alerts/subscriptions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubscriptions(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to unfollow:', err);
    }
  };

  const handleSimulateAlert = async () => {
    try {
      const res = await fetch('/api/alerts/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) {
        const data = await res.json();
        setAlerts(prev => [data.alert, ...prev]);
        setUnreadCount(data.unread_count);
        if (onAlertsUpdated) onAlertsUpdated(data.unread_count);
        setActiveTab('feed');
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    }
  };

  const handleSpeakAlert = (alert) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeakingId === alert.id) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const text = `Policy alert for ${alert.target_value}. ${alert.title}. ${alert.summary}. Statutory evidence: ${alert.evidence_quote}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.22;
    utterance.rate = 0.98;

    const voices = window.speechSynthesis.getVoices();
    const sweetVoice = voices.find(v =>
      /samantha|tara|karen|victoria|moira|female/i.test(v.name)
    ) || voices[0];

    if (sweetVoice) utterance.voice = sweetVoice;

    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);

    setIsSpeakingId(alert.id);
    window.speechSynthesis.speak(utterance);
  };

  const filteredAlerts = alerts.filter(a => {
    if (filterType === 'all') return true;
    return a.target_type === filterType;
  });

  const getSeverityStyle = (sev) => {
    if (sev === 'urgent') return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', icon: '🚨' };
    if (sev === 'high') return { bg: '#fffbeb', border: '#fde68a', text: '#d97706', icon: '⚠️' };
    return { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', icon: 'ℹ️' };
  };

  const getTypeIcon = (type) => {
    if (type === 'neighborhood') return '🏘️';
    if (type === 'project') return '📁';
    if (type === 'policy') return '📜';
    if (type === 'department') return '🏛️';
    return '🔔';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content animate-fade" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 860, width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#eff6ff',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              border: '1px solid #bfdbfe'
            }}>
              🔔
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                  Policy Alerts Center
                </h3>
                {unreadCount > 0 && (
                  <span style={{
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 9999
                  }}>
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Follow neighborhoods, projects, policies, &amp; departments for real-time statutory updates
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              fontSize: 20,
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher & Quick Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 28px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: '#ffffff',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setActiveTab('feed')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                backgroundColor: activeTab === 'feed' ? 'var(--primary)' : '#f1f5f9',
                color: activeTab === 'feed' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🔔 Alerts Feed</span>
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: activeTab === 'feed' ? '#ffffff' : '#ef4444',
                  color: activeTab === 'feed' ? 'var(--primary)' : '#ffffff',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: 9999
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('manage')}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                backgroundColor: activeTab === 'manage' ? 'var(--primary)' : '#f1f5f9',
                color: activeTab === 'manage' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>⚙️ Manage Subscriptions</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>({subscriptions.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'feed' && unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'none',
                  border: '1px solid var(--border)',
                  padding: '5px 10px',
                  borderRadius: 6,
                  cursor: 'pointer'
                }}
              >
                ✓ Mark all as read
              </button>
            )}

            <button
              onClick={handleSimulateAlert}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#1e40af',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '5px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              title="Test real-time alert trigger"
            >
              <span>⚡ Simulate Policy Change</span>
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {/* TAB 1: ALERTS FEED */}
          {activeTab === 'feed' && (
            <div>
              {/* Category Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4 }}>
                  Filter:
                </span>
                {[
                  { id: 'all', label: 'All Alerts' },
                  { id: 'neighborhood', label: '🏘️ Neighborhoods' },
                  { id: 'project', label: '📁 Projects' },
                  { id: 'policy', label: '📜 Policies' },
                  { id: 'department', label: '🏛️ Departments' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 9999,
                      border: '1px solid',
                      borderColor: filterType === f.id ? 'var(--primary)' : '#cbd5e1',
                      backgroundColor: filterType === f.id ? '#eff6ff' : '#ffffff',
                      color: filterType === f.id ? 'var(--primary)' : '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                    No alerts in this category
                  </h4>
                  <p style={{ fontSize: 13 }}>Follow more topics or click "Simulate Policy Change" above!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {filteredAlerts.map(alert => {
                    const sev = getSeverityStyle(alert.severity);
                    const isUnread = alert.read === 0;

                    return (
                      <div
                        key={alert.id}
                        style={{
                          backgroundColor: isUnread ? '#ffffff' : '#f8fafc',
                          border: `1px solid ${isUnread ? '#bfdbfe' : '#e2e8f0'}`,
                          borderLeft: `5px solid ${sev.text}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '16px 20px',
                          boxShadow: isUnread ? '0 2px 8px rgba(30, 58, 138, 0.06)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: 4,
                              backgroundColor: sev.bg,
                              color: sev.text,
                              border: `1px solid ${sev.border}`
                            }}>
                              {sev.icon} {alert.severity}
                            </span>

                            <span style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#475569',
                              backgroundColor: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: 4
                            }}>
                              {getTypeIcon(alert.target_type)} {alert.target_type.toUpperCase()}: {alert.target_value}
                            </span>

                            {isUnread && (
                              <span style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: '#3b82f6',
                                display: 'inline-block'
                              }}></span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => handleSpeakAlert(alert)}
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: isSpeakingId === alert.id ? '#ffffff' : '#be123c',
                                backgroundColor: isSpeakingId === alert.id ? '#f43f5e' : '#fff1f2',
                                border: '1px solid #fecdd3',
                                padding: '3px 8px',
                                borderRadius: 9999,
                                cursor: 'pointer'
                              }}
                            >
                              {isSpeakingId === alert.id ? '⏹️ Stop' : '🌸 Voice'}
                            </button>

                            {isUnread && (
                              <button
                                onClick={() => handleMarkRead(alert.id)}
                                style={{
                                  fontSize: 11,
                                  color: 'var(--text-muted)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px 6px'
                                }}
                                title="Mark as read"
                              >
                                ✓ Done
                              </button>
                            )}
                          </div>
                        </div>

                        <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', lineHeight: 1.35 }}>
                          {alert.title}
                        </h4>

                        <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5, margin: '0 0 10px' }}>
                          {alert.summary}
                        </p>

                        {alert.evidence_quote && (
                          <div style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderLeft: '3px solid var(--teal)',
                            padding: '8px 12px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontStyle: 'italic',
                            color: '#475569',
                            marginBottom: 8
                          }}>
                            “{alert.evidence_quote}”
                          </div>
                        )}

                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          🗓️ Issued: {new Date(alert.created_at).toLocaleDateString()} at {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANAGE SUBSCRIPTIONS */}
          {activeTab === 'manage' && (
            <div>
              {/* Add New Subscription Form */}
              <div className="card" style={{ padding: 18, marginBottom: 24, backgroundColor: '#f8fafc', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 10 }}>
                  ➕ Follow a Neighborhood, Project, Policy, or Department:
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: '#ffffff',
                      outline: 'none'
                    }}
                  >
                    <option value="neighborhood">🏘️ Neighborhood / Ward</option>
                    <option value="project">📁 Project / Proposal</option>
                    <option value="policy">📜 Policy / Mandate</option>
                    <option value="department">🏛️ Department / Board</option>
                  </select>

                  <input
                    type="text"
                    value={newVal}
                    onChange={e => setNewVal(e.target.value)}
                    placeholder={`Enter ${newType} name...`}
                    style={{
                      flex: 1,
                      minWidth: 200,
                      padding: '8px 12px',
                      fontSize: 13,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      backgroundColor: '#ffffff',
                      outline: 'none'
                    }}
                  />

                  <button
                    onClick={() => handleFollow(newType, newVal)}
                    disabled={!newVal.trim()}
                    className="btn-primary btn-sm"
                    style={{ opacity: !newVal.trim() ? 0.6 : 1, cursor: !newVal.trim() ? 'not-allowed' : 'pointer' }}
                  >
                    + Follow
                  </button>
                </div>

                {followSuccessMsg && (
                  <div style={{ fontSize: 12, color: '#166534', marginTop: 8, fontWeight: 600 }}>
                    ✓ {followSuccessMsg}
                  </div>
                )}
              </div>

              {/* Categorized Active Subscriptions & Quick Suggestions */}
              {['neighborhood', 'project', 'policy', 'department'].map(category => {
                const activeSubs = subscriptions.filter(s => s.target_type === category);
                const suggestions = (SUGGESTED_FOLLOWS[category] || []).filter(
                  item => !activeSubs.some(s => s.target_value.toLowerCase() === item.toLowerCase())
                );

                const titles = {
                  neighborhood: '🏘️ Followed Neighborhoods & Wards',
                  project: '📁 Followed Municipal Projects & Proposals',
                  policy: '📜 Followed Policies & Statutory Sections',
                  department: '🏛️ Followed Municipal Departments'
                };

                return (
                  <div key={category} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
                      {titles[category]}
                    </div>

                    {/* Active Follow Badges */}
                    {activeSubs.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
                        Not following any {category} yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        {activeSubs.map(s => (
                          <span
                            key={s.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 9999,
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1e40af',
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            <span>✓ {s.target_value}</span>
                            <button
                              onClick={() => handleUnfollow(s.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: 12,
                                padding: 0,
                                marginLeft: 4
                              }}
                              title="Unfollow"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Quick Follow Suggestions */}
                    {suggestions.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Suggested:</span>
                        {suggestions.slice(0, 4).map((sug, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleFollow(category, sug)}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: '1px dashed #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#475569',
                              cursor: 'pointer'
                            }}
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

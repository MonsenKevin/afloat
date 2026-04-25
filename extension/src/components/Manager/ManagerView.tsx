import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot, BarChart, Bar, Legend, Cell } from 'recharts';
import apiClient from '../../api/client';
import { SentimentTrend } from '../../types/index';

interface Report {
  id: string;
  name: string;
  email: string;
  latestSentimentScore: number | null;
  peerScore: number | null;
  atRisk: boolean;
  startDate: string;
}

interface CheckInEntry {
  id: string;
  completedAt: string;
  sentimentScore: number;
  struggleType: string | null;
  questions: string[];
  responses: string[];
}

interface ManagerPeerReview {
  id: string;
  reviewerId: string;
  subjectId: string;
  reviewerName: string;
  reviewerEmail: string;
  subjectName: string;
  subjectEmail: string;
  status: string;
  questions: string[];
  responses: string[] | null;
  managerNotes: string | null;
  createdAt: string;
  completedAt: string | null;
  approvedAt: string | null;
}

type ExpandedSection = 'trend' | 'checkins' | 'peerreviews' | null;

function ScorePill({ score }: { score: number }) {
  const bg = score >= 4 ? '#dcfce7' : score >= 3 ? '#fef9c3' : '#fee2e2';
  const color = score >= 4 ? '#15803d' : score >= 3 ? '#a16207' : '#dc2626';
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
      {score.toFixed(1)}
    </span>
  );
}

function StruggleBadge({ type }: { type: string | null }) {
  if (!type || type === 'NONE') return null;
  const colors: Record<string, { bg: string; color: string }> = {
    HUMAN: { bg: '#fce7f3', color: '#be185d' },
    TECHNICAL: { bg: '#e0f2fe', color: '#0369a1' },
    BOTH: { bg: '#fef3c7', color: '#b45309' },
  };
  const c = colors[type] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10 }}>
      {type}
    </span>
  );
}

export default function ManagerView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [trends, setTrends] = useState<Record<string, { date: string; score: number }[]>>({});
  const [checkins, setCheckins] = useState<Record<string, CheckInEntry[]>>({});
  const [loadingData, setLoadingData] = useState<string | null>(null);
  const [expandedCheckin, setExpandedCheckin] = useState<string | null>(null);

  // Peer review state
  const [peerReviews, setPeerReviews] = useState<ManagerPeerReview[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignReviewerId, setAssignReviewerId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [expandedPeerReview, setExpandedPeerReview] = useState<string | null>(null);
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({});
  const [rejectFeedback, setRejectFeedback] = useState<Record<string, string>>({});
  const [peerActionLoading, setPeerActionLoading] = useState<string | null>(null);

  // Search & filter state
  const [search, setSearch] = useState('');
  const [filterAtRisk, setFilterAtRisk] = useState(false);
  const [filterSentiment, setFilterSentiment] = useState<Set<'low' | 'medium' | 'high'>>(new Set());
  const [filterStruggle, setFilterStruggle] = useState<'all' | 'HUMAN' | 'TECHNICAL' | 'BOTH' | 'NONE'>('all');

  const toggleSentiment = (opt: 'low' | 'medium' | 'high') => {
    setFilterSentiment(prev => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt); else next.add(opt);
      return next;
    });
  };

  // Derived: filtered reports
  const filteredReports = reports.filter(r => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterAtRisk && !r.atRisk) return false;
    if (filterSentiment.size > 0) {
      const s = r.latestSentimentScore;
      if (s === null) return false;
      const inLow = s < 3;
      const inMedium = s >= 3 && s < 4;
      const inHigh = s >= 4;
      if (!((filterSentiment.has('low') && inLow) || (filterSentiment.has('medium') && inMedium) || (filterSentiment.has('high') && inHigh))) return false;
    }
    return true;
  });

  const hasActiveFilters = search !== '' || filterAtRisk || filterSentiment.size > 0;

  const clearFilters = () => {
    setSearch('');
    setFilterAtRisk(false);
    setFilterSentiment(new Set());
    setFilterStruggle('all');
  };

  // Team summary stats
  const atRiskCount = reports.filter(r => r.atRisk).length;
  const selfScores = reports.map(r => r.latestSentimentScore).filter((s): s is number => s !== null);
  const peerScores = reports.map(r => r.peerScore).filter((s): s is number => s !== null);
  const avgSelf = selfScores.length > 0 ? Math.round(selfScores.reduce((a, b) => a + b, 0) / selfScores.length * 10) / 10 : null;
  const avgPeer = peerScores.length > 0 ? Math.round(peerScores.reduce((a, b) => a + b, 0) / peerScores.length * 10) / 10 : null;
  const pendingReviewCount = peerReviews.filter(pr => pr.status === 'pending_reviewer' || pr.status === 'pending_manager').length;

  useEffect(() => {
    apiClient.get('/api/manager/reports')
      .then(res => setReports(res.data.reports || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
    apiClient.get('/api/manager/peer-reviews')
      .then(res => setPeerReviews(res.data.peerReviews || []))
      .catch(() => {});
  }, []);

  const handleToggle = async (id: string, section: ExpandedSection) => {
    if (expandedId === id && expandedSection === section) {
      setExpandedId(null);
      setExpandedSection(null);
      return;
    }
    setExpandedId(id);
    setExpandedSection(section);

    if (section === 'trend' && !trends[id]) {
      setLoadingData(id);
      try {
        const res = await apiClient.get(`/api/manager/reports/${id}/trend`);
        const raw: SentimentTrend[] = res.data.trend || [];
        setTrends(prev => ({
          ...prev,
          [id]: raw.map(t => ({
            date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            score: t.score,
          })),
        }));
      } catch {} finally { setLoadingData(null); }
    }

    if (section === 'checkins' && !checkins[id]) {
      setLoadingData(id);
      try {
        const res = await apiClient.get(`/api/manager/reports/${id}/checkins`);
        setCheckins(prev => ({ ...prev, [id]: res.data.checkins || [] }));
      } catch {} finally { setLoadingData(null); }
    }
  };

  const handleAssignPeerReview = async () => {
    if (!assignReviewerId || !assignSubjectId) {
      setAssignError('Please select both a reviewer and a subject.');
      return;
    }
    setAssignLoading(true);
    setAssignError(null);
    try {
      const res = await apiClient.post('/api/manager/peer-reviews', {
        reviewerId: assignReviewerId,
        subjectId: assignSubjectId,
      });
      setPeerReviews(prev => [res.data.peerReview, ...prev]);
      setAssignSuccess(true);
      setAssignReviewerId('');
      setAssignSubjectId('');
      setTimeout(() => {
        setAssignSuccess(false);
        setShowAssignForm(false);
      }, 2000);
    } catch (err: any) {
      setAssignError(err?.response?.data?.error || 'Failed to assign peer review.');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleApprovePeerReview = async (id: string) => {
    setPeerActionLoading(id + '_approve');
    try {
      const res = await apiClient.post(`/api/manager/peer-reviews/${id}/approve`, {
        managerNotes: approveNotes[id] || undefined,
      });
      setPeerReviews(prev => prev.map(pr => pr.id === id ? { ...pr, ...res.data.peerReview } : pr));
      setExpandedPeerReview(null);
      // Refresh reports to get updated peer score
      apiClient.get('/api/manager/reports')
        .then(r => setReports(r.data.reports || []))
        .catch(() => {});
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to approve.');
    } finally {
      setPeerActionLoading(null);
    }
  };

  const handleRejectPeerReview = async (id: string) => {
    const feedback = rejectFeedback[id]?.trim();
    if (!feedback) { alert('Please enter feedback for the reviewer.'); return; }
    setPeerActionLoading(id + '_reject');
    try {
      const res = await apiClient.post(`/api/manager/peer-reviews/${id}/reject`, { feedback });
      setPeerReviews(prev => prev.map(pr => pr.id === id ? { ...pr, ...res.data.peerReview } : pr));
      setExpandedPeerReview(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to send back.');
    } finally {
      setPeerActionLoading(null);
    }
  };

  function statusBadge(status: string) {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      pending_reviewer: { label: 'Awaiting Review', bg: '#fff7ed', color: '#ea580c' },
      pending_manager: { label: 'Needs Approval', bg: '#e0f2fe', color: '#0369a1' },
      approved: { label: 'Approved', bg: '#dcfce7', color: '#15803d' },
    };
    const s = map[status] || { label: status, bg: '#f3f4f6', color: '#374151' };
    return (
      <span style={{ fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 10 }}>
        {s.label}
      </span>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <svg style={{ width: 24, height: 24, color: '#f97316', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 24px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No direct reports</p>
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Your team members will appear here.</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 12px' }}>

      {/* ── Team Summary Dashboard ── */}
      <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>Team Overview</p>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{reports.length}</p>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>Reports</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: atRiskCount > 0 ? '#dc2626' : '#111827', margin: 0 }}>{atRiskCount}</p>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>At Risk</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: pendingReviewCount > 0 ? '#ea580c' : '#111827', margin: 0 }}>{pendingReviewCount}</p>
            <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0' }}>Pending Reviews</p>
          </div>
        </div>

        {/* Bar chart: self vs peer score per employee */}
        {reports.some(r => r.latestSentimentScore !== null || r.peerScore !== null) && (
          <>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>Self vs Peer Score</p>
            <div style={{ height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={reports.map(r => ({
                    name: r.name.split(' ')[0],
                    self: r.latestSentimentScore,
                    peer: r.peerScore,
                  }))}
                  margin={{ top: 2, right: 4, left: -28, bottom: 0 }}
                  barCategoryGap="25%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(value: any, name: string) => [value !== null ? Number(value).toFixed(1) : '—', name === 'self' ? 'Self' : 'Peer']}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                    formatter={(value) => value === 'self' ? 'Self' : 'Peer'}
                  />
                  <Bar dataKey="self" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={16}>
                    {reports.map((r, i) => (
                      <Cell key={i} fill={r.atRisk ? '#dc2626' : '#f97316'} />
                    ))}
                  </Bar>
                  <Bar dataKey="peer" fill="#38bdf8" radius={[3, 3, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* ── Search & Filters ── */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employees…"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#111827', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setFilterAtRisk(v => !v)}
            style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: '1px solid', cursor: 'pointer', background: filterAtRisk ? '#fee2e2' : '#fff', borderColor: filterAtRisk ? '#fca5a5' : '#e5e7eb', color: filterAtRisk ? '#dc2626' : '#6b7280' }}
          >
            At Risk ({atRiskCount})
          </button>
          {(['low', 'medium', 'high'] as const).map(opt => (
            <button key={opt} onClick={() => toggleSentiment(opt)}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: '1px solid', cursor: 'pointer', background: filterSentiment.has(opt) ? '#fff7ed' : '#fff', borderColor: filterSentiment.has(opt) ? '#fed7aa' : '#e5e7eb', color: filterSentiment.has(opt) ? '#ea580c' : '#6b7280' }}
            >
              {opt === 'low' ? 'Low (1–2.9)' : opt === 'medium' ? 'Med (3–3.9)' : 'High (4–5)'}
            </button>
          ))}
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: '1px solid #e5e7eb', cursor: 'pointer', background: '#f9fafb', color: '#6b7280' }}>
              Clear
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
            Showing {filteredReports.length} of {reports.length} employees
          </p>
        )}
      </div>

      <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Direct Reports ({reports.length})
      </p>

      {filteredReports.length === 0 && reports.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 12 }}>
          No employees match your search
        </div>
      )}

      {filteredReports.map(report => {
        const isOpen = expandedId === report.id;
        const daysSinceStart = Math.floor((Date.now() - new Date(report.startDate).getTime()) / (1000 * 60 * 60 * 24));

        return (
          <div key={report.id} style={{ border: '1px solid #f3f4f6', borderRadius: 12, marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
            {/* Employee header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#0369a1' }}>
                {report.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{report.name}</span>
                  {report.atRisk && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 10 }}>At Risk</span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{report.email} · Day {daysSinceStart}</p>
              </div>
              {(report.latestSentimentScore !== null || (report as any).peerScore !== null) && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  {report.latestSentimentScore !== null && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>self</span>
                      <ScorePill score={report.latestSentimentScore} />
                    </div>
                  )}
                  {report.peerScore !== null && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>peer</span>
                      <ScorePill score={report.peerScore} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', borderTop: '1px solid #f9fafb', padding: '0 12px 10px', gap: 6 }}>
              <button
                onClick={() => void handleToggle(report.id, 'trend')}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, border: '1px solid',
                  borderRadius: 8, cursor: 'pointer',
                  background: isOpen && expandedSection === 'trend' ? '#fff7ed' : '#fff',
                  borderColor: isOpen && expandedSection === 'trend' ? '#fed7aa' : '#e5e7eb',
                  color: isOpen && expandedSection === 'trend' ? '#ea580c' : '#6b7280',
                }}
              >
                📈 Trend
              </button>
              <button
                onClick={() => void handleToggle(report.id, 'checkins')}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, border: '1px solid',
                  borderRadius: 8, cursor: 'pointer',
                  background: isOpen && expandedSection === 'checkins' ? '#fff7ed' : '#fff',
                  borderColor: isOpen && expandedSection === 'checkins' ? '#fed7aa' : '#e5e7eb',
                  color: isOpen && expandedSection === 'checkins' ? '#ea580c' : '#6b7280',
                }}
              >
                📋 Check-ins
              </button>
              <button
                onClick={() => void handleToggle(report.id, 'peerreviews')}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600, border: '1px solid',
                  borderRadius: 8, cursor: 'pointer',
                  background: isOpen && expandedSection === 'peerreviews' ? '#f0f9ff' : '#fff',
                  borderColor: isOpen && expandedSection === 'peerreviews' ? '#bae6fd' : '#e5e7eb',
                  color: isOpen && expandedSection === 'peerreviews' ? '#0369a1' : '#6b7280',
                }}
              >
                {`👥 Peers (${peerReviews.filter(pr => pr.status === 'approved' && pr.subjectId === report.id).length})`}
              </button>
            </div>

            {/* Expanded: Peer Reviews (approved, grouped under this employee) */}
            {isOpen && expandedSection === 'peerreviews' && (() => {
              const approved = (peerReviews.filter(pr => pr.status === 'approved' && pr.subjectId === report.id)
                .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt)));
              return (
                <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
                  {approved.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>No peer feedback yet.</p>
                  ) : (
                    approved.map(pr => {
                      const prOpen = expandedPeerReview === pr.id;
                      const date = pr.completedAt
                        ? new Date(pr.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : new Date(pr.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                      return (
                        <div key={pr.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <button
                            onClick={() => setExpandedPeerReview(prOpen ? null : pr.id)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{pr.reviewerName}</span>
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>{date}</span>
                            </div>
                            <svg style={{ width: 14, height: 14, color: '#9ca3af', transform: prOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {prOpen && (
                            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {pr.managerNotes && (
                                <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>Manager note</p>
                                  <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{pr.managerNotes}</p>
                                </div>
                              )}
                              {pr.questions.map((q, i) => {
                                const label = q.startsWith('slider:') ? q.slice(7) : q.startsWith('text:') ? q.slice(5) : q;
                                const resp = pr.responses?.[i] ?? '—';
                                const isSlider = q.startsWith('slider:');
                                return (
                                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px' }}>{label}</p>
                                    {isSlider ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ flex: 1, height: 4, background: '#f3f4f6', borderRadius: 4 }}>
                                          <div style={{ width: `${(parseInt(String(resp)) / 5) * 100}%`, height: 4, background: '#0ea5e9', borderRadius: 4 }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9' }}>{resp}/5</span>
                                      </div>
                                    ) : (
                                      <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{resp}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}

            {/* Expanded: Trend */}
            {isOpen && expandedSection === 'trend' && (
              <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px', background: '#fafafa' }}>
                {loadingData === report.id ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <svg style={{ width: 20, height: 20, color: '#f97316', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : trends[report.id]?.length > 0 ? (
                  <div style={{ height: 120 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends[report.id]} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                        <Line type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2} dot={<Dot r={3} fill="#38bdf8" stroke="#38bdf8" />} activeDot={{ r: 4, fill: '#f97316' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No check-in data yet.</p>
                )}
              </div>
            )}

            {/* Expanded: Check-ins */}
            {isOpen && expandedSection === 'checkins' && (
              <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
                {loadingData === report.id ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                    <svg style={{ width: 20, height: 20, color: '#f97316', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : !checkins[report.id] || checkins[report.id].length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>No completed check-ins yet.</p>
                ) : (
                  checkins[report.id].map(ci => {
                    const ciOpen = expandedCheckin === ci.id;
                    const date = new Date(ci.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div key={ci.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <button
                          onClick={() => setExpandedCheckin(ciOpen ? null : ci.id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{date}</span>
                            <ScorePill score={ci.sentimentScore} />
                            <StruggleBadge type={ci.struggleType} />
                          </div>
                          <svg style={{ width: 14, height: 14, color: '#9ca3af', transform: ciOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {ciOpen && (
                          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {ci.questions.map((q, i) => {
                              const label = q.startsWith('slider:') ? q.slice(7) : q.startsWith('text:') ? q.slice(5) : q;
                              const resp = ci.responses[i] || '—';
                              const isSlider = q.startsWith('slider:');
                              return (
                                <div key={i} style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: '8px 10px' }}>
                                  <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px' }}>{label}</p>
                                  {isSlider ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <div style={{ flex: 1, height: 4, background: '#f3f4f6', borderRadius: 4 }}>
                                        <div style={{ width: `${(parseInt(resp) / 5) * 100}%`, height: 4, background: '#f97316', borderRadius: 4 }} />
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>{resp}/5</span>
                                    </div>
                                  ) : (
                                    <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{resp}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Peer Reviews Section ── */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Peer Reviews
          </p>
          <button
            onClick={() => { setShowAssignForm(v => !v); setAssignError(null); setAssignSuccess(false); }}
            style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', borderRadius: 8, cursor: 'pointer' }}
          >
            {showAssignForm ? 'Cancel' : '+ Assign Peer Review'}
          </button>
        </div>

        {/* Assign form */}
        {showAssignForm && (
          <div style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: 12, padding: '14px 14px 12px', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Assign a peer review</p>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Reviewer</label>
              <select
                value={assignReviewerId}
                onChange={e => { setAssignReviewerId(e.target.value); setAssignError(null); }}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#111827', background: '#fff' }}
              >
                <option value="">Select reviewer…</option>
                {reports.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Subject</label>
              <select
                value={assignSubjectId}
                onChange={e => { setAssignSubjectId(e.target.value); setAssignError(null); }}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#111827', background: '#fff' }}
              >
                <option value="">Select subject…</option>
                {reports.filter(r => r.id !== assignReviewerId).map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            {assignError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#dc2626', marginBottom: 8 }}>
                {assignError}
              </div>
            )}
            {assignSuccess && (
              <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#15803d', marginBottom: 8 }}>
                Peer review assigned successfully!
              </div>
            )}
            <button
              onClick={handleAssignPeerReview}
              disabled={assignLoading}
              style={{ width: '100%', padding: '9px 0', background: assignLoading ? '#fdba74' : '#f97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: assignLoading ? 'not-allowed' : 'pointer' }}
            >
              {assignLoading ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        )}

        {/* Pending reviews — needs manager action */}
        {(() => {
          const pendingReviews = peerReviews.filter(pr => pr.status !== 'approved');
          if (pendingReviews.length === 0 && !showAssignForm) return null;
          return (
            <>
              {pendingReviews.length > 0 && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Pending Reviews
                  </p>
                  {pendingReviews.map(pr => {
                    const isExpanded = expandedPeerReview === pr.id;
                    const date = new Date(pr.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <div key={pr.id} style={{ border: '1px solid #f3f4f6', borderRadius: 12, marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{pr.reviewerName}</span>
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>→</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{pr.subjectName}</span>
                              {statusBadge(pr.status)}
                            </div>
                            <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{date}</p>
                          </div>
                          {pr.status === 'pending_manager' && (
                            <button
                              onClick={() => setExpandedPeerReview(isExpanded ? null : pr.id)}
                              style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}
                            >
                              {isExpanded ? 'Close' : 'Review & Approve'}
                            </button>
                          )}
                        </div>

                        {/* Expanded approval panel */}
                        {isExpanded && pr.status === 'pending_manager' && pr.responses && (
                          <div style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa', padding: '12px' }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                              Reviewer's Responses
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                              {pr.questions.map((q, i) => {
                                const label = q.startsWith('slider:') ? q.slice(7) : q.startsWith('text:') ? q.slice(5) : q;
                                const resp = pr.responses![i] ?? '—';
                                const isSlider = q.startsWith('slider:');
                                return (
                                  <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 4px' }}>{label}</p>
                                    {isSlider ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ flex: 1, height: 4, background: '#f3f4f6', borderRadius: 4 }}>
                                          <div style={{ width: `${(parseInt(resp) / 5) * 100}%`, height: 4, background: '#0ea5e9', borderRadius: 4 }} />
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0ea5e9' }}>{resp}/5</span>
                                      </div>
                                    ) : (
                                      <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5 }}>{resp}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Manager notes (optional)</label>
                              <textarea
                                value={approveNotes[pr.id] ?? ''}
                                onChange={e => setApproveNotes(prev => ({ ...prev, [pr.id]: e.target.value }))}
                                placeholder="Add a note to accompany this feedback…"
                                rows={3}
                                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#111827', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                              />
                            </div>

                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Send back reason (if rejecting)</label>
                              <textarea
                                value={rejectFeedback[pr.id] ?? ''}
                                onChange={e => setRejectFeedback(prev => ({ ...prev, [pr.id]: e.target.value }))}
                                placeholder="Explain what needs to be revised…"
                                rows={2}
                                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#111827', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                              />
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleApprovePeerReview(pr.id)}
                                disabled={peerActionLoading === pr.id + '_approve'}
                                style={{ flex: 2, padding: '9px 0', background: peerActionLoading === pr.id + '_approve' ? '#86efac' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: peerActionLoading === pr.id + '_approve' ? 'not-allowed' : 'pointer' }}
                              >
                                {peerActionLoading === pr.id + '_approve' ? 'Approving…' : 'Approve & Send'}
                              </button>
                              <button
                                onClick={() => handleRejectPeerReview(pr.id)}
                                disabled={peerActionLoading === pr.id + '_reject'}
                                style={{ flex: 1, padding: '9px 0', background: peerActionLoading === pr.id + '_reject' ? '#fca5a5' : '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: peerActionLoading === pr.id + '_reject' ? 'not-allowed' : 'pointer' }}
                              >
                                {peerActionLoading === pr.id + '_reject' ? 'Sending…' : 'Send Back'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

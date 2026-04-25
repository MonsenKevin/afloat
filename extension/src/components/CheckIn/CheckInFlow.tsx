import React, { useState, useEffect, useRef } from 'react';
import { useCheckinStore } from '../../store/checkinStore';
import { PeerReview } from '../../types/index';
import RoutingCard from './RoutingCard';

const SLIDER_LABELS = ['Not at all', 'Rarely', 'Sometimes', 'Often', 'Always'];
const DRAFT_KEY = 'afloat_checkin_draft';

interface Draft {
  checkinId: string;
  sliderValues: Record<string, number>;
  technicalText: string;
  cultureText: string;
  page: number;
}

function saveDraft(draft: Draft) {
  chrome.storage.local.set({ [DRAFT_KEY]: JSON.stringify(draft) });
}

// ── Slider card ───────────────────────────────────────────────────────────────
function SliderCard({
  name,
  value,
  onChange,
  peerMode,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  peerMode?: boolean;
}) {
  const color =
    value >= 4 ? '#16a34a' : value >= 3 ? '#ca8a04' : '#ef4444';

  return (
    <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: peerMode ? '#0ea5e9' : '#f97316' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{name}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{value} / 5</span>
      </div>
      <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
        {peerMode ? 'How well does this person embody this value?' : 'How well are you embodying this value this sprint?'}
      </p>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: peerMode ? '#0ea5e9' : '#f97316', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {SLIDER_LABELS.map((label, i) => (
          <span
            key={i}
            style={{
              fontSize: 10,
              color: value === i + 1 ? (peerMode ? '#0ea5e9' : '#f97316') : '#9ca3af',
              fontWeight: value === i + 1 ? 700 : 400,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Text card ─────────────────────────────────────────────────────────────────
function TextCard({
  label,
  question,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  question: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 10, lineHeight: 1.4 }}>
        {question}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          fontSize: 13,
          color: '#111827',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#f97316'; }}
        onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; }}
      />
    </div>
  );
}

// ── Peer Review Flow ──────────────────────────────────────────────────────────
function PeerReviewFlow({ review, onDone }: { review: PeerReview; onDone: () => void }) {
  const { submitPeerReview } = useCheckinStore();
  const [page, setPage] = useState(1);
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [textValues, setTextValues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const questions = review.questions;
  const sliderNames = questions.filter(q => q.startsWith('slider:')).map(q => q.slice(7));
  const textQs = questions.filter(q => q.startsWith('text:')).map(q => q.slice(5));

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const defaults: Record<string, number> = {};
    sliderNames.forEach(n => { defaults[n] = 3; });
    setSliderValues(defaults);
    setTextValues(textQs.map(() => ''));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <svg style={{ width: 24, height: 24, color: '#16a34a' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Feedback submitted!</p>
        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5, marginBottom: 20 }}>
          Your feedback has been sent to your manager for review.
        </p>
        <button
          onClick={onDone}
          style={{ padding: '9px 24px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Done
        </button>
      </div>
    );
  }

  const handleSubmit = async () => {
    const unanswered = textValues.findIndex(v => !v.trim());
    if (unanswered !== -1) {
      setError('Please answer all questions.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      let textIdx = 0;
      const responses = questions.map(q => {
        if (q.startsWith('slider:')) return String(sliderValues[q.slice(7)] ?? 3);
        if (q.startsWith('text:')) return textValues[textIdx++]?.trim() ?? '';
        return '';
      });
      await submitPeerReview(review.id, responses);
      setSubmitted(true);
    } catch {
      setError('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (page / 2) * 100;

  const header = (
    <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 2 }}>
            Peer Review: {review.subjectName}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {page === 1 ? 'Company Values' : 'Open Questions'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {page === 1 ? 'Rate how this person embodies each value' : 'Share your observations'}
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{page} / 2</span>
      </div>
      {review.managerNotes && (
        <div style={{ marginBottom: 8, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>Manager feedback</p>
          <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{review.managerNotes}</p>
        </div>
      )}
      <div style={{ width: '100%', height: 4, background: '#f3f4f6', borderRadius: 4 }}>
        <div style={{ width: `${progress}%`, height: 4, background: '#0ea5e9', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    </div>
  );

  if (page === 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
          {sliderNames.map(name => (
            <SliderCard
              key={name}
              name={name}
              value={sliderValues[name] ?? 3}
              onChange={v => setSliderValues(prev => ({ ...prev, [name]: v }))}
              peerMode
            />
          ))}
        </div>
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
          <button
            onClick={() => setPage(2)}
            style={{ width: '100%', padding: '11px 0', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {header}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
        {textQs.map((q, i) => (
          <TextCard
            key={i}
            label={`Question ${i + 1}`}
            question={q}
            value={textValues[i] ?? ''}
            onChange={v => setTextValues(prev => { const next = [...prev]; next[i] = v; return next; })}
            placeholder="Share your observations…"
          />
        ))}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setPage(1)}
          style={{ flex: 1, padding: '11px 0', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ flex: 2, padding: '11px 0', background: isSubmitting ? '#7dd3fc' : '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {isSubmitting ? (
            <>
              <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting…
            </>
          ) : 'Submit Peer Review'}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CheckInFlow() {
  const { pendingCheckin, routingResult, isSubmitting, submitResponses, submittedScore, pendingPeerReviews, fetchPeerReviews } =
    useCheckinStore();

  const [activePeerReview, setActivePeerReview] = useState<PeerReview | null>(null);
  const [dismissedPeerReviews, setDismissedPeerReviews] = useState<Set<string>>(new Set());

  // Self-fetch on mount in case the store hasn't loaded yet (e.g. initial login)
  useEffect(() => {
    void fetchPeerReviews();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [page, setPage] = useState(1);
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [technicalText, setTechnicalText] = useState('');
  const [cultureText, setCultureText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  const questions = pendingCheckin?.questions ?? [];
  const sliderNames = questions
    .filter((q) => q.startsWith('slider:'))
    .map((q) => q.slice(7));
  const textQs = questions
    .filter((q) => q.startsWith('text:'))
    .map((q) => q.slice(5));
  const techQ = textQs[0] ?? 'What technical work are you focused on this sprint, and where are you blocked?';
  const cultQ = textQs[1] ?? 'How connected do you feel to your team and company culture right now?';

  // Restore draft once on mount
  useEffect(() => {
    if (!pendingCheckin?.id || initialized.current) return;
    initialized.current = true;

    // Default slider values
    const defaults: Record<string, number> = {};
    sliderNames.forEach((n) => { defaults[n] = 3; });

    chrome.storage.local.get([DRAFT_KEY], (result) => {
      const raw = result[DRAFT_KEY] as string | undefined;
      if (raw) {
        try {
          const draft = JSON.parse(raw) as Draft;
          if (draft.checkinId === pendingCheckin.id) {
            // Merge defaults with saved (in case new sliders were added)
            setSliderValues({ ...defaults, ...draft.sliderValues });
            setTechnicalText(draft.technicalText ?? '');
            setCultureText(draft.cultureText ?? '');
            setPage(draft.page ?? 1);
            return;
          }
        } catch { /* corrupt — ignore */ }
      }
      setSliderValues(defaults);
    });
  }, [pendingCheckin?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pendingCheckin) {
    // Show peer review banners if no regular check-in is pending
    const visiblePeerReviews = pendingPeerReviews.filter(pr => !dismissedPeerReviews.has(pr.id));

    if (activePeerReview) {
      return (
        <PeerReviewFlow
          review={activePeerReview}
          onDone={() => setActivePeerReview(null)}
        />
      );
    }

    if (visiblePeerReviews.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '16px 12px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Peer Reviews Pending
        </p>
        {visiblePeerReviews.map(pr => (
          <div key={pr.id} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#0369a1', margin: '0 0 2px' }}>
                  Peer review for {pr.subjectName}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                  You have a peer review to complete for {pr.subjectName}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => setActivePeerReview(pr)}
                  style={{ padding: '6px 12px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Start
                </button>
                <button
                  onClick={() => setDismissedPeerReviews(prev => new Set([...prev, pr.id]))}
                  style={{ padding: '6px 8px', background: 'none', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
            {pr.managerNotes && (
              <div style={{ marginTop: 10, background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>Manager feedback</p>
                <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{pr.managerNotes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (routingResult) {
    return <RoutingCard routing={routingResult} sentimentScore={submittedScore} />;
  }

  // If a peer review is active, show it (even if regular check-in is also pending)
  if (activePeerReview) {
    return (
      <PeerReviewFlow
        review={activePeerReview}
        onDone={() => setActivePeerReview(null)}
      />
    );
  }

  // Helpers that update state AND persist
  const updateSlider = (name: string, v: number) => {
    const next = { ...sliderValues, [name]: v };
    setSliderValues(next);
    saveDraft({ checkinId: pendingCheckin.id, sliderValues: next, technicalText, cultureText, page });
  };
  const updateTech = (v: string) => {
    setTechnicalText(v);
    saveDraft({ checkinId: pendingCheckin.id, sliderValues, technicalText: v, cultureText, page });
  };
  const updateCult = (v: string) => {
    setCultureText(v);
    saveDraft({ checkinId: pendingCheckin.id, sliderValues, technicalText, cultureText: v, page });
  };
  const goNext = () => {
    setPage(2);
    saveDraft({ checkinId: pendingCheckin.id, sliderValues, technicalText, cultureText, page: 2 });
  };
  const goBack = () => {
    setPage(1);
    saveDraft({ checkinId: pendingCheckin.id, sliderValues, technicalText, cultureText, page: 1 });
  };

  const handleSubmit = async () => {
    if (!technicalText.trim()) { setError('Please answer the technical question.'); return; }
    if (!cultureText.trim()) { setError('Please answer the culture question.'); return; }
    setError(null);

    const responses = questions.map((q) => {
      if (q.startsWith('slider:')) return String(sliderValues[q.slice(7)] ?? 3);
      if (q.startsWith('text:')) {
        const idx = textQs.indexOf(q.slice(5));
        return idx === 0 ? technicalText.trim() : cultureText.trim();
      }
      return '';
    });

    try {
      await submitResponses(responses);
      chrome.storage.local.remove([DRAFT_KEY]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (err instanceof Error ? err.message : null) ||
        'Submission failed. Please try again.';
      setError(msg);
    }
  };

  const progress = (page / 2) * 100;

  // ── Shared header ──
  const header = (
    <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {page === 1 ? 'Company Values' : 'Open Questions'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            {page === 1 ? "Rate how you're living each value" : 'Share what\'s on your mind'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{page} / 2</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 12, color: '#f97316', fontWeight: 500 }}>Due now</span>
          </div>
        </div>
      </div>
      <div style={{ width: '100%', height: 4, background: '#f3f4f6', borderRadius: 4 }}>
        <div style={{ width: `${progress}%`, height: 4, background: '#f97316', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    </div>
  );

  // ── Page 1: Sliders ──
  if (page === 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
          {sliderNames.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              Loading values…
            </p>
          ) : (
            sliderNames.map((name) => (
              <SliderCard
                key={name}
                name={name}
                value={sliderValues[name] ?? 3}
                onChange={(v) => updateSlider(name, v)}
              />
            ))
          )}
        </div>
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
          <button
            onClick={goNext}
            style={{
              width: '100%', padding: '11px 0', background: '#f97316', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  // ── Page 2: Text boxes ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {header}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>
        <TextCard
          label="Technical Progress"
          question={techQ}
          value={technicalText}
          onChange={updateTech}
          placeholder="Share what you're working on and any blockers…"
        />
        <TextCard
          label="Team & Culture"
          question={cultQ}
          value={cultureText}
          onChange={updateCult}
          placeholder="How are you feeling about your team and culture fit…"
        />
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0, display: 'flex', gap: 8 }}>
        <button
          onClick={goBack}
          style={{
            flex: 1, padding: '11px 0', background: '#f3f4f6', color: '#374151',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{
            flex: 2, padding: '11px 0',
            background: isSubmitting ? '#fdba74' : '#f97316',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 14,
            fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {isSubmitting ? (
            <>
              <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing…
            </>
          ) : 'Submit Check-in'}
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore, ChatMessage } from '../../store/chatStore';
import { useCheckinStore } from '../../store/checkinStore';
import { useAuthStore } from '../../store/authStore';
import { ContactSuggestion } from '../../types/index';

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          style={{
            width: 8, height: 8, borderRadius: '50%', background: '#38bdf8',
            display: 'inline-block', animation: `bounce 1s ${delay}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── GitHub contact list ───────────────────────────────────────────────────────
function ContactList({ contacts }: { contacts: ContactSuggestion[] }) {
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {contacts.map((c, i) => {
        const date = new Date(c.lastCommitDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #f3f4f6', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: 16, height: 16, color: '#6b7280' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>@{c.githubUsername} · {date}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Provider icons ────────────────────────────────────────────────────────────
function ProviderIcon({ provider }: { provider: string }) {
  switch (provider) {
    case 'jira':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: 2, background: '#0052CC', color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
          J
        </span>
      );
    case 'github':
      return (
        <svg style={{ width: 12, height: 12, flexShrink: 0 }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      );
    case 'outlook':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: 2, background: '#0078D4', color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
          O
        </span>
      );
    case 'google_calendar':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: 2, background: '#EA4335', color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
          G
        </span>
      );
    case 'granola':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: 2, background: '#22c55e', color: '#fff', fontSize: 8, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
          G
        </span>
      );
    default:
      // knowledge_base or undefined
      return (
        <svg style={{ width: 10, height: 10, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

const PROVIDER_LABELS: Record<string, string> = {
  jira: 'Jira',
  github: 'GitHub',
  outlook: 'Outlook',
  google_calendar: 'Google Calendar',
  granola: 'Granola',
  knowledge_base: 'Knowledge Base',
};

function isIntegrationProvider(provider: string) {
  return provider !== 'knowledge_base';
}

// ── Source chips grouped by provider ─────────────────────────────────────────
function SourceChips({ documents }: { documents: Array<{ title: string; section?: string; provider?: string; url?: string }> }) {
  // Group documents by provider (default to 'knowledge_base')
  const groups = new Map<string, typeof documents>();
  for (const doc of documents) {
    const key = doc.provider ?? 'knowledge_base';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(doc);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Sources</p>
      {Array.from(groups.entries()).map(([provider, docs]) => {
        const isIntegration = isIntegrationProvider(provider);
        const chipStyle: React.CSSProperties = isIntegration
          ? { background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1' }
          : { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' };

        return (
          <div key={provider} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {PROVIDER_LABELS[provider] ?? provider}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {docs.map((d, i) => {
                const label = `${d.title}${d.section ? ` › ${d.section}` : ''}`;
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                      ...chipStyle,
                    }}
                  >
                    <ProviderIcon provider={provider} />
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#15803d', textDecoration: 'none' }}
                      >
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Primary doc card ──────────────────────────────────────────────────────────
function PrimaryDocCard({ doc }: { doc: { title: string; section?: string; provider?: string; url?: string; description?: string } }) {
  const isIntegration = doc.provider && doc.provider !== 'knowledge_base';
  const bg = isIntegration ? '#f0f9ff' : '#f0fdf4';
  const border = isIntegration ? '#bae6fd' : '#bbf7d0';
  const accent = isIntegration ? '#0369a1' : '#15803d';

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        Start here
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ProviderIcon provider={doc.provider ?? 'knowledge_base'} />
        {doc.url ? (
          <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: accent, textDecoration: 'none' }}>
            {doc.title}{doc.section ? ` › ${doc.section}` : ''}
          </a>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: accent }}>
            {doc.title}{doc.section ? ` › ${doc.section}` : ''}
          </span>
        )}
      </div>
      {doc.description && (
        <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.4 }}>{doc.description}</p>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div style={{ maxWidth: '82%', background: '#f97316', color: '#fff', borderRadius: '16px 4px 16px 16px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>
          {msg.content}
        </div>
      </div>
    );
  }

  const contacts = msg.data?.contacts || [];
  const documents = msg.data?.documents || [];
  const githubContacts = msg.data?.githubContacts || [];
  const primaryDoc = msg.data?.primaryDoc;

  // Filter out the primaryDoc from the additional sources list to avoid duplication
  const additionalDocs = primaryDoc
    ? documents.filter(d => d.title !== primaryDoc.title)
    : documents;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
      <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Answer bubble */}
        <div style={{ background: '#f3f4f6', borderLeft: '2px solid #38bdf8', borderRadius: '4px 16px 16px 16px', padding: '10px 14px', fontSize: 13, color: '#1f2937', lineHeight: 1.6 }}>
          {msg.content}
        </div>

        {/* Primary doc — "Start here" card */}
        {primaryDoc && primaryDoc.title && (
          <PrimaryDocCard doc={primaryDoc} />
        )}

        {/* Contact cards */}
        {contacts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Reach out to</p>
            {contacts.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fff', border: '1px solid #e0f2fe', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#0369a1' }}>
                  {c.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{c.name}</span>
                    {c.email && (
                      <a href={`mailto:${c.email}`} style={{ fontSize: 11, color: '#f97316', textDecoration: 'none' }}>{c.email}</a>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '2px 0 0', lineHeight: 1.4 }}>{c.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Additional sources (collapsed chips) */}
        {additionalDocs.length > 0 && (
          <SourceChips documents={additionalDocs} />
        )}

        {/* GitHub contacts */}
        {githubContacts.length > 0 && (
          <ContactList contacts={githubContacts} />
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Chat() {
  const { messages, isLoading, sendMessage } = useChatStore();
  const { pendingCheckin, routingResult, startCheckin, isLoading: checkinLoading } = useCheckinStore();
  const { user } = useAuthStore();
  const isManager = user?.role === 'Manager';
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasActiveCheckin = !!(pendingCheckin && !routingResult);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Empty state — shown instead of scroll area when no messages */}
      {messages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 32px' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <svg style={{ width: 26, height: 26, color: '#38bdf8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>
            {isManager ? 'Ask about your team' : 'Ask Mission Control anything'}
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
            {isManager
              ? 'Ask about your team\'s check-ins, struggles, or progress'
              : 'Ask about company culture, processes,\nor type a file path to find contributors'}
          </p>

          {/* Example prompts */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {(isManager ? [
              'Who on my team is struggling?',
              'How is Alex doing this sprint?',
              'Which employees have technical blockers?',
              'Summarize my team\'s recent check-ins',
            ] : [
              'How do I submit a pull request?',
              'What is our Bias for Action value?',
              'Who worked on src/auth/index.ts?',
              'How do I set up my dev environment?',
            ]).map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  void sendMessage(prompt);
                }}
                style={{
                  padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb',
                  borderRadius: 8, fontSize: 12, color: '#374151', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}
              >
                {prompt}
              </button>
            ))}
          </div>

          {!hasActiveCheckin && !isManager && (
            <button
              onClick={() => void startCheckin()}
              disabled={checkinLoading}
              style={{
                marginTop: 16,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 22px',
                background: checkinLoading ? '#fdba74' : '#f97316',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                cursor: checkinLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(249,115,22,0.3)',
              }}
            >
              {checkinLoading ? 'Starting…' : (
                <>
                  <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Start Check-in
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        /* Message thread */
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: '#f3f4f6', borderLeft: '2px solid #38bdf8', borderRadius: '4px 16px 16px 16px' }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input area — always visible at bottom */}
      <div style={{ padding: '10px 12px 14px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
        {/* Start check-in shortcut when there are messages */}
        {messages.length > 0 && !hasActiveCheckin && (
          <button
            onClick={() => void startCheckin()}
            disabled={checkinLoading}
            style={{
              width: '100%', marginBottom: 8,
              padding: '8px 0',
              background: '#fff7ed', border: '1px solid #fed7aa',
              color: '#ea580c', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {checkinLoading ? 'Starting…' : '+ Start a Check-in'}
          </button>
        )}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: '#f9fafb', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '8px 12px',
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isManager ? 'Ask about your team…' : 'Ask a question or type a file path…'}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: '#111827', resize: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, minHeight: 22, maxHeight: 96,
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isLoading}
            style={{
              flexShrink: 0, width: 32, height: 32,
              background: input.trim() && !isLoading ? '#f97316' : '#fed7aa',
              border: 'none', borderRadius: 8, cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Send"
          >
            <svg style={{ width: 16, height: 16, color: '#fff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

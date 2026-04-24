import React from 'react';
import { RoutingResult, CultureChampion, KBAnswer, ContactSuggestion } from '../../types/index';
import { useCheckinStore } from '../../store/checkinStore';

interface Props {
  routing: RoutingResult;
  sentimentScore: number | null;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 4 ? 'bg-green-100 text-green-700' : score >= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${color}`}>
      {score.toFixed(1)} / 5
    </span>
  );
}

function ChampionCard({ champion }: { champion: CultureChampion }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
        <span className="text-sky-600 font-semibold text-sm">
          {champion.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{champion.name}</span>
          <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
            {champion.cultureValueName}
          </span>
        </div>
        {champion.bio && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{champion.bio}</p>
        )}
        <a
          href={`mailto:${champion.email}`}
          className="text-xs text-orange-500 hover:text-orange-600 font-medium mt-1 inline-block"
        >
          {champion.email}
        </a>
      </div>
    </div>
  );
}

function KBAnswerCard({ answer }: { answer: KBAnswer }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
      <p className="text-sm text-gray-800 leading-relaxed">{answer.answer}</p>
      {answer.citation && (
        <span className="inline-block mt-2 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
          {answer.citation}
        </span>
      )}
    </div>
  );
}

function ContactCard({ contact }: { contact: ContactSuggestion }) {
  const date = new Date(contact.lastCommitDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{contact.name}</p>
        <p className="text-xs text-gray-500">@{contact.githubUsername} · {date}</p>
      </div>
    </div>
  );
}

export default function RoutingCard({ routing, sentimentScore }: Props) {
  const { clearCheckin } = useCheckinStore();

  const showHuman = routing.struggleType === 'HUMAN' || routing.struggleType === 'BOTH';
  const showTechnical = routing.struggleType === 'TECHNICAL' || routing.struggleType === 'BOTH';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Check-in complete</h2>
          <ScoreBadge score={sentimentScore} />
        </div>

        {/* Summary message */}
        <p className="text-sm text-gray-600 leading-relaxed">{routing.message}</p>

        {/* Culture Champions (HUMAN / BOTH) */}
        {showHuman && routing.cultureChampions && routing.cultureChampions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Culture Champions
            </h3>
            <div className="space-y-2">
              {routing.cultureChampions.map((c) => (
                <ChampionCard key={c.userId} champion={c} />
              ))}
            </div>
          </div>
        )}

        {/* KB Answers (TECHNICAL / BOTH) */}
        {showTechnical && routing.kbAnswers && routing.kbAnswers.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Knowledge Base
            </h3>
            <div className="space-y-2">
              {routing.kbAnswers.map((a, i) => (
                <KBAnswerCard key={i} answer={a} />
              ))}
            </div>
          </div>
        )}

        {/* GitHub Contacts (TECHNICAL / BOTH) */}
        {showTechnical && routing.githubContacts && routing.githubContacts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              File Contributors
            </h3>
            <div className="space-y-2">
              {routing.githubContacts.map((c, i) => (
                <ContactCard key={i} contact={c} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state for NONE */}
        {routing.struggleType === 'NONE' && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">You're doing great — keep it up!</p>
          </div>
        )}

        {/* Done button */}
        <button
          onClick={clearCheckin}
          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg text-sm transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

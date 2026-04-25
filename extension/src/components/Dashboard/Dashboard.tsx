import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';
import apiClient from '../../api/client';
import { CheckIn } from '../../types/index';

interface HistoryEntry extends CheckIn {
  completedAt: string;
  sentimentScore: number;
}

interface NoteState {
  [checkinId: string]: {
    text: string;
    saved: string | null;
    editing: boolean;
  };
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 4
      ? 'bg-green-100 text-green-700'
      : score >= 2
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-red-100 text-red-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

export default function Dashboard() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<NoteState>({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get('/api/checkins/history');
        setHistory((res.data.checkins as HistoryEntry[]) || []);
      } catch {
        // ignore
      }
      setIsLoading(false);
    };
    void load();
  }, []);

  const trendData = history
    .filter((c) => c.sentimentScore !== null)
    .map((c) => ({
      date: new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: c.sentimentScore,
    }))
    .reverse();

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startNote = (id: string) => {
    setNotes((prev) => ({
      ...prev,
      [id]: { text: prev[id]?.text || '', saved: prev[id]?.saved || null, editing: true },
    }));
  };

  const saveNote = async (id: string) => {
    const text = notes[id]?.text?.trim();
    if (!text) return;
    try {
      await apiClient.post(`/api/checkins/${id}/notes`, { content: text });
      setNotes((prev) => ({
        ...prev,
        [id]: { text, saved: text, editing: false },
      }));
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <svg className="animate-spin h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">No check-ins yet</p>
        <p className="text-xs text-gray-400 mt-1">Complete your first check-in to see your trend.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Sentiment Trend</h2>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                labelStyle={{ color: '#6b7280' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#f97316"
                strokeWidth={2}
                dot={<Dot r={4} fill="#38bdf8" stroke="#38bdf8" />}
                activeDot={{ r: 5, fill: '#f97316' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History list */}
      <div className="px-4 pb-4 space-y-2 mt-2">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Past Check-ins</h2>
        {history.map((entry) => {
          const isOpen = expanded.has(entry.id);
          const note = notes[entry.id];
          const date = new Date(entry.completedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          return (
            <div key={entry.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleExpand(entry.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-gray-50 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{date}</span>
                  <ScoreBadge score={entry.sentimentScore} />
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  {entry.questions.map((q, i) => {
                    const label = q.startsWith('slider:')
                      ? `${q.slice(7)} (rated ${entry.responses?.[i] ?? '—'}/5)`
                      : q.startsWith('text:')
                      ? q.slice(5)
                      : q;
                    const response = q.startsWith('slider:')
                      ? null  // shown inline in label
                      : entry.responses?.[i] || '—';
                    return (
                      <div key={i} className="pt-2">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
                        {response && (
                          <p className="text-xs text-gray-700 leading-relaxed">{response}</p>
                        )}
                      </div>
                    );
                  })}

                  {/* Note section */}
                  <div className="pt-2 border-t border-gray-200">
                    {note?.saved && !note.editing && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">Your note</p>
                        <p className="text-xs text-gray-700">{note.saved}</p>
                      </div>
                    )}
                    {note?.editing ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={note.text}
                          onChange={(e) =>
                            setNotes((prev) => ({
                              ...prev,
                              [entry.id]: { ...prev[entry.id], text: e.target.value },
                            }))
                          }
                          placeholder="Add a note…"
                          rows={2}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => void saveNote(entry.id)}
                            className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={() =>
                              setNotes((prev) => ({
                                ...prev,
                                [entry.id]: { ...prev[entry.id], editing: false },
                              }))
                            }
                            className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startNote(entry.id)}
                        className="text-xs text-sky-500 hover:text-sky-600 font-medium transition"
                      >
                        + Add note
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

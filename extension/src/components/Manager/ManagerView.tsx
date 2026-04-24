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
import { SentimentTrend } from '../../types/index';

interface Report {
  id: string;
  name: string;
  email: string;
  latestScore: number | null;
  atRisk: boolean;
}

interface TrendData {
  date: string;
  score: number;
}

export default function ManagerView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trends, setTrends] = useState<Record<string, TrendData[]>>({});
  const [loadingTrend, setLoadingTrend] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get('/api/manager/reports');
        setReports((res.data.reports as Report[]) || []);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const handleToggle = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!trends[id]) {
      setLoadingTrend(id);
      try {
        const res = await apiClient.get(`/api/manager/reports/${id}/trend`);
        const raw: SentimentTrend[] = (res.data.trend as SentimentTrend[]) || [];
        setTrends((prev) => ({
          ...prev,
          [id]: raw.map((t) => ({
            date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            score: t.score,
          })),
        }));
      } catch {
        // ignore
      } finally {
        setLoadingTrend(null);
      }
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

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">No direct reports</p>
        <p className="text-xs text-gray-400 mt-1">Your team members will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Direct Reports</h2>
        <div className="space-y-2">
          {reports.map((report) => {
            const isOpen = expandedId === report.id;
            const trendData = trends[report.id];
            const isLoadingThis = loadingTrend === report.id;

            return (
              <div key={report.id} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => void handleToggle(report.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 bg-white hover:bg-gray-50 transition text-left"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sky-600 font-semibold text-sm">
                      {report.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{report.name}</span>
                      {report.atRisk && (
                        <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">
                          At Risk
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{report.email}</p>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {report.latestScore !== null && (
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          report.latestScore >= 4
                            ? 'bg-green-100 text-green-700'
                            : report.latestScore >= 2
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {report.latestScore.toFixed(1)}
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mt-2 mb-2">Sentiment Trend</p>
                    {isLoadingThis ? (
                      <div className="flex items-center justify-center h-24">
                        <svg className="animate-spin h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : trendData && trendData.length > 0 ? (
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 9, fill: '#9ca3af' }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              domain={[1, 5]}
                              ticks={[1, 2, 3, 4, 5]}
                              tick={{ fontSize: 9, fill: '#9ca3af' }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip
                              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="#f97316"
                              strokeWidth={2}
                              dot={<Dot r={3} fill="#38bdf8" stroke="#38bdf8" />}
                              activeDot={{ r: 4, fill: '#f97316' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 py-4 text-center">No check-in data yet.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

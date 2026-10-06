import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOverview } from '../api/analytics';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import TrendLineChart from '../components/charts/TrendLineChart';
import BarList from '../components/charts/BarList';
import PriorityBreakdown from '../components/charts/PriorityBreakdown';
import ChatbotAnalytics from '../components/ChatbotAnalytics';
import { cardClass } from '../lib/ui';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

const VIEWS = [
  {
    key: 'tickets',
    product: 'desk',
    label: 'Tickets',
    subtitle: 'Ticket volume and performance trends',
  },
  {
    key: 'chatbot',
    product: 'chat',
    label: 'Chatbot',
    subtitle: 'What the chat widget handled, and what it passed to the team',
  },
];

function formatHours(hours) {
  if (hours === null || hours === undefined) return null;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function DashboardPage() {
  const { token, hasProduct } = useAuth();
  const [params, setParams] = useSearchParams();
  const views = VIEWS.filter((v) => hasProduct(v.product));
  const view = views.find((v) => v.key === params.get('view')) || views[0] || VIEWS[0];
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (view.key !== 'tickets') return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getOverview(token, days)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load analytics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, days, view.key]);

  const selectView = (key) => {
    const next = new URLSearchParams(params);
    if (key === views[0].key) next.delete('view');
    else next.set('view', key);
    setParams(next, { replace: true });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">{view.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {views.length > 1 && (
            <div role="tablist" aria-label="Dashboard view" className="inline-flex rounded-lg bg-gray-100 p-1">
              {views.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={v.key === view.key}
                  onClick={() => selectView(v.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    v.key === view.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view.key === 'chatbot' ? (
        <ChatbotAnalytics days={days} />
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="transition-opacity" style={{ opacity: loading && overview ? 0.5 : 1 }}>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Tickets created" value={overview ? overview.totals.ticketsCreated : null} tone="blue" />
              <StatCard
                label="Tickets resolved"
                value={overview ? overview.totals.ticketsResolved : null}
                tone="emerald"
              />
              <StatCard
                label="Avg first response"
                value={overview ? (formatHours(overview.totals.avgFirstResponseHours) ?? '-') : null}
                tone="amber"
              />
              <StatCard
                label="Avg resolution time"
                value={overview ? (formatHours(overview.totals.avgResolutionHours) ?? '-') : null}
                tone="gray"
              />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className={`${cardClass} col-span-1 p-5 lg:col-span-2`}>
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Tickets created vs. resolved</h2>
                {overview && (
                  <TrendLineChart
                    data={overview.trend}
                    series={[
                      {
                        key: 'ticketsCreated',
                        label: 'Created',
                        color: '#4f46e5',
                      },
                      {
                        key: 'ticketsResolved',
                        label: 'Resolved',
                        color: '#059669',
                      },
                    ]}
                  />
                )}
              </div>

              <div className={`${cardClass} p-5`}>
                <h2 className="mb-4 text-sm font-semibold text-gray-900">By priority</h2>
                {overview && <PriorityBreakdown data={overview.byPriority} />}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={`${cardClass} p-5`}>
                <h2 className="mb-4 text-sm font-semibold text-gray-900">By category</h2>
                {overview && (
                  <BarList
                    data={overview.byCategory.map((row) => ({
                      label: row.category,
                      value: row.ticketsCreated,
                    }))}
                    color="#4f46e5"
                  />
                )}
              </div>

              <div className={`${cardClass} p-5`}>
                <h2 className="mb-4 text-sm font-semibold text-gray-900">By agent</h2>
                {overview && (
                  <BarList
                    data={overview.byAgent.map((row) => ({
                      label: row.agent,
                      value: row.ticketsCreated,
                    }))}
                    color="#4f46e5"
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;

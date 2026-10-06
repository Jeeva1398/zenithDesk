import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getChatbotOverview } from '../api/analytics';
import { useAuth } from '../context/AuthContext';
import StatCard from './StatCard';
import TrendLineChart from './charts/TrendLineChart';
import BarList from './charts/BarList';
import { cardClass } from '../lib/ui';

function percent(rate) {
  return rate === null || rate === undefined ? '-' : `${Math.round(rate * 100)}%`;
}

function formatWait(seconds) {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m`;
}

// How often a question was missed, and how: no answer found, or an answer
// that did not help.
function gapLabel({ count, unanswered }) {
  const unhelpful = count - unanswered;
  const parts = [];
  if (unanswered) parts.push(`${unanswered} unanswered`);
  if (unhelpful) parts.push(`${unhelpful} didn't help`);
  return `Asked ${count}× · ${parts.join(', ')}`;
}

// One labelled number in a card's breakdown.
function Figure({ label, value, hint }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-gray-900">{value}</dd>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// The Chatbot tab on the dashboard: what the chat widget's bot handled on its
// own, what it passed to the team, and what visitors asked that the knowledge
// base could not answer.
function ChatbotAnalytics({ days }) {
  const { token, hasProduct } = useAuth();
  // Without Desk the bot raises no tickets, so they are left out of the numbers.
  const hasDesk = hasProduct('desk');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getChatbotOverview(token, days)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load chatbot analytics.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, days]);

  const totals = data?.totals;

  return (
    <div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="transition-opacity" style={{ opacity: loading && data ? 0.5 : 1 }}>
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Conversations" value={totals ? totals.conversations : null} tone="blue" />
          <StatCard
            label="Handled by the bot"
            value={totals ? percent(totals.handledByBotRate) : null}
            tone="emerald"
          />
          {hasDesk ? (
            <StatCard label="Tickets raised" value={totals ? totals.tickets : null} tone="amber" />
          ) : (
            <StatCard label="Enquiries taken" value={totals ? totals.enquiries : null} tone="amber" />
          )}
          <StatCard
            label="Replies rated helpful"
            value={data ? percent(data.ratings.satisfaction) : null}
            tone="gray"
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className={`${cardClass} col-span-1 p-5 lg:col-span-2`}>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Conversations vs. passed to the team</h2>
            {data && (
              <TrendLineChart
                data={data.trend}
                series={[
                  {
                    key: 'conversations',
                    label: 'Conversations',
                    color: '#4f46e5',
                  },
                  {
                    key: 'escalated',
                    label: hasDesk ? 'To a ticket or person' : 'To a person',
                    color: '#d97706',
                  },
                ]}
              />
            )}
          </div>

          <div className={`${cardClass} p-5`}>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Where conversations went</h2>
            {data && (
              <BarList
                data={[
                  { label: 'Settled by the bot', value: totals.handledByBot },
                  ...(hasDesk ? [{ label: 'Tickets', value: totals.tickets }] : []),
                  { label: 'Asked for a person', value: totals.handoffs },
                  { label: 'Enquiries', value: totals.enquiries },
                ]}
                color="#4f46e5"
              />
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={`${cardClass} p-5`}>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Knowledge base answers</h2>
            {data && (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Figure label="Answered" value={data.knowledge.answered} />
                <Figure
                  label="Helped"
                  value={percent(data.knowledge.helpfulRate)}
                  hint={`${data.knowledge.helpful} said so`}
                />
                <Figure label="Didn't help" value={data.knowledge.notHelpful} />
                <Figure label="No answer found" value={data.knowledge.noAnswer} />
              </dl>
            )}
          </div>

          <div className={`${cardClass} p-5`}>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Live chat</h2>
            {data && (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Figure label="Requested" value={data.liveChats.total} />
                <Figure label="Answered" value={data.liveChats.answered} />
                <Figure label="Missed" value={data.liveChats.missed} />
                <Figure label="Avg wait to join" value={formatWait(data.liveChats.avgWaitSeconds)} />
              </dl>
            )}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Questions the knowledge base missed</h2>
            <Link to="/settings?tab=knowledge" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
              Write an article
            </Link>
          </div>
          {data &&
            (data.knowledgeGaps.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                Nothing yet. Questions the bot couldn&apos;t answer, or answered without helping, show here.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.knowledgeGaps.map((gap) => (
                  <li key={gap.question} className="flex items-start justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{gap.question}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {gapLabel(gap)}
                        {gap.coveredBy && (
                          <span className="text-emerald-700"> · Covered since by “{gap.coveredBy.title}”</span>
                        )}
                      </p>
                    </div>
                    {!gap.coveredBy && (
                      <Link
                        to={`/settings?tab=knowledge&draft=${encodeURIComponent(gap.question)}`}
                        className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        Write article
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>
    </div>
  );
}

export default ChatbotAnalytics;

import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createView, deleteView, listViews } from '../api/views';
import { navItemActiveClass, navItemClass } from '../lib/ui';

function paramsToFilters(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

function filtersToSearch(filters) {
  return new URLSearchParams(filters).toString();
}

function ViewsPanel() {
  const { token, agent } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [views, setViews] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadViews = async () => {
    try {
      const result = await listViews(token);
      setViews(result.views);
    } catch {
      // Non-critical — quick views still work if saved views fail to load.
    }
  };

  useEffect(() => {
    loadViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickViews = [
    { label: 'My tickets', filters: { assignedAgentId: String(agent?.id ?? '') } },
    { label: 'Unassigned', filters: { assignedAgentId: 'unassigned' } },
    { label: 'Open tickets', filters: { status: 'open' } },
    { label: 'All tickets', filters: {} },
  ];

  const isActive = (filters) => filtersToSearch(filters) === searchParams.toString();

  const handleSaveView = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await createView(token, { name, filters: paramsToFilters(searchParams) });
      setName('');
      setShowForm(false);
      await loadViews();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteView = async (id) => {
    try {
      await deleteView(token, id);
      await loadViews();
    } catch {
      // Non-critical — leave the stale entry, user can retry.
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50/60 px-3 py-5">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Quick views
      </p>
      <nav className="mb-6 flex flex-col gap-0.5">
        {quickViews.map((view) => (
          <Link
            key={view.label}
            to={`/tickets${filtersToSearch(view.filters) ? `?${filtersToSearch(view.filters)}` : ''}`}
            className={
              location.pathname === '/tickets' && isActive(view.filters)
                ? navItemActiveClass
                : navItemClass
            }
          >
            {view.label}
          </Link>
        ))}
      </nav>

      <div className="mb-2 flex items-center justify-between px-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Saved views</p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-label="Save current filters as a view"
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSaveView} className="mb-3 flex flex-col gap-2 px-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="View name"
            required
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save current filters'}
          </button>
        </form>
      )}

      <nav className="flex flex-col gap-0.5">
        {views.length === 0 && !showForm && (
          <p className="px-3 text-xs text-gray-400">No saved views yet.</p>
        )}
        {views.map((view) => (
          <div key={view.id} className="group flex items-center">
            <Link
              to={`/tickets${filtersToSearch(view.filters) ? `?${filtersToSearch(view.filters)}` : ''}`}
              className={`flex-1 ${
                location.pathname === '/tickets' && isActive(view.filters)
                  ? navItemActiveClass
                  : navItemClass
              }`}
            >
              {view.name}
            </Link>
            <button
              type="button"
              onClick={() => handleDeleteView(view.id)}
              aria-label={`Delete view ${view.name}`}
              className="hidden rounded p-1 text-gray-300 hover:bg-gray-200 hover:text-gray-600 group-hover:block"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}

export default ViewsPanel;

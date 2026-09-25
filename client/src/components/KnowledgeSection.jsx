import { useEffect, useState } from 'react';
import {
  createArticle,
  deleteArticle,
  listArticles,
  searchKnowledge,
  updateArticle,
} from '../api/knowledge';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';
import Modal from './Modal';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../lib/ui';

const emptyForm = { title: '', body: '', isPublished: true };

function excerpt(text, length = 140) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

// "Try a question" runs the same search the chatbot does, so an admin can see
// which article a customer's wording would reach before a customer does.
function SearchPreview({ token }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setError('');
    try {
      setResults((await searchKnowledge(token, query)).results);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <p className={labelClass}>Try a question</p>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. I was charged twice this month"
          className={inputClass}
        />
        <button type="submit" className={secondaryButtonClass}>
          Search
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {results && (
        <div className="mt-3 flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">
              No published article matches - the chatbot would go straight to raising a ticket.
            </p>
          ) : (
            results.map((r) => (
              <div key={`${r.articleId}-${r.text.slice(0, 20)}`} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <p className="font-medium text-gray-900">
                  {r.title} <span className="font-normal text-gray-400">· score {r.score}</span>
                </p>
                <p className="mt-0.5 text-gray-600">{excerpt(r.text, 200)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function KnowledgeSection() {
  const { token, agent } = useAuth();
  const isAdmin = agent?.role === 'admin';

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setArticles((await listArticles(token)).articles);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing('new');
    setForm(emptyForm);
    setFormError('');
  };

  const openEdit = (article) => {
    setEditing(article);
    setForm({ title: article.title, body: article.body, isPublished: article.is_published });
    setFormError('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await createArticle(token, form);
      } else {
        await updateArticle(token, editing.id, form);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (article) => {
    if (!window.confirm(`Delete "${article.title}"? The chatbot stops using it immediately.`)) return;
    try {
      await deleteArticle(token, article.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`${cardClass} mb-8 p-5`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Knowledge base</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Answers the chat widget can give before raising a ticket. It only ever answers from
            published articles, and offers a ticket whenever they do not cover the question. Write
            them plainly: a line like "not covered here" can be read as "not covered by us".
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={openCreate} className={primaryButtonClass}>
            Add article
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : articles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          No articles yet. Start with the questions your team answers most often.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {articles.map((article) => (
            <li key={article.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  {article.title}
                  {!article.is_published && <Badge value="draft" />}
                </p>
                <p className="mt-0.5 text-sm text-gray-500">{excerpt(article.body)}</p>
              </div>
              {isAdmin && (
                <div className="flex flex-shrink-0 gap-2">
                  <button type="button" onClick={() => openEdit(article)} className={secondaryButtonClass}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(article)} className={secondaryButtonClass}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {articles.length > 0 && <SearchPreview token={token} />}

      {editing && (
        <Modal title={editing === 'new' ? 'Add article' : 'Edit article'} onClose={() => setEditing(null)}>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Title</label>
              <input
                value={form.title}
                maxLength={200}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Refunds and double charges"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Answer</label>
              <textarea
                value={form.body}
                rows={10}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write it the way you would answer a customer. Separate topics with a blank line."
                className={inputClass}
                required
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
              Published - the chatbot may answer from it
            </label>
            {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? 'Saving…' : 'Save article'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default KnowledgeSection;

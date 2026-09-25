const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const kbSearch = require('./kbSearch');

const MAX_TITLE = 200;
const MAX_BODY = 50_000;
const MAX_ARTICLES = 200;
const COLUMNS = 'id, title, body, is_published, created_at, updated_at';

// A query is one customer message; anything longer than this is not a
// question worth ranking against, and keeps a huge body from costing a scan.
const MAX_QUERY = 1000;
const MAX_RESULTS = 5;

// The index is rebuilt only when the org's articles have changed. The version
// check is one cheap aggregate per search; rebuilding costs a read of every
// published article, which for a few hundred FAQs is still milliseconds, but
// is not worth paying on every chat message. Writes also drop the org's entry
// outright: updated_at is to the second, so an edit landing in the same second
// as the last one would not move the version.
const indexCache = new Map();

function validate({ title, body, isPublished }, { partial }) {
  const fields = {};

  if (title !== undefined || !partial) {
    if (typeof title !== 'string' || !title.trim()) throw new ApiError(400, 'title is required');
    if (title.trim().length > MAX_TITLE) throw new ApiError(400, `title must be at most ${MAX_TITLE} characters`);
    fields.title = title.trim();
  }
  if (body !== undefined || !partial) {
    if (typeof body !== 'string' || !body.trim()) throw new ApiError(400, 'body is required');
    if (body.length > MAX_BODY) throw new ApiError(400, `body must be at most ${MAX_BODY} characters`);
    fields.body = body.trim();
  }
  if (isPublished !== undefined) {
    if (typeof isPublished !== 'boolean') throw new ApiError(400, 'isPublished must be true or false');
    fields.is_published = isPublished;
  }

  if (partial && Object.keys(fields).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }
  return fields;
}

function present(row) {
  return { ...row, is_published: Boolean(row.is_published) };
}

async function listArticles(orgId) {
  const rows = await forOrg(orgId).list('kb_articles', {}, { columns: COLUMNS, orderBy: 'title ASC' });
  return { articles: rows.map(present) };
}

async function createArticle(orgId, input) {
  const db = forOrg(orgId);
  if ((await db.count('kb_articles')) >= MAX_ARTICLES) {
    throw new ApiError(409, `A knowledge base can hold at most ${MAX_ARTICLES} articles`);
  }
  const id = await db.insert('kb_articles', validate(input, { partial: false }));
  indexCache.delete(orgId);
  return present(await db.get('kb_articles', id, 'Article not found', { columns: COLUMNS }));
}

async function updateArticle(orgId, articleId, input) {
  const db = forOrg(orgId);
  await db.update('kb_articles', articleId, validate(input, { partial: true }), 'Article not found');
  indexCache.delete(orgId);
  return present(await db.get('kb_articles', articleId, 'Article not found', { columns: COLUMNS }));
}

async function deleteArticle(orgId, articleId) {
  await forOrg(orgId).remove('kb_articles', articleId, 'Article not found');
  indexCache.delete(orgId);
}

async function indexFor(orgId) {
  const db = forOrg(orgId);
  const [version] = await db.sql(
    `SELECT COUNT(*) AS n, MAX(updated_at) AS latest FROM kb_articles
     WHERE org_id = :orgId AND is_published = 1`,
  );
  const key = `${version.n}:${version.latest ? new Date(version.latest).getTime() : 0}`;

  const cached = indexCache.get(orgId);
  if (cached && cached.key === key) return cached.index;

  const articles = await db.list('kb_articles', { is_published: 1 }, { columns: 'id, title, body' });
  const index = kbSearch.buildIndex(articles);
  indexCache.set(orgId, { key, index });
  return index;
}

async function search(orgId, { query, limit }) {
  if (typeof query !== 'string' || !query.trim()) {
    throw new ApiError(400, 'query is required');
  }
  const n = limit === undefined ? 4 : Number(limit);
  if (!Number.isInteger(n) || n < 1 || n > MAX_RESULTS) {
    throw new ApiError(400, `limit must be a whole number between 1 and ${MAX_RESULTS}`);
  }

  const index = await indexFor(orgId);
  return { results: kbSearch.search(index, query.slice(0, MAX_QUERY), { limit: n }) };
}

module.exports = { listArticles, createArticle, updateArticle, deleteArticle, search };

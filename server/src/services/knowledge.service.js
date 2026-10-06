const crypto = require('crypto');
const { forOrg } = require('../db/orgScope');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const embeddings = require('./embeddings');
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

// Passages are embedded in the background, a batch at a time, never while a
// customer waits: until a passage has its vector it is found by keywords
// only. One job per org at a time.
const EMBED_BATCH = 16;
const embedJobs = new Map();

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
  await attachVectors(db, index);
  indexCache.set(orgId, { key, index });
  syncVectors(orgId, index);
  return index;
}

function hashOf(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function attachVectors(db, index) {
  if (!embeddings.enabled()) return;
  for (const passage of index.passages) passage.hash = hashOf(kbSearch.embeddingText(passage));
  const rows = await db.sql(
    'SELECT content_hash, vector FROM kb_passage_embeddings WHERE org_id = :orgId AND model = ?',
    [embeddings.MODEL],
  );
  const stored = new Map(rows.map((row) => [row.content_hash, row.vector]));
  for (const passage of index.passages) {
    const vector = stored.get(passage.hash);
    if (vector) passage.vector = embeddings.fromBuffer(vector);
  }
}

// Embeds the passages that have no vector yet, straight into the cached
// index as well as the table, then drops stored vectors no current passage
// uses - an edited paragraph's old text, or a deleted article's.
function syncVectors(orgId, index) {
  if (!embeddings.available() || embedJobs.has(orgId)) return;
  const job = (async () => {
    const db = forOrg(orgId);
    const missing = index.passages.filter((p) => !p.vector);
    for (let i = 0; i < missing.length; i += EMBED_BATCH) {
      const batch = missing.slice(i, i + EMBED_BATCH);
      const vectors = await embeddings.embedDocuments(batch.map(kbSearch.embeddingText));
      for (const [n, passage] of batch.entries()) {
        await db.sql(
          `INSERT INTO kb_passage_embeddings (org_id, model, content_hash, vector, created_at, updated_at)
           VALUES (:orgId, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE vector = VALUES(vector), updated_at = NOW()`,
          [embeddings.MODEL, passage.hash, embeddings.toBuffer(vectors[n])],
        );
        passage.vector = vectors[n];
      }
    }
    const hashes = [...new Set(index.passages.map((p) => p.hash))];
    await db.sql(
      `DELETE FROM kb_passage_embeddings WHERE org_id = :orgId
       AND (model <> ?${hashes.length ? ' OR content_hash NOT IN (?)' : ' OR 1 = 1'})`,
      hashes.length ? [embeddings.MODEL, hashes] : [embeddings.MODEL],
    );
    if (missing.length) logger.info(`Embedded ${missing.length} knowledge passages for org ${orgId}`);
  })()
    .catch((err) => logger.warn(`Embedding knowledge passages for org ${orgId} stopped: ${err.message}`))
    .finally(() => embedJobs.delete(orgId));
  embedJobs.set(orgId, job);
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
  const text = query.slice(0, MAX_QUERY);
  // A job that stopped part way (Ollama was down) is picked up again here.
  if (index.passages.some((p) => !p.vector)) syncVectors(orgId, index);
  const queryVector = index.passages.some((p) => p.vector) ? await embeddings.embedQuery(text) : null;
  return { results: kbSearch.search(index, text, { limit: n, queryVector }) };
}

// The chatbot sends a question to its model when the best passage shares a
// quarter of the question's words, or is this close in meaning.
const MIN_COVERAGE = 0.25;

// For a question the bot missed: the published article written or edited
// since it was last asked that the search now leads to, if there is one - so
// the dashboard can show which gaps have been dealt with.
async function newerArticleFor(orgId, question, since) {
  const { results } = await search(orgId, { query: question, limit: 3 });
  const candidates = results.filter((r) => r.coverage >= MIN_COVERAGE || r.similarity >= kbSearch.MIN_SIMILARITY);
  if (candidates.length === 0) return null;
  const rows = await forOrg(orgId).sql(
    'SELECT id, title, updated_at FROM kb_articles WHERE org_id = :orgId AND id IN (?)',
    [candidates.map((r) => r.articleId)],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const match = candidates
    .map((r) => byId.get(r.articleId))
    .find((a) => a && new Date(a.updated_at) >= new Date(since));
  return match ? { id: match.id, title: match.title } : null;
}

module.exports = { listArticles, createArticle, updateArticle, deleteArticle, search, newerArticleFor };

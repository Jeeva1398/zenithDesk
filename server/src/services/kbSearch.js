// Search over an org's knowledge base: articles cut into passages, ranked
// with BM25 and, when the passages carry embedding vectors, by meaning too.
// Pure functions - no database, no model calls - so the ranking can be tested
// on its own.
//
// Not MySQL FULLTEXT: InnoDB weighs a term by how rare it is across the whole
// index, i.e. across every org's rows, so one tenant's results would shift
// with another tenant's content - and a word present in all of a small org's
// articles scores zero.

const PASSAGE_TARGET_CHARS = 800;
const PASSAGE_MAX_CHARS = 1200;

// BM25's usual constants: k1 caps how much a repeated word keeps counting,
// b how much long passages are penalised for matching by sheer length.
const K1 = 1.2;
const B = 0.75;

const STOPWORDS = new Set(
  (
    'a an and are as at be but by can could did do does for from had has have how i if in into is it its ' +
    'me my no not of on or our so that the their them then there these they this to too was we were what ' +
    'when where which who why will with would you your hi hello hey please thanks thank im ive dont cant'
  ).split(' '),
);

// Lowercase words, apostrophes dropped ("don't" -> "dont"), then a light
// suffix trim so the forms of a word meet at one root: delete, deleted,
// deleting and deletion all become "delet"; invoice and invoices "invoic".
// Deliberately crude - one suffix, then a trailing e - which is good enough
// for FAQs and, above all, predictable.
const SUFFIXES = [
  ['ies', 'y', 4],
  ['ing', '', 4],
  ['ion', '', 5],
  ['ed', '', 3],
  ['es', '', 3],
  ['s', '', 3],
];

function stem(word) {
  let root = word;
  for (const [suffix, replacement, minLength] of SUFFIXES) {
    if (root.length > minLength && root.endsWith(suffix) && !(suffix === 's' && root.endsWith('ss'))) {
      root = root.slice(0, -suffix.length) + replacement;
      break;
    }
  }
  return root.length > 3 && root.endsWith('e') ? root.slice(0, -1) : root;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

// Cuts on paragraph breaks, packing paragraphs up to the target size so a
// passage reads as a whole thought. A paragraph longer than the maximum is
// split on sentence ends. Each passage carries its article's title, since the
// title is often the best match for a question ("How do I reset my password?").
function toPassages(article) {
  const paragraphs = article.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length <= PASSAGE_MAX_CHARS ? [p] : p.match(/[^.!?]+[.!?]*\s*/g) || [p]));

  const passages = [];
  let current = '';
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > PASSAGE_TARGET_CHARS) {
      passages.push(current.trim());
      current = '';
    }
    current += `${paragraph}\n\n`;
  }
  if (current.trim()) passages.push(current.trim());

  return passages.map((text, ordinal) => ({
    articleId: article.id,
    title: article.title,
    ordinal,
    text,
    terms: tokenize(`${article.title} ${text}`),
  }));
}

function buildIndex(articles) {
  const passages = articles.flatMap(toPassages);
  const documentFrequency = new Map();
  for (const passage of passages) {
    for (const term of new Set(passage.terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }
  const averageLength = passages.reduce((sum, p) => sum + p.terms.length, 0) / (passages.length || 1);
  return { passages, documentFrequency, averageLength };
}

// A passage counts as a match by meaning only above this cosine similarity,
// and only when it is near the best one - nomic-embed-text puts unrelated
// text around 0.35-0.5 and a real match at 0.6 and up, but which side of the
// line the middle falls on varies with the question.
const MIN_SIMILARITY = 0.55;
const SIMILARITY_MARGIN = 0.06;
// Reciprocal rank fusion: each ranking adds 1 / (RRF_K + rank). Ranks rather
// than raw scores, since a BM25 score and a cosine are not on any common scale.
const RRF_K = 60;

function keywordScores(index, queryTerms) {
  const total = index.passages.length;
  return index.passages.map((passage) => {
    const counts = new Map();
    for (const term of passage.terms) counts.set(term, (counts.get(term) || 0) + 1);

    let score = 0;
    let matched = 0;
    for (const term of queryTerms) {
      const tf = counts.get(term);
      if (!tf) continue;
      matched += 1;
      const df = index.documentFrequency.get(term);
      // The +1 inside the log keeps a word found in every passage from
      // scoring zero or less - the failure InnoDB's version has.
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      score += (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * passage.terms.length) / index.averageLength));
    }
    return { score, coverage: queryTerms.length ? matched / queryTerms.length : 0 };
  });
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

// Vectors are stored at unit length, so the dot product is the cosine.
function similarities(index, queryVector) {
  return index.passages.map((p) =>
    queryVector && p.vector && p.vector.length === queryVector.length ? dot(p.vector, queryVector) : null,
  );
}

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

function search(index, query, { limit = 4, queryVector = null, minSimilarity = MIN_SIMILARITY } = {}) {
  const queryTerms = [...new Set(tokenize(query))];
  if (index.passages.length === 0 || (queryTerms.length === 0 && !queryVector)) return [];

  const keyword = keywordScores(index, queryTerms);
  const similarity = similarities(index, queryVector);
  const best = Math.max(-1, ...similarity.filter((s) => s !== null));

  const rows = index.passages.map((passage, i) => ({
    passage,
    score: keyword[i].score,
    coverage: keyword[i].coverage,
    similarity: similarity[i],
    byMeaning: similarity[i] !== null && similarity[i] >= minSimilarity && similarity[i] >= best - SIMILARITY_MARGIN,
    fused: 0,
  }));

  const byKeyword = rows.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  const bySemantics = rows.filter((r) => r.byMeaning).sort((a, b) => b.similarity - a.similarity);
  byKeyword.forEach((r, rank) => {
    r.fused += 1 / (RRF_K + rank + 1);
  });
  bySemantics.forEach((r, rank) => {
    r.fused += 1 / (RRF_K + rank + 1);
  });

  return rows
    .filter((r) => r.fused > 0)
    .sort((a, b) => b.fused - a.fused || b.score - a.score)
    .slice(0, limit)
    .map(({ passage, score, coverage, similarity: s }) => ({
      articleId: passage.articleId,
      title: passage.title,
      text: passage.text,
      score: round(score, 3),
      coverage: round(coverage, 2),
      similarity: s === null ? null : round(s, 3),
    }));
}

// What gets embedded for a passage, and hashed to find its stored vector.
function embeddingText(passage) {
  return `${passage.title}\n\n${passage.text}`;
}

module.exports = { tokenize, toPassages, buildIndex, search, embeddingText, MIN_SIMILARITY };

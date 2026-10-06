const logger = require('../config/logger');

// Embeddings from a local Ollama, used to rank knowledge-base passages by
// meaning. Optional by design: when the model is off, missing or slow, the
// search carries on with keywords alone, so nothing here may throw into a
// customer's request.

const HOST = (process.env.EMBED_OLLAMA_HOST || process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/+$/, '');
const MODEL = process.env.EMBED_MODEL === undefined ? 'nomic-embed-text' : process.env.EMBED_MODEL.trim();
const QUERY_TIMEOUT_MS = Number(process.env.EMBED_QUERY_TIMEOUT_MS) || 2000;
const BATCH_TIMEOUT_MS = 60_000;
// After a failure Ollama is left alone for this long, so a stopped Ollama
// costs one timeout per minute rather than one per chat message.
const RETRY_AFTER_MS = 60_000;

let unavailableUntil = 0;

function enabled() {
  return Boolean(MODEL) && MODEL.toLowerCase() !== 'none';
}

function available() {
  return enabled() && Date.now() >= unavailableUntil;
}

// nomic-embed-text is trained with these task prefixes and ranks noticeably
// worse without them; other models take the text as it is.
function prefixed(kind, texts) {
  if (!MODEL.startsWith('nomic-embed')) return texts;
  const prefix = kind === 'query' ? 'search_query: ' : 'search_document: ';
  return texts.map((t) => prefix + t);
}

function unitLength(values) {
  const vector = Float32Array.from(values);
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
}

async function embed(kind, texts, timeoutMs) {
  const res = await fetch(`${HOST}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: prefixed(kind, texts) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { embeddings } = await res.json();
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error('Ollama embed returned the wrong number of vectors');
  }
  return embeddings.map(unitLength);
}

function markUnavailable(err) {
  if (Date.now() >= unavailableUntil) {
    logger.warn(`Embeddings unavailable, searching by keywords only for now: ${err.message}`);
  }
  unavailableUntil = Date.now() + RETRY_AFTER_MS;
}

// One question, on the customer's clock: a short timeout, and null on any
// failure.
async function embedQuery(text) {
  if (!available()) return null;
  try {
    return (await embed('query', [text], QUERY_TIMEOUT_MS))[0];
  } catch (err) {
    markUnavailable(err);
    return null;
  }
}

// Passages, in the background. Throws, so the caller can stop the batch.
async function embedDocuments(texts) {
  try {
    return await embed('document', texts, BATCH_TIMEOUT_MS);
  } catch (err) {
    markUnavailable(err);
    throw err;
  }
}

function toBuffer(vector) {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

function fromBuffer(buffer) {
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

module.exports = {
  MODEL,
  enabled,
  available,
  embedQuery,
  embedDocuments,
  toBuffer,
  fromBuffer,
};

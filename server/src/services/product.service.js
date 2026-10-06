const pool = require('../db/connection');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const { DEFAULT_POLICIES } = require('./sla.service');

// The two products an org can use. They share the org, its agents, customers
// and knowledge base; what each adds is gated on the org having it.
const PRODUCTS = ['desk', 'chat'];
const PRODUCT_NAMES = { desk: 'ZenithDesk Desk', chat: 'ZenithDesk Chat' };

// Asked on nearly every request, and changed only when an admin turns a
// product on, which clears this org's entry.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

function isProduct(value) {
  return PRODUCTS.includes(value);
}

async function listForOrg(orgId) {
  const cached = cache.get(orgId);
  if (cached && cached.expires > Date.now()) return cached.products;

  const rows = await forOrg(orgId).list('org_products', { status: { not: 'cancelled' } }, { columns: 'product' });
  // In PRODUCTS order, so the list reads the same whichever was turned on first.
  const products = PRODUCTS.filter((p) => rows.some((r) => r.product === p));
  cache.set(orgId, { products, expires: Date.now() + CACHE_TTL_MS });
  return products;
}

async function has(orgId, product) {
  return (await listForOrg(orgId)).includes(product);
}

async function assertHas(orgId, product) {
  if (!(await has(orgId, product))) {
    throw new ApiError(403, `${PRODUCT_NAMES[product]} is not enabled for this organization`, 'product_not_enabled');
  }
}

// What a product needs before its first request: Desk measures tickets against
// SLA targets, so an org never has Desk without them. Chat needs nothing - the
// widget row exists for every org from signup.
async function seed(connection, orgId, product) {
  if (product !== 'desk') return;
  const [existing] = await connection.query('SELECT 1 FROM sla_policies WHERE org_id = ? LIMIT 1', [orgId]);
  if (existing.length > 0) return;
  await connection.query(
    `INSERT INTO sla_policies
       (org_id, priority, first_response_minutes, resolution_minutes, created_at, updated_at)
     VALUES ?`,
    [
      DEFAULT_POLICIES.map((p) => [
        orgId,
        p.priority,
        p.first_response_minutes,
        p.resolution_minutes,
        new Date(),
        new Date(),
      ]),
    ],
  );
}

async function enableWith(connection, orgId, product) {
  await connection.query(
    `INSERT INTO org_products (org_id, product, status, created_at, updated_at)
     VALUES (?, ?, 'active', NOW(), NOW())
     ON DUPLICATE KEY UPDATE status = 'active', updated_at = NOW()`,
    [orgId, product],
  );
  await seed(connection, orgId, product);
}

// Turns a product on, inside the caller's transaction when it passes its
// connection (signup), or in one of its own. Turning on one the org already
// has changes nothing.
async function enable(orgId, product, connection = null) {
  if (!isProduct(product)) {
    throw new ApiError(400, `product must be one of: ${PRODUCTS.join(', ')}`);
  }

  if (connection) {
    await enableWith(connection, orgId, product);
  } else {
    const own = await pool.getConnection();
    try {
      await own.beginTransaction();
      await enableWith(own, orgId, product);
      await own.commit();
    } catch (err) {
      await own.rollback();
      throw err;
    } finally {
      own.release();
    }
  }

  cache.delete(orgId);
}

module.exports = { PRODUCTS, PRODUCT_NAMES, isProduct, listForOrg, has, assertHas, enable };

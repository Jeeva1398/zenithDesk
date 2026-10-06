const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { hashPassword } = require('../utils/password');
const { signToken, TOKEN_TYPES } = require('../utils/token');
const chatWidgetService = require('./chatWidget.service');
const refreshTokenService = require('./refreshToken.service');
const productService = require('./product.service');

// Which products a new org starts with. Signing up without saying gives both,
// which is what every org had before there was a choice.
function productsFor(requested) {
  if (requested === undefined || requested === null) return [...productService.PRODUCTS];
  if (
    !Array.isArray(requested) ||
    requested.length === 0 ||
    !requested.every(productService.isProduct)
  ) {
    throw new ApiError(400, `products must be a non-empty list of: ${productService.PRODUCTS.join(', ')}`);
  }
  return productService.PRODUCTS.filter((p) => requested.includes(p));
}

async function signup({ orgName, adminName, adminEmail, adminPassword, products: requested }) {
  const products = productsFor(requested);
  const [existing] = await pool.query('/* unscoped: agent email is globally unique, so this spans orgs */ SELECT id FROM agents WHERE email = ?', [adminEmail]);
  if (existing.length > 0) {
    throw new ApiError(409, 'An agent with this email already exists');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orgResult] = await connection.query(
      'INSERT INTO organizations (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
      [orgName],
    );
    const orgId = orgResult.insertId;

    const passwordHash = await hashPassword(adminPassword);
    const [agentResult] = await connection.query(
      `INSERT INTO agents (org_id, name, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', NOW(), NOW())`,
      [orgId, adminName, adminEmail, passwordHash],
    );

    // Inside the transaction, so an org never exists without what its
    // products need - Desk its SLA targets. Through the connection, since the
    // org scope helper uses the pool and would land outside the transaction.
    for (const product of products) {
      await productService.enable(orgId, product, connection);
    }

    // Every org has exactly one widget row, whatever it starts with, so its
    // embed key exists from the moment Chat is turned on.
    await chatWidgetService.seedDefaults(connection, orgId);

    await connection.commit();

    const agentId = agentResult.insertId;
    return {
      token: signToken({ typ: TOKEN_TYPES.AGENT, agentId, orgId, role: 'admin', email: adminEmail }),
      // Signing up signs you in, so it returns the same session shape as login -
      // otherwise the first short-lived access token would expire with nothing
      // to renew it. Issued after the commit, because the scope helper uses the
      // pool rather than this transaction's connection.
      refreshToken: await refreshTokenService.issue(orgId, agentId),
      agent: { id: agentId, orgId, orgName, name: adminName, email: adminEmail, role: 'admin', products },
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getOrganization(orgId) {
  const [rows] = await pool.query('SELECT id, name FROM organizations WHERE id = ?', [orgId]);
  if (rows.length === 0) {
    throw new ApiError(404, 'Organization not found');
  }
  return { id: rows[0].id, name: rows[0].name, products: await productService.listForOrg(orgId) };
}

async function enableProduct(orgId, product) {
  await productService.enable(orgId, product);
  return getOrganization(orgId);
}

module.exports = { signup, getOrganization, enableProduct };

const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

async function listCustomers(orgId) {
  const customers = await forOrg(orgId).sql(
    `SELECT u.id, u.name, u.email, u.created_at,
       COUNT(t.id) AS ticket_count,
       MAX(t.created_at) AS last_ticket_at
     FROM users u
     LEFT JOIN tickets t ON t.customer_id = u.id AND t.org_id = :orgId
     WHERE u.org_id = :orgId
     GROUP BY u.id
     ORDER BY u.name ASC`,
  );
  return { customers };
}

async function getCustomerById(orgId, customerId) {
  const db = forOrg(orgId);
  const customer = await db.get('users', customerId, 'Customer not found', {
    columns: 'id, name, email, created_at',
  });

  const tickets = await db.list(
    'tickets',
    { customer_id: customerId },
    { columns: 'id, subject, status, priority, created_at', orderBy: 'created_at DESC' },
  );

  return { ...customer, tickets };
}

async function createCustomer(orgId, { name, email }) {
  if (!name || !email) {
    throw new ApiError(400, 'name and email are required');
  }

  const db = forOrg(orgId);
  if (await db.exists('users', { email })) {
    throw new ApiError(409, 'A customer with this email already exists');
  }

  const customerId = await db.insert('users', { name, email });
  return getCustomerById(orgId, customerId);
}

async function updateCustomer(orgId, customerId, { name, email }) {
  const db = forOrg(orgId);

  if (email !== undefined && (await db.exists('users', { email, id: { not: customerId } }))) {
    throw new ApiError(409, 'Another customer already uses this email');
  }

  const updates = {};
  if (name !== undefined) {
    updates.name = name;
  }
  if (email !== undefined) {
    updates.email = email;
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  await db.update('users', customerId, updates, 'Customer not found');
  return getCustomerById(orgId, customerId);
}

async function deleteCustomer(orgId, customerId) {
  const db = forOrg(orgId);
  await db.get('users', customerId, 'Customer not found', { columns: 'id' });

  if ((await db.count('tickets', { customer_id: customerId })) > 0) {
    throw new ApiError(409, 'Cannot delete a customer with existing tickets');
  }

  await db.remove('users', customerId, 'Customer not found');
}

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};

require('dotenv').config();

const { faker } = require('@faker-js/faker');
const pool = require('./db/connection');
const logger = require('./config/logger');
const { hashPassword } = require('./utils/password');

const DEMO_PASSWORD = 'password123';

const ORG_COUNT = 2;
const AGENTS_PER_ORG = [3, 2];
const CUSTOMERS_PER_ORG = 8;
const TICKETS_PER_ORG = 15;

const CATEGORIES = ['Billing', 'Technical', 'Account', 'General'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'pending', 'resolved', 'closed'];

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function wipe(connection) {
  await connection.query('DELETE FROM ticket_comments');
  await connection.query('DELETE FROM tickets');
  await connection.query('DELETE FROM users');
  await connection.query('DELETE FROM agents');
  await connection.query('DELETE FROM organizations');
  await connection.query('DELETE FROM super_admins');
  await connection.query('ALTER TABLE ticket_comments AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE tickets AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE users AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE agents AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE organizations AUTO_INCREMENT = 1');
  await connection.query('ALTER TABLE super_admins AUTO_INCREMENT = 1');
}

async function seedSuperAdmin(connection) {
  const name = 'Platform Admin';
  const email = 'superadmin@zenithdesk.test';
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await connection.query(
    'INSERT INTO super_admins (name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
    [name, email, passwordHash],
  );
  return { name, email };
}

async function seedOrganization(connection, agentCount) {
  const orgName = faker.company.name();
  const [orgResult] = await connection.query(
    'INSERT INTO organizations (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
    [orgName],
  );
  const orgId = orgResult.insertId;

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const agents = [];
  for (let i = 0; i < agentCount; i += 1) {
    const name = faker.person.fullName();
    const email = faker.internet.email({ firstName: name.split(' ')[0] }).toLowerCase();
    const role = i === 0 ? 'admin' : 'agent';
    const [agentResult] = await connection.query(
      'INSERT INTO agents (org_id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [orgId, name, email, passwordHash, role],
    );
    agents.push({ id: agentResult.insertId, name, email, role });
  }

  const customers = [];
  for (let i = 0; i < CUSTOMERS_PER_ORG; i += 1) {
    const name = faker.person.fullName();
    const email = faker.internet.email({ firstName: name.split(' ')[0] }).toLowerCase();
    const [customerResult] = await connection.query(
      'INSERT INTO users (org_id, name, email, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [orgId, name, email],
    );
    customers.push({ id: customerResult.insertId, name, email });
  }

  for (let i = 0; i < TICKETS_PER_ORG; i += 1) {
    const customer = randomFrom(customers);
    const priority = randomFrom(PRIORITIES);
    const status = randomFrom(STATUSES);
    const assignedAgent = Math.random() > 0.3 ? randomFrom(agents) : null;
    const createdAt = faker.date.recent({ days: 30 });

    const [ticketResult] = await connection.query(
      `INSERT INTO tickets
         (org_id, customer_id, assigned_agent_id, subject, description, category, priority, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        customer.id,
        assignedAgent ? assignedAgent.id : null,
        faker.lorem.sentence({ min: 3, max: 8 }).replace(/\.$/, ''),
        faker.lorem.paragraph(),
        randomFrom(CATEGORIES),
        priority,
        status,
        createdAt,
        createdAt,
      ],
    );
    const ticketId = ticketResult.insertId;

    const commentCount = Math.floor(Math.random() * 4);
    for (let c = 0; c < commentCount; c += 1) {
      const authorAgent = randomFrom(agents);
      const commentAt = faker.date.between({ from: createdAt, to: new Date() });
      await connection.query(
        `INSERT INTO ticket_comments
           (org_id, ticket_id, author_agent_id, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orgId, ticketId, authorAgent.id, faker.lorem.sentences({ min: 1, max: 3 }), commentAt, commentAt],
      );
    }
  }

  return { orgName, agents };
}

async function seed() {
  const connection = await pool.getConnection();
  try {
    await wipe(connection);

    const summary = [];
    for (let i = 0; i < ORG_COUNT; i += 1) {
      summary.push(await seedOrganization(connection, AGENTS_PER_ORG[i] || 2));
    }
    const superAdmin = await seedSuperAdmin(connection);

    logger.info('Seed complete.');
    logger.info(`Demo password for all seeded agents and the super admin: ${DEMO_PASSWORD}`);
    summary.forEach(({ orgName, agents }) => {
      logger.info(`Organization: ${orgName}`);
      agents.forEach((agent) => logger.info(`  Agent (${agent.role}): ${agent.email} (${agent.name})`));
    });
    logger.info(`Super admin: ${superAdmin.email} (${superAdmin.name})`);
  } finally {
    connection.release();
    await pool.end();
  }
}

seed().catch((err) => {
  logger.error(err);
  process.exit(1);
});

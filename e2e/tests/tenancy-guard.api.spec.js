const { test, expect } = require('@playwright/test');
const path = require('path');

// A unit test rather than an API one: the guard's whole job is to reject a
// query before it reaches MySQL, so the only way to exercise it is to hand it
// the statements it is meant to refuse. It lives here because this is the
// project's one test runner.
const { assertTenantScoped } = require(
  path.resolve(__dirname, '..', '..', 'server', 'src', 'db', 'tenancy'),
);

function allows(sql) {
  assertTenantScoped(sql);
}

function rejects(sql) {
  expect(() => assertTenantScoped(sql)).toThrow(/without an org_id predicate/);
}

test.describe('tenancy guard', () => {
  test('allows an org-scoped table when org_id is named', () => {
    allows('SELECT * FROM views WHERE id = ? AND org_id = ?');
    allows('UPDATE tickets SET status = ? WHERE id = ? AND org_id = ?');
    allows('DELETE FROM users WHERE id = ? AND org_id = ?');
    allows('INSERT INTO tags (org_id, name) VALUES (?, ?)');
  });

  test('rejects the same statements without it', () => {
    rejects('SELECT * FROM views WHERE id = ?');
    rejects('UPDATE tickets SET status = ? WHERE id = ?');
    rejects('DELETE FROM users WHERE id = ?');
    rejects('INSERT INTO tags (name) VALUES (?)');
  });

  test('ignores tables that carry no org_id', () => {
    allows('SELECT * FROM organizations ORDER BY created_at DESC');
    allows('SELECT * FROM super_admins WHERE email = ?');
    allows('DELETE FROM ticket_tags WHERE ticket_id = ?');
  });

  test('catches a scoped table reached through a join', () => {
    rejects(
      `SELECT tags.name FROM ticket_tags
       JOIN tags ON tags.id = ticket_tags.tag_id
       WHERE ticket_tags.ticket_id = ?`,
    );
  });

  test('catches DDL, which is how a seed script wipes the wrong rows', () => {
    rejects('DELETE FROM ticket_comments');
    rejects('ALTER TABLE agents AUTO_INCREMENT = 1');
  });

  test('honours the unscoped marker, and only the marker', () => {
    allows('/* unscoped: seed wipes every tenant */ DELETE FROM ticket_comments');
    rejects('/* wipes every tenant */ DELETE FROM ticket_comments');
  });

  test('reads the statement out of a query options object', () => {
    rejects({ sql: 'SELECT * FROM users WHERE id = ?' });
    allows({ sql: 'SELECT * FROM users WHERE id = ? AND org_id = ?' });
  });

  test('names the offending table in the error', () => {
    expect(() => assertTenantScoped('SELECT * FROM customer_otps WHERE email = ?')).toThrow(
      /`customer_otps`/,
    );
  });
});

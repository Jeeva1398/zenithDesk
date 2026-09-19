// Refresh tokens are stored so they can be revoked - that is the whole point of
// having them. Only a hash is kept: a leaked database should not hand out live
// sessions, exactly as with passwords.
exports.up = function up(knex) {
  return knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('agent_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('agents')
      .onDelete('CASCADE');
    table.string('token_hash', 64).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('revoked_at').nullable();
    // Set when this token is rotated, so a reused old token identifies the
    // chain it belonged to and the whole family can be revoked at once.
    table.integer('replaced_by_id').unsigned().nullable();
    table.timestamps(true, true);

    table.index('org_id');
    table.index('agent_id');
    table.unique('token_hash');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('refresh_tokens');
};

// One row per "forgot password" link sent. Only a hash of the token is kept,
// so a leaked table cannot be used to reset anyone's password.
exports.up = async function up(knex) {
  await knex.schema.createTable('password_reset_tokens', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.integer('agent_id').unsigned().notNullable().references('id').inTable('agents').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.dateTime('expires_at').notNullable();
    table.dateTime('used_at').nullable();
    table.timestamps(true, true);

    table.index(['org_id', 'agent_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('password_reset_tokens');
};

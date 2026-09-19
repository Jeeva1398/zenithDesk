exports.up = function up(knex) {
  return knex.schema.createTable('macros', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('created_by_agent_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('agents')
      .onDelete('SET NULL');
    table.string('name', 100).notNullable();
    // What applying the macro does: any of status / priority / assigned_agent_id,
    // plus an optional comment body. Stored as one document rather than a column
    // per field so a new action doesn't need a migration.
    table.json('actions').notNullable();
    table.timestamps(true, true);

    table.index('org_id');
    table.unique(['org_id', 'name']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('macros');
};

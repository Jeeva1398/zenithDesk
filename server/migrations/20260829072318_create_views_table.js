exports.up = function up(knex) {
  return knex.schema.createTable('views', (table) => {
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
    table.json('filters').notNullable();
    table.timestamps(true, true);

    table.index('org_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('views');
};

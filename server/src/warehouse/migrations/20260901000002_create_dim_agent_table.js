exports.up = function up(knex) {
  return knex.schema.createTable('dim_agent', (table) => {
    table.increments('id').primary();
    table.integer('agent_id').unsigned().notNullable().unique();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('org_id')
      .inTable('dim_organization')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable();
    table.string('role', 50).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('dim_agent');
};

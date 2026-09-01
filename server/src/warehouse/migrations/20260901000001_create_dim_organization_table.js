exports.up = function up(knex) {
  return knex.schema.createTable('dim_organization', (table) => {
    table.increments('id').primary();
    table.integer('org_id').unsigned().notNullable().unique();
    table.string('name', 255).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('dim_organization');
};

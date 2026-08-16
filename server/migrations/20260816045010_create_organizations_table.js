exports.up = function up(knex) {
  return knex.schema.createTable('organizations', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('organizations');
};

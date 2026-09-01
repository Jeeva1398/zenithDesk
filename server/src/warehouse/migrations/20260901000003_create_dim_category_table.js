exports.up = function up(knex) {
  return knex.schema.createTable('dim_category', (table) => {
    table.increments('id').primary();
    table.string('category', 100).notNullable().unique();
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('dim_category');
};

exports.up = function up(knex) {
  return knex.schema.createTable('etl_runs', (table) => {
    table.increments('id').primary();
    table.string('job_name', 100).notNullable().unique();
    table.datetime('last_run_at').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('etl_runs');
};

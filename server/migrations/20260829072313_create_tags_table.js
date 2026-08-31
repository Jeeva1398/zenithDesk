exports.up = function up(knex) {
  return knex.schema.createTable('tags', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.timestamps(true, true);

    table.unique(['org_id', 'name']);
    table.index('org_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('tags');
};

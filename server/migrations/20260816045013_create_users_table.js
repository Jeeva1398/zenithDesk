exports.up = function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('email', 255).notNullable();
    table.string('password_hash', 255).notNullable();
    table.timestamps(true, true);

    table.unique(['org_id', 'email']);
    table.index('org_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('users');
};

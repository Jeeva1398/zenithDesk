exports.up = function up(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.string('password_hash', 255).nullable().alter();
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('users', (table) => {
    table.string('password_hash', 255).notNullable().alter();
  });
};

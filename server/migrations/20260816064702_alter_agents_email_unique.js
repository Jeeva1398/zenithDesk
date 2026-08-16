exports.up = function up(knex) {
  return knex.schema.alterTable('agents', (table) => {
    table.dropUnique(['org_id', 'email']);
    table.unique('email');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('agents', (table) => {
    table.dropUnique(['email']);
    table.unique(['org_id', 'email']);
  });
};

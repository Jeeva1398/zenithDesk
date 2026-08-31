exports.up = function up(knex) {
  return knex.schema.alterTable('agents', (table) => {
    table.enu('role', ['admin', 'agent']).notNullable().defaultTo('agent');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('agents', (table) => {
    table.dropColumn('role');
  });
};

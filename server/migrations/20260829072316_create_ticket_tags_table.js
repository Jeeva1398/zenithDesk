exports.up = function up(knex) {
  return knex.schema.createTable('ticket_tags', (table) => {
    table
      .integer('ticket_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tickets')
      .onDelete('CASCADE');
    table
      .integer('tag_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tags')
      .onDelete('CASCADE');

    table.primary(['ticket_id', 'tag_id']);
    table.index('tag_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('ticket_tags');
};

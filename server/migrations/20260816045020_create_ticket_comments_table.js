exports.up = function up(knex) {
  return knex.schema.createTable('ticket_comments', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('ticket_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tickets')
      .onDelete('CASCADE');
    table
      .integer('author_customer_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('author_agent_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('agents')
      .onDelete('CASCADE');
    table.text('body').notNullable();
    table.timestamps(true, true);

    table.index('org_id');
    table.index('ticket_id');

    table.check(
      '(author_customer_id IS NOT NULL AND author_agent_id IS NULL) OR (author_customer_id IS NULL AND author_agent_id IS NOT NULL)',
      [],
      'ticket_comments_single_author_chk',
    );
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('ticket_comments');
};

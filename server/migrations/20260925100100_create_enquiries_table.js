// Pre-sales and general enquiries the chat widget takes down. Kept apart from
// tickets: they are leads for someone to follow up, not problems in a support
// queue, and have their own page and a much smaller life cycle.
exports.up = function up(knex) {
  return knex.schema.createTable('enquiries', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('name', 100).notNullable();
    // At least one of the two is required; the service enforces it.
    table.string('email', 255).nullable();
    table.string('phone', 30).nullable();
    table.string('company', 150).nullable();
    table.text('message').notNullable();
    table.enu('status', ['new', 'contacted', 'closed']).notNullable().defaultTo('new');
    table.text('notes').nullable();
    table.string('source', 20).notNullable().defaultTo('chat');
    table.timestamps(true, true);

    table.index(['org_id', 'status', 'created_at']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('enquiries');
};

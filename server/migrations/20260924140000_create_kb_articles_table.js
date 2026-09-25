// The knowledge base the chat widget answers from before it offers a ticket.
// One row per article; the search index is built from these in memory, so
// there is no second table of chunks to keep in step with edits.
exports.up = function up(knex) {
  return knex.schema.createTable('kb_articles', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('title', 200).notNullable();
    table.text('body', 'mediumtext').notNullable();
    // Drafts stay out of the chatbot's reach until an admin is happy with them.
    table.boolean('is_published').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index('org_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('kb_articles');
};

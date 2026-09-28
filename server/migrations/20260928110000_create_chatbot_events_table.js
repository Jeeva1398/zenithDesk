// What the chatbot reports about its own conversations, for the Chatbot tab
// on the dashboard: a conversation starting, a knowledge-base answer and
// whether it helped, a ticket or enquiry taken, a person asked for, a reply
// rated. One row per happening; the numbers are counted from these.
exports.up = async function up(knex) {
  await knex.schema.createTable('chatbot_events', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('session_id', 100).notNullable();
    table.string('type', 30).notNullable();
    // The question, for a knowledge-base answer or a miss; the rated reply's
    // id, for a rating.
    table.string('detail', 255).nullable();
    table.timestamps(true, true);

    table.index(['org_id', 'type', 'created_at']);
    table.index(['org_id', 'session_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('chatbot_events');
};

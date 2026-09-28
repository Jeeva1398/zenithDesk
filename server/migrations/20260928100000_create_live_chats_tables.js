// A chat widget conversation handed from the bot to a person. The bot's part
// stays on the chat server; what is kept here is the snapshot the agent reads
// to catch up, and everything said after the handoff, by either side.
exports.up = async function up(knex) {
  await knex.schema.createTable('live_chats', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    // The widget conversation it came from. A visitor can ask for a person
    // again after a chat has ended, so this is not unique.
    table.string('session_id', 100).notNullable();
    table.enu('status', ['waiting', 'active', 'closed', 'missed']).notNullable().defaultTo('waiting');
    table.integer('agent_id').unsigned().nullable().references('id').inTable('agents').onDelete('SET NULL');
    table.string('visitor_name', 100).nullable();
    table.string('visitor_email', 255).nullable();
    // The bot conversation before the handoff, as [{ role, content }].
    table.text('transcript', 'mediumtext').nullable();
    table.dateTime('last_message_at').nullable();
    table.dateTime('closed_at').nullable();
    table.timestamps(true, true);

    table.index(['org_id', 'status', 'created_at']);
    table.index(['org_id', 'session_id']);
  });

  await knex.schema.createTable('live_chat_messages', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('live_chat_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('live_chats')
      .onDelete('CASCADE');
    // system is the chat's own notes: who joined, who ended it.
    table.enu('author_type', ['visitor', 'agent', 'system']).notNullable();
    table.integer('agent_id').unsigned().nullable().references('id').inTable('agents').onDelete('SET NULL');
    table.text('body').notNullable();
    // What a system note records, so the chatbot can tell the visitor without
    // reading the wording: joined (agent_id is who), ended, or missed.
    table.string('event', 20).nullable();
    table.timestamps(true, true);

    table.index(['org_id', 'live_chat_id', 'id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('live_chat_messages');
  await knex.schema.dropTableIfExists('live_chats');
};

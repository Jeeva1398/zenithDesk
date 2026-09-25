// What the chat widget's bot is for: which jobs it does (enquiries, support
// tickets, knowledge answers, ticket status) and the wording around them.
// Like theme/tools it stores only what an admin changed, so existing rows stay
// NULL and read back as the defaults - the bot keeps behaving as it did.
exports.up = function up(knex) {
  return knex.schema.alterTable('chat_widget_settings', (table) => {
    table.json('bot').nullable();
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('chat_widget_settings', (table) => {
    table.dropColumn('bot');
  });
};

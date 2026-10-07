// What the Chat setup checklist needs to know that nothing else records:
// whether the widget has shown up on a real site (the chat server reports the
// first and latest page that loaded it), and whether an admin has chosen what
// the bot does - a stored bot is not enough, since a Chat-only org starts with one.
exports.up = async function up(knex) {
  await knex.schema.alterTable('chat_widget_settings', (table) => {
    table.datetime('first_seen_at').nullable();
    table.datetime('last_seen_at').nullable();
    table.string('last_seen_origin', 255).nullable();
    table.datetime('bot_saved_at').nullable();
  });
  // Until now a bot was only ever stored by an admin saving it.
  await knex('chat_widget_settings').whereNotNull('bot').update({ bot_saved_at: knex.ref('updated_at') });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('chat_widget_settings', (table) => {
    table.dropColumn('first_seen_at');
    table.dropColumn('last_seen_at');
    table.dropColumn('last_seen_origin');
    table.dropColumn('bot_saved_at');
  });
};

// SLA needs to know when a ticket was actually resolved. updated_at cannot
// answer that - any later edit moves it - so resolution time is recorded once,
// when the status first becomes resolved or closed.
exports.up = async function up(knex) {
  await knex.schema.alterTable('tickets', (table) => {
    table.timestamp('resolved_at').nullable().after('status');
  });

  // Existing resolved tickets have no better evidence than updated_at. It is an
  // approximation, and the only one available for rows created before this
  // column existed.
  await knex('tickets')
    .whereIn('status', ['resolved', 'closed'])
    .update({ resolved_at: knex.ref('updated_at') });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('tickets', (table) => {
    table.dropColumn('resolved_at');
  });
};

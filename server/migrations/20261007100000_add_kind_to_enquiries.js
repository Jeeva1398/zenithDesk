// What an enquiry is: a lead (someone interested in buying, or a website's
// contact form), or a message - a question the bot of an org without Desk could
// not answer, left for the team instead of the ticket it would otherwise raise.
// Everything before this was a lead.
exports.up = function up(knex) {
  return knex.schema.alterTable('enquiries', (table) => {
    table.enu('kind', ['lead', 'message']).notNullable().defaultTo('lead').after('source');
  });
};

exports.down = function down(knex) {
  return knex.schema.alterTable('enquiries', (table) => {
    table.dropColumn('kind');
  });
};

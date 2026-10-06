// Which products an organization uses: Desk (tickets, SLA, macros, the
// customer portal) and Chat (the widget, its bot, live chat, enquiries). Both
// sit on the same org, agents and knowledge base, and an org can start with
// either and add the other later. A row per product rather than a column, so
// a product's plan and trial can hang off it once there is billing.
//
// Every org that exists already has been using both, so each gets both.
exports.up = async function up(knex) {
  await knex.schema.createTable('org_products', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.enu('product', ['desk', 'chat']).notNullable();
    table.enu('status', ['trial', 'active', 'cancelled']).notNullable().defaultTo('active');
    // Unused until there is billing.
    table.dateTime('trial_ends_at').nullable();
    table.timestamps(true, true);

    table.unique(['org_id', 'product']);
  });

  await knex.raw(
    `INSERT INTO org_products (org_id, product, status, created_at, updated_at)
     SELECT o.id, p.product, 'active', NOW(), NOW()
     FROM organizations o
     CROSS JOIN (SELECT 'desk' AS product UNION ALL SELECT 'chat') p`,
  );
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('org_products');
};

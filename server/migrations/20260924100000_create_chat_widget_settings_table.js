const crypto = require('crypto');

// One row per org: how its chat widget looks, which composer tools it offers,
// and which sites may embed it. theme and tools hold only what an admin has
// changed - the service lays them over its defaults on read - so a new default
// reaches every org without a backfill.
exports.up = async function up(knex) {
  await knex.schema.createTable('chat_widget_settings', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    // Not a secret: it sits in the embed snippet on the customer's own pages.
    // It says which org a widget belongs to, and allowed_domains is what stops
    // another site reusing it.
    table.string('public_key', 64).notNullable();
    table.json('allowed_domains').notNullable();
    table.json('theme').notNullable();
    table.json('tools').notNullable();
    table.timestamps(true, true);

    table.unique('org_id');
    table.unique('public_key');
  });

  // Every existing org gets a row, so the read path never has to invent one.
  const orgs = await knex('organizations').select('id');
  if (orgs.length === 0) return;

  await knex('chat_widget_settings').insert(
    orgs.map((org) => ({
      org_id: org.id,
      public_key: `zdw_${crypto.randomBytes(16).toString('hex')}`,
      allowed_domains: '[]',
      theme: '{}',
      tools: '{}',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    })),
  );
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('chat_widget_settings');
};

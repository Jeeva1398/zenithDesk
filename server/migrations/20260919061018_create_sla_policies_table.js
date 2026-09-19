// One row per (org, priority): how long an org gives itself to reply first and
// to resolve. Minutes rather than hours so a tight urgent target is expressible.
const DEFAULTS = [
  { priority: 'urgent', first_response_minutes: 30, resolution_minutes: 240 },
  { priority: 'high', first_response_minutes: 60, resolution_minutes: 480 },
  { priority: 'medium', first_response_minutes: 240, resolution_minutes: 1440 },
  { priority: 'low', first_response_minutes: 480, resolution_minutes: 2880 },
];

exports.up = async function up(knex) {
  await knex.schema.createTable('sla_policies', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.enu('priority', ['low', 'medium', 'high', 'urgent']).notNullable();
    table.integer('first_response_minutes').unsigned().notNullable();
    table.integer('resolution_minutes').unsigned().notNullable();
    table.timestamps(true, true);

    table.index('org_id');
    table.unique(['org_id', 'priority']);
  });

  // Every existing org gets the defaults, so no tenant is left without a policy
  // and the read path never has to invent one.
  const orgs = await knex('organizations').select('id');
  if (orgs.length === 0) return;

  await knex('sla_policies').insert(
    orgs.flatMap((org) =>
      DEFAULTS.map((d) => ({
        org_id: org.id,
        ...d,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      })),
    ),
  );
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('sla_policies');
};

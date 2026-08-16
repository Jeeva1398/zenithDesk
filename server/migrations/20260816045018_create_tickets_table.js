exports.up = function up(knex) {
  return knex.schema.createTable('tickets', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('customer_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('assigned_agent_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('agents')
      .onDelete('SET NULL');
    table.string('subject', 255).notNullable();
    table.text('description').notNullable();
    table.string('category', 100).nullable();
    table.enu('priority', ['low', 'medium', 'high', 'urgent']).notNullable().defaultTo('medium');
    table
      .enu('status', ['open', 'pending', 'resolved', 'closed'])
      .notNullable()
      .defaultTo('open');
    table.timestamps(true, true);

    table.index('org_id');
    table.index('status');
    table.index('created_at');
    table.index('customer_id');
    table.index('assigned_agent_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('tickets');
};

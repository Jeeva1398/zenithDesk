exports.up = function up(knex) {
  return knex.schema.createTable('fact_ticket_daily', (table) => {
    table.increments('id').primary();
    table.date('date_key').notNullable();
    table
      .integer('dim_organization_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('dim_organization')
      .onDelete('CASCADE');
    table
      .integer('dim_agent_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('dim_agent')
      .onDelete('SET NULL');
    table
      .integer('dim_category_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('dim_category')
      .onDelete('CASCADE');
    table.enu('priority', ['low', 'medium', 'high', 'urgent']).notNullable();
    table.integer('tickets_created').unsigned().notNullable().defaultTo(0);
    table.integer('tickets_resolved').unsigned().notNullable().defaultTo(0);
    table.decimal('avg_first_response_hours', 10, 2).nullable();
    table.decimal('avg_resolution_hours', 10, 2).nullable();
    table.timestamps(true, true);

    table.index(['date_key', 'dim_organization_id']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('fact_ticket_daily');
};

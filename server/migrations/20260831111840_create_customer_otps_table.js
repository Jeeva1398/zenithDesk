exports.up = function up(knex) {
  return knex.schema.createTable('customer_otps', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('otp_code_hash', 255).notNullable();
    table.timestamp('expires_at').notNullable();
    table.integer('attempts').unsigned().notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.index(['org_id', 'email']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('customer_otps');
};

// Files attached to a ticket - today only the ones a customer sent through the
// chat widget. The bytes live on disk under UPLOAD_DIR; storage_key is the
// path relative to it, never a name the uploader chose.
exports.up = function up(knex) {
  return knex.schema.createTable('ticket_attachments', (table) => {
    table.increments('id').primary();
    table
      .integer('org_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('organizations')
      .onDelete('CASCADE');
    table
      .integer('ticket_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tickets')
      .onDelete('CASCADE');
    table.string('filename', 255).notNullable();
    table.string('mime_type', 100).notNullable();
    table.integer('size_bytes').unsigned().notNullable();
    table.string('storage_key', 255).notNullable();
    table.timestamps(true, true);

    table.index('org_id');
    table.index('ticket_id');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('ticket_attachments');
};

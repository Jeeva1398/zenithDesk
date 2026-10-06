// Embedding vectors for knowledge-base passages, so the search can match a
// question by meaning and not only by shared words. Keyed by a hash of the
// passage text and the model that embedded it: an edit that leaves a passage
// unchanged keeps its vector, and switching models simply misses until the
// new ones are filled in.
exports.up = function up(knex) {
  return knex.schema.createTable('kb_passage_embeddings', (table) => {
    table.increments('id').primary();
    table.integer('org_id').unsigned().notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    table.string('model', 100).notNullable();
    table.specificType('content_hash', 'CHAR(64)').notNullable();
    // Float32 values, unit length, little-endian.
    table.specificType('vector', 'MEDIUMBLOB').notNullable();
    table.timestamps(true, true);

    table.unique(['org_id', 'model', 'content_hash']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('kb_passage_embeddings');
};

const { forOrg } = require('../db/orgScope');

async function listTags(orgId) {
  const tags = await forOrg(orgId).list('tags', {}, { columns: 'id, name', orderBy: 'name ASC' });
  return { tags };
}

module.exports = { listTags };

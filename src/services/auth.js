'use strict';

async function resolveOwnerIds(client, configured) {
  const ids = new Set(configured);
  if (ids.size > 0) return ids;

  const application = await client.application.fetch();
  const owner = application.owner;
  if (!owner) return ids;

  if (owner.members) {
    for (const memberId of owner.members.keys()) ids.add(memberId);
  } else {
    ids.add(owner.id);
  }
  return ids;
}

module.exports = { resolveOwnerIds };

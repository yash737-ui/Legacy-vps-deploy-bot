import db from './database.js';

export function isAdmin(userId, ownerId = null) {
  if (userId === ownerId) return true;
  const row = db.prepare('SELECT userId FROM admins WHERE userId = ?').get(userId);
  return Boolean(row);
}

export function hasVpsAccess(vps, userId) {
  if (vps.ownerId === userId) return true;
  const shared = JSON.parse(vps.sharedUsers || '[]');
  return shared.includes(userId);
}

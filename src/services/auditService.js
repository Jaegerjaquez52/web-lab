import { prisma } from '../db.js';
import { enqueue } from '../utils/queue.js';

export function logAction(userId, action, entity, entityId, meta) {
  enqueue(() =>
    prisma.activityLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    })
  );
}

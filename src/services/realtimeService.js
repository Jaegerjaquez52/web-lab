import { prisma } from '../db.js';

export async function publish(io, room, event, payload) {
  const row = await prisma.realtimeEvent.create({
    data: { room, event, payload: JSON.stringify(payload) },
  });

  io?.to(room).emit(event, { ...payload, _eventId: row.id });
  return row;
}

export async function eventsSince(room, afterId) {
  const rows = await prisma.realtimeEvent.findMany({
    where: { room, id: { gt: Number(afterId) || 0 } },
    orderBy: { id: 'asc' },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    event: row.event,
    payload: JSON.parse(row.payload),
    createdAt: row.createdAt,
  }));
}

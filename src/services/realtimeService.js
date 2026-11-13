import { prisma } from '../db.js';

export async function publish(io, room, event, payload) {
  const row = await prisma.realtimeEvent.create({
    data: { room, event, payload: JSON.stringify(payload) },
  });

  const message = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? { ...payload, _eventId: row.id, _room: room }
    : { payload, _eventId: row.id, _room: room };
  io?.to(room).emit(event, message);
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
    payload: {
      ...JSON.parse(row.payload),
      _eventId: row.id,
      _room: room,
    },
    createdAt: row.createdAt,
  }));
}

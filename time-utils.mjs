export function dayBounds(day) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function overlapMsForDay(session, day, end = new Date()) {
  const { start, end: dayEnd } = dayBounds(day);
  const sessionStart = new Date(session.startedAt).getTime();
  const sessionEnd = new Date(session.endedAt || end).getTime();
  return Math.max(0, Math.min(sessionEnd, dayEnd.getTime()) - Math.max(sessionStart, start.getTime()));
}

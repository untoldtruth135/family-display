export function getAgendaDateKeys(year: number, month: number, day: number) {
  // Increment the display's calendar date, not an instant by 24 hours (DST).
  const today = new Date(Date.UTC(year, month - 1, day));
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    today: today.toISOString().slice(0, 10),
    tomorrow: tomorrow.toISOString().slice(0, 10),
  };
}

type AgendaEvent = { date: string; allDay: boolean; start: string | null };
export function eventsForAgendaDay<T extends AgendaEvent>(events: T[], date: string): T[] {
  return events.filter(event => event.date === date).sort((first, second) => {
    if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
    return (first.start ?? "").localeCompare(second.start ?? "");
  });
}

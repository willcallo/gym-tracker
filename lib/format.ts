function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date: string): string {
  return parseDate(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDate(date: string): string {
  return parseDate(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function monthLabel(date: string): string {
  return parseDate(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatWeight(n: number): string {
  return `${Math.round(n * 100) / 100}`;
}

export function formatSet(
  s: { reps: number; weight: number | null },
  isBodyweight: boolean
): string {
  if (isBodyweight || s.weight === null) return `${s.reps} reps`;
  return `${s.reps} × ${formatWeight(s.weight)} kg`;
}

export function formatPR(pr: number | null, isBodyweight: boolean): string | null {
  if (pr === null) return null;
  return isBodyweight ? `${pr} reps` : `${formatWeight(pr)} kg`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// m:ss, or h:mm:ss once past an hour. For running clocks.
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// "1h 12m", "45m", "under 1m". For finished sessions.
export function formatDuration(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 1) return 'under 1m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

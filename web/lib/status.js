export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

export function statusFor(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return { label: 'sem validade', tone: 'neutral' };
  if (d < 0) return { label: `vencida há ${Math.abs(d)}d`, tone: 'danger' };
  if (d <= 7) return { label: `vence em ${d}d`, tone: 'warning' };
  return { label: `válida (vence em ${d}d)`, tone: 'ok' };
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

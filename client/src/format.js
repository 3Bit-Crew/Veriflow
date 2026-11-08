const moneyFormats = {};

// formatMoney(97.5) -> "$97.50"
export function formatMoney(amount, currency = 'USD') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  moneyFormats[currency] ??= new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return moneyFormats[currency].format(value);
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// "3:04 PM" for today, "Nov 6, 3:04 PM" for other days.
export function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const isToday = date.toDateString() === new Date().toDateString();
  return (isToday ? timeFormat : dateTimeFormat).format(date);
}

const moneyFormats = {};

// formatMoney(97.5) -> "$97.50"
export function formatMoney(amount, currency = 'USD') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  moneyFormats[currency] ??= new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return moneyFormats[currency].format(value);
}

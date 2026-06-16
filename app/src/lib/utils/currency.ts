/**
 * Currency formatting utility.
 * Always uses the league's stored currency — never defaults to USD.
 */

export function formatLeagueCurrency(amount: number, currency: string): string {
  if (currency === 'PEN') return `S/ ${amount.toFixed(2)}`;
  if (currency === 'USD') return `US$ ${amount.toFixed(2)}`;
  if (currency === 'EUR') return `€${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}

export function currencySymbol(currency: string): string {
  if (currency === 'PEN') return 'S/';
  if (currency === 'USD') return 'US$';
  if (currency === 'EUR') return '€';
  return currency;
}

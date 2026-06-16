import { describe, it, expect } from 'vitest';
import { formatLeagueCurrency, currencySymbol } from './currency';

describe('formatLeagueCurrency', () => {
  it('should format PEN correctly', () => {
    expect(formatLeagueCurrency(50, 'PEN')).toBe('S/ 50.00');
    expect(formatLeagueCurrency(123.456, 'PEN')).toBe('S/ 123.46');
  });

  it('should format USD correctly', () => {
    expect(formatLeagueCurrency(50, 'USD')).toBe('US$ 50.00');
  });

  it('should format EUR correctly', () => {
    expect(formatLeagueCurrency(50, 'EUR')).toBe('€50.00');
  });

  it('should fallback to input currency code if unrecognized', () => {
    expect(formatLeagueCurrency(50, 'GBP')).toBe('GBP 50.00');
  });
});

describe('currencySymbol', () => {
  it('should return correct symbols', () => {
    expect(currencySymbol('PEN')).toBe('S/');
    expect(currencySymbol('USD')).toBe('US$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('MXN')).toBe('MXN');
  });
});

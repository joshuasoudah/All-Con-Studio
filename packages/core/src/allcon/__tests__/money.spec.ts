// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  compareWorkOrderNumbers,
  formatCreditNumber,
  formatUsd,
  parseUsdToCents,
  pdfFileName
} from '@invoice-builder/contracts';
import { lineTotalCents, priceDocument, taxOnCents } from '../money';

const wo817Lines = [
  { quantity: '1', unitCostCents: 269790 },
  { quantity: '1', unitCostCents: 288 },
  { quantity: '1', unitCostCents: 18895 }
];

describe('work order money', () => {
  it('prices the WO8.17 fixture at 7.5 percent', () => {
    const priced = priceDocument({
      lines: wo817Lines,
      taxRateBps: 750,
      manualTotalCents: null,
      overrideBasis: 'post-tax'
    });
    expect(priced.lineTotalCents).toEqual([269790, 288, 18895]);
    expect(priced.subtotalCents).toBe(288973);
    expect(priced.taxCents).toBe(21673);
    expect(priced.calculatedTotalCents).toBe(310646);
    expect(priced.adjustmentCents).toBe(0);
    expect(priced.totalCents).toBe(310646);
    expect(formatUsd(priced.subtotalCents)).toBe('$2,889.73');
    expect(formatUsd(priced.taxCents)).toBe('$216.73');
    expect(formatUsd(priced.totalCents)).toBe('$3,106.46');
  });

  it('keeps line cents and shows a post-tax adjustment of -6.46', () => {
    const priced = priceDocument({
      lines: wo817Lines,
      taxRateBps: 750,
      manualTotalCents: 310000,
      overrideBasis: 'post-tax'
    });
    expect(priced.lineTotalCents).toEqual([269790, 288, 18895]);
    expect(priced.subtotalCents).toBe(288973);
    expect(priced.taxCents).toBe(21673);
    expect(priced.calculatedTotalCents).toBe(310646);
    expect(priced.adjustmentCents).toBe(-646);
    expect(priced.totalCents).toBe(310000);
    expect(formatUsd(priced.adjustmentCents)).toBe('-$6.46');
  });

  it('solves a pre-tax override so the grand total matches', () => {
    const priced = priceDocument({
      lines: wo817Lines,
      taxRateBps: 750,
      manualTotalCents: 310000,
      overrideBasis: 'pre-tax'
    });
    expect(priced.lineTotalCents).toEqual([269790, 288, 18895]);
    expect(priced.subtotalCents).toBe(288973);
    expect(priced.adjustmentCents).toBe(-601);
    expect(priced.taxCents).toBe(21628);
    expect(priced.totalCents).toBe(310000);
  });

  it('rounds half up', () => {
    expect(taxOnCents(1, 5000)).toBe(1);
    expect(lineTotalCents('1.005', 100)).toBe(101);
    expect(lineTotalCents('0.333', 100)).toBe(33);
    expect(parseUsdToCents('1.005')).toBe(101);
    expect(parseUsdToCents('-$6.46')).toBe(-646);
  });

  it('orders work order numbers numerically and builds filenames', () => {
    expect(compareWorkOrderNumbers('WO8.2', 'WO8.10')).toBeLessThan(0);
    expect(compareWorkOrderNumbers('WO8.17', 'WO8.18')).toBeLessThan(0);
    expect(formatCreditNumber('CM-', 1001, 4)).toBe('CM-1001');
    expect(pdfFileName('{number} - {project}.pdf', 'WO8.17', 'Jaguars Stadium of the Future')).toBe(
      'WO8.17 - Jaguars Stadium of the Future.pdf'
    );
  });
});

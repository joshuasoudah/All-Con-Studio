import type { StudioTotals, TotalOverrideBasis } from '@invoice-builder/contracts';
import { Decimal } from 'decimal.js';

const HALF_UP = Decimal.ROUND_HALF_UP;

export const lineTotalCents = (quantity: string, unitCostCents: number) =>
  new Decimal(quantity || '0').mul(unitCostCents).toDecimalPlaces(0, HALF_UP).toNumber();

export const taxOnCents = (amountCents: number, rateBps: number) =>
  new Decimal(amountCents).mul(rateBps).div(10_000).toDecimalPlaces(0, HALF_UP).toNumber();

const solvePreTaxAdjustment = (subtotalCents: number, rateBps: number, manualTotalCents: number) => {
  const approx = new Decimal(manualTotalCents)
    .div(new Decimal(rateBps).div(10_000).add(1))
    .toDecimalPlaces(0, HALF_UP)
    .toNumber();
  for (let delta = 0; delta <= 50; delta += 1) {
    const candidates = delta === 0 ? [approx] : [approx - delta, approx + delta];
    for (const taxable of candidates) {
      if (taxable + taxOnCents(taxable, rateBps) === manualTotalCents) return taxable - subtotalCents;
    }
  }
  return approx - subtotalCents;
};

export const priceDocument = (input: {
  lines: { quantity: string; unitCostCents: number }[];
  taxRateBps: number;
  manualTotalCents: number | null;
  overrideBasis: TotalOverrideBasis;
}): StudioTotals => {
  const lineTotalCentsList = input.lines.map(line => lineTotalCents(line.quantity, line.unitCostCents));
  const subtotalCents = lineTotalCentsList.reduce((sum, cents) => sum + cents, 0);
  const originalTax = taxOnCents(subtotalCents, input.taxRateBps);
  const calculatedTotalCents = subtotalCents + originalTax;
  const basis = input.overrideBasis;
  const manual = input.manualTotalCents;

  if (manual === null || manual === undefined) {
    return {
      subtotalCents,
      taxCents: originalTax,
      calculatedTotalCents,
      adjustmentCents: 0,
      manualTotalCents: null,
      totalCents: calculatedTotalCents,
      overrideBasis: basis,
      lineTotalCents: lineTotalCentsList
    };
  }

  if (basis === 'pre-tax') {
    const adjustmentCents = solvePreTaxAdjustment(subtotalCents, input.taxRateBps, manual);
    const taxable = subtotalCents + adjustmentCents;
    const taxCents = taxOnCents(taxable, input.taxRateBps);
    return {
      subtotalCents,
      taxCents,
      calculatedTotalCents,
      adjustmentCents,
      manualTotalCents: manual,
      totalCents: taxable + taxCents,
      overrideBasis: basis,
      lineTotalCents: lineTotalCentsList
    };
  }

  return {
    subtotalCents,
    taxCents: originalTax,
    calculatedTotalCents,
    adjustmentCents: manual - calculatedTotalCents,
    manualTotalCents: manual,
    totalCents: manual,
    overrideBasis: 'post-tax',
    lineTotalCents: lineTotalCentsList
  };
};

// @vitest-environment node
import { pdf } from '@react-pdf/renderer';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { pdfFileName } from '@invoice-builder/contracts';
import { WorkOrderPdf, type WorkOrderPdfModel } from '../WorkOrderPdf';

const fontFiles = vi.hoisted(() => {
  // vi.hoisted runs before ESM imports, so the path helper is loaded here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolve: resolvePath } = require('node:path') as typeof import('node:path');
  return {
    regular: resolvePath(process.cwd(), 'apps/renderer/src/assets/figtree/Figtree-Regular.ttf'),
    semibold: resolvePath(process.cwd(), 'apps/renderer/src/assets/figtree/Figtree-SemiBold.ttf')
  };
});

vi.mock('@react-pdf/renderer', async () => {
  const actual = await vi.importActual<typeof import('@react-pdf/renderer')>('@react-pdf/renderer');
  return {
    ...actual,
    Font: {
      ...actual.Font,
      register: vi.fn((config: { family?: string; fonts?: { fontWeight?: number; src: string }[]; src?: string }) => {
        if (config.fonts) {
          return actual.Font.register({
            family: config.family ?? 'Figtree',
            fonts: config.fonts.map(font => ({
              ...font,
              src: font.fontWeight === 600 ? fontFiles.semibold : fontFiles.regular
            }))
          });
        }
        return actual.Font.register({ ...config, family: config.family ?? 'Figtree', src: fontFiles.regular });
      }),
      registerHyphenationCallback: (callback: (word: string) => string[]) =>
        actual.Font.registerHyphenationCallback(callback)
    }
  };
});

const logo = readFileSync(resolve(process.cwd(), 'apps/renderer/src/assets/allcon/default-logo.png')).toString(
  'base64'
);

const wo817 = (overrides: Partial<WorkOrderPdfModel> = {}): WorkOrderPdfModel => ({
  documentType: 'work_order',
  numberText: 'WO8.17',
  projectName: 'Jaguars Stadium of the Future',
  issuedOn: '2026-10-15',
  dueOn: '2026-11-14',
  jobNumber: 'Default',
  subcontractNumber: 'WO8',
  vendorNumber: 'ALLCO5',
  vendorInvoiceNumber: '2966923',
  originalVendorInvoiceNumber: '',
  companyAddressLine1: '123 Example St',
  companyAddressLine2: '',
  companyCity: 'Jacksonville',
  companyRegion: 'FL',
  companyPostalCode: '32202',
  companyPhone: '(904) 555-0100',
  logoSrc: `data:image/png;base64,${logo}`,
  billToName: 'Hunt Construction-Barton Malow',
  billToAddressLine1: '123 Example St',
  billToAddressLine2: '',
  billToCity: 'Jacksonville',
  billToRegion: 'FL',
  billToPostalCode: '32202',
  taxName: 'Default',
  taxRateBps: 750,
  overrideBasis: 'post-tax',
  lines: [
    {
      title: '2nd Restroom Rent',
      description: 'Restroom, 12x30 DBPR Rent (Item1129)(BG) (Bldg ID # 33135/ E-Code 526842)',
      serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
      quantity: '1',
      unitCostCents: 269790,
      lineTotalCents: 269790
    },
    {
      title: '2nd Restroom',
      description: 'Security Door Bars Office, 24x56 DBPR (Item1376W) (Bldg ID # 89263/ E-Code 737086, 737087)',
      serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
      quantity: '1',
      unitCostCents: 288,
      lineTotalCents: 288
    },
    {
      title: 'Personal Property Expense',
      description: '',
      serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
      quantity: '1',
      unitCostCents: 18895,
      lineTotalCents: 18895
    }
  ],
  subtotalCents: 288973,
  taxCents: 21673,
  adjustmentCents: 0,
  totalCents: 310646,
  showAmountPaid: false,
  amountPaidCents: 0,
  ...overrides
});

const renderPdf = async (model: WorkOrderPdfModel) => {
  const blob = await pdf(<WorkOrderPdf model={model} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
};

const textOf = (bytes: Buffer) => {
  const dir = mkdtempSync(join(tmpdir(), 'allcon-pdf-'));
  const filePath = join(dir, 'doc.pdf');
  writeFileSync(filePath, bytes);
  return {
    filePath,
    text: execFileSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8' }),
    fonts: execFileSync('pdffonts', [filePath], { encoding: 'utf8' })
  };
};

describe('work order PDF', () => {
  it('extracts the WO8.17 text, Figtree, and page 1 / 1', async () => {
    const bytes = await renderPdf(wo817());
    writeFileSync('/tmp/wo817-sanitized.pdf', bytes);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const { text, fonts } = textOf(bytes);
    expect(fonts).toMatch(/Figtree/);
    expect(text).toContain('WORK ORDER');
    expect(text).toContain('WO8.17');
    expect(text).toContain('Jaguars Stadium of the Future');
    expect(text).toContain('Hunt Construction-Barton Malow');
    expect(text).toContain('ALLCO5');
    expect(text).toContain('2966923');
    expect(text).toContain('2nd Restroom Rent');
    expect(text).toContain('2nd Restroom');
    expect(text).toContain('Personal Property Expense');
    expect(text).toContain('123 Example St');
    expect(text).toContain('$2,889.73');
    expect(text).toContain('$216.73');
    expect(text).toContain('$3,106.46');
    expect(text).toContain('Page 1 / 1');
    expect(text).not.toContain('Amount Paid');
    expect(text).not.toContain('Balance Due');
    expect(text).not.toContain('ATTACHMENT-SENTINEL-XYZ');
    expect(pdfFileName('{number} - {project}.pdf', 'WO8.17', 'Jaguars Stadium of the Future')).toBe(
      'WO8.17 - Jaguars Stadium of the Future.pdf'
    );
  });

  it('shows a post-tax adjustment once and can opt in to amount paid', async () => {
    const adjusted = textOf(
      await renderPdf(
        wo817({ manualTotalCents: 310000, adjustmentCents: -646, totalCents: 310000 } as Partial<WorkOrderPdfModel>)
      )
    ).text;
    expect(adjusted).toContain('Adjustment');
    expect(adjusted).toContain('-$6.46');
    expect(adjusted).toContain('$3,100.00');
    expect(adjusted.match(/-?\$6\.46/g)).toHaveLength(1);

    const paid = textOf(await renderPdf(wo817({ showAmountPaid: true, amountPaidCents: 100000 }))).text;
    expect(paid).toContain('Amount Paid');
    expect(paid).toContain('$1,000.00');
    expect(paid).toContain('Balance Due');
    expect(paid).toContain('$2,106.46');
  });

  it('labels a credit memo without a second negative', async () => {
    const bytes = await renderPdf(
      wo817({
        documentType: 'credit_memo',
        numberText: 'CM-1001',
        originalVendorInvoiceNumber: '2966923',
        lines: [wo817().lines[2]],
        subtotalCents: 18895,
        taxCents: 1417,
        totalCents: 20312
      })
    );
    writeFileSync('/tmp/cm-1001.pdf', bytes);
    const text = textOf(bytes).text;
    expect(text).toContain('CREDIT MEMO');
    expect(text).toContain('CM-1001');
    expect(text).toContain('Credit Total');
    expect(text).toContain('Vendor invoice 2966923');
    expect(text).not.toContain('-$203.12');
  });

  it('keeps every title on a multi-page letter document', async () => {
    const lines = Array.from({ length: 40 }, (_, index) => ({
      title: `Fixture line ${String(index + 1).padStart(2, '0')}`,
      description: 'Longer description so the row takes vertical space on the letter page.',
      serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
      quantity: '1',
      unitCostCents: 1000,
      lineTotalCents: 1000
    }));
    const bytes = await renderPdf(
      wo817({
        lines,
        subtotalCents: 40000,
        taxCents: 3000,
        totalCents: 43000
      })
    );
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
    const text = textOf(bytes).text;
    for (const line of lines) expect(text).toContain(line.title);
    expect(text).toContain('Page 1 /');
  });
});

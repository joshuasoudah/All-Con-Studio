// @vitest-environment node
import fs from 'fs';
import os from 'os';
import path from 'path';
import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { initSchema } from '../../db/setup';
import { createSqliteAdapter } from '../../db/client';
import type { DatabaseAdapter } from '../../types/DatabaseAdapter';
import { backupSqlite, restoreDatabase } from '../backup';
import { StudioError } from '../errors';
import { ensureAllConDatabase } from '../open';
import { initAllConSchema } from '../schema';
import {
  addAttachment,
  archiveDocument,
  archiveProject,
  archiveVendor,
  countDocuments,
  deleteDocument,
  deleteProject,
  deleteVendor,
  duplicateDocument,
  duplicateProject,
  finalizeDocument,
  getAttachment,
  getCompany,
  getDocument,
  getProject,
  getStudioSettings,
  getStudioState,
  getVendor,
  listAttachments,
  importDocument,
  listDocuments,
  listProjects,
  listVendors,
  saveDocument,
  saveProject,
  saveVendor,
  seedDemo,
  suggestNumber,
  updateCompany,
  updateStudioSettings
} from '../store';

const files: string[] = [];
const openers: DatabaseAdapter[] = [];

const tempFile = () => {
  const filePath = path.join(os.tmpdir(), `allcon-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  files.push(filePath);
  return filePath;
};

const memory = async () => {
  const raw = await new Promise<sqlite3.Database>((resolve, reject) => {
    const database = new sqlite3.Database(':memory:', error => (error ? reject(error) : resolve(database)));
  });
  const adapter = createSqliteAdapter(raw);
  await initAllConSchema(adapter);
  openers.push(adapter);
  return { adapter, raw };
};

const lines = [
  {
    title: '2nd Restroom Rent',
    description: 'Restroom, 12x30 DBPR Rent (Item1129)(BG) (Bldg ID # 33135/ E-Code 526842)',
    serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
    quantity: '1',
    unitCostCents: 269790
  },
  {
    title: '2nd Restroom',
    description: 'Security Door Bars Office, 24x56 DBPR (Item1376W) (Bldg ID # 89263/ E-Code 737086, 737087)',
    serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
    quantity: '1',
    unitCostCents: 288
  },
  {
    title: 'Personal Property Expense',
    serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
    quantity: '1',
    unitCostCents: 18895
  }
];

const fixture = async () => {
  const { adapter } = await memory();
  const project = await saveProject(adapter, {
    groupNumber: '8',
    name: 'Jaguars Stadium of the Future',
    jobNumber: 'Default',
    subcontractNumber: 'WO8',
    billToName: 'Hunt Construction-Barton Malow',
    billToAddressLine1: '123 Example St',
    billToCity: 'Jacksonville',
    billToRegion: 'FL',
    billToPostalCode: '32202',
    taxName: 'Default',
    taxRateBps: 750,
    dueDateRule: 'net',
    dueDateDays: 30
  });
  const vendor = await saveVendor(adapter, { name: 'All Construction Group', vendorNumber: 'ALLCO5' });
  return { adapter, project, vendor };
};

afterEach(async () => {
  await Promise.all(openers.splice(0).map(adapter => adapter.close().catch(() => undefined)));
  for (const filePath of files.splice(0)) {
    for (const suffix of ['', '-shm', '-wal']) {
      if (fs.existsSync(filePath + suffix)) fs.unlinkSync(filePath + suffix);
    }
  }
});

describe('all con documents', () => {
  it('prices a stadium work order, a follow-up, a second group, and a credit memo', async () => {
    const { adapter, project, vendor } = await fixture();
    const school = await saveProject(adapter, {
      groupNumber: '3',
      name: 'Riverside Elementary Addition',
      jobNumber: 'RIV-14',
      subcontractNumber: 'WO3',
      billToName: 'Example School Board',
      billToAddressLine1: '400 Example Ave',
      billToCity: 'Jacksonville',
      billToRegion: 'FL',
      billToPostalCode: '32202',
      taxName: 'Default',
      taxRateBps: 0,
      dueDateRule: 'net',
      dueDateDays: 30
    });
    const stadium = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.17',
      vendorInvoiceNumber: '2966923',
      issuedOn: '2026-10-15',
      showAmountPaid: true,
      amountPaidCents: 0,
      lines
    });
    expect(stadium.numberText).toBe('WO8.17');
    expect(stadium.dueOn).toBe('2026-11-14');
    expect(stadium.subtotalCents).toBe(288973);
    expect(stadium.taxCents).toBe(21673);
    expect(stadium.totalCents).toBe(310646);
    expect(stadium.balanceCents).toBe(310646);
    expect(stadium.jobNumber).toBe('Default');
    expect(stadium.subcontractNumber).toBe('WO8');

    const followUp = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      vendorInvoiceNumber: '2967104',
      issuedOn: '2026-10-20',
      lines: [{ title: 'Site labor', description: 'Gate relocation', quantity: '40', unitCostCents: 8550 }]
    });
    expect(followUp.numberText).toBe('WO8.18');
    expect(followUp.dueOn).toBe('2026-11-19');
    expect(followUp.subtotalCents).toBe(342000);
    expect(followUp.taxCents).toBe(25650);
    expect(followUp.totalCents).toBe(367650);

    const schoolOrder = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: school?.id,
      vendorId: vendor.id,
      vendorInvoiceNumber: '44102',
      issuedOn: '2026-09-02',
      lines: [
        {
          title: 'Temporary fencing',
          description: 'Chain link, 6 ft, along the north laydown yard.',
          quantity: '1',
          unitCostCents: 185000
        }
      ]
    });
    expect(schoolOrder.numberText).toBe('WO3.1');
    expect(schoolOrder.dueOn).toBe('2026-10-02');
    expect(schoolOrder.taxCents).toBe(0);
    expect(schoolOrder.totalCents).toBe(185000);
    expect(schoolOrder.projectName).toBe('Riverside Elementary Addition');

    const credit = await saveDocument(adapter, {
      documentType: 'credit_memo',
      groupId: project.id,
      vendorId: vendor.id,
      originalVendorInvoiceNumber: '2966923',
      issuedOn: '2026-10-16',
      lines: [lines[2]]
    });
    expect(credit.numberText).toBe('CM-1001');
    expect(credit.subtotalCents).toBe(18895);
    expect(credit.taxCents).toBe(1417);
    expect(credit.totalCents).toBe(20312);
    expect(await suggestNumber(adapter, 'work_order', '8')).toBe('WO8.19');
    expect(await suggestNumber(adapter, 'work_order', '3')).toBe('WO3.2');
    expect(await suggestNumber(adapter, 'credit_memo')).toBe('CM-1002');
  });

  it('seeds the sanitized WO8.17 fixture and the next numbers', async () => {
    const { adapter } = await memory();
    await seedDemo(adapter);
    const documents = await listDocuments(adapter, { includeArchived: true });
    const workOrder = documents.find(document => document.numberText === 'WO8.17');
    const credit = documents.find(document => document.numberText === 'CM-1001');
    expect(workOrder?.totalCents).toBe(310646);
    expect(workOrder?.taxCents).toBe(21673);
    expect(workOrder?.companyAddressLine1).toBe('123 Example St');
    expect(workOrder?.companyPhone).toBe('(904) 555-0100');
    expect(workOrder?.lines.map(line => line.lineTotalCents)).toEqual([269790, 288, 18895]);
    expect(credit?.documentType).toBe('credit_memo');
    expect(await suggestNumber(adapter, 'work_order', '8')).toBe('WO8.18');
    expect(await suggestNumber(adapter, 'credit_memo')).toBe('CM-1002');
  });

  it('numbers work orders per group, rejects duplicates, and sorts numerically', async () => {
    const { adapter, project, vendor } = await fixture();
    const first = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.17',
      issuedOn: '2026-10-15',
      lines
    });
    expect(first.numberText).toBe('WO8.17');
    expect(first.totalCents).toBe(310646);
    const second = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      lines
    });
    expect(second.numberText).toBe('WO8.18');
    await expect(
      saveDocument(adapter, {
        documentType: 'work_order',
        groupId: project.id,
        vendorId: vendor.id,
        numberText: 'WO8.17',
        lines
      })
    ).rejects.toMatchObject({ key: 'error.duplicateNumber' });
    const manual = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.25',
      lines
    });
    expect(manual.numberText).toBe('WO8.25');
    expect(manual.numberOverridden).toBe(true);
    expect(await suggestNumber(adapter, 'work_order', '8')).toBe('WO8.26');

    await importDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.2',
      lines,
      status: 'finalized'
    });
    await importDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.10',
      lines
    });
    const numbers = (await listDocuments(adapter, { documentType: 'work_order', includeArchived: true })).map(
      document => document.numberText
    );
    expect(numbers).toEqual(['WO8.2', 'WO8.10', 'WO8.17', 'WO8.18', 'WO8.25']);
    expect(await suggestNumber(adapter, 'work_order', '8')).toBe('WO8.26');
    const imported = await listDocuments(adapter, { documentType: 'work_order', includeArchived: true });
    expect(imported.find(document => document.numberText === 'WO8.2')?.status).toBe('finalized');
  });

  it('keeps project templates, vendors, and credit memos independent', async () => {
    const { adapter, project, vendor } = await fixture();
    const before = await suggestNumber(adapter, 'work_order', '8');
    await saveVendor(adapter, { name: 'Another Vendor', vendorNumber: 'ZZ' });
    expect(await suggestNumber(adapter, 'work_order', '8')).toBe(before);

    const draft = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.17',
      issuedOn: '2026-10-15',
      lines
    });
    expect(draft.dueOn).toBe('2026-11-14');
    await saveDocument(adapter, { id: draft.id, documentType: 'work_order', billToName: 'Edited Bill To' });
    expect((await getProject(adapter, project.id)).billToName).toBe('Hunt Construction-Barton Malow');
    expect((await getDocument(adapter, draft.id)).billToName).toBe('Edited Bill To');

    await saveVendor(adapter, { id: vendor.id, name: 'Renamed Vendor', vendorNumber: 'CHANGED' });
    const untouched = await getDocument(adapter, draft.id);
    expect(untouched.vendorNumber).toBe('ALLCO5');
    expect(untouched.vendorName).toBe('All Construction Group');

    const none = await saveProject(adapter, {
      groupNumber: '9',
      name: 'No due date',
      dueDateRule: 'none',
      taxRateBps: 0
    });
    const noDue = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: none.id,
      lines: [{ title: 'Labor', quantity: '1', unitCostCents: 100 }]
    });
    expect(noDue.dueOn).toBeNull();
    expect(noDue.numberText).toBe('WO9.1');

    await expect(saveProject(adapter, { groupNumber: '8', name: 'Duplicate' })).rejects.toBeInstanceOf(StudioError);
    const archived = await archiveProject(adapter, project.id, true);
    expect(archived.archived).toBe(true);
    expect((await listProjects(adapter)).some(item => item.id === project.id)).toBe(false);

    const credit = await saveDocument(adapter, {
      documentType: 'credit_memo',
      groupId: project.id,
      vendorId: vendor.id,
      originalVendorInvoiceNumber: '2966923',
      lines: [{ title: 'Personal Property Expense', quantity: '1', unitCostCents: 18895 }]
    });
    expect(credit.numberText).toBe('CM-1001');
    expect(credit.totalCents).toBeGreaterThan(0);
    expect(await suggestNumber(adapter, 'work_order', '8')).toBe('WO8.18');
    const workOrderBefore = await getDocument(adapter, draft.id);
    await deleteDocument(adapter, credit.id);
    expect(await getDocument(adapter, draft.id)).toEqual(workOrderBefore);
  });

  it('freezes a finalized snapshot and duplicates it as a new draft', async () => {
    const { adapter, project, vendor } = await fixture();
    await updateCompany(adapter, {
      addressLine1: '123 Example St',
      city: 'Jacksonville',
      region: 'FL',
      postalCode: '32202'
    });
    const draft = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.17',
      lines,
      manualTotalCents: 310000
    });
    expect(draft.adjustmentCents).toBe(-646);
    expect(draft.lines[0].lineTotalCents).toBe(269790);
    const finalized = await finalizeDocument(adapter, draft.id);
    expect(finalized.status).toBe('finalized');
    await saveProject(adapter, {
      id: project.id,
      groupNumber: '8',
      name: project.name,
      billToAddressLine1: '999 Changed Ave'
    });
    await updateCompany(adapter, { addressLine1: '999 Changed Ave' });
    const reread = await getDocument(adapter, finalized.id);
    expect(reread.billToAddressLine1).toBe('123 Example St');
    expect(reread.companyAddressLine1).toBe('123 Example St');
    await expect(
      saveDocument(adapter, { id: finalized.id, documentType: 'work_order', billToName: 'Nope' })
    ).rejects.toMatchObject({ key: 'error.finalizedImmutable' });
    await expect(deleteDocument(adapter, finalized.id)).rejects.toMatchObject({ key: 'error.finalizedImmutable' });

    const copy = await duplicateDocument(adapter, finalized.id);
    expect(copy.status).toBe('draft');
    expect(copy.numberText).toBe('WO8.18');
    expect(copy.billToAddressLine1).toBe('123 Example St');
    expect(copy.id).not.toBe(finalized.id);
  });

  it('filters the library and round-trips an attachment without changing the document', async () => {
    const { adapter, project, vendor } = await fixture();
    const workOrder = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      numberText: 'WO8.17',
      vendorInvoiceNumber: '2966923',
      issuedOn: '2026-10-15',
      lines
    });
    await finalizeDocument(adapter, workOrder.id);
    const otherVendor = await saveVendor(adapter, { name: 'Other', vendorNumber: 'OTHER' });
    await saveDocument(adapter, {
      documentType: 'credit_memo',
      groupId: project.id,
      vendorId: otherVendor.id,
      issuedOn: '2026-11-01',
      lines: [{ title: 'Credit line', quantity: '1', unitCostCents: 500 }]
    });
    const filtered = await listDocuments(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      status: 'finalized',
      issuedFrom: '2026-10-01',
      issuedTo: '2026-10-31',
      search: '2966923'
    });
    expect(filtered.map(document => document.numberText)).toEqual(['WO8.17']);

    const marker = Buffer.from('%PDF-1.4\nATTACHMENT-SENTINEL-XYZ\n%%EOF');
    const meta = await addAttachment(adapter, workOrder.id, {
      fileName: 'vendor-invoice.pdf',
      mimeType: 'application/pdf',
      bytesBase64: marker.toString('base64')
    });
    expect(await listAttachments(adapter, workOrder.id)).toEqual([
      expect.objectContaining({ id: meta.id, fileName: 'vendor-invoice.pdf' })
    ]);
    const stored = await getAttachment(adapter, meta.id);
    const state = await getStudioState(adapter);
    expect(state.recent.some(document => document.numberText === 'WO8.17')).toBe(true);
    expect(Buffer.from(stored.bytesBase64, 'base64').subarray(0, 4).toString()).toBe('%PDF');
    expect(Buffer.from(stored.bytesBase64, 'base64').toString()).toContain('ATTACHMENT-SENTINEL-XYZ');
    expect((await getDocument(adapter, workOrder.id)).lines).toHaveLength(3);
  });

  it('backs up and restores only after confirmation, and refuses an invoice-builder file', async () => {
    const filePath = tempFile();
    const handle = await ensureAllConDatabase(filePath, { seed: false });
    openers.push(handle.adapter);
    const project = await saveProject(handle.adapter, {
      groupNumber: '8',
      name: 'Jaguars Stadium of the Future',
      taxRateBps: 750
    });
    await saveDocument(handle.adapter, {
      documentType: 'work_order',
      groupId: project.id,
      numberText: 'WO8.17',
      lines
    });
    const backupPath = tempFile();
    await backupSqlite(handle.raw, backupPath);
    const opened = await ensureAllConDatabase(backupPath, { createIfMissing: false, seed: false });
    openers.push(opened.adapter);
    expect(await countDocuments(opened.adapter)).toBe(await countDocuments(handle.adapter));

    await saveDocument(handle.adapter, { documentType: 'work_order', groupId: project.id, lines });
    expect(await countDocuments(handle.adapter)).toBe(2);
    await expect(restoreDatabase({ handle, sourcePath: backupPath, confirmed: false })).rejects.toMatchObject({
      key: 'error.restoreNotConfirmed'
    });
    expect(await countDocuments(handle.adapter)).toBe(2);

    const restored = await restoreDatabase({ handle, sourcePath: backupPath, confirmed: true });
    expect(fs.existsSync(restored.safetyPath)).toBe(true);
    files.push(restored.safetyPath);
    const reopened = await ensureAllConDatabase(filePath, { createIfMissing: false, seed: false });
    openers.push(reopened.adapter);
    expect(await countDocuments(reopened.adapter)).toBe(1);
    expect((await listDocuments(reopened.adapter, { includeArchived: true }))[0].numberText).toBe('WO8.17');

    const legacyPath = tempFile();
    const legacyRaw = new sqlite3.Database(legacyPath);
    const legacy = createSqliteAdapter(legacyRaw);
    await initSchema(legacy);
    await legacy.close();
    await expect(ensureAllConDatabase(legacyPath, { createIfMissing: true, seed: false })).rejects.toMatchObject({
      key: 'error.notAllConDatabase'
    });
    expect(fs.existsSync(legacyPath)).toBe(true);
  });

  it('covers validation, renumbering, and empty-value branches', async () => {
    const { adapter, project, vendor } = await fixture();
    const spare = await saveVendor(adapter, { name: 'Spare Vendor', vendorNumber: 'SP' });
    const renamed = await saveVendor(adapter, { id: spare.id, name: 'Spare Vendor Updated' });
    expect(renamed.vendorNumber).toBe('SP');
    await archiveVendor(adapter, spare.id);
    await archiveVendor(adapter, spare.id, false);
    expect((await listVendors(adapter, true)).some(item => item.id === spare.id)).toBe(true);
    expect((await listVendors(adapter)).some(item => item.id === spare.id)).toBe(true);
    await deleteVendor(adapter, spare.id);
    await expect(saveVendor(adapter, { name: '   ' })).rejects.toMatchObject({ key: 'error.vendorRequired' });
    await expect(getVendor(adapter, 'missing-vendor')).rejects.toMatchObject({ key: 'error.notFound' });

    const draft = await saveDocument(adapter, {
      documentType: 'work_order',
      groupId: project.id,
      vendorId: vendor.id,
      lines: [{ title: 'Labor', quantity: '1', unitCostCents: 1000, serviceText: null }],
      showAmountPaid: true,
      amountPaidCents: 100,
      overrideBasis: 'pre-tax',
      manualTotalCents: 1000
    });
    expect(draft.numberOverridden).toBe(false);
    await expect(deleteVendor(adapter, vendor.id)).rejects.toMatchObject({ key: 'error.vendorInUse' });
    await expect(deleteProject(adapter, project.id)).rejects.toMatchObject({ key: 'error.projectInUse' });

    const unused = await saveProject(adapter, { groupNumber: '11', name: 'Unused group', taxRateBps: 0 });
    const firstCopy = await duplicateProject(adapter, unused.id);
    const secondCopy = await duplicateProject(adapter, unused.id);
    expect(firstCopy.groupNumber).toBe('11-copy');
    expect(secondCopy.groupNumber).toBe('11-copy-2');
    await deleteProject(adapter, firstCopy.id);
    expect(await listProjects(adapter, true)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: project.id })])
    );

    await expect(suggestNumber(adapter, 'work_order', '')).rejects.toMatchObject({ key: 'error.groupRequired' });
    await expect(
      saveDocument(adapter, {
        documentType: 'work_order',
        lines: [{ title: 'Labor', quantity: '1', unitCostCents: 100 }]
      })
    ).rejects.toMatchObject({ key: 'error.groupRequired' });
    await expect(
      saveDocument(adapter, {
        documentType: 'work_order',
        groupId: project.id,
        numberText: 'NOT-A-NUMBER',
        lines: [{ title: 'Labor', quantity: '1', unitCostCents: 100 }]
      })
    ).rejects.toMatchObject({ key: 'error.numberFormat' });
    await expect(
      saveDocument(adapter, {
        documentType: 'work_order',
        groupId: project.id,
        lines: [{ title: '   ', quantity: '1', unitCostCents: 100 }]
      })
    ).rejects.toMatchObject({ key: 'error.lineTitle' });
    await expect(
      importDocument(adapter, {
        documentType: 'work_order',
        groupId: project.id,
        numberText: 'BAD',
        lines: [{ title: 'Labor', quantity: '1', unitCostCents: 100 }]
      })
    ).rejects.toMatchObject({ key: 'error.numberFormat' });

    const credit = await saveDocument(adapter, {
      documentType: 'credit_memo',
      lines: [{ title: 'Credit', quantity: '', unitCostCents: 500 }]
    });
    expect(credit.groupId).toBeNull();
    expect(credit.projectName).toBe('');
    const customCredit = await saveDocument(adapter, {
      documentType: 'credit_memo',
      numberText: 'CREDIT',
      lines: [{ title: 'Plain credit', quantity: '1', unitCostCents: 100 }]
    });
    expect(customCredit.numberText).toBe('CREDIT');
    expect(customCredit.numberOverridden).toBe(true);

    const other = await saveProject(adapter, {
      groupNumber: '12',
      name: 'Other group',
      taxRateBps: 0,
      dueDateRule: 'none'
    });
    const moved = await saveDocument(adapter, {
      id: draft.id,
      documentType: 'work_order',
      groupId: other.id,
      vendorId: null,
      dueOn: null,
      manualTotalCents: null,
      lines: [{ title: 'Labor', quantity: '', unitCostCents: 1000 }]
    });
    expect(moved.numberText).toBe('WO12.1');
    expect(moved.vendorId).toBeNull();
    expect(moved.dueOn).toBeNull();
    expect(moved.manualTotalCents).toBeNull();

    const finalized = await finalizeDocument(adapter, moved.id);
    const paid = await saveDocument(adapter, {
      id: finalized.id,
      documentType: 'work_order',
      showAmountPaid: true,
      amountPaidCents: 250,
      archived: true
    });
    expect(paid.archived).toBe(true);
    expect(paid.amountPaidCents).toBe(250);
    expect((await listDocuments(adapter, { archived: true, includeArchived: true })).map(item => item.id)).toContain(
      paid.id
    );
    await archiveDocument(adapter, credit.id, false);
    expect((await getDocument(adapter, credit.id)).archived).toBe(false);

    await expect(getAttachment(adapter, 'missing-file')).rejects.toMatchObject({ key: 'error.notFound' });
    const empty = await addAttachment(adapter, credit.id, {
      fileName: 'empty.pdf',
      mimeType: 'application/pdf',
      bytesBase64: ''
    });
    await expect(getAttachment(adapter, empty.id)).rejects.toMatchObject({ key: 'error.notFound' });
    await expect(getDocument(adapter, 'missing-document')).rejects.toMatchObject({ key: 'error.notFound' });
    await expect(getProject(adapter, 'missing-project')).rejects.toMatchObject({ key: 'error.notFound' });

    await expect(updateStudioSettings(adapter, { totalOverrideBasis: 'sideways' as 'post-tax' })).rejects.toMatchObject(
      { key: 'error.overrideBasis' }
    );
    const configured = await updateStudioSettings(adapter, {
      creditPrefix: 'CR-',
      creditStart: 2000,
      creditPadding: 5,
      filenamePattern: '{number}.pdf',
      showAmountPaidDefault: true,
      totalOverrideBasis: 'pre-tax'
    });
    expect(configured.creditPrefix).toBe('CR-');
    expect(configured.showAmountPaidDefault).toBe(true);
    const kept = await updateStudioSettings(adapter, {});
    expect(kept.creditPrefix).toBe('CR-');
    const cleared = await updateCompany(adapter, { logoBase64: '', logoMime: null });
    expect(cleared.logoBase64).toBeNull();
    const logo = await updateCompany(adapter, {
      logoBase64: Buffer.from('png').toString('base64'),
      logoMime: 'image/png'
    });
    expect(logo.logoBase64).toBeTruthy();

    await adapter.run(
      `UPDATE ac_settings SET creditPrefix = '', creditStart = 0, filenamePattern = '', totalOverrideBasis = '' WHERE id = 1`
    );
    const fallback = await getStudioSettings(adapter);
    expect(fallback.creditPrefix).toBe('CM-');
    expect(fallback.creditStart).toBe(1001);
    expect(fallback.filenamePattern).toBe('{number} - {project}.pdf');
    expect(fallback.totalOverrideBasis).toBe('post-tax');
    await seedDemo(adapter);
    expect(await countDocuments(adapter)).toBeGreaterThan(0);

    await adapter.run('DELETE FROM ac_settings WHERE id = 1');
    await expect(getStudioSettings(adapter)).rejects.toMatchObject({ key: 'error.notFound' });
    await adapter.run(`DELETE FROM ac_company WHERE id = 'company'`);
    await expect(getCompany(adapter)).rejects.toMatchObject({ key: 'error.notFound' });
    await expect(updateCompany(adapter, { name: 'Missing' })).rejects.toMatchObject({ key: 'error.notFound' });
  });
});

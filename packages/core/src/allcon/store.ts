import { randomUUID } from 'node:crypto';
import {
  addIsoDays,
  compareWorkOrderNumbers,
  formatCreditNumber,
  formatWorkOrderNumber,
  parseWorkOrderNumber,
  type StudioAttachment,
  type StudioAttachmentMeta,
  type StudioCompany,
  type StudioCompanyWrite,
  type StudioDocument,
  type StudioDocumentWrite,
  type StudioLine,
  type StudioLineWrite,
  type StudioListFilter,
  type StudioProject,
  type StudioProjectWrite,
  type StudioSettings,
  type StudioSettingsWrite,
  type StudioVendor,
  type StudioVendorWrite,
  type TotalOverrideBasis
} from '@invoice-builder/contracts';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { StudioError } from './errors';
import { priceDocument } from './money';

type Row = Record<string, unknown>;

const nowIso = () => new Date().toISOString();
const newId = () => randomUUID();
const text = (row: Row, key: string) => (row[key] == null ? '' : String(row[key]));
const nullableText = (row: Row, key: string) => (row[key] == null ? null : String(row[key]));
const integer = (row: Row, key: string) => (row[key] == null ? 0 : Number(row[key]));
const integerOrNull = (row: Row, key: string) => (row[key] == null ? null : Number(row[key]));
const flag = (row: Row, key: string) => Number(row[key] ?? 0) === 1;

const blobBase64 = (value: unknown) => {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  return null;
};

const rethrow = (error: unknown): never => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('UNIQUE') && message.includes('ac_documents')) {
    throw new StudioError('error.duplicateNumber', 'That document number is already used.');
  }
  if (message.includes('UNIQUE') && message.includes('groupNumber')) {
    throw new StudioError('error.duplicateGroupNumber', 'That project group number is already used.');
  }
  throw error instanceof Error ? error : new Error(message);
};

const transaction = async <T>(db: DatabaseAdapter, work: () => Promise<T>) => {
  await db.run('BEGIN');
  try {
    const result = await work();
    await db.run('COMMIT');
    return result;
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch {
      // Keep the original failure.
    }
    throw error;
  }
};

const mapCompany = (row: Row): StudioCompany => ({
  name: text(row, 'name'),
  addressLine1: text(row, 'addressLine1'),
  addressLine2: text(row, 'addressLine2'),
  city: text(row, 'city'),
  region: text(row, 'region'),
  postalCode: text(row, 'postalCode'),
  phone: text(row, 'phone'),
  email: text(row, 'email'),
  logoBase64: blobBase64(row.logoBlob),
  logoMime: nullableText(row, 'logoMime')
});

const mapSettings = (row: Row): StudioSettings => ({
  creditPrefix: text(row, 'creditPrefix') || 'CM-',
  creditStart: integer(row, 'creditStart') || 1001,
  creditPadding: integer(row, 'creditPadding'),
  filenamePattern: text(row, 'filenamePattern') || '{number} - {project}.pdf',
  showAmountPaidDefault: flag(row, 'showAmountPaidDefault'),
  totalOverrideBasis: (text(row, 'totalOverrideBasis') || 'post-tax') as TotalOverrideBasis,
  databasePath: text(row, 'databasePath')
});

const mapProject = (row: Row): StudioProject => ({
  id: text(row, 'id'),
  groupNumber: text(row, 'groupNumber'),
  name: text(row, 'name'),
  jobNumber: text(row, 'jobNumber'),
  subcontractNumber: text(row, 'subcontractNumber'),
  billToName: text(row, 'billToName'),
  billToAddressLine1: text(row, 'billToAddressLine1'),
  billToAddressLine2: text(row, 'billToAddressLine2'),
  billToCity: text(row, 'billToCity'),
  billToRegion: text(row, 'billToRegion'),
  billToPostalCode: text(row, 'billToPostalCode'),
  billToEmail: text(row, 'billToEmail'),
  taxName: text(row, 'taxName') || 'Default',
  taxRateBps: integer(row, 'taxRateBps'),
  dueDateRule: text(row, 'dueDateRule') === 'none' ? 'none' : 'net',
  dueDateDays: integer(row, 'dueDateDays'),
  archived: flag(row, 'archived'),
  createdAt: text(row, 'createdAt'),
  updatedAt: text(row, 'updatedAt')
});

const mapVendor = (row: Row): StudioVendor => ({
  id: text(row, 'id'),
  name: text(row, 'name'),
  vendorNumber: text(row, 'vendorNumber'),
  addressLine1: text(row, 'addressLine1'),
  city: text(row, 'city'),
  region: text(row, 'region'),
  postalCode: text(row, 'postalCode'),
  email: text(row, 'email'),
  phone: text(row, 'phone'),
  archived: flag(row, 'archived'),
  createdAt: text(row, 'createdAt'),
  updatedAt: text(row, 'updatedAt')
});

const mapLine = (row: Row): StudioLine => ({
  id: text(row, 'id'),
  position: integer(row, 'position'),
  title: text(row, 'title'),
  description: text(row, 'description'),
  notes: text(row, 'notes'),
  serviceStart: nullableText(row, 'serviceStart'),
  serviceEnd: nullableText(row, 'serviceEnd'),
  serviceText: nullableText(row, 'serviceText'),
  quantity: text(row, 'quantity'),
  unitCostCents: integer(row, 'unitCostCents'),
  lineTotalCents: integer(row, 'lineTotalCents')
});

const mapDocument = (row: Row, lines: StudioLine[], includeLogo: boolean): StudioDocument => {
  const totalCents = integer(row, 'totalCents');
  const amountPaidCents = integer(row, 'amountPaidCents');
  return {
    id: text(row, 'id'),
    documentType: text(row, 'documentType') as StudioDocument['documentType'],
    status: text(row, 'status') as StudioDocument['status'],
    groupId: nullableText(row, 'groupId'),
    groupNumber: text(row, 'groupNumber'),
    sequence: integerOrNull(row, 'sequence'),
    numberText: text(row, 'numberText'),
    numberOverridden: flag(row, 'numberOverridden'),
    vendorId: nullableText(row, 'vendorId'),
    vendorName: text(row, 'vendorName'),
    vendorNumber: text(row, 'vendorNumber'),
    vendorInvoiceNumber: text(row, 'vendorInvoiceNumber'),
    originalVendorInvoiceNumber: text(row, 'originalVendorInvoiceNumber'),
    relatedDocumentId: nullableText(row, 'relatedDocumentId'),
    projectName: text(row, 'projectName'),
    jobNumber: text(row, 'jobNumber'),
    subcontractNumber: text(row, 'subcontractNumber'),
    billToName: text(row, 'billToName'),
    billToAddressLine1: text(row, 'billToAddressLine1'),
    billToAddressLine2: text(row, 'billToAddressLine2'),
    billToCity: text(row, 'billToCity'),
    billToRegion: text(row, 'billToRegion'),
    billToPostalCode: text(row, 'billToPostalCode'),
    billToEmail: text(row, 'billToEmail'),
    companyName: text(row, 'companyName'),
    companyAddressLine1: text(row, 'companyAddressLine1'),
    companyAddressLine2: text(row, 'companyAddressLine2'),
    companyCity: text(row, 'companyCity'),
    companyRegion: text(row, 'companyRegion'),
    companyPostalCode: text(row, 'companyPostalCode'),
    companyPhone: text(row, 'companyPhone'),
    companyEmail: text(row, 'companyEmail'),
    logoBase64: includeLogo ? blobBase64(row.companyLogoBlob) : null,
    logoMime: includeLogo ? nullableText(row, 'companyLogoMime') : null,
    issuedOn: text(row, 'issuedOn'),
    dueOn: nullableText(row, 'dueOn'),
    taxName: text(row, 'taxName'),
    taxRateBps: integer(row, 'taxRateBps'),
    overrideBasis: (text(row, 'overrideBasis') || 'post-tax') as TotalOverrideBasis,
    manualTotalCents: integerOrNull(row, 'manualTotalCents'),
    calculatedTotalCents: integer(row, 'calculatedTotalCents'),
    adjustmentCents: integer(row, 'adjustmentCents'),
    subtotalCents: integer(row, 'subtotalCents'),
    taxCents: integer(row, 'taxCents'),
    totalCents,
    showAmountPaid: flag(row, 'showAmountPaid'),
    amountPaidCents,
    balanceCents: totalCents - amountPaidCents,
    archived: flag(row, 'archived'),
    lines,
    createdAt: text(row, 'createdAt'),
    updatedAt: text(row, 'updatedAt')
  };
};

const loadLines = async (db: DatabaseAdapter, ids: string[]) => {
  const grouped = new Map<string, StudioLine[]>();
  if (!ids.length) return grouped;
  const rows = await db.all<Row>(
    `SELECT * FROM ac_lines WHERE documentId IN (${ids.map(() => '?').join(',')}) ORDER BY position`,
    ids
  );
  for (const row of rows) {
    const documentId = text(row, 'documentId');
    const list = grouped.get(documentId) ?? [];
    list.push(mapLine(row));
    grouped.set(documentId, list);
  }
  return grouped;
};

const sortDocuments = (documents: StudioDocument[]) =>
  documents.sort((left, right) => {
    if (left.documentType !== right.documentType) return left.documentType.localeCompare(right.documentType);
    if (left.documentType === 'work_order') return compareWorkOrderNumbers(left.numberText, right.numberText);
    return (left.sequence ?? 0) - (right.sequence ?? 0);
  });

export const getCompany = async (db: DatabaseAdapter) => {
  const row = await db.get<Row>('SELECT * FROM ac_company WHERE id = ?', ['company']);
  if (!row) throw new StudioError('error.notFound', 'Company profile is missing.');
  return mapCompany(row);
};

export const updateCompany = async (db: DatabaseAdapter, input: StudioCompanyWrite) => {
  const current = await db.get<Row>('SELECT * FROM ac_company WHERE id = ?', ['company']);
  if (!current) throw new StudioError('error.notFound', 'Company profile is missing.');
  const logoProvided = 'logoBase64' in input;
  await db.run(
    `UPDATE ac_company SET
      name = ?, addressLine1 = ?, addressLine2 = ?, city = ?, region = ?, postalCode = ?, phone = ?, email = ?,
      logoBlob = ?, logoMime = ?
     WHERE id = 'company'`,
    [
      input.name ?? text(current, 'name'),
      input.addressLine1 ?? text(current, 'addressLine1'),
      input.addressLine2 ?? text(current, 'addressLine2'),
      input.city ?? text(current, 'city'),
      input.region ?? text(current, 'region'),
      input.postalCode ?? text(current, 'postalCode'),
      input.phone ?? text(current, 'phone'),
      input.email ?? text(current, 'email'),
      logoProvided ? (input.logoBase64 ? Buffer.from(input.logoBase64, 'base64') : null) : (current.logoBlob ?? null),
      logoProvided ? (input.logoMime ?? null) : (current.logoMime ?? null)
    ]
  );
  return getCompany(db);
};

export const getStudioSettings = async (db: DatabaseAdapter) => {
  const row = await db.get<Row>('SELECT * FROM ac_settings WHERE id = 1');
  if (!row) throw new StudioError('error.notFound', 'Settings are missing.');
  return mapSettings(row);
};

export const rememberDatabasePath = async (db: DatabaseAdapter, filePath: string) => {
  await db.run('UPDATE ac_settings SET databasePath = ? WHERE id = 1', [filePath]);
};

export const updateStudioSettings = async (db: DatabaseAdapter, input: StudioSettingsWrite) => {
  const current = await getStudioSettings(db);
  const basis = input.totalOverrideBasis ?? current.totalOverrideBasis;
  if (basis !== 'post-tax' && basis !== 'pre-tax') {
    throw new StudioError('error.overrideBasis', 'Total override basis must be post-tax or pre-tax.');
  }
  await db.run(
    `UPDATE ac_settings SET creditPrefix = ?, creditStart = ?, creditPadding = ?, filenamePattern = ?,
      showAmountPaidDefault = ?, totalOverrideBasis = ? WHERE id = 1`,
    [
      input.creditPrefix ?? current.creditPrefix,
      input.creditStart ?? current.creditStart,
      input.creditPadding ?? current.creditPadding,
      input.filenamePattern ?? current.filenamePattern,
      (input.showAmountPaidDefault ?? current.showAmountPaidDefault) ? 1 : 0,
      basis
    ]
  );
  return getStudioSettings(db);
};

const projectValues = (input: StudioProjectWrite, createdAt: string) => [
  input.groupNumber.trim(),
  input.name.trim(),
  input.jobNumber?.trim() ?? '',
  input.subcontractNumber?.trim() ?? '',
  input.billToName?.trim() ?? '',
  input.billToAddressLine1?.trim() ?? '',
  input.billToAddressLine2?.trim() ?? '',
  input.billToCity?.trim() ?? '',
  input.billToRegion?.trim() ?? '',
  input.billToPostalCode?.trim() ?? '',
  input.billToEmail?.trim() ?? '',
  input.taxName?.trim() || 'Default',
  Math.round(input.taxRateBps ?? 0),
  input.dueDateRule === 'none' ? 'none' : 'net',
  Math.round(input.dueDateDays ?? 30),
  input.archived ? 1 : 0,
  createdAt
];

export const listProjects = async (db: DatabaseAdapter, includeArchived = false) => {
  const rows = await db.all<Row>(
    `SELECT * FROM ac_project_groups ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY CAST(groupNumber AS INTEGER), groupNumber`
  );
  return rows.map(mapProject);
};

export const getProject = async (db: DatabaseAdapter, id: string) => {
  const row = await db.get<Row>('SELECT * FROM ac_project_groups WHERE id = ?', [id]);
  if (!row) throw new StudioError('error.notFound', 'Project group was not found.');
  return mapProject(row);
};

export const saveProject = async (db: DatabaseAdapter, input: StudioProjectWrite & { id?: string }) => {
  if (!input.groupNumber?.trim() || !input.name?.trim()) {
    throw new StudioError('error.projectRequired', 'A project group needs a number and a name.');
  }
  const timestamp = nowIso();
  try {
    if (!input.id) {
      const id = newId();
      await db.run(
        `INSERT INTO ac_project_groups (
          id, groupNumber, name, jobNumber, subcontractNumber, billToName, billToAddressLine1, billToAddressLine2,
          billToCity, billToRegion, billToPostalCode, billToEmail, taxName, taxRateBps, dueDateRule, dueDateDays,
          archived, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, ...projectValues(input, timestamp), timestamp]
      );
      return getProject(db, id);
    }
    const existing = await getProject(db, input.id);
    await db.run(
      `UPDATE ac_project_groups SET
        groupNumber = ?, name = ?, jobNumber = ?, subcontractNumber = ?, billToName = ?, billToAddressLine1 = ?,
        billToAddressLine2 = ?, billToCity = ?, billToRegion = ?, billToPostalCode = ?, billToEmail = ?, taxName = ?,
        taxRateBps = ?, dueDateRule = ?, dueDateDays = ?, archived = ?, updatedAt = ?
       WHERE id = ?`,
      [
        ...projectValues({ ...input, archived: input.archived ?? existing.archived }, existing.createdAt).slice(0, -1),
        timestamp,
        input.id
      ]
    );
    return getProject(db, input.id);
  } catch (error) {
    rethrow(error);
  }
};

export const duplicateProject = async (db: DatabaseAdapter, id: string) => {
  const source = await getProject(db, id);
  let groupNumber = `${source.groupNumber}-copy`;
  let suffix = 2;
  while (await db.get('SELECT id FROM ac_project_groups WHERE groupNumber = ?', [groupNumber])) {
    groupNumber = `${source.groupNumber}-copy-${suffix}`;
    suffix += 1;
  }
  return saveProject(db, {
    groupNumber,
    name: source.name,
    jobNumber: source.jobNumber,
    subcontractNumber: source.subcontractNumber,
    billToName: source.billToName,
    billToAddressLine1: source.billToAddressLine1,
    billToAddressLine2: source.billToAddressLine2,
    billToCity: source.billToCity,
    billToRegion: source.billToRegion,
    billToPostalCode: source.billToPostalCode,
    billToEmail: source.billToEmail,
    taxName: source.taxName,
    taxRateBps: source.taxRateBps,
    dueDateRule: source.dueDateRule,
    dueDateDays: source.dueDateDays,
    archived: false
  });
};

export const archiveProject = async (db: DatabaseAdapter, id: string, archived = true) => {
  await db.run('UPDATE ac_project_groups SET archived = ?, updatedAt = ? WHERE id = ?', [
    archived ? 1 : 0,
    nowIso(),
    id
  ]);
  return getProject(db, id);
};

export const deleteProject = async (db: DatabaseAdapter, id: string) => {
  const used = await db.get('SELECT id FROM ac_documents WHERE groupId = ? LIMIT 1', [id]);
  if (used) throw new StudioError('error.projectInUse', 'Archive this project instead. Documents still reference it.');
  await db.run('DELETE FROM ac_project_groups WHERE id = ?', [id]);
};

export const listVendors = async (db: DatabaseAdapter, includeArchived = false) => {
  const rows = await db.all<Row>(
    `SELECT * FROM ac_vendors ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name`
  );
  return rows.map(mapVendor);
};

export const getVendor = async (db: DatabaseAdapter, id: string) => {
  const row = await db.get<Row>('SELECT * FROM ac_vendors WHERE id = ?', [id]);
  if (!row) throw new StudioError('error.notFound', 'Vendor was not found.');
  return mapVendor(row);
};

export const saveVendor = async (db: DatabaseAdapter, input: StudioVendorWrite & { id?: string }) => {
  if (!input.name?.trim()) throw new StudioError('error.vendorRequired', 'A vendor needs a name.');
  const timestamp = nowIso();
  const values = [
    input.name.trim(),
    input.vendorNumber?.trim() ?? '',
    input.addressLine1?.trim() ?? '',
    input.city?.trim() ?? '',
    input.region?.trim() ?? '',
    input.postalCode?.trim() ?? '',
    input.email?.trim() ?? '',
    input.phone?.trim() ?? '',
    input.archived ? 1 : 0
  ];
  if (!input.id) {
    const id = newId();
    await db.run(
      `INSERT INTO ac_vendors (
        id, name, vendorNumber, addressLine1, city, region, postalCode, email, phone, archived, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...values, timestamp, timestamp]
    );
    return getVendor(db, id);
  }
  const existing = await getVendor(db, input.id);
  await db.run(
    `UPDATE ac_vendors SET name = ?, vendorNumber = ?, addressLine1 = ?, city = ?, region = ?, postalCode = ?,
      email = ?, phone = ?, archived = ?, updatedAt = ? WHERE id = ?`,
    [
      input.name.trim(),
      input.vendorNumber ?? existing.vendorNumber,
      input.addressLine1 ?? existing.addressLine1,
      input.city ?? existing.city,
      input.region ?? existing.region,
      input.postalCode ?? existing.postalCode,
      input.email ?? existing.email,
      input.phone ?? existing.phone,
      (input.archived ?? existing.archived) ? 1 : 0,
      timestamp,
      input.id
    ]
  );
  return getVendor(db, input.id);
};

export const archiveVendor = async (db: DatabaseAdapter, id: string, archived = true) => {
  await db.run('UPDATE ac_vendors SET archived = ?, updatedAt = ? WHERE id = ?', [archived ? 1 : 0, nowIso(), id]);
  return getVendor(db, id);
};

export const deleteVendor = async (db: DatabaseAdapter, id: string) => {
  const used = await db.get('SELECT id FROM ac_documents WHERE vendorId = ? LIMIT 1', [id]);
  if (used) throw new StudioError('error.vendorInUse', 'Archive this vendor instead. Documents still reference it.');
  await db.run('DELETE FROM ac_vendors WHERE id = ?', [id]);
};

const readNext = async (db: DatabaseAdapter, documentType: string, groupNumber: string) => {
  const row = await db.get<Row>('SELECT nextSequence FROM ac_sequences WHERE documentType = ? AND groupNumber = ?', [
    documentType,
    groupNumber
  ]);
  return row ? integer(row, 'nextSequence') : null;
};

const writeNext = async (db: DatabaseAdapter, documentType: string, groupNumber: string, nextSequence: number) => {
  await db.run(
    `INSERT INTO ac_sequences (documentType, groupNumber, nextSequence) VALUES (?, ?, ?)
     ON CONFLICT(documentType, groupNumber) DO UPDATE SET nextSequence = excluded.nextSequence`,
    [documentType, groupNumber, nextSequence]
  );
};

const assertNumberAvailable = async (
  db: DatabaseAdapter,
  documentType: string,
  numberText: string,
  exceptId: string | null
) => {
  const row = await db.get<Row>(`SELECT id FROM ac_documents WHERE documentType = ? AND numberText = ? AND id != ?`, [
    documentType,
    numberText,
    exceptId ?? ''
  ]);
  if (row) throw new StudioError('error.duplicateNumber', 'That document number is already used.');
};

export const suggestNumber = async (
  db: DatabaseAdapter,
  documentType: StudioDocument['documentType'],
  groupNumber = ''
) => {
  if (documentType === 'credit_memo') {
    const settings = await getStudioSettings(db);
    const sequence = Math.max((await readNext(db, 'credit_memo', '')) ?? settings.creditStart, settings.creditStart);
    return formatCreditNumber(settings.creditPrefix, sequence, settings.creditPadding);
  }
  if (!groupNumber)
    throw new StudioError('error.groupRequired', 'Choose a project group before numbering a work order.');
  return formatWorkOrderNumber(groupNumber, (await readNext(db, 'work_order', groupNumber)) ?? 1);
};

const claimNumber = async (
  db: DatabaseAdapter,
  documentType: StudioDocument['documentType'],
  groupNumber: string,
  requested: string | null | undefined,
  exceptId: string | null
) => {
  if (documentType === 'credit_memo') {
    const settings = await getStudioSettings(db);
    const suggestedSeq = Math.max(
      (await readNext(db, 'credit_memo', '')) ?? settings.creditStart,
      settings.creditStart
    );
    const suggested = formatCreditNumber(settings.creditPrefix, suggestedSeq, settings.creditPadding);
    const trimmed = requested?.trim() ?? '';
    if (!trimmed || trimmed === suggested) {
      await writeNext(db, 'credit_memo', '', suggestedSeq + 1);
      return { sequence: suggestedSeq, numberText: suggested, overridden: false };
    }
    await assertNumberAvailable(db, 'credit_memo', trimmed, exceptId);
    const digits = /(\d+)$/.exec(trimmed);
    const sequence = digits ? Number(digits[1]) : suggestedSeq;
    await writeNext(db, 'credit_memo', '', Math.max(suggestedSeq, sequence + 1));
    return { sequence, numberText: trimmed, overridden: true };
  }
  const suggested = await suggestNumber(db, 'work_order', groupNumber);
  const trimmed = requested?.trim() ?? '';
  if (!trimmed || trimmed === suggested) {
    const parsed = parseWorkOrderNumber(suggested);
    if (!parsed) throw new StudioError('error.numberFormat', 'The suggested work order number is invalid.');
    await assertNumberAvailable(db, 'work_order', suggested, exceptId);
    await writeNext(db, 'work_order', groupNumber, parsed.sequence + 1);
    return { sequence: parsed.sequence, numberText: suggested, overridden: false };
  }
  const parsed = parseWorkOrderNumber(trimmed);
  if (!parsed || parsed.groupNumber !== groupNumber) {
    throw new StudioError('error.numberFormat', `Use a number like ${suggested} for this project group.`);
  }
  const numberText = formatWorkOrderNumber(parsed.groupNumber, parsed.sequence);
  await assertNumberAvailable(db, 'work_order', numberText, exceptId);
  const current = parseWorkOrderNumber(suggested)?.sequence ?? 1;
  await writeNext(db, 'work_order', groupNumber, Math.max(current, parsed.sequence + 1));
  return { sequence: parsed.sequence, numberText, overridden: true };
};

const replaceLines = async (
  db: DatabaseAdapter,
  documentId: string,
  lines: StudioLineWrite[],
  lineTotals: number[]
) => {
  await db.run('DELETE FROM ac_lines WHERE documentId = ?', [documentId]);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.title?.trim()) throw new StudioError('error.lineTitle', 'Each line needs a title.');
    await db.run(
      `INSERT INTO ac_lines (
        id, documentId, position, title, description, notes, serviceStart, serviceEnd, serviceText, quantity, unitCostCents, lineTotalCents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        documentId,
        index + 1,
        line.title.trim(),
        line.description?.trim() ?? '',
        line.notes?.trim() ?? '',
        line.serviceStart ?? null,
        line.serviceEnd ?? null,
        line.serviceText ?? null,
        line.quantity?.trim() || '0',
        Math.round(line.unitCostCents),
        lineTotals[index] ?? 0
      ]
    );
  }
};

const hydrate = async (db: DatabaseAdapter, id: string, includeLogo: boolean) => {
  const row = await db.get<Row>('SELECT * FROM ac_documents WHERE id = ?', [id]);
  if (!row) throw new StudioError('error.notFound', 'Document was not found.');
  const lines = (await loadLines(db, [id])).get(id) ?? [];
  return mapDocument(row, lines, includeLogo);
};

export const getDocument = (db: DatabaseAdapter, id: string) => hydrate(db, id, true);

export const listDocuments = async (db: DatabaseAdapter, filter: StudioListFilter = {}) => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.documentType) {
    where.push('documentType = ?');
    params.push(filter.documentType);
  }
  if (filter.groupId) {
    where.push('groupId = ?');
    params.push(filter.groupId);
  }
  if (filter.vendorId) {
    where.push('vendorId = ?');
    params.push(filter.vendorId);
  }
  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter.archived === true) where.push('archived = 1');
  else if (filter.archived === false || !filter.includeArchived) where.push('archived = 0');
  if (filter.search?.trim()) {
    where.push(
      '(numberText LIKE ? OR projectName LIKE ? OR vendorName LIKE ? OR vendorInvoiceNumber LIKE ? OR originalVendorInvoiceNumber LIKE ?)'
    );
    const like = `%${filter.search.trim()}%`;
    params.push(like, like, like, like, like);
  }
  if (filter.issuedFrom) {
    where.push('issuedOn >= ?');
    params.push(filter.issuedFrom);
  }
  if (filter.issuedTo) {
    where.push('issuedOn <= ?');
    params.push(filter.issuedTo);
  }
  const rows = await db.all<Row>(
    `SELECT * FROM ac_documents ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params
  );
  const lines = await loadLines(
    db,
    rows.map(row => text(row, 'id'))
  );
  return sortDocuments(rows.map(row => mapDocument(row, lines.get(text(row, 'id')) ?? [], false)));
};

const lineWritesFromDocument = (document: StudioDocument): StudioLineWrite[] =>
  document.lines.map(line => ({
    title: line.title,
    description: line.description,
    notes: line.notes,
    serviceStart: line.serviceStart,
    serviceEnd: line.serviceEnd,
    serviceText: line.serviceText,
    quantity: line.quantity,
    unitCostCents: line.unitCostCents
  }));

export const saveDocument = async (
  db: DatabaseAdapter,
  input: StudioDocumentWrite & { id?: string },
  options?: { assignNumber?: string; status?: StudioDocument['status'] }
) => {
  try {
    return await transaction(db, async () => {
      const settings = await getStudioSettings(db);
      const company = await db.get<Row>('SELECT * FROM ac_company WHERE id = ?', ['company']);
      if (!company) throw new StudioError('error.notFound', 'Company profile is missing.');
      if (!input.id) {
        if (input.documentType === 'work_order' && !input.groupId) {
          throw new StudioError('error.groupRequired', 'Choose a project group before numbering a work order.');
        }
        const group = input.groupId ? await getProject(db, input.groupId) : null;
        const vendor = input.vendorId ? await getVendor(db, input.vendorId) : null;
        const issuedOn = input.issuedOn ?? nowIso().slice(0, 10);
        const dueOn =
          'dueOn' in input
            ? (input.dueOn ?? null)
            : !group || group.dueDateRule === 'none'
              ? null
              : addIsoDays(issuedOn, group.dueDateDays);
        const lines = input.lines ?? [];
        const basis = input.overrideBasis ?? settings.totalOverrideBasis;
        const priced = priceDocument({
          lines,
          taxRateBps: input.taxRateBps ?? group?.taxRateBps ?? 0,
          manualTotalCents: input.manualTotalCents ?? null,
          overrideBasis: basis
        });
        const claimed = options?.assignNumber
          ? await assignImportedNumber(db, input.documentType, group?.groupNumber ?? '', options.assignNumber)
          : await claimNumber(db, input.documentType, group?.groupNumber ?? '', input.numberText, null);
        const id = newId();
        const timestamp = nowIso();
        await db.run(
          `INSERT INTO ac_documents (
            id, documentType, status, groupId, groupNumber, sequence, numberText, numberOverridden,
            vendorId, vendorName, vendorNumber, vendorInvoiceNumber, originalVendorInvoiceNumber, relatedDocumentId,
            projectName, jobNumber, subcontractNumber,
            billToName, billToAddressLine1, billToAddressLine2, billToCity, billToRegion, billToPostalCode, billToEmail,
            companyName, companyAddressLine1, companyAddressLine2, companyCity, companyRegion, companyPostalCode, companyPhone, companyEmail,
            companyLogoBlob, companyLogoMime,
            issuedOn, dueOn, taxName, taxRateBps, overrideBasis, manualTotalCents, calculatedTotalCents, adjustmentCents,
            subtotalCents, taxCents, totalCents, showAmountPaid, amountPaidCents, archived, createdAt, updatedAt
          ) VALUES (${Array.from({ length: 50 }, () => '?').join(', ')})`,
          [
            id,
            input.documentType,
            options?.status ?? 'draft',
            group?.id ?? null,
            group?.groupNumber ?? '',
            claimed.sequence,
            claimed.numberText,
            claimed.overridden ? 1 : 0,
            vendor?.id ?? null,
            input.vendorName ?? vendor?.name ?? '',
            input.vendorNumber ?? vendor?.vendorNumber ?? '',
            input.vendorInvoiceNumber?.trim() ?? '',
            input.originalVendorInvoiceNumber?.trim() ?? '',
            input.relatedDocumentId ?? null,
            input.projectName ?? group?.name ?? '',
            input.jobNumber ?? group?.jobNumber ?? '',
            input.subcontractNumber ?? group?.subcontractNumber ?? '',
            input.billToName ?? group?.billToName ?? '',
            input.billToAddressLine1 ?? group?.billToAddressLine1 ?? '',
            input.billToAddressLine2 ?? group?.billToAddressLine2 ?? '',
            input.billToCity ?? group?.billToCity ?? '',
            input.billToRegion ?? group?.billToRegion ?? '',
            input.billToPostalCode ?? group?.billToPostalCode ?? '',
            input.billToEmail ?? group?.billToEmail ?? '',
            text(company, 'name'),
            text(company, 'addressLine1'),
            text(company, 'addressLine2'),
            text(company, 'city'),
            text(company, 'region'),
            text(company, 'postalCode'),
            text(company, 'phone'),
            text(company, 'email'),
            company.logoBlob ?? null,
            company.logoMime ?? null,
            issuedOn,
            dueOn,
            input.taxName ?? group?.taxName ?? 'Default',
            input.taxRateBps ?? group?.taxRateBps ?? 0,
            basis,
            priced.manualTotalCents,
            priced.calculatedTotalCents,
            priced.adjustmentCents,
            priced.subtotalCents,
            priced.taxCents,
            priced.totalCents,
            (input.showAmountPaid ?? settings.showAmountPaidDefault) ? 1 : 0,
            Math.round(input.amountPaidCents ?? 0),
            0,
            timestamp,
            timestamp
          ]
        );
        await replaceLines(db, id, lines, priced.lineTotalCents);
        return hydrate(db, id, true);
      }

      const existing = await hydrate(db, input.id, true);
      if (existing.status === 'finalized') {
        const mutable = new Set(['archived', 'showAmountPaid', 'amountPaidCents']);
        const touched = Object.keys(input).filter(key => key !== 'id' && key !== 'documentType');
        if (touched.some(key => !mutable.has(key))) {
          throw new StudioError('error.finalizedImmutable', 'A finalized document cannot be edited.');
        }
        await db.run(
          `UPDATE ac_documents SET archived = ?, showAmountPaid = ?, amountPaidCents = ?, updatedAt = ? WHERE id = ?`,
          [
            (input.archived ?? existing.archived) ? 1 : 0,
            (input.showAmountPaid ?? existing.showAmountPaid) ? 1 : 0,
            Math.round(input.amountPaidCents ?? existing.amountPaidCents),
            nowIso(),
            existing.id
          ]
        );
        return hydrate(db, existing.id, true);
      }

      const group = (input.groupId === undefined ? existing.groupId : input.groupId)
        ? await getProject(db, (input.groupId === undefined ? existing.groupId : input.groupId) as string)
        : null;
      const vendorId = input.vendorId === undefined ? existing.vendorId : input.vendorId;
      const vendor = vendorId ? await getVendor(db, vendorId) : null;
      const lines = input.lines ?? lineWritesFromDocument(existing);
      const basis = input.overrideBasis ?? existing.overrideBasis;
      const manual = 'manualTotalCents' in input ? (input.manualTotalCents ?? null) : existing.manualTotalCents;
      const taxRateBps = input.taxRateBps ?? existing.taxRateBps;
      const priced = priceDocument({ lines, taxRateBps, manualTotalCents: manual, overrideBasis: basis });
      let sequence = existing.sequence;
      let numberText = existing.numberText;
      let overridden = existing.numberOverridden;
      const groupNumber = group?.groupNumber ?? existing.groupNumber;
      if (input.numberText != null && input.numberText.trim() !== existing.numberText) {
        const claimed = await claimNumber(db, existing.documentType, groupNumber, input.numberText, existing.id);
        sequence = claimed.sequence;
        numberText = claimed.numberText;
        overridden = claimed.overridden;
      } else if (
        group &&
        group.groupNumber !== existing.groupNumber &&
        !existing.numberOverridden &&
        input.numberText === undefined
      ) {
        const claimed = await claimNumber(db, existing.documentType, group.groupNumber, null, existing.id);
        sequence = claimed.sequence;
        numberText = claimed.numberText;
        overridden = false;
      }
      const issuedOn = input.issuedOn ?? existing.issuedOn;
      const dueOn = 'dueOn' in input ? (input.dueOn ?? null) : existing.dueOn;
      await db.run(
        `UPDATE ac_documents SET
          groupId = ?, groupNumber = ?, sequence = ?, numberText = ?, numberOverridden = ?,
          vendorId = ?, vendorName = ?, vendorNumber = ?, vendorInvoiceNumber = ?, originalVendorInvoiceNumber = ?,
          relatedDocumentId = ?, projectName = ?, jobNumber = ?, subcontractNumber = ?,
          billToName = ?, billToAddressLine1 = ?, billToAddressLine2 = ?, billToCity = ?, billToRegion = ?,
          billToPostalCode = ?, billToEmail = ?, issuedOn = ?, dueOn = ?, taxName = ?, taxRateBps = ?, overrideBasis = ?,
          manualTotalCents = ?, calculatedTotalCents = ?, adjustmentCents = ?, subtotalCents = ?, taxCents = ?, totalCents = ?,
          showAmountPaid = ?, amountPaidCents = ?, archived = ?, updatedAt = ?
         WHERE id = ?`,
        [
          group?.id ?? null,
          groupNumber,
          sequence,
          numberText,
          overridden ? 1 : 0,
          vendor?.id ?? null,
          input.vendorName ?? (input.vendorId ? vendor?.name : existing.vendorName) ?? existing.vendorName,
          input.vendorNumber ??
            (input.vendorId ? vendor?.vendorNumber : existing.vendorNumber) ??
            existing.vendorNumber,
          input.vendorInvoiceNumber ?? existing.vendorInvoiceNumber,
          input.originalVendorInvoiceNumber ?? existing.originalVendorInvoiceNumber,
          input.relatedDocumentId === undefined ? existing.relatedDocumentId : input.relatedDocumentId,
          input.projectName ?? existing.projectName,
          input.jobNumber ?? existing.jobNumber,
          input.subcontractNumber ?? existing.subcontractNumber,
          input.billToName ?? existing.billToName,
          input.billToAddressLine1 ?? existing.billToAddressLine1,
          input.billToAddressLine2 ?? existing.billToAddressLine2,
          input.billToCity ?? existing.billToCity,
          input.billToRegion ?? existing.billToRegion,
          input.billToPostalCode ?? existing.billToPostalCode,
          input.billToEmail ?? existing.billToEmail,
          issuedOn,
          dueOn,
          input.taxName ?? existing.taxName,
          taxRateBps,
          basis,
          priced.manualTotalCents,
          priced.calculatedTotalCents,
          priced.adjustmentCents,
          priced.subtotalCents,
          priced.taxCents,
          priced.totalCents,
          (input.showAmountPaid ?? existing.showAmountPaid) ? 1 : 0,
          Math.round(input.amountPaidCents ?? existing.amountPaidCents),
          (input.archived ?? existing.archived) ? 1 : 0,
          nowIso(),
          existing.id
        ]
      );
      await replaceLines(db, existing.id, lines, priced.lineTotalCents);
      return hydrate(db, existing.id, true);
    });
  } catch (error) {
    rethrow(error);
  }
};

export const finalizeDocument = async (db: DatabaseAdapter, id: string) => {
  const existing = await getDocument(db, id);
  if (existing.status === 'finalized') return existing;
  const priced = priceDocument({
    lines: lineWritesFromDocument(existing),
    taxRateBps: existing.taxRateBps,
    manualTotalCents: existing.manualTotalCents,
    overrideBasis: existing.overrideBasis
  });
  await db.run(
    `UPDATE ac_documents SET status = 'finalized', calculatedTotalCents = ?, adjustmentCents = ?, subtotalCents = ?,
      taxCents = ?, totalCents = ?, manualTotalCents = ?, updatedAt = ? WHERE id = ?`,
    [
      priced.calculatedTotalCents,
      priced.adjustmentCents,
      priced.subtotalCents,
      priced.taxCents,
      priced.totalCents,
      priced.manualTotalCents,
      nowIso(),
      id
    ]
  );
  return getDocument(db, id);
};

export const duplicateDocument = async (db: DatabaseAdapter, id: string) => {
  const source = await getDocument(db, id);
  return transaction(db, async () => {
    const claimed = await claimNumber(db, source.documentType, source.groupNumber, null, null);
    const idCopy = newId();
    const timestamp = nowIso();
    await db.run(
      `INSERT INTO ac_documents (
        id, documentType, status, groupId, groupNumber, sequence, numberText, numberOverridden,
        vendorId, vendorName, vendorNumber, vendorInvoiceNumber, originalVendorInvoiceNumber, relatedDocumentId,
        projectName, jobNumber, subcontractNumber,
        billToName, billToAddressLine1, billToAddressLine2, billToCity, billToRegion, billToPostalCode, billToEmail,
        companyName, companyAddressLine1, companyAddressLine2, companyCity, companyRegion, companyPostalCode, companyPhone, companyEmail,
        companyLogoBlob, companyLogoMime, issuedOn, dueOn, taxName, taxRateBps, overrideBasis, manualTotalCents,
        calculatedTotalCents, adjustmentCents, subtotalCents, taxCents, totalCents, showAmountPaid, amountPaidCents,
        archived, createdAt, updatedAt
      )
      SELECT ?, documentType, 'draft', groupId, groupNumber, ?, ?, ?,
        vendorId, vendorName, vendorNumber, vendorInvoiceNumber, originalVendorInvoiceNumber, relatedDocumentId,
        projectName, jobNumber, subcontractNumber,
        billToName, billToAddressLine1, billToAddressLine2, billToCity, billToRegion, billToPostalCode, billToEmail,
        companyName, companyAddressLine1, companyAddressLine2, companyCity, companyRegion, companyPostalCode, companyPhone, companyEmail,
        companyLogoBlob, companyLogoMime, issuedOn, dueOn, taxName, taxRateBps, overrideBasis, manualTotalCents,
        calculatedTotalCents, adjustmentCents, subtotalCents, taxCents, totalCents, showAmountPaid, amountPaidCents,
        0, ?, ?
      FROM ac_documents WHERE id = ?`,
      [idCopy, claimed.sequence, claimed.numberText, claimed.overridden ? 1 : 0, timestamp, timestamp, id]
    );
    const lines = await db.all<Row>('SELECT * FROM ac_lines WHERE documentId = ? ORDER BY position', [id]);
    for (const line of lines) {
      await db.run(
        `INSERT INTO ac_lines (
          id, documentId, position, title, description, notes, serviceStart, serviceEnd, serviceText, quantity, unitCostCents, lineTotalCents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          idCopy,
          integer(line, 'position'),
          text(line, 'title'),
          text(line, 'description'),
          text(line, 'notes'),
          line.serviceStart ?? null,
          line.serviceEnd ?? null,
          line.serviceText ?? null,
          text(line, 'quantity'),
          integer(line, 'unitCostCents'),
          integer(line, 'lineTotalCents')
        ]
      );
    }
    return hydrate(db, idCopy, true);
  });
};

export const archiveDocument = async (db: DatabaseAdapter, id: string, archived = true) =>
  saveDocument(db, { id, documentType: (await getDocument(db, id)).documentType, archived });

export const deleteDocument = async (db: DatabaseAdapter, id: string) => {
  const existing = await getDocument(db, id);
  if (existing.status === 'finalized') {
    throw new StudioError('error.finalizedImmutable', 'A finalized document cannot be deleted.');
  }
  await db.run('DELETE FROM ac_documents WHERE id = ?', [id]);
};

const raiseCounter = async (
  db: DatabaseAdapter,
  documentType: StudioDocument['documentType'],
  groupNumber: string,
  sequence: number
) => {
  if (documentType === 'credit_memo') {
    const settings = await getStudioSettings(db);
    const current = Math.max((await readNext(db, 'credit_memo', '')) ?? settings.creditStart, settings.creditStart);
    await writeNext(db, 'credit_memo', '', Math.max(current, sequence + 1));
    return;
  }
  const current = (await readNext(db, 'work_order', groupNumber)) ?? 1;
  await writeNext(db, 'work_order', groupNumber, Math.max(current, sequence + 1));
};

const assignImportedNumber = async (
  db: DatabaseAdapter,
  documentType: StudioDocument['documentType'],
  groupNumber: string,
  requested: string
) => {
  const numberText = requested.trim();
  const parsed = documentType === 'work_order' ? parseWorkOrderNumber(numberText) : null;
  if (documentType === 'work_order' && (!parsed || parsed.groupNumber !== groupNumber)) {
    throw new StudioError('error.numberFormat', 'Imported work order numbers must match the project group.');
  }
  await assertNumberAvailable(db, documentType, numberText, null);
  const sequence = parsed?.sequence ?? Number(/(\d+)$/.exec(numberText)?.[1] ?? 1);
  await raiseCounter(db, documentType, parsed?.groupNumber ?? groupNumber, sequence);
  return { sequence, numberText, overridden: true };
};

export const importDocument = async (
  db: DatabaseAdapter,
  input: StudioDocumentWrite & { numberText: string; status?: StudioDocument['status'] }
) =>
  saveDocument(
    db,
    { ...input, numberText: undefined },
    { assignNumber: input.numberText, status: input.status ?? 'draft' }
  );

export const addAttachment = async (
  db: DatabaseAdapter,
  documentId: string,
  file: { fileName: string; mimeType: string; bytesBase64: string }
) => {
  await getDocument(db, documentId);
  const id = newId();
  const createdAt = nowIso();
  await db.run(
    `INSERT INTO ac_attachments (id, documentId, fileName, mimeType, bytes, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, documentId, file.fileName, file.mimeType, Buffer.from(file.bytesBase64, 'base64'), createdAt]
  );
  return { id, documentId, fileName: file.fileName, mimeType: file.mimeType, createdAt } satisfies StudioAttachmentMeta;
};

export const listAttachments = async (db: DatabaseAdapter, documentId: string) => {
  const rows = await db.all<Row>(
    'SELECT id, documentId, fileName, mimeType, createdAt FROM ac_attachments WHERE documentId = ? ORDER BY createdAt',
    [documentId]
  );
  return rows.map(row => ({
    id: text(row, 'id'),
    documentId: text(row, 'documentId'),
    fileName: text(row, 'fileName'),
    mimeType: text(row, 'mimeType'),
    createdAt: text(row, 'createdAt')
  }));
};

export const getAttachment = async (db: DatabaseAdapter, id: string): Promise<StudioAttachment> => {
  const row = await db.get<Row>('SELECT * FROM ac_attachments WHERE id = ?', [id]);
  if (!row) throw new StudioError('error.notFound', 'Attachment was not found.');
  const bytes = blobBase64(row.bytes);
  if (!bytes) throw new StudioError('error.notFound', 'Attachment was not found.');
  return {
    id: text(row, 'id'),
    documentId: text(row, 'documentId'),
    fileName: text(row, 'fileName'),
    mimeType: text(row, 'mimeType'),
    bytesBase64: bytes,
    createdAt: text(row, 'createdAt')
  };
};

export const getStudioState = async (db: DatabaseAdapter) => {
  const [company, settings, documents] = await Promise.all([
    getCompany(db),
    getStudioSettings(db),
    listDocuments(db, { includeArchived: false })
  ]);
  return {
    databasePath: settings.databasePath,
    company,
    settings,
    recent: [...documents].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 8)
  };
};

export const countDocuments = async (db: DatabaseAdapter) => {
  const row = await db.get<Row>('SELECT COUNT(*) AS count FROM ac_documents');
  return integer(row ?? {}, 'count');
};

export const seedDemo = async (db: DatabaseAdapter, options?: { logo?: Buffer }) => {
  const existing = await db.get<Row>('SELECT id FROM ac_documents LIMIT 1');
  if (existing) return;
  const serviceText = 'Service Date Range: 9/23/2026-10/22/2026(Monthly)';
  await updateCompany(db, {
    name: 'All Construction Group',
    addressLine1: '123 Example St',
    city: 'Jacksonville',
    region: 'FL',
    postalCode: '32202',
    phone: '(904) 555-0100',
    email: 'billing@example.test',
    logoBase64: options?.logo ? options.logo.toString('base64') : null,
    logoMime: options?.logo ? 'image/png' : null
  });
  const project = await saveProject(db, {
    groupNumber: '8',
    name: 'Jaguars Stadium of the Future',
    jobNumber: 'Default',
    subcontractNumber: 'WO8',
    billToName: 'Hunt Construction-Barton Malow',
    billToAddressLine1: '123 Example St',
    billToCity: 'Jacksonville',
    billToRegion: 'FL',
    billToPostalCode: '32202',
    billToEmail: 'ap@example.test',
    taxName: 'Default',
    taxRateBps: 750,
    dueDateRule: 'net',
    dueDateDays: 30
  });
  if (!project) throw new StudioError('error.notFound', 'The demo project was not saved.');
  const vendor = await saveVendor(db, {
    name: 'All Construction Group',
    vendorNumber: 'ALLCO5',
    addressLine1: '123 Example St',
    city: 'Jacksonville',
    region: 'FL',
    postalCode: '32202',
    email: 'billing@example.test',
    phone: '(904) 555-0100'
  });
  const lines = [
    {
      title: '2nd Restroom Rent',
      description: 'Restroom, 12x30 DBPR Rent (Item1129)(BG) (Bldg ID # 33135/ E-Code 526842)',
      serviceText,
      quantity: '1',
      unitCostCents: 269790
    },
    {
      title: '2nd Restroom',
      description: 'Security Door Bars Office, 24x56 DBPR (Item1376W) (Bldg ID # 89263/ E-Code 737086, 737087)',
      serviceText,
      quantity: '1',
      unitCostCents: 288
    },
    {
      title: 'Personal Property Expense',
      description: '',
      serviceText,
      quantity: '1',
      unitCostCents: 18895
    }
  ];
  await importDocument(db, {
    documentType: 'work_order',
    groupId: project.id,
    vendorId: vendor.id,
    numberText: 'WO8.17',
    vendorInvoiceNumber: '2966923',
    issuedOn: '2026-10-15',
    dueOn: '2026-11-14',
    lines,
    status: 'draft'
  });
  await importDocument(db, {
    documentType: 'credit_memo',
    groupId: project.id,
    vendorId: vendor.id,
    numberText: 'CM-1001',
    originalVendorInvoiceNumber: '2966923',
    vendorInvoiceNumber: '2966923',
    issuedOn: '2026-10-15',
    dueOn: '2026-11-14',
    lines: [
      {
        title: 'Personal Property Expense',
        description: 'Credit for the vendor invoice line.',
        serviceText,
        quantity: '1',
        unitCostCents: 18895
      }
    ],
    status: 'draft'
  });
};

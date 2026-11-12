import type { DatabaseAdapter } from '../types/DatabaseAdapter';

const statements = [
  `CREATE TABLE IF NOT EXISTS ac_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    schemaVersion INTEGER NOT NULL,
    product TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ac_company (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    addressLine1 TEXT NOT NULL DEFAULT '',
    addressLine2 TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    postalCode TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    logoBlob BLOB,
    logoMime TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS ac_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    creditPrefix TEXT NOT NULL DEFAULT 'CM-',
    creditStart INTEGER NOT NULL DEFAULT 1001,
    creditPadding INTEGER NOT NULL DEFAULT 4,
    filenamePattern TEXT NOT NULL DEFAULT '{number} - {project}.pdf',
    showAmountPaidDefault INTEGER NOT NULL DEFAULT 0,
    totalOverrideBasis TEXT NOT NULL DEFAULT 'post-tax',
    databasePath TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS ac_project_groups (
    id TEXT PRIMARY KEY,
    groupNumber TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    jobNumber TEXT NOT NULL DEFAULT '',
    subcontractNumber TEXT NOT NULL DEFAULT '',
    billToName TEXT NOT NULL DEFAULT '',
    billToAddressLine1 TEXT NOT NULL DEFAULT '',
    billToAddressLine2 TEXT NOT NULL DEFAULT '',
    billToCity TEXT NOT NULL DEFAULT '',
    billToRegion TEXT NOT NULL DEFAULT '',
    billToPostalCode TEXT NOT NULL DEFAULT '',
    billToEmail TEXT NOT NULL DEFAULT '',
    taxName TEXT NOT NULL DEFAULT 'Default',
    taxRateBps INTEGER NOT NULL DEFAULT 0,
    dueDateRule TEXT NOT NULL DEFAULT 'net',
    dueDateDays INTEGER NOT NULL DEFAULT 30,
    archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ac_vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    vendorNumber TEXT NOT NULL DEFAULT '',
    addressLine1 TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    postalCode TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ac_sequences (
    documentType TEXT NOT NULL,
    groupNumber TEXT NOT NULL DEFAULT '',
    nextSequence INTEGER NOT NULL,
    PRIMARY KEY (documentType, groupNumber)
  )`,
  `CREATE TABLE IF NOT EXISTS ac_documents (
    id TEXT PRIMARY KEY,
    documentType TEXT NOT NULL,
    status TEXT NOT NULL,
    groupId TEXT,
    groupNumber TEXT NOT NULL DEFAULT '',
    sequence INTEGER,
    numberText TEXT NOT NULL,
    numberOverridden INTEGER NOT NULL DEFAULT 0,
    vendorId TEXT,
    vendorName TEXT NOT NULL DEFAULT '',
    vendorNumber TEXT NOT NULL DEFAULT '',
    vendorInvoiceNumber TEXT NOT NULL DEFAULT '',
    originalVendorInvoiceNumber TEXT NOT NULL DEFAULT '',
    relatedDocumentId TEXT,
    projectName TEXT NOT NULL DEFAULT '',
    jobNumber TEXT NOT NULL DEFAULT '',
    subcontractNumber TEXT NOT NULL DEFAULT '',
    billToName TEXT NOT NULL DEFAULT '',
    billToAddressLine1 TEXT NOT NULL DEFAULT '',
    billToAddressLine2 TEXT NOT NULL DEFAULT '',
    billToCity TEXT NOT NULL DEFAULT '',
    billToRegion TEXT NOT NULL DEFAULT '',
    billToPostalCode TEXT NOT NULL DEFAULT '',
    billToEmail TEXT NOT NULL DEFAULT '',
    companyName TEXT NOT NULL DEFAULT '',
    companyAddressLine1 TEXT NOT NULL DEFAULT '',
    companyAddressLine2 TEXT NOT NULL DEFAULT '',
    companyCity TEXT NOT NULL DEFAULT '',
    companyRegion TEXT NOT NULL DEFAULT '',
    companyPostalCode TEXT NOT NULL DEFAULT '',
    companyPhone TEXT NOT NULL DEFAULT '',
    companyEmail TEXT NOT NULL DEFAULT '',
    companyLogoBlob BLOB,
    companyLogoMime TEXT,
    issuedOn TEXT NOT NULL,
    dueOn TEXT,
    taxName TEXT NOT NULL DEFAULT 'Default',
    taxRateBps INTEGER NOT NULL DEFAULT 0,
    overrideBasis TEXT NOT NULL DEFAULT 'post-tax',
    manualTotalCents INTEGER,
    calculatedTotalCents INTEGER NOT NULL DEFAULT 0,
    adjustmentCents INTEGER NOT NULL DEFAULT 0,
    subtotalCents INTEGER NOT NULL DEFAULT 0,
    taxCents INTEGER NOT NULL DEFAULT 0,
    totalCents INTEGER NOT NULL DEFAULT 0,
    showAmountPaid INTEGER NOT NULL DEFAULT 0,
    amountPaidCents INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE (documentType, numberText)
  )`,
  `CREATE TABLE IF NOT EXISTS ac_lines (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL REFERENCES ac_documents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    serviceStart TEXT,
    serviceEnd TEXT,
    serviceText TEXT,
    quantity TEXT NOT NULL,
    unitCostCents INTEGER NOT NULL,
    lineTotalCents INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ac_attachments (
    id TEXT PRIMARY KEY,
    documentId TEXT NOT NULL REFERENCES ac_documents(id) ON DELETE CASCADE,
    fileName TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    bytes BLOB NOT NULL,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "amountFormat" TEXT NOT NULL DEFAULT 'en-US',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
    "isDarkMode" INTEGER NOT NULL DEFAULT 0 CHECK ("isDarkMode" IN (0,1)),
    "invoicePrefix" TEXT,
    "invoiceSuffix" TEXT,
    "shouldIncludeYear" INTEGER NOT NULL DEFAULT 0 CHECK ("shouldIncludeYear" IN (0,1)),
    "shouldIncludeMonth" INTEGER NOT NULL DEFAULT 0 CHECK ("shouldIncludeMonth" IN (0,1)),
    "shouldIncludeBusinessName" INTEGER NOT NULL DEFAULT 0 CHECK ("shouldIncludeBusinessName" IN (0,1)),
    "quotesON" INTEGER NOT NULL DEFAULT 0 CHECK ("quotesON" IN (0,1)),
    "reportsON" INTEGER NOT NULL DEFAULT 0 CHECK ("reportsON" IN (0,1)),
    "styleProfilesON" INTEGER NOT NULL DEFAULT 0 CHECK ("styleProfilesON" IN (0,1)),
    "presetsON" INTEGER NOT NULL DEFAULT 0 CHECK ("presetsON" IN (0,1)),
    "ublON" INTEGER NOT NULL DEFAULT 0 CHECK ("ublON" IN (0,1)),
    "xrechnungON" INTEGER NOT NULL DEFAULT 0 CHECK ("xrechnungON" IN (0,1)),
    "receiptPrintingOn" INTEGER NOT NULL DEFAULT 0 CHECK ("receiptPrintingOn" IN (0,1)),
    "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
    "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
  )`
];

export const initAllConSchema = async (db: DatabaseAdapter) => {
  await db.run('PRAGMA foreign_keys = ON;');
  for (const statement of statements) await db.run(statement);
  await db.run(
    `INSERT INTO ac_meta (id, schemaVersion, product) VALUES (1, 1, 'all-con-studio') ON CONFLICT(id) DO NOTHING`
  );
  await db.run(
    `INSERT INTO ac_company (id, name) VALUES ('company', 'All Construction Group') ON CONFLICT(id) DO NOTHING`
  );
  await db.run(`INSERT INTO ac_settings (id) VALUES (1) ON CONFLICT(id) DO NOTHING`);
  const settings = await db.get('SELECT id FROM settings LIMIT 1');
  if (!settings) {
    await db.run(
      `INSERT INTO settings (
        "language", "amountFormat", "dateFormat", "isDarkMode",
        "shouldIncludeYear", "shouldIncludeMonth", "shouldIncludeBusinessName",
        "quotesON", "reportsON", "styleProfilesON", "presetsON", "ublON", "xrechnungON", "receiptPrintingOn"
      ) VALUES ('en', 'en-US', 'MM/dd/yyyy', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`
    );
  }
};

export const isAllConDatabase = async (db: DatabaseAdapter) => {
  try {
    const row = await db.get<{ product: string }>('SELECT product FROM ac_meta WHERE id = 1');
    return row?.product === 'all-con-studio';
  } catch {
    return false;
  }
};

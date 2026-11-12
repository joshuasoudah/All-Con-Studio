export const ALL_CON_DIRECTORY = 'All Con Studio';
export const ALL_CON_DATABASE_FILE = 'all-con-studio.db';
export const DEFAULT_FILENAME_PATTERN = '{number} - {project}.pdf';

export type StudioDocumentType = 'work_order' | 'credit_memo';
export type StudioDocumentStatus = 'draft' | 'finalized';
export type TotalOverrideBasis = 'post-tax' | 'pre-tax';
export type DueDateRule = 'none' | 'net';

export interface StudioLine {
  id: string;
  position: number;
  title: string;
  description: string;
  notes: string;
  serviceStart: string | null;
  serviceEnd: string | null;
  serviceText: string | null;
  quantity: string;
  unitCostCents: number;
  lineTotalCents: number;
}

export interface StudioLineWrite {
  title: string;
  description?: string;
  notes?: string;
  serviceStart?: string | null;
  serviceEnd?: string | null;
  serviceText?: string | null;
  quantity: string;
  unitCostCents: number;
}

export interface StudioDocument {
  id: string;
  documentType: StudioDocumentType;
  status: StudioDocumentStatus;
  groupId: string | null;
  groupNumber: string;
  sequence: number | null;
  numberText: string;
  numberOverridden: boolean;
  vendorId: string | null;
  vendorName: string;
  vendorNumber: string;
  vendorInvoiceNumber: string;
  originalVendorInvoiceNumber: string;
  relatedDocumentId: string | null;
  projectName: string;
  jobNumber: string;
  subcontractNumber: string;
  billToName: string;
  billToAddressLine1: string;
  billToAddressLine2: string;
  billToCity: string;
  billToRegion: string;
  billToPostalCode: string;
  billToEmail: string;
  companyName: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyCity: string;
  companyRegion: string;
  companyPostalCode: string;
  companyPhone: string;
  companyEmail: string;
  logoBase64: string | null;
  logoMime: string | null;
  issuedOn: string;
  dueOn: string | null;
  taxName: string;
  taxRateBps: number;
  overrideBasis: TotalOverrideBasis;
  manualTotalCents: number | null;
  calculatedTotalCents: number;
  adjustmentCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  showAmountPaid: boolean;
  amountPaidCents: number;
  balanceCents: number;
  archived: boolean;
  lines: StudioLine[];
  createdAt: string;
  updatedAt: string;
}

export interface StudioDocumentWrite {
  documentType: StudioDocumentType;
  groupId?: string | null;
  vendorId?: string | null;
  numberText?: string | null;
  vendorInvoiceNumber?: string;
  originalVendorInvoiceNumber?: string;
  relatedDocumentId?: string | null;
  issuedOn?: string;
  dueOn?: string | null;
  manualTotalCents?: number | null;
  overrideBasis?: TotalOverrideBasis;
  showAmountPaid?: boolean;
  amountPaidCents?: number;
  projectName?: string;
  jobNumber?: string;
  subcontractNumber?: string;
  billToName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToRegion?: string;
  billToPostalCode?: string;
  billToEmail?: string;
  vendorName?: string;
  vendorNumber?: string;
  taxName?: string;
  taxRateBps?: number;
  lines?: StudioLineWrite[];
  archived?: boolean;
}

export interface StudioProject {
  id: string;
  groupNumber: string;
  name: string;
  jobNumber: string;
  subcontractNumber: string;
  billToName: string;
  billToAddressLine1: string;
  billToAddressLine2: string;
  billToCity: string;
  billToRegion: string;
  billToPostalCode: string;
  billToEmail: string;
  taxName: string;
  taxRateBps: number;
  dueDateRule: DueDateRule;
  dueDateDays: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudioProjectWrite {
  groupNumber: string;
  name: string;
  jobNumber?: string;
  subcontractNumber?: string;
  billToName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToRegion?: string;
  billToPostalCode?: string;
  billToEmail?: string;
  taxName?: string;
  taxRateBps?: number;
  dueDateRule?: DueDateRule;
  dueDateDays?: number;
  archived?: boolean;
}

export interface StudioVendor {
  id: string;
  name: string;
  vendorNumber: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  email: string;
  phone: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudioVendorWrite {
  name: string;
  vendorNumber?: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  email?: string;
  phone?: string;
  archived?: boolean;
}

export interface StudioCompany {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
  email: string;
  logoBase64: string | null;
  logoMime: string | null;
}

export interface StudioCompanyWrite {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  logoBase64?: string | null;
  logoMime?: string | null;
}

export interface StudioSettings {
  creditPrefix: string;
  creditStart: number;
  creditPadding: number;
  filenamePattern: string;
  showAmountPaidDefault: boolean;
  totalOverrideBasis: TotalOverrideBasis;
  databasePath: string;
}

export interface StudioSettingsWrite {
  creditPrefix?: string;
  creditStart?: number;
  creditPadding?: number;
  filenamePattern?: string;
  showAmountPaidDefault?: boolean;
  totalOverrideBasis?: TotalOverrideBasis;
}

export interface StudioListFilter {
  documentType?: StudioDocumentType;
  groupId?: string;
  vendorId?: string;
  status?: StudioDocumentStatus;
  archived?: boolean;
  includeArchived?: boolean;
  search?: string;
  issuedFrom?: string;
  issuedTo?: string;
}

export interface StudioAttachmentMeta {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

export interface StudioAttachment {
  id: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  bytesBase64: string;
  createdAt: string;
}

export interface StudioState {
  databasePath: string;
  company: StudioCompany;
  settings: StudioSettings;
  recent: StudioDocument[];
}

export interface StudioRequest {
  action: string;
  payload?: unknown;
}

export interface StudioTotals {
  subtotalCents: number;
  taxCents: number;
  calculatedTotalCents: number;
  adjustmentCents: number;
  manualTotalCents: number | null;
  totalCents: number;
  overrideBasis: TotalOverrideBasis;
  lineTotalCents: number[];
}

export const formatWorkOrderNumber = (groupNumber: string, sequence: number) => `WO${groupNumber}.${sequence}`;

export const parseWorkOrderNumber = (value: string) => {
  const match = /^WO(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return null;
  return { groupNumber: match[1], sequence: Number(match[2]) };
};

export const compareWorkOrderNumbers = (left: string, right: string) => {
  const a = parseWorkOrderNumber(left);
  const b = parseWorkOrderNumber(right);
  if (a && b) {
    const group = Number(a.groupNumber) - Number(b.groupNumber);
    if (group !== 0) return group;
    return a.sequence - b.sequence;
  }
  return left.localeCompare(right);
};

export const formatCreditNumber = (prefix: string, sequence: number, padding: number) =>
  `${prefix}${String(sequence).padStart(Math.max(0, padding), '0')}`;

const stripUnsafeFileChars = (value: string) =>
  [...value]
    .filter(char => {
      const code = char.charCodeAt(0);
      return code > 31 && !'<>:"/\\|?*'.includes(char);
    })
    .join('');

export const pdfFileName = (pattern: string, numberText: string, projectName: string) => {
  const clean = (value: string) => stripUnsafeFileChars(value).replace(/\s+/g, ' ').trim();
  const base = (pattern || DEFAULT_FILENAME_PATTERN)
    .replaceAll('{number}', clean(numberText))
    .replaceAll('{project}', clean(projectName))
    .trim();
  if (!base) return 'document.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
};

export const formatUsd = (cents: number) => {
  const negative = cents < 0;
  const absolute = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  const grouped = dollars.toLocaleString('en-US');
  return `${negative ? '-' : ''}$${grouped}.${String(remainder).padStart(2, '0')}`;
};

export const formatTaxPercent = (rateBps: number) => {
  const percent = rateBps / 100;
  if (Number.isInteger(percent)) return String(percent);
  return percent.toFixed(2).replace(/\.?0+$/, '');
};

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatDisplayDate = (iso: string | null) => {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = SHORT_MONTHS[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
};

export const formatSlashDate = (iso: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
};

export const addIsoDays = (isoDate: string, days: number) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const lineServiceLabel = (line: Pick<StudioLine, 'serviceText' | 'serviceStart' | 'serviceEnd'>) => {
  if (line.serviceText && line.serviceText.trim()) return line.serviceText.trim();
  if (line.serviceStart && line.serviceEnd) {
    return `Service Date Range: ${formatSlashDate(line.serviceStart)}-${formatSlashDate(line.serviceEnd)}`;
  }
  return '';
};

export const parseUsdToCents = (value: string) => {
  const trimmed = value.trim().replace(/[$,\s]/g, '');
  if (!trimmed || trimmed === '-' || trimmed === '.') return 0;
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholeRaw, fracRaw = ''] = unsigned.split('.');
  const whole = wholeRaw.replace(/\D/g, '') || '0';
  const digits = fracRaw.replace(/\D/g, '');
  const frac = (digits + '000').slice(0, 3);
  let cents = Number(whole) * 100 + Number(frac.slice(0, 2) || '0');
  if (Number(frac[2] || '0') >= 5) cents += 1;
  if (!Number.isFinite(cents)) return 0;
  return negative ? -cents : cents;
};

import {
  formatDisplayDate,
  formatTaxPercent,
  formatUsd,
  lineServiceLabel,
  type StudioDocument,
  type StudioLine,
  type TotalOverrideBasis
} from '@invoice-builder/contracts';
import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import semibold from '../../assets/figtree/Figtree-SemiBold.ttf';
import regular from '../../assets/figtree/Figtree-Regular.ttf';

Font.register({
  family: 'Figtree',
  fonts: [
    { src: regular, fontWeight: 400 },
    { src: semibold, fontWeight: 600 }
  ]
});
Font.registerHyphenationCallback(word => [word]);

export interface WorkOrderPdfLine {
  title: string;
  description: string;
  serviceText: string;
  quantity: string;
  unitCostCents: number;
  lineTotalCents: number;
}

export interface WorkOrderPdfModel {
  documentType: 'work_order' | 'credit_memo';
  numberText: string;
  projectName: string;
  issuedOn: string;
  dueOn: string | null;
  jobNumber: string;
  subcontractNumber: string;
  vendorNumber: string;
  vendorInvoiceNumber: string;
  originalVendorInvoiceNumber: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyCity: string;
  companyRegion: string;
  companyPostalCode: string;
  companyPhone: string;
  logoSrc: string | null;
  billToName: string;
  billToAddressLine1: string;
  billToAddressLine2: string;
  billToCity: string;
  billToRegion: string;
  billToPostalCode: string;
  taxName: string;
  taxRateBps: number;
  overrideBasis: TotalOverrideBasis;
  lines: WorkOrderPdfLine[];
  subtotalCents: number;
  taxCents: number;
  adjustmentCents: number;
  totalCents: number;
  showAmountPaid: boolean;
  amountPaidCents: number;
}

const ink = '#1a1a1a';
const muted = '#6d6d6d';
const hairline = '#e4e4e4';
const rule = '#d0d0d0';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Figtree',
    fontSize: 9,
    color: ink,
    paddingTop: 34,
    paddingBottom: 40,
    paddingHorizontal: 40
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  admin: { width: 260, color: muted, fontSize: 8.5, lineHeight: 1.4 },
  logo: { width: 148, height: 34, objectFit: 'contain', marginTop: 2 },
  projectRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  project: { fontSize: 12.5, fontWeight: 600, width: 360 },
  dateColumns: { flexDirection: 'row' },
  dateCol: { width: 84, alignItems: 'flex-end', marginLeft: 8 },
  dateLabel: { color: muted, fontSize: 8, marginBottom: 1 },
  dateValue: { fontSize: 9 },
  rule: { marginTop: 7, borderBottomWidth: 0.6, borderBottomColor: rule },
  parties: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  billLabel: { fontSize: 10.5, fontWeight: 600, marginBottom: 2 },
  billName: { fontSize: 10, marginBottom: 1 },
  billText: { fontSize: 9, lineHeight: 1.35, color: ink },
  docKind: { fontSize: 16, fontWeight: 600, textAlign: 'right' },
  docNumber: { marginTop: 1, fontSize: 11, textAlign: 'right' },
  ref: { marginTop: 3, fontSize: 8, color: muted, textAlign: 'right' },
  tableHeader: {
    marginTop: 26,
    flexDirection: 'row',
    borderBottomWidth: 0.6,
    borderBottomColor: rule,
    paddingBottom: 4
  },
  th: { fontSize: 8, color: '#3a3a3a' },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.4,
    borderBottomColor: hairline,
    paddingTop: 7,
    paddingBottom: 8
  },
  colNo: { width: 22 },
  colItem: { flex: 1, paddingRight: 10 },
  colQty: { width: 42, textAlign: 'right' },
  colMoney: { width: 78, textAlign: 'right' },
  itemTitle: { fontSize: 9, fontWeight: 600 },
  itemMeta: { marginTop: 1, fontSize: 8, color: muted, lineHeight: 1.35 },
  totals: { marginTop: 12, marginLeft: 'auto', width: 248 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 3 },
  totalLabel: { fontSize: 9, textAlign: 'right', marginRight: 18 },
  totalValue: { fontSize: 9, width: 78, textAlign: 'right' },
  grandLabel: { fontSize: 10.5, fontWeight: 600, textAlign: 'right', marginRight: 18 },
  grandValue: { fontSize: 10.5, fontWeight: 600, width: 78, textAlign: 'right' },
  totalRule: { borderBottomWidth: 0.6, borderBottomColor: rule, marginBottom: 5, marginTop: 2 },
  pageNo: { position: 'absolute', right: 40, bottom: 18, fontSize: 8, color: muted }
});

const placeLine = (city: string, region: string, postalCode: string) => {
  const cityRegion = [city, region].filter(Boolean).join(', ');
  return [cityRegion, postalCode].filter(Boolean).join(' ');
};

const metaLine = (label: string, value: string, withBullet: boolean) =>
  `${label}: ${value || '—'}${withBullet ? ' •' : ''}`;

const TotalRow = ({ label, value, grand = false }: { label: string; value: string; grand?: boolean }) => (
  <View style={styles.totalRow}>
    <Text style={grand ? styles.grandLabel : styles.totalLabel}>{label}</Text>
    <Text style={grand ? styles.grandValue : styles.totalValue}>{value}</Text>
  </View>
);

const serviceOf = (line: WorkOrderPdfLine) =>
  line.serviceText || lineServiceLabel({ serviceText: '', serviceStart: null, serviceEnd: null });

export const toPdfModel = (document: StudioDocument): WorkOrderPdfModel => ({
  documentType: document.documentType,
  numberText: document.numberText,
  projectName: document.projectName,
  issuedOn: document.issuedOn,
  dueOn: document.dueOn,
  jobNumber: document.jobNumber,
  subcontractNumber: document.subcontractNumber,
  vendorNumber: document.vendorNumber,
  vendorInvoiceNumber: document.vendorInvoiceNumber,
  originalVendorInvoiceNumber: document.originalVendorInvoiceNumber,
  companyAddressLine1: document.companyAddressLine1,
  companyAddressLine2: document.companyAddressLine2,
  companyCity: document.companyCity,
  companyRegion: document.companyRegion,
  companyPostalCode: document.companyPostalCode,
  companyPhone: document.companyPhone,
  logoSrc: document.logoBase64 ? `data:${document.logoMime || 'image/png'};base64,${document.logoBase64}` : null,
  billToName: document.billToName,
  billToAddressLine1: document.billToAddressLine1,
  billToAddressLine2: document.billToAddressLine2,
  billToCity: document.billToCity,
  billToRegion: document.billToRegion,
  billToPostalCode: document.billToPostalCode,
  taxName: document.taxName,
  taxRateBps: document.taxRateBps,
  overrideBasis: document.overrideBasis,
  lines: document.lines.map((line: StudioLine) => ({
    title: line.title,
    description: line.description,
    serviceText: lineServiceLabel(line),
    quantity: line.quantity,
    unitCostCents: line.unitCostCents,
    lineTotalCents: line.lineTotalCents
  })),
  subtotalCents: document.subtotalCents,
  taxCents: document.taxCents,
  adjustmentCents: document.adjustmentCents,
  totalCents: document.totalCents,
  showAmountPaid: document.showAmountPaid,
  amountPaidCents: document.amountPaidCents
});

export const WorkOrderPdf = ({ model }: { model: WorkOrderPdfModel }) => {
  const credit = model.documentType === 'credit_memo';
  const companyPlace = placeLine(model.companyCity, model.companyRegion, model.companyPostalCode);
  const billPlace = placeLine(model.billToCity, model.billToRegion, model.billToPostalCode);
  const adjustment = model.adjustmentCents !== 0;
  const balance = model.totalCents - model.amountPaidCents;
  const rows: ReactNode[] = [<TotalRow key="subtotal" label="Subtotal" value={formatUsd(model.subtotalCents)} />];
  if (model.overrideBasis === 'pre-tax' && adjustment) {
    rows.push(<TotalRow key="adj-pre" label="Adjustment" value={formatUsd(model.adjustmentCents)} />);
  }
  rows.push(
    <TotalRow
      key="tax"
      label={`Tax ${model.taxName} (${formatTaxPercent(model.taxRateBps)}%)`}
      value={formatUsd(model.taxCents)}
    />
  );
  if (model.overrideBasis !== 'pre-tax' && adjustment) {
    rows.push(<TotalRow key="adj-post" label="Adjustment" value={formatUsd(model.adjustmentCents)} />);
  }
  rows.push(<View key="rule" style={styles.totalRule} />);
  rows.push(
    <TotalRow key="grand" grand label={credit ? 'Credit Total' : 'Total'} value={formatUsd(model.totalCents)} />
  );
  if (model.showAmountPaid) {
    rows.push(<TotalRow key="paid" label="Amount Paid" value={formatUsd(model.amountPaidCents)} />);
    rows.push(<TotalRow key="balance" label="Balance Due" value={formatUsd(balance)} />);
  }

  return (
    <Document title={model.numberText}>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.admin}>
            {model.companyAddressLine1 ? <Text>{model.companyAddressLine1}</Text> : null}
            {model.companyAddressLine2 ? <Text>{model.companyAddressLine2}</Text> : null}
            {companyPlace ? <Text>{companyPlace}</Text> : null}
            {model.companyPhone ? <Text>{model.companyPhone}</Text> : null}
            <Text>{metaLine('Job No', model.jobNumber, true)}</Text>
            <Text>{metaLine('Subcontract No', model.subcontractNumber, true)}</Text>
            <Text>{metaLine('Vendor No', model.vendorNumber, true)}</Text>
            <Text>{metaLine('Invoice No', model.vendorInvoiceNumber, false)}</Text>
          </View>
          {model.logoSrc ? <Image src={model.logoSrc} style={styles.logo} /> : <View />}
        </View>
        <View style={styles.projectRow}>
          <Text style={styles.project}>Project: {model.projectName}</Text>
          <View style={styles.dateColumns}>
            <View style={styles.dateCol}>
              <Text style={styles.dateLabel}>Date</Text>
              <Text style={styles.dateValue}>{formatDisplayDate(model.issuedOn)}</Text>
            </View>
            <View style={styles.dateCol}>
              <Text style={styles.dateLabel}>Due Date</Text>
              <Text style={styles.dateValue}>{formatDisplayDate(model.dueOn)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.rule} />
        <View style={styles.parties}>
          <View>
            <Text style={styles.billLabel}>Bill To</Text>
            <Text style={styles.billName}>{model.billToName}</Text>
            {model.billToAddressLine1 ? <Text style={styles.billText}>{model.billToAddressLine1}</Text> : null}
            {model.billToAddressLine2 ? <Text style={styles.billText}>{model.billToAddressLine2}</Text> : null}
            {billPlace ? <Text style={styles.billText}>{billPlace}</Text> : null}
          </View>
          <View>
            <Text style={styles.docKind}>{credit ? 'Credit Memo' : 'Invoice'}</Text>
            <Text style={styles.docNumber}>{model.numberText}</Text>
            {credit && model.originalVendorInvoiceNumber ? (
              <Text style={styles.ref}>Vendor invoice {model.originalVendorInvoiceNumber}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colNo]}>#</Text>
          <Text style={[styles.th, styles.colItem]}>Item</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colMoney]}>Unit Cost</Text>
          <Text style={[styles.th, styles.colMoney]}>Total</Text>
        </View>
        {model.lines.map((line, index) => (
          <View key={`${line.title}-${index}`} style={styles.row} wrap={false}>
            <Text style={styles.colNo}>{index + 1}</Text>
            <View style={styles.colItem}>
              <Text style={styles.itemTitle}>{line.title}</Text>
              {line.description ? <Text style={styles.itemMeta}>{line.description}</Text> : null}
              {serviceOf(line) ? <Text style={styles.itemMeta}>{serviceOf(line)}</Text> : null}
            </View>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <Text style={styles.colMoney}>{formatUsd(line.unitCostCents)}</Text>
            <Text style={styles.colMoney}>{formatUsd(line.lineTotalCents)}</Text>
          </View>
        ))}
        <View style={styles.totals}>{rows}</View>
        <Text style={styles.pageNo} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  );
};

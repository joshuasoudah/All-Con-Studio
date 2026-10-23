import type { StudioDocument } from '@invoice-builder/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentEditor } from '../DocumentEditor';

const studio = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../../client', () => ({ studioCall: studio.call }));
vi.mock('@react-pdf/renderer', () => ({
  pdf: () => ({
    toBlob: async () => new Blob([Uint8Array.from([37, 80, 68, 70])])
  }),
  PDFViewer: ({ children }: { children: React.ReactNode }) => <div data-testid="preview">{children}</div>
}));
vi.mock('../../pdf/WorkOrderPdf', () => ({
  WorkOrderPdf: () => <div>Work order preview</div>,
  toPdfModel: (document: { numberText?: string }) => ({ numberText: document.numberText ?? 'WO8.17' })
}));

const saved: StudioDocument = {
  id: 'wo-817',
  documentType: 'work_order',
  status: 'draft',
  groupId: 'proj-8',
  groupNumber: '8',
  sequence: 17,
  numberText: 'WO8.17',
  numberOverridden: true,
  vendorId: 'vendor-1',
  vendorName: 'All Construction Group',
  vendorNumber: 'ALLCO5',
  vendorInvoiceNumber: '2966923',
  originalVendorInvoiceNumber: '',
  relatedDocumentId: null,
  projectName: 'Jaguars Stadium of the Future',
  jobNumber: 'Default',
  subcontractNumber: 'WO8',
  billToName: 'Hunt Construction-Barton Malow',
  billToAddressLine1: '123 Example St',
  billToAddressLine2: '',
  billToCity: 'Jacksonville',
  billToRegion: 'FL',
  billToPostalCode: '32202',
  billToEmail: 'ap@example.test',
  companyName: 'All Construction Group',
  companyAddressLine1: '123 Example St',
  companyAddressLine2: '',
  companyCity: 'Jacksonville',
  companyRegion: 'FL',
  companyPostalCode: '32202',
  companyPhone: '(904) 555-0100',
  companyEmail: 'billing@example.test',
  logoBase64: 'QUJD',
  logoMime: 'image/png',
  issuedOn: '2026-10-15',
  dueOn: '2026-11-14',
  taxName: 'Default',
  taxRateBps: 750,
  overrideBasis: 'post-tax',
  manualTotalCents: 310000,
  calculatedTotalCents: 310646,
  adjustmentCents: -646,
  subtotalCents: 288973,
  taxCents: 21673,
  totalCents: 310000,
  showAmountPaid: true,
  amountPaidCents: 100000,
  balanceCents: 210000,
  archived: false,
  lines: [
    {
      id: 'line-1',
      position: 1,
      title: '2nd Restroom Rent',
      description: 'Restroom rent',
      notes: '',
      serviceStart: null,
      serviceEnd: null,
      serviceText: 'Service Date Range: 9/23/2026-10/22/2026(Monthly)',
      quantity: '1',
      unitCostCents: 269790,
      lineTotalCents: 269790
    }
  ],
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z'
};

const project = {
  id: 'proj-8',
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
};

const vendor = { id: 'vendor-1', name: 'All Construction Group', vendorNumber: 'ALLCO5' };
const company = {
  name: 'All Construction Group',
  addressLine1: '123 Example St',
  addressLine2: '',
  city: 'Jacksonville',
  region: 'FL',
  postalCode: '32202',
  phone: '(904) 555-0100',
  email: 'billing@example.test',
  logoBase64: null,
  logoMime: null
};
const settings = {
  creditPrefix: 'CM-',
  creditStart: 1001,
  creditPadding: 4,
  filenamePattern: '{number} - {project}.pdf',
  showAmountPaidDefault: false,
  totalOverrideBasis: 'post-tax',
  databasePath: 'C:\\all-con-studio.db'
};

const renderEditor = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/work-orders/new" element={<DocumentEditor documentType="work_order" />} />
        <Route path="/work-orders/:id" element={<DocumentEditor documentType="work_order" />} />
        <Route path="/credit-memos/new" element={<DocumentEditor documentType="credit_memo" />} />
        <Route path="/credit-memos/:id" element={<DocumentEditor documentType="credit_memo" />} />
      </Routes>
    </MemoryRouter>
  );

describe('DocumentEditor', () => {
  beforeEach(() => {
    studio.call.mockReset();
    vi.stubGlobal('open', vi.fn());
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vendor-invoice');
    studio.call.mockImplementation(
      async (action: string, payload?: { id?: string; name?: string; numberText?: string }) => {
        if (action === 'listProjects') return [project];
        if (action === 'listVendors') return [vendor];
        if (action === 'getState') return { company, settings };
        if (action === 'suggestNumber') return 'WO8.18';
        if (action === 'computeTotals') {
          return {
            lineTotalCents: [269790, 0],
            subtotalCents: 269790,
            taxCents: 20234,
            adjustmentCents: payload?.name ? 0 : -646,
            calculatedTotalCents: 290024,
            totalCents: 289378,
            manualTotalCents: 289378,
            overrideBasis: 'post-tax'
          };
        }
        if (action === 'saveDocument')
          return { ...saved, numberText: payload?.numberText || 'WO8.18', lines: saved.lines };
        if (action === 'getDocument') {
          return payload?.id === 'wo-819' ? { ...saved, id: 'wo-819', numberText: 'WO8.19', status: 'draft' } : saved;
        }
        if (action === 'listAttachments')
          return [{ id: 'file-1', fileName: 'vendor.pdf', mimeType: 'application/pdf' }];
        if (action === 'getAttachment')
          return { bytesBase64: btoa('pdf'), mimeType: 'application/pdf', fileName: 'vendor.pdf' };
        if (action === 'saveVendor') return { ...vendor, id: 'vendor-2', name: payload?.name, vendorNumber: 'EX2' };
        if (action === 'duplicateDocument') return { ...saved, id: 'wo-819', numberText: 'WO8.19', status: 'draft' };
        if (action === 'finalizeDocument') return { ...saved, status: 'finalized' };
        if (action === 'savePdf') return { filePath: 'C:\\WO8.17.pdf' };
        return null;
      }
    );
  });

  it('builds a work order, saves it, and downloads the PDF', async () => {
    const user = userEvent.setup();
    renderEditor('/work-orders/new');
    expect(await screen.findByLabelText('Project group')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Project group'));
    await user.click(await screen.findByRole('option', { name: /Jaguars Stadium/ }));
    await waitFor(() => expect(screen.getByLabelText('Work order number')).toHaveValue('WO8.18'));
    await user.click(screen.getByLabelText('Vendor'));
    await user.click(await screen.findByRole('option', { name: /ALLCO5/ }));
    fireEvent.change(screen.getByLabelText('Work order number'), { target: { value: 'WO8.25' } });
    fireEvent.change(screen.getByLabelText('Vendor invoice no.'), { target: { value: '2966923' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-16' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByLabelText('Bill to'), { target: { value: 'Hunt Construction-Barton Malow' } });
    fireEvent.change(screen.getByLabelText('Bill to address'), { target: { value: '123 Example St' } });
    fireEvent.change(screen.getAllByLabelText('Title')[0], { target: { value: '2nd Restroom Rent' } });
    fireEvent.change(screen.getAllByLabelText('Description')[0], { target: { value: 'Restroom rent' } });
    fireEvent.change(screen.getAllByLabelText('Service range')[0], { target: { value: 'Monthly' } });
    fireEvent.change(screen.getAllByLabelText('Qty')[0], { target: { value: '1' } });
    fireEvent.change(screen.getAllByLabelText('Unit cost')[0], { target: { value: '2697.90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    fireEvent.change(screen.getByLabelText('Manual total'), { target: { value: '3100.00' } });
    await user.click(screen.getByLabelText('Total override'));
    await user.click(await screen.findByRole('option', { name: 'Pre-tax adjustment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show amount paid' }));
    fireEvent.change(screen.getByLabelText('Amount paid'), { target: { value: '1000.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'New vendor' }));
    fireEvent.change(screen.getByLabelText('Vendor name'), { target: { value: 'Example Vendor' } });
    fireEvent.change(screen.getByLabelText('Vendor no.'), { target: { value: 'EX2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));
    await waitFor(() =>
      expect(studio.call).toHaveBeenCalledWith('saveVendor', expect.objectContaining({ name: 'Example Vendor' }))
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand preview' }));
    expect(screen.queryByLabelText('Project group')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show form' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Finalize' })).toBeInTheDocument();
    const file = new File(['%PDF'], 'vendor.pdf', { type: 'application/pdf' });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Open vendor.pdf' }));
    await waitFor(() => expect(window.open).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(studio.call).toHaveBeenCalledWith('savePdf', expect.any(Object)));
    fireEvent.click(screen.getByRole('button', { name: 'Finalize' }));
    expect(await screen.findByText(/Finalized documents stay as they were saved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByDisplayValue('WO8.19')).toBeInTheDocument();
  });

  it('edits a credit memo and reports a save failure', async () => {
    const failures = new Map<string, unknown>([['saveDocument', new Error('duplicate number')]]);
    studio.call.mockImplementation(async (action: string) => {
      if (failures.has(action)) throw failures.get(action);
      if (action === 'listProjects') return [project];
      if (action === 'listVendors') return [vendor];
      if (action === 'getState') return { company, settings };
      if (action === 'listAttachments') return [];
      if (action === 'getDocument') {
        return { ...saved, id: 'cm-1001', documentType: 'credit_memo', numberText: 'CM-1001', status: 'draft' };
      }
      if (action === 'computeTotals') {
        return {
          lineTotalCents: [0],
          subtotalCents: 0,
          taxCents: 0,
          adjustmentCents: 0,
          calculatedTotalCents: 0,
          totalCents: 0,
          manualTotalCents: null,
          overrideBasis: 'post-tax'
        };
      }
      if (action === 'saveDocument') {
        return { ...saved, id: 'cm-1001', documentType: 'credit_memo', numberText: 'CM-1001' };
      }
      return null;
    });
    renderEditor('/credit-memos/cm-1001');
    expect(await screen.findByLabelText('Credit number')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Original vendor invoice'), { target: { value: '2966923' } });
    fireEvent.change(screen.getAllByLabelText('Title')[0], { target: { value: 'Personal Property Expense' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('duplicate number')).toBeInTheDocument();
    failures.set('saveDocument', 'nope');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Could not save.')).toBeInTheDocument();
    failures.delete('saveDocument');
    failures.set('savePdf', new Error('dialog closed'));
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText('dialog closed')).toBeInTheDocument();
    failures.set('savePdf', 'nope');
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByText('Could not download.')).toBeInTheDocument();
  });
});

import type { StudioDocument, StudioProject, StudioVendor } from '@invoice-builder/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../i18n';
import { DashboardPage } from '../DashboardPage';
import { LibraryPage } from '../LibraryPage';
import { ProjectsPage } from '../ProjectsPage';
import { StudioSettingsPage } from '../StudioSettingsPage';
import { VendorsPage } from '../VendorsPage';

const studio = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../../client', () => ({ studioCall: studio.call }));
vi.mock('@react-pdf/renderer', () => ({
  pdf: () => ({
    toBlob: async () => new Blob([Uint8Array.from([37, 80, 68, 70])])
  })
}));
vi.mock('../../pdf/WorkOrderPdf', () => ({
  WorkOrderPdf: () => null,
  toPdfModel: (document: unknown) => document
}));

const project: StudioProject = {
  id: 'proj-8',
  groupNumber: '8',
  name: 'Jaguars Stadium of the Future',
  jobNumber: 'Default',
  subcontractNumber: 'WO8',
  billToName: 'Hunt Construction-Barton Malow',
  billToAddressLine1: '123 Example St',
  billToAddressLine2: '',
  billToCity: 'Jacksonville',
  billToRegion: 'FL',
  billToPostalCode: '32202',
  billToEmail: 'ap@example.test',
  taxName: 'Default',
  taxRateBps: 750,
  dueDateRule: 'net',
  dueDateDays: 30,
  archived: false,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z'
};

const vendor: StudioVendor = {
  id: 'vendor-1',
  name: 'All Construction Group',
  vendorNumber: 'ALLCO5',
  addressLine1: '123 Example St',
  city: 'Jacksonville',
  region: 'FL',
  postalCode: '32202',
  email: 'billing@example.test',
  phone: '(904) 555-0100',
  archived: false,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z'
};

const workOrder: StudioDocument = {
  id: 'wo-817',
  documentType: 'work_order',
  status: 'draft',
  groupId: project.id,
  groupNumber: '8',
  sequence: 17,
  numberText: 'WO8.17',
  numberOverridden: false,
  vendorId: vendor.id,
  vendorName: vendor.name,
  vendorNumber: vendor.vendorNumber,
  vendorInvoiceNumber: '2966923',
  originalVendorInvoiceNumber: '',
  relatedDocumentId: null,
  projectName: project.name,
  jobNumber: 'Default',
  subcontractNumber: 'WO8',
  billToName: project.billToName,
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
  logoBase64: null,
  logoMime: null,
  issuedOn: '2026-10-15',
  dueOn: '2026-11-14',
  taxName: 'Default',
  taxRateBps: 750,
  overrideBasis: 'post-tax',
  manualTotalCents: null,
  calculatedTotalCents: 310646,
  adjustmentCents: 0,
  subtotalCents: 288973,
  taxCents: 21673,
  totalCents: 310646,
  showAmountPaid: false,
  amountPaidCents: 0,
  balanceCents: 310646,
  archived: false,
  lines: [],
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z'
};

const credit: StudioDocument = {
  ...workOrder,
  id: 'cm-1001',
  documentType: 'credit_memo',
  numberText: 'CM-1001',
  totalCents: 20312,
  balanceCents: 20312
};

const company = {
  name: 'All Construction Group',
  addressLine1: '123 Example St',
  addressLine2: '',
  city: 'Jacksonville',
  region: 'FL',
  postalCode: '32202',
  phone: '(904) 555-0100',
  email: 'billing@example.test',
  logoBase64: null as string | null,
  logoMime: null as string | null
};

const settings = {
  creditPrefix: 'CM-',
  creditStart: 1001,
  creditPadding: 4,
  filenamePattern: '{number} - {project}.pdf',
  showAmountPaidDefault: false,
  totalOverrideBasis: 'post-tax' as const,
  databasePath: 'C:\\Users\\Example\\AppData\\Roaming\\All Con Studio\\all-con-studio.db'
};

const Location = () => <div data-testid="location">{useLocation().pathname}</div>;

const change = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('studio pages', () => {
  beforeEach(() => {
    studio.call.mockReset();
    studio.call.mockImplementation(async (action: string) => {
      if (action === 'getState')
        return { company, settings, recent: [workOrder, credit], databasePath: settings.databasePath };
      if (action === 'listProjects') return [project];
      if (action === 'listVendors') return [vendor];
      if (action === 'listDocuments') return [workOrder];
      if (action === 'getDocument') return workOrder;
      if (action === 'duplicateDocument') return { ...workOrder, id: 'wo-818', numberText: 'WO8.18' };
      if (action === 'savePdf') return { filePath: 'C:\\WO8.17.pdf' };
      if (action === 'backup') return { filePath: 'C:\\backup.db' };
      if (action === 'restore') return { safetyPath: 'C:\\safety.db' };
      return { ok: true };
    });
  });

  it('lists recent documents and starts a work order', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
        <Location />
      </MemoryRouter>
    );
    expect(await screen.findByText('WO8.17 · Jaguars Stadium of the Future')).toBeInTheDocument();
    expect(screen.getByText('$2,903.34')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New Work Order' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/work-orders/new');
    fireEvent.click(screen.getByRole('button', { name: /CM-1001/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/credit-memos/cm-1001');
  });

  it('shows the empty dashboard and a load error', async () => {
    studio.call.mockResolvedValueOnce({ company, settings, recent: [], databasePath: settings.databasePath });
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('No documents yet. Start with New Work Order.')).toBeInTheDocument();

    studio.call.mockRejectedValueOnce(new Error('unavailable'));
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('unavailable')).toBeInTheDocument();

    studio.call.mockRejectedValueOnce('down');
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Could not load the dashboard.')).toBeInTheDocument();
  });

  it('asks for a group number and a project name before saving', async () => {
    render(<ProjectsPage />);
    expect(await screen.findByText('8 · Jaguars Stadium of the Future')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    expect(await screen.findByText('Enter a group number.')).toBeInTheDocument();
    change('Group number', '4');
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    expect(await screen.findByText('Enter a project name.')).toBeInTheDocument();
  });

  it('saves, edits, archives, and deletes a project', async () => {
    const user = userEvent.setup();
    render(<ProjectsPage />);
    expect(await screen.findByText('8 · Jaguars Stadium of the Future')).toBeInTheDocument();
    change('Group number', '9');
    change('Project name', 'Example Yard');
    change('Job no.', 'JY');
    change('Subcontract no.', 'WO9');
    change('Bill to', 'Example GC');
    change('Bill to address', '123 Example St');
    change('City', 'Jacksonville');
    change('State', 'FL');
    change('Postal code', '32202');
    change('Bill to email', 'ap@example.test');
    change('Tax name', 'Default');
    change('Tax basis points', '750');
    change('Net days', '15');
    await user.click(screen.getByLabelText('Due date'));
    await user.click(await screen.findByRole('option', { name: 'None' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    await waitFor(() =>
      expect(studio.call).toHaveBeenCalledWith('saveProject', expect.objectContaining({ name: 'Example Yard' }))
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Project name')).toHaveValue(project.name);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(studio.call).toHaveBeenCalledWith('deleteProject', { id: project.id }));

    studio.call.mockRejectedValueOnce(new Error('duplicate group'));
    fireEvent.click(screen.getByRole('button', { name: 'Update project' }));
    expect(await screen.findByText('duplicate group')).toBeInTheDocument();
    studio.call.mockRejectedValueOnce('nope');
    fireEvent.click(screen.getByRole('button', { name: 'Update project' }));
    expect(await screen.findByText('Could not save the project.')).toBeInTheDocument();
    studio.call.mockRejectedValueOnce('blocked');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('blocked')).toBeInTheDocument();
  });

  it('asks for a vendor name before saving', async () => {
    render(<VendorsPage />);
    expect(await screen.findByText(/ALLCO5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save vendor' }));
    expect(await screen.findByText('Enter a vendor name.')).toBeInTheDocument();
  });

  it('saves, edits, archives, and deletes a vendor', async () => {
    render(<VendorsPage />);
    expect(await screen.findByText(/ALLCO5/)).toBeInTheDocument();
    change('Name', 'Example Vendor');
    change('Vendor no.', 'EX1');
    change('Email', 'billing@example.test');
    change('Phone', '(904) 555-0100');
    change('Address', '123 Example St');
    fireEvent.click(screen.getByRole('button', { name: 'Save vendor' }));
    await waitFor(() =>
      expect(studio.call).toHaveBeenCalledWith('saveVendor', expect.objectContaining({ name: 'Example Vendor' }))
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Update vendor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(studio.call).toHaveBeenCalledWith('deleteVendor', { id: vendor.id }));

    studio.call.mockRejectedValueOnce(new Error('required'));
    fireEvent.click(screen.getByRole('button', { name: 'Update vendor' }));
    expect(await screen.findByText('required')).toBeInTheDocument();
    studio.call.mockRejectedValueOnce('nope');
    fireEvent.click(screen.getByRole('button', { name: 'Update vendor' }));
    expect(await screen.findByText('Could not save the vendor.')).toBeInTheDocument();
  });

  it('saves settings, a logo, a backup, and a confirmed restore', async () => {
    const user = userEvent.setup();
    class FakeReader {
      result: string | null = 'data:image/png;base64,QUJD';
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() {
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', FakeReader);
    render(<StudioSettingsPage />);
    expect(await screen.findByText(/all-con-studio.db/)).toBeInTheDocument();
    change('Company', 'All Construction Group');
    change('Phone', '(904) 555-0100');
    change('Street', '123 Example St');
    change('Email', 'billing@example.test');
    change('City', 'Jacksonville');
    change('State', 'FL');
    change('Postal code', '32202');
    change('Credit prefix', 'CM-');
    change('Credit start', '1001');
    change('Credit padding', '4');
    change('PDF filename pattern', '{number} - {project}.pdf');
    await user.click(screen.getByLabelText('Manual total'));
    await user.click(await screen.findByRole('option', { name: 'Pre-tax adjustment' }));
    const input = window.document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['png'], 'logo.png', { type: 'image/png' })] } });
    expect(await screen.findByAltText('Company logo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/logo and numbering settings/)).toBeInTheDocument();

    studio.call.mockImplementationOnce(async () => ({ canceled: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Backup database' }));
    expect(await screen.findByText('Backup canceled.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Backup database' }));
    expect(await screen.findByText(/Backup saved to/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore database' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Restore database' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/Safety copy/)).toBeInTheDocument();

    studio.call.mockRejectedValueOnce(new Error('bad backup'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('bad backup')).toBeInTheDocument();
    studio.call.mockRejectedValueOnce('nope');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Could not save settings.')).toBeInTheDocument();
    studio.call.mockRejectedValueOnce(new Error('restore failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Restore database' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('restore failed')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it('filters the library and exports a PDF', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/work-orders']}>
        <Routes>
          <Route path="/work-orders" element={<LibraryPage documentType="work_order" />} />
          <Route path="/work-orders/new" element={<div>New work order</div>} />
          <Route path="/work-orders/:id" element={<div>Opened work order</div>} />
        </Routes>
        <Location />
      </MemoryRouter>
    );
    expect(await screen.findByRole('button', { name: 'WO8.17' })).toBeInTheDocument();
    change('Search', '2966923');
    change('From', '2026-10-01');
    change('To', '2026-10-31');
    await user.click(screen.getByLabelText('Project'));
    await user.click(await screen.findByRole('option', { name: /Jaguars/ }));
    await user.click(screen.getByLabelText('Vendor'));
    await user.click(await screen.findByRole('option', { name: 'All Construction Group' }));
    await user.click(screen.getByLabelText('Status'));
    await user.click(await screen.findByRole('option', { name: 'Finalized' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(studio.call).toHaveBeenCalledWith(
        'listDocuments',
        expect.objectContaining({ search: '2966923', status: 'finalized', groupId: project.id })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() =>
      expect(studio.call).toHaveBeenCalledWith(
        'savePdf',
        expect.objectContaining({ defaultName: expect.stringContaining('WO8.17') })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(await screen.findByText('Opened work order')).toBeInTheDocument();
  });

  it('opens a credit memo library and reports a failed load', async () => {
    studio.call.mockImplementation(async (action: string) => {
      if (action === 'listDocuments') return [credit];
      if (action === 'listProjects') return [project];
      if (action === 'listVendors') return [{ ...vendor, archived: true }];
      if (action === 'getState') return { settings };
      if (action === 'duplicateDocument') throw new Error('busy');
      return null;
    });
    render(
      <MemoryRouter>
        <LibraryPage documentType="credit_memo" />
        <Location />
      </MemoryRouter>
    );
    expect(await screen.findByRole('heading', { name: 'Credit Memos' })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Vendor'));
    expect(await screen.findByRole('option', { name: 'All Construction Group' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    fireEvent.click(screen.getByRole('button', { name: 'New Credit Memo' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/credit-memos/new');
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(studio.call).toHaveBeenCalledWith('archiveDocument', { id: credit.id }));
    await user.click(screen.getByLabelText('Status'));
    await user.click(await screen.findByRole('option', { name: 'Archived' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() =>
      expect(studio.call).toHaveBeenCalledWith(
        'listDocuments',
        expect.objectContaining({ includeArchived: true, archived: true })
      )
    );

    studio.call.mockRejectedValueOnce(new Error('offline'));
    render(
      <MemoryRouter>
        <LibraryPage documentType="work_order" />
      </MemoryRouter>
    );
    expect(await screen.findByText('offline')).toBeInTheDocument();
    studio.call.mockRejectedValueOnce('down');
    render(
      <MemoryRouter>
        <LibraryPage documentType="work_order" />
      </MemoryRouter>
    );
    expect(await screen.findByText('Could not load documents.')).toBeInTheDocument();
  });
});

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { StudioError } from '@invoice-builder/core/allcon/errors';

const ipc = vi.hoisted(() => ({
  handlers: new Map<string, (event: { sender: { id: number } }, request?: unknown) => Promise<unknown>>()
}));
const dialogs = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn()
}));
const database = vi.hoisted(() => ({ attachDatabase: vi.fn() }));
const open = vi.hoisted(() => ({ ensureAllConDatabase: vi.fn() }));
const backup = vi.hoisted(() => ({ backupSqlite: vi.fn(), restoreDatabase: vi.fn() }));
const store = vi.hoisted(() => ({
  getStudioState: vi.fn(),
  updateCompany: vi.fn(),
  updateStudioSettings: vi.fn(),
  listProjects: vi.fn(),
  saveProject: vi.fn(),
  duplicateProject: vi.fn(),
  archiveProject: vi.fn(),
  deleteProject: vi.fn(),
  listVendors: vi.fn(),
  saveVendor: vi.fn(),
  archiveVendor: vi.fn(),
  deleteVendor: vi.fn(),
  listDocuments: vi.fn(),
  getDocument: vi.fn(),
  suggestNumber: vi.fn(),
  saveDocument: vi.fn(),
  finalizeDocument: vi.fn(),
  duplicateDocument: vi.fn(),
  archiveDocument: vi.fn(),
  deleteDocument: vi.fn(),
  addAttachment: vi.fn(),
  listAttachments: vi.fn(),
  getAttachment: vi.fn()
}));

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/missing-app', getPath: () => tmpdir() },
  dialog: dialogs,
  ipcMain: {
    handle: (channel: string, handler: (event: { sender: { id: number } }, request?: unknown) => Promise<unknown>) => {
      ipc.handlers.set(channel, handler);
    }
  }
}));
vi.mock('../../database', () => database);
vi.mock('@invoice-builder/core/allcon/open', () => open);
vi.mock('@invoice-builder/core/allcon/backup', () => backup);
vi.mock('@invoice-builder/core/allcon/store', () => store);

import { initStudioHandlers } from '../studio';

const event = { sender: { id: 11 } };
const other = { sender: { id: 99 } };
const handle = { adapter: { name: 'db' }, raw: { name: 'raw' }, filePath: '/data/all-con-studio.db', created: true };

const call = (request?: unknown, target = event) => {
  const handler = ipc.handlers.get('studio');
  if (!handler) throw new Error('studio handler was not registered');
  return handler(target, request);
};

describe('studio IPC', () => {
  beforeAll(() => {
    Object.values(store).forEach(fn => fn.mockResolvedValue({ ok: true }));
    open.ensureAllConDatabase.mockResolvedValue(handle);
    backup.backupSqlite.mockResolvedValue(undefined);
    backup.restoreDatabase.mockResolvedValue({ filePath: handle.filePath, safetyPath: '/data/safety.db' });
    database.attachDatabase.mockResolvedValue(undefined);
    initStudioHandlers();
  });

  it('opens the default database and dispatches each studio action', async () => {
    expect(await call()).toMatchObject({ success: false, key: 'error.studioAction' });
    expect(await call({ action: 'ensureDefault' })).toMatchObject({
      success: true,
      data: { databasePath: handle.filePath, created: true }
    });
    expect(database.attachDatabase).toHaveBeenCalledWith(11, handle.adapter);

    await call({ action: 'getState' });
    await call({ action: 'updateCompany', payload: { name: 'All Construction Group' } });
    await call({ action: 'updateSettings', payload: { creditPrefix: 'CM-' } });
    await call({ action: 'listProjects', payload: { includeArchived: true } });
    await call({ action: 'saveProject', payload: { groupNumber: '8', name: 'Stadium' } });
    await call({ action: 'duplicateProject', payload: { id: 'p1' } });
    await call({ action: 'archiveProject', payload: { id: 'p1', archived: false } });
    await call({ action: 'deleteProject', payload: { id: 'p1' } });
    await call({ action: 'listVendors', payload: { includeArchived: false } });
    await call({ action: 'saveVendor', payload: { name: 'Vendor' } });
    await call({ action: 'archiveVendor', payload: { id: 'v1' } });
    await call({ action: 'deleteVendor', payload: { id: 'v1' } });
    await call({ action: 'listDocuments', payload: { documentType: 'work_order' } });
    await call({ action: 'getDocument', payload: { id: 'd1' } });
    await call({ action: 'suggestNumber', payload: { documentType: 'work_order', groupNumber: '8' } });
    await call({
      action: 'computeTotals',
      payload: { lines: [{ quantity: '1', unitCostCents: 100 }], taxRateBps: 750, manualTotalCents: null }
    });
    await call({
      action: 'computeTotals',
      payload: {
        lines: [{ quantity: '1', unitCostCents: 100 }],
        taxRateBps: 750,
        manualTotalCents: 100,
        overrideBasis: 'pre-tax'
      }
    });
    await call({ action: 'saveDocument', payload: { documentType: 'work_order' } });
    await call({ action: 'finalizeDocument', payload: { id: 'd1' } });
    await call({ action: 'duplicateDocument', payload: { id: 'd1' } });
    await call({ action: 'archiveDocument', payload: { id: 'd1', archived: false } });
    await call({ action: 'deleteDocument', payload: { id: 'd1' } });
    await call({
      action: 'addAttachment',
      payload: { documentId: 'd1', fileName: 'a.pdf', bytesBase64: 'QQ==' }
    });
    await call({ action: 'listAttachments', payload: { documentId: 'd1' } });
    await call({ action: 'getAttachment', payload: { id: 'a1' } });

    expect(store.archiveProject).toHaveBeenCalledWith(handle.adapter, 'p1', false);
    expect(store.archiveVendor).toHaveBeenCalledWith(handle.adapter, 'v1', true);
    expect(store.addAttachment).toHaveBeenCalledWith(
      handle.adapter,
      'd1',
      expect.objectContaining({ mimeType: 'application/pdf' })
    );

    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await call({ action: 'backup' })).toMatchObject({ success: true, data: { canceled: true } });
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [mkdtempSync(join(tmpdir(), 'bak-'))] });
    const saved = (await call({ action: 'backup' })) as { success: boolean; data: { filePath: string } };
    expect(saved.data.filePath).toContain('all-con-studio-');

    expect(await call({ action: 'restore', payload: { confirmed: false } })).toMatchObject({
      success: false,
      key: 'error.restoreNotConfirmed'
    });
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await call({ action: 'restore', payload: { confirmed: true } })).toMatchObject({
      success: true,
      data: { canceled: true }
    });
    dialogs.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/tmp/backup.db'] });
    expect(await call({ action: 'restore', payload: { confirmed: true } })).toMatchObject({
      success: true,
      data: { safetyPath: '/data/safety.db' }
    });

    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: '' });
    expect(await call({ action: 'savePdf', payload: { base64: 'QQ==' } })).toMatchObject({
      success: true,
      data: { canceled: true }
    });
    const pdfPath = join(mkdtempSync(join(tmpdir(), 'pdf-')), 'WO8.17.pdf');
    dialogs.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: pdfPath });
    expect(await call({ action: 'savePdf', payload: { base64: 'QQ==', defaultName: 'WO8.17.pdf' } })).toMatchObject({
      success: true,
      data: { filePath: pdfPath }
    });

    expect(await call({ action: 'missing' })).toMatchObject({ success: false, key: 'error.studioAction' });
    expect(await call({ action: 'getState' }, other)).toMatchObject({
      success: false,
      key: 'error.databaseNotInitialized'
    });
  });

  it('reports store failures without dropping the channel', async () => {
    store.getDocument.mockRejectedValueOnce(new StudioError('error.notFound', 'Missing'));
    expect(await call({ action: 'getDocument', payload: { id: 'gone' } })).toMatchObject({
      success: false,
      key: 'error.notFound'
    });
    store.getDocument.mockRejectedValueOnce(new Error('disk'));
    expect(await call({ action: 'getDocument', payload: { id: 'gone' } })).toMatchObject({
      success: false,
      message: 'disk'
    });
    store.getDocument.mockRejectedValueOnce('nope');
    expect(await call({ action: 'getDocument', payload: { id: 'gone' } })).toMatchObject({
      success: false,
      message: 'error.unknown'
    });
    open.ensureAllConDatabase.mockRejectedValueOnce(new Error('locked'));
    expect(await call({ action: 'ensureDefault' }, { sender: { id: 12 } })).toMatchObject({
      success: false,
      message: 'locked'
    });
  });
});

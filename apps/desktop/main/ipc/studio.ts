import {
  ALL_CON_DATABASE_FILE,
  ALL_CON_DIRECTORY,
  type StudioCompanyWrite,
  type StudioDocumentType,
  type StudioDocumentWrite,
  type StudioListFilter,
  type StudioProjectWrite,
  type StudioRequest,
  type StudioSettingsWrite,
  type StudioVendorWrite,
  type TotalOverrideBasis
} from '@invoice-builder/contracts';
import { priceDocument } from '@invoice-builder/core/allcon/money';
import { ensureAllConDatabase, type AllConHandle } from '@invoice-builder/core/allcon/open';
import { backupSqlite, restoreDatabase } from '@invoice-builder/core/allcon/backup';
import { StudioError } from '@invoice-builder/core/allcon/errors';
import {
  addAttachment,
  archiveDocument,
  archiveProject,
  archiveVendor,
  deleteDocument,
  deleteProject,
  deleteVendor,
  duplicateDocument,
  duplicateProject,
  finalizeDocument,
  getAttachment,
  getDocument,
  getStudioState,
  listAttachments,
  listDocuments,
  listProjects,
  listVendors,
  saveDocument,
  saveProject,
  saveVendor,
  suggestNumber,
  updateCompany,
  updateStudioSettings
} from '@invoice-builder/core/allcon/store';
import { app, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import { IpcChannel } from '@invoice-builder/contracts';
import { attachDatabase } from '../database';

const handles = new Map<number, AllConHandle>();

const bundledLogo = () => {
  const candidates = [
    path.join(process.cwd(), 'dist-desktop/main/assets/default-logo.png'),
    path.join(process.cwd(), 'apps/desktop/main/assets/default-logo.png'),
    path.join(process.cwd(), 'apps/renderer/src/assets/allcon/default-logo.png'),
    path.join(app.getAppPath(), 'dist-desktop/main/assets/default-logo.png')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate);
  }
  return undefined;
};

const defaultDatabasePath = () => path.join(app.getPath('appData'), ALL_CON_DIRECTORY, ALL_CON_DATABASE_FILE);

const requireHandle = (event: IpcMainInvokeEvent) => {
  const handle = handles.get(event.sender.id);
  if (!handle) throw new StudioError('error.databaseNotInitialized', 'Open the All Con Studio database first.');
  return handle;
};

const run = async (work: () => Promise<unknown>) => {
  try {
    return { success: true, data: await work() };
  } catch (error) {
    if (error instanceof StudioError) return { success: false, key: error.key, message: error.message };
    return { success: false, message: error instanceof Error ? error.message : 'error.unknown' };
  }
};

export const initStudioHandlers = () => {
  ipcMain.handle(IpcChannel.studio, async (event, request?: StudioRequest) => {
    const action = request?.action;
    const payload = (request?.payload ?? {}) as Record<string, unknown>;
    if (!action) return { success: false, key: 'error.studioAction', message: 'Missing studio action.' };

    if (action === 'ensureDefault') {
      return run(async () => {
        const filePath = defaultDatabasePath();
        const handle = await ensureAllConDatabase(filePath, { createIfMissing: true, seed: true, logo: bundledLogo() });
        handles.set(event.sender.id, handle);
        await attachDatabase(event.sender.id, handle.adapter);
        return { databasePath: handle.filePath, created: handle.created };
      });
    }

    return run(async () => {
      const handle = requireHandle(event);
      const db = handle.adapter;
      switch (action) {
        case 'getState':
          return getStudioState(db);
        case 'updateCompany':
          return updateCompany(db, payload as StudioCompanyWrite);
        case 'updateSettings':
          return updateStudioSettings(db, payload as StudioSettingsWrite);
        case 'listProjects':
          return listProjects(db, Boolean(payload.includeArchived));
        case 'saveProject':
          return saveProject(db, payload as unknown as StudioProjectWrite & { id?: string });
        case 'duplicateProject':
          return duplicateProject(db, String(payload.id));
        case 'archiveProject':
          return archiveProject(db, String(payload.id), payload.archived !== false);
        case 'deleteProject':
          await deleteProject(db, String(payload.id));
          return null;
        case 'listVendors':
          return listVendors(db, Boolean(payload.includeArchived));
        case 'saveVendor':
          return saveVendor(db, payload as unknown as StudioVendorWrite & { id?: string });
        case 'archiveVendor':
          return archiveVendor(db, String(payload.id), payload.archived !== false);
        case 'deleteVendor':
          await deleteVendor(db, String(payload.id));
          return null;
        case 'listDocuments':
          return listDocuments(db, payload as StudioListFilter);
        case 'getDocument':
          return getDocument(db, String(payload.id));
        case 'suggestNumber':
          return suggestNumber(db, payload.documentType as StudioDocumentType, String(payload.groupNumber ?? ''));
        case 'computeTotals':
          return priceDocument({
            lines: payload.lines as { quantity: string; unitCostCents: number }[],
            taxRateBps: Number(payload.taxRateBps ?? 0),
            manualTotalCents: payload.manualTotalCents == null ? null : Number(payload.manualTotalCents),
            overrideBasis: (payload.overrideBasis as TotalOverrideBasis) || 'post-tax'
          });
        case 'saveDocument':
          return saveDocument(db, payload as unknown as StudioDocumentWrite & { id?: string });
        case 'finalizeDocument':
          return finalizeDocument(db, String(payload.id));
        case 'duplicateDocument':
          return duplicateDocument(db, String(payload.id));
        case 'archiveDocument':
          return archiveDocument(db, String(payload.id), payload.archived !== false);
        case 'deleteDocument':
          await deleteDocument(db, String(payload.id));
          return null;
        case 'addAttachment':
          return addAttachment(db, String(payload.documentId), {
            fileName: String(payload.fileName),
            mimeType: String(payload.mimeType || 'application/pdf'),
            bytesBase64: String(payload.bytesBase64)
          });
        case 'listAttachments':
          return listAttachments(db, String(payload.documentId));
        case 'getAttachment':
          return getAttachment(db, String(payload.id));
        case 'backup': {
          const picked = await dialog.showOpenDialog({
            title: 'Choose a folder for the All Con Studio backup',
            properties: ['openDirectory', 'createDirectory']
          });
          if (picked.canceled || !picked.filePaths[0]) return { canceled: true };
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filePath = path.join(picked.filePaths[0], `all-con-studio-${stamp}.db`);
          await backupSqlite(handle.raw, filePath);
          return { filePath };
        }
        case 'restore': {
          if (payload.confirmed !== true) {
            throw new StudioError('error.restoreNotConfirmed', 'Restore requires confirmation.');
          }
          const picked = await dialog.showOpenDialog({
            title: 'Choose an All Con Studio backup to restore',
            filters: [{ name: 'SQLite database', extensions: ['db'] }],
            properties: ['openFile']
          });
          if (picked.canceled || !picked.filePaths[0]) return { canceled: true };
          const restored = await restoreDatabase({ handle, sourcePath: picked.filePaths[0], confirmed: true });
          const reopened = await ensureAllConDatabase(restored.filePath, { createIfMissing: false, seed: false });
          handles.set(event.sender.id, reopened);
          await attachDatabase(event.sender.id, reopened.adapter);
          return restored;
        }
        case 'savePdf': {
          const defaultName = String(payload.defaultName || 'document.pdf');
          const result = await dialog.showSaveDialog({
            title: 'Download PDF',
            defaultPath: path.join(app.getPath('documents'), defaultName),
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
          });
          if (result.canceled || !result.filePath) return { canceled: true };
          fs.writeFileSync(result.filePath, Buffer.from(String(payload.base64 || ''), 'base64'));
          return { filePath: result.filePath };
        }
        default:
          throw new StudioError('error.studioAction', `Unknown studio action: ${action}`);
      }
    });
  });
};

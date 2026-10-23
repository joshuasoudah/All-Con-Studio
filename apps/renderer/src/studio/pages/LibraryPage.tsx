import type { StudioDocument, StudioListFilter, StudioProject, StudioVendor } from '@invoice-builder/contracts';
import { formatUsd, pdfFileName } from '@invoice-builder/contracts';
import { pdf } from '@react-pdf/renderer';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { studioCall } from '../client';
import { toPdfModel, WorkOrderPdf } from '../pdf/WorkOrderPdf';

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

export const LibraryPage: FC<{ documentType: 'work_order' | 'credit_memo' }> = ({ documentType }) => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<StudioDocument[]>([]);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [vendors, setVendors] = useState<StudioVendor[]>([]);
  const [pattern, setPattern] = useState('{number} - {project}.pdf');
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [status, setStatus] = useState('');
  const [issuedFrom, setIssuedFrom] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const filter: StudioListFilter = {
      documentType,
      search,
      groupId: groupId || undefined,
      vendorId: vendorId || undefined,
      status: status === 'draft' || status === 'finalized' ? status : undefined,
      issuedFrom: issuedFrom || undefined,
      issuedTo: issuedTo || undefined,
      includeArchived: status === 'archived',
      archived: status === 'archived' ? true : undefined
    };
    const [rows, stateProjects, stateVendors, state] = await Promise.all([
      studioCall<StudioDocument[]>('listDocuments', filter),
      studioCall<StudioProject[]>('listProjects', { includeArchived: true }),
      studioCall<StudioVendor[]>('listVendors', { includeArchived: true }),
      studioCall<{ settings: { filenamePattern: string } }>('getState')
    ]);
    setDocuments(rows);
    setProjects(stateProjects);
    setVendors(stateVendors);
    setPattern(state.settings.filenamePattern);
  };

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Could not load documents.')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType]);

  const grouped = useMemo(() => {
    const groups = new Map<string, StudioDocument[]>();
    for (const document of documents) {
      const key = document.projectName || 'No project';
      const list = groups.get(key) ?? [];
      list.push(document);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [documents]);

  const openPath = (document: StudioDocument) =>
    document.documentType === 'credit_memo' ? `/credit-memos/${document.id}` : `/work-orders/${document.id}`;

  const download = async (id: string) => {
    const document = await studioCall<StudioDocument>('getDocument', { id });
    const blob = await pdf(<WorkOrderPdf model={toPdfModel(document)} />).toBlob();
    const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    await studioCall('savePdf', {
      base64,
      defaultName: pdfFileName(pattern, document.numberText, document.projectName)
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">{documentType === 'credit_memo' ? 'Credit Memos' : 'Work Orders'}</Typography>
        <Button
          variant="contained"
          onClick={() => navigate(documentType === 'credit_memo' ? '/credit-memos/new' : '/work-orders/new')}
        >
          {documentType === 'credit_memo' ? 'New Credit Memo' : 'New Work Order'}
        </Button>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Library grouped by project. Search, filter, duplicate, archive, and export from here.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 1, mb: 2 }}>
        <TextField label="Search" value={search} onChange={event => setSearch(event.target.value)} />
        <TextField select label="Project" value={groupId} onChange={event => setGroupId(event.target.value)}>
          <MenuItem value="">Any</MenuItem>
          {projects.map(project => (
            <MenuItem key={project.id} value={project.id}>
              {project.groupNumber} · {project.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Vendor" value={vendorId} onChange={event => setVendorId(event.target.value)}>
          <MenuItem value="">Any</MenuItem>
          {vendors.map(vendor => (
            <MenuItem key={vendor.id} value={vendor.id}>
              {vendor.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Status" value={status} onChange={event => setStatus(event.target.value)}>
          <MenuItem value="">Active</MenuItem>
          <MenuItem value="draft">Draft</MenuItem>
          <MenuItem value="finalized">Finalized</MenuItem>
          <MenuItem value="archived">Archived</MenuItem>
        </TextField>
        <TextField
          label="From"
          type="date"
          value={issuedFrom}
          onChange={event => setIssuedFrom(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="To"
          type="date"
          value={issuedTo}
          onChange={event => setIssuedTo(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
      <Button variant="outlined" onClick={() => void load().catch((reason: unknown) => setError(String(reason)))}>
        Apply filters
      </Button>
      {error ? (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      ) : null}
      {grouped.map(([projectName, rows]) => (
        <Box key={projectName} sx={{ mt: 3 }}>
          <Typography variant="h6">{projectName}</Typography>
          {rows.map(document => (
            <Box key={document.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5 }}>
              <Button onClick={() => navigate(openPath(document))}>{document.numberText}</Button>
              <Typography sx={{ flex: 1 }}>
                {document.vendorName} · {document.status} · {formatUsd(document.totalCents)}
              </Typography>
              <Button
                onClick={() =>
                  void studioCall<StudioDocument>('duplicateDocument', { id: document.id }).then(copy =>
                    navigate(openPath(copy))
                  )
                }
              >
                Duplicate
              </Button>
              <Button onClick={() => void download(document.id)}>PDF</Button>
              <Button onClick={() => void studioCall('archiveDocument', { id: document.id }).then(load)}>
                Archive
              </Button>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

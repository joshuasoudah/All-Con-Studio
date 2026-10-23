import type {
  StudioCompany,
  StudioAttachment,
  StudioAttachmentMeta,
  StudioDocument,
  StudioProject,
  StudioSettings,
  StudioTotals,
  StudioVendor,
  TotalOverrideBasis
} from '@invoice-builder/contracts';
import { formatUsd, parseUsdToCents, pdfFileName } from '@invoice-builder/contracts';
import { pdf, PDFViewer } from '@react-pdf/renderer';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { studioCall } from '../client';
import { toPdfModel, WorkOrderPdf, type WorkOrderPdfModel } from '../pdf/WorkOrderPdf';

type DraftLine = {
  key: string;
  title: string;
  description: string;
  serviceText: string;
  quantity: string;
  unitCost: string;
};

const emptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  title: '',
  description: '',
  serviceText: '',
  quantity: '1',
  unitCost: ''
});

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

const money = (cents: number) => (cents / 100).toFixed(2);

export const DocumentEditor: FC<{ documentType: 'work_order' | 'credit_memo' }> = ({ documentType }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const credit = documentType === 'credit_memo';
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [vendors, setVendors] = useState<StudioVendor[]>([]);
  const [company, setCompany] = useState<StudioCompany | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [groupId, setGroupId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [numberText, setNumberText] = useState('');
  const [numberDirty, setNumberDirty] = useState(false);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [originalVendorInvoiceNumber, setOriginalVendorInvoiceNumber] = useState('');
  const [issuedOn, setIssuedOn] = useState(new Date().toISOString().slice(0, 10));
  const [dueOn, setDueOn] = useState('');
  const [projectName, setProjectName] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const [subcontractNumber, setSubcontractNumber] = useState('');
  const [billToName, setBillToName] = useState('');
  const [billToAddressLine1, setBillToAddressLine1] = useState('');
  const [billToCity, setBillToCity] = useState('');
  const [billToRegion, setBillToRegion] = useState('');
  const [billToPostalCode, setBillToPostalCode] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorNumber, setVendorNumber] = useState('');
  const [taxName, setTaxName] = useState('Default');
  const [taxRateBps, setTaxRateBps] = useState(0);
  const [basis, setBasis] = useState<TotalOverrideBasis>('post-tax');
  const [manualTotal, setManualTotal] = useState('');
  const [showAmountPaid, setShowAmountPaid] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [status, setStatus] = useState<'draft' | 'finalized'>('draft');
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [totals, setTotals] = useState<StudioTotals | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [newVendor, setNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorNumber, setNewVendorNumber] = useState('');
  const [attachments, setAttachments] = useState<StudioAttachmentMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | undefined>(id);
  const locked = status === 'finalized';

  useEffect(() => {
    void Promise.all([
      studioCall<StudioProject[]>('listProjects'),
      studioCall<StudioVendor[]>('listVendors'),
      studioCall<{ company: StudioCompany; settings: StudioSettings }>('getState')
    ]).then(([projectRows, vendorRows, state]) => {
      setProjects(projectRows);
      setVendors(vendorRows);
      setCompany(state.company);
      setSettings(state.settings);
      if (!id) {
        setBasis(state.settings.totalOverrideBasis);
        setShowAmountPaid(state.settings.showAmountPaidDefault);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void studioCall<StudioDocument>('getDocument', { id }).then(document => {
      setSavedId(document.id);
      setStatus(document.status);
      setGroupId(document.groupId ?? '');
      setVendorId(document.vendorId ?? '');
      setNumberText(document.numberText);
      setNumberDirty(true);
      setVendorInvoiceNumber(document.vendorInvoiceNumber);
      setOriginalVendorInvoiceNumber(document.originalVendorInvoiceNumber);
      setIssuedOn(document.issuedOn);
      setDueOn(document.dueOn ?? '');
      setProjectName(document.projectName);
      setJobNumber(document.jobNumber);
      setSubcontractNumber(document.subcontractNumber);
      setBillToName(document.billToName);
      setBillToAddressLine1(document.billToAddressLine1);
      setBillToCity(document.billToCity);
      setBillToRegion(document.billToRegion);
      setBillToPostalCode(document.billToPostalCode);
      setVendorName(document.vendorName);
      setVendorNumber(document.vendorNumber);
      setTaxName(document.taxName);
      setTaxRateBps(document.taxRateBps);
      setBasis(document.overrideBasis);
      setManualTotal(document.manualTotalCents == null ? '' : money(document.manualTotalCents));
      setShowAmountPaid(document.showAmountPaid);
      setAmountPaid(document.amountPaidCents ? money(document.amountPaidCents) : '');
      setLines(
        document.lines.map(line => ({
          key: line.id,
          title: line.title,
          description: line.description,
          serviceText: line.serviceText ?? '',
          quantity: line.quantity,
          unitCost: money(line.unitCostCents)
        }))
      );
      setLogoSrc(document.logoBase64 ? `data:${document.logoMime || 'image/png'};base64,${document.logoBase64}` : null);
      setCompany({
        name: document.companyName,
        addressLine1: document.companyAddressLine1,
        addressLine2: document.companyAddressLine2,
        city: document.companyCity,
        region: document.companyRegion,
        postalCode: document.companyPostalCode,
        phone: document.companyPhone,
        email: document.companyEmail,
        logoBase64: document.logoBase64,
        logoMime: document.logoMime
      });
    });
  }, [id]);

  useEffect(() => {
    if (!savedId) return;
    void studioCall<StudioAttachmentMeta[]>('listAttachments', { documentId: savedId }).then(setAttachments);
  }, [savedId]);

  const applyGroup = async (nextGroupId: string) => {
    setGroupId(nextGroupId);
    const project = projects.find(item => item.id === nextGroupId);
    if (!project) return;
    setProjectName(project.name);
    setJobNumber(project.jobNumber);
    setSubcontractNumber(project.subcontractNumber);
    setBillToName(project.billToName);
    setBillToAddressLine1(project.billToAddressLine1);
    setBillToCity(project.billToCity);
    setBillToRegion(project.billToRegion);
    setBillToPostalCode(project.billToPostalCode);
    setTaxName(project.taxName);
    setTaxRateBps(project.taxRateBps);
    if (!dueOn && project.dueDateRule === 'net') {
      const issued = new Date(`${issuedOn}T00:00:00Z`);
      issued.setUTCDate(issued.getUTCDate() + project.dueDateDays);
      setDueOn(issued.toISOString().slice(0, 10));
    }
    if (!numberDirty && !credit) {
      const suggested = await studioCall<string>('suggestNumber', { documentType, groupNumber: project.groupNumber });
      setNumberText(suggested);
    }
  };

  const applyVendor = (nextVendorId: string) => {
    setVendorId(nextVendorId);
    const vendor = vendors.find(item => item.id === nextVendorId);
    if (!vendor) return;
    setVendorName(vendor.name);
    setVendorNumber(vendor.vendorNumber);
  };

  const pricedLines = useMemo(
    () =>
      lines.map(line => ({
        quantity: line.quantity || '0',
        unitCostCents: parseUsdToCents(line.unitCost)
      })),
    [lines]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void studioCall<StudioTotals>('computeTotals', {
        lines: pricedLines,
        taxRateBps,
        manualTotalCents: manualTotal.trim() ? parseUsdToCents(manualTotal) : null,
        overrideBasis: basis
      })
        .then(setTotals)
        .catch(() => undefined);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [pricedLines, taxRateBps, manualTotal, basis]);

  const model: WorkOrderPdfModel = {
    documentType,
    numberText: numberText || (credit ? 'CM-____' : 'WO'),
    projectName,
    issuedOn,
    dueOn: dueOn || null,
    jobNumber,
    subcontractNumber,
    vendorNumber,
    vendorInvoiceNumber,
    originalVendorInvoiceNumber,
    companyAddressLine1: company?.addressLine1 ?? '',
    companyAddressLine2: company?.addressLine2 ?? '',
    companyCity: company?.city ?? '',
    companyRegion: company?.region ?? '',
    companyPostalCode: company?.postalCode ?? '',
    companyPhone: company?.phone ?? '',
    logoSrc:
      logoSrc || (company?.logoBase64 ? `data:${company.logoMime || 'image/png'};base64,${company.logoBase64}` : null),
    billToName,
    billToAddressLine1,
    billToAddressLine2: '',
    billToCity,
    billToRegion,
    billToPostalCode,
    taxName,
    taxRateBps,
    overrideBasis: basis,
    lines: lines.map((line, index) => ({
      title: line.title || 'Item',
      description: line.description,
      serviceText: line.serviceText,
      quantity: line.quantity || '0',
      unitCostCents: parseUsdToCents(line.unitCost),
      lineTotalCents: totals?.lineTotalCents[index] ?? 0
    })),
    subtotalCents: totals?.subtotalCents ?? 0,
    taxCents: totals?.taxCents ?? 0,
    adjustmentCents: totals?.adjustmentCents ?? 0,
    totalCents: totals?.totalCents ?? 0,
    showAmountPaid,
    amountPaidCents: parseUsdToCents(amountPaid)
  };

  const payload = {
    id: savedId,
    documentType,
    groupId: groupId || null,
    vendorId: vendorId || null,
    numberText,
    vendorInvoiceNumber,
    originalVendorInvoiceNumber,
    issuedOn,
    dueOn: dueOn || null,
    projectName,
    jobNumber,
    subcontractNumber,
    billToName,
    billToAddressLine1,
    billToCity,
    billToRegion,
    billToPostalCode,
    vendorName,
    vendorNumber,
    taxName,
    taxRateBps,
    overrideBasis: basis,
    manualTotalCents: manualTotal.trim() ? parseUsdToCents(manualTotal) : null,
    showAmountPaid,
    amountPaidCents: parseUsdToCents(amountPaid),
    lines: lines
      .filter(line => line.title.trim())
      .map(line => ({
        title: line.title,
        description: line.description,
        serviceText: line.serviceText,
        quantity: line.quantity || '0',
        unitCostCents: parseUsdToCents(line.unitCost)
      }))
  };

  const save = async () => {
    const saved = await studioCall<StudioDocument>('saveDocument', payload);
    setSavedId(saved.id);
    setNumberText(saved.numberText);
    setStatus(saved.status);
    const path = credit ? `/credit-memos/${saved.id}` : `/work-orders/${saved.id}`;
    if (!id) navigate(path, { replace: true });
    return saved;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not save.'));
  };

  const download = async () => {
    const saved = locked && savedId ? await studioCall<StudioDocument>('getDocument', { id: savedId }) : await save();
    const blob = await pdf(<WorkOrderPdf model={toPdfModel(saved)} />).toBlob();
    const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
    await studioCall('savePdf', {
      base64,
      defaultName: pdfFileName(
        settings?.filenamePattern ?? '{number} - {project}.pdf',
        saved.numberText,
        saved.projectName
      )
    });
  };

  const createVendor = async () => {
    const vendor = await studioCall<StudioVendor>('saveVendor', { name: newVendorName, vendorNumber: newVendorNumber });
    setVendors(current => [...current, vendor].sort((left, right) => left.name.localeCompare(right.name)));
    applyVendor(vendor.id);
    setVendorId(vendor.id);
    setVendorName(vendor.name);
    setVendorNumber(vendor.vendorNumber);
    setNewVendor(false);
    setNewVendorName('');
    setNewVendorNumber('');
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 32px)' }}>
      {!expanded ? (
        <Box component="form" onSubmit={onSubmit} sx={{ flex: 1, overflow: 'auto', minWidth: 0, pr: 1 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            {credit ? 'Credit Memo' : 'Work Order'} {numberText}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {locked
              ? 'Finalized documents stay as they were saved.'
              : 'Confirm the suggested number, then check the total before downloading.'}
          </Typography>
          {error ? (
            <Typography color="error" sx={{ mb: 1 }}>
              {error}
            </Typography>
          ) : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField
              select
              label="Project group"
              value={groupId}
              disabled={locked}
              onChange={event => void applyGroup(event.target.value)}
            >
              <MenuItem value="">Choose a project</MenuItem>
              {projects.map(project => (
                <MenuItem key={project.id} value={project.id}>
                  {project.groupNumber} · {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Vendor"
              value={vendorId}
              disabled={locked}
              onChange={event => applyVendor(event.target.value)}
            >
              <MenuItem value="">Choose a vendor</MenuItem>
              {vendors.map(vendor => (
                <MenuItem key={vendor.id} value={vendor.id}>
                  {vendor.name} · {vendor.vendorNumber}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={credit ? 'Credit number' : 'Work order number'}
              value={numberText}
              disabled={locked}
              helperText="Confirm or edit the suggested number."
              onChange={event => {
                setNumberDirty(true);
                setNumberText(event.target.value);
              }}
            />
            <TextField
              label="Vendor invoice no."
              value={vendorInvoiceNumber}
              disabled={locked}
              onChange={event => setVendorInvoiceNumber(event.target.value)}
            />
            {credit ? (
              <TextField
                label="Original vendor invoice"
                value={originalVendorInvoiceNumber}
                disabled={locked}
                onChange={event => setOriginalVendorInvoiceNumber(event.target.value)}
              />
            ) : null}
            <TextField
              label="Date"
              type="date"
              value={issuedOn}
              disabled={locked}
              onChange={event => setIssuedOn(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Due date"
              type="date"
              value={dueOn}
              disabled={locked}
              onChange={event => setDueOn(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="Bill to"
              value={billToName}
              disabled={locked}
              onChange={event => setBillToName(event.target.value)}
            />
            <TextField
              label="Bill to address"
              value={billToAddressLine1}
              disabled={locked}
              onChange={event => setBillToAddressLine1(event.target.value)}
            />
          </Box>
          {!locked ? (
            <Button type="button" sx={{ mt: 1 }} onClick={() => setNewVendor(value => !value)}>
              New vendor
            </Button>
          ) : null}
          {newVendor ? (
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <TextField
                label="Vendor name"
                value={newVendorName}
                onChange={event => setNewVendorName(event.target.value)}
              />
              <TextField
                label="Vendor no."
                value={newVendorNumber}
                onChange={event => setNewVendorNumber(event.target.value)}
              />
              <Button type="button" onClick={() => void createVendor()}>
                Add vendor
              </Button>
            </Box>
          ) : null}
          <Typography sx={{ mt: 2, mb: 1 }} variant="h6">
            Lines
          </Typography>
          {lines.map((line, index) => (
            <Box
              key={line.key}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 88px 150px auto',
                gap: 1,
                mb: 1.5
              }}
            >
              <TextField
                sx={{ gridColumn: '1 / -1' }}
                label="Title"
                value={line.title}
                disabled={locked}
                onChange={event =>
                  setLines(current =>
                    current.map(item => (item.key === line.key ? { ...item, title: event.target.value } : item))
                  )
                }
              />
              <TextField
                sx={{ gridColumn: '1 / -1' }}
                label="Description"
                value={line.description}
                disabled={locked}
                onChange={event =>
                  setLines(current =>
                    current.map(item => (item.key === line.key ? { ...item, description: event.target.value } : item))
                  )
                }
              />
              <TextField
                sx={{ gridColumn: '1 / -1' }}
                label="Service range"
                value={line.serviceText}
                disabled={locked}
                onChange={event =>
                  setLines(current =>
                    current.map(item => (item.key === line.key ? { ...item, serviceText: event.target.value } : item))
                  )
                }
              />
              <TextField
                label="Qty"
                value={line.quantity}
                disabled={locked}
                onChange={event =>
                  setLines(current =>
                    current.map(item => (item.key === line.key ? { ...item, quantity: event.target.value } : item))
                  )
                }
              />
              <TextField
                label="Unit cost"
                value={line.unitCost}
                disabled={locked}
                onChange={event =>
                  setLines(current =>
                    current.map(item => (item.key === line.key ? { ...item, unitCost: event.target.value } : item))
                  )
                }
              />
              <Typography sx={{ alignSelf: 'center' }}>{formatUsd(totals?.lineTotalCents[index] ?? 0)}</Typography>
            </Box>
          ))}
          {!locked ? (
            <Button type="button" onClick={() => setLines(current => [...current, emptyLine()])}>
              Add line
            </Button>
          ) : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mt: 2 }}>
            <TextField
              select
              label="Total override"
              value={basis}
              disabled={locked}
              onChange={event => setBasis(event.target.value as TotalOverrideBasis)}
            >
              <MenuItem value="post-tax">Post-tax adjustment</MenuItem>
              <MenuItem value="pre-tax">Pre-tax adjustment</MenuItem>
            </TextField>
            <TextField
              label="Manual total"
              value={manualTotal}
              disabled={locked}
              onChange={event => setManualTotal(event.target.value)}
              helperText="Leave blank to use the calculated total."
            />
            <TextField
              label="Amount paid"
              value={amountPaid}
              disabled={!showAmountPaid}
              onChange={event => setAmountPaid(event.target.value)}
            />
          </Box>
          <Button type="button" sx={{ mt: 1 }} onClick={() => setShowAmountPaid(value => !value)}>
            {showAmountPaid ? 'Hide amount paid' : 'Show amount paid'}
          </Button>
          <Box sx={{ mt: 2 }}>
            <Typography>Subtotal {formatUsd(totals?.subtotalCents ?? 0)}</Typography>
            <Typography>
              Tax {taxName} {formatUsd(totals?.taxCents ?? 0)}
            </Typography>
            <Typography>Adjustment {formatUsd(totals?.adjustmentCents ?? 0)}</Typography>
            <Typography variant="h6">
              {credit ? 'Credit Total' : 'Total'} {formatUsd(totals?.totalCents ?? 0)}
            </Typography>
            {showAmountPaid ? (
              <Typography>Balance due {formatUsd((totals?.totalCents ?? 0) - parseUsdToCents(amountPaid))}</Typography>
            ) : null}
          </Box>
          {savedId ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6">Vendor invoice file</Typography>
              <Typography color="text.secondary">
                Stored beside the document. It is not merged into the work order PDF.
              </Typography>
              <Button component="label" type="button">
                Attach PDF
                <input
                  hidden
                  type="file"
                  accept="application/pdf"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file || !savedId) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = String(reader.result || '');
                      const bytesBase64 = result.includes(',') ? result.split(',')[1] : result;
                      void studioCall('addAttachment', {
                        documentId: savedId,
                        fileName: file.name,
                        mimeType: file.type || 'application/pdf',
                        bytesBase64
                      }).then(() =>
                        studioCall<StudioAttachmentMeta[]>('listAttachments', { documentId: savedId }).then(
                          setAttachments
                        )
                      );
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </Button>
              {attachments.map(file => (
                <Button
                  key={file.id}
                  type="button"
                  onClick={() =>
                    void studioCall<StudioAttachment>('getAttachment', { id: file.id }).then(stored => {
                      const bytes = Uint8Array.from(atob(stored.bytesBase64), character => character.charCodeAt(0));
                      const url = URL.createObjectURL(new Blob([bytes], { type: stored.mimeType }));
                      window.open(url);
                    })
                  }
                >
                  Open {file.fileName}
                </Button>
              ))}
            </Box>
          ) : null}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, mb: 4 }}>
            {!locked ? (
              <Button type="submit" variant="contained">
                Save
              </Button>
            ) : null}
            {!locked && savedId ? (
              <Button
                type="button"
                onClick={() => void studioCall('finalizeDocument', { id: savedId }).then(() => setStatus('finalized'))}
              >
                Finalize
              </Button>
            ) : null}
            <Button
              type="button"
              variant="contained"
              onClick={() =>
                void download().catch((reason: unknown) =>
                  setError(reason instanceof Error ? reason.message : 'Could not download.')
                )
              }
            >
              Download PDF
            </Button>
            {savedId ? (
              <Button
                type="button"
                onClick={() =>
                  void studioCall<StudioDocument>('duplicateDocument', { id: savedId }).then(copy =>
                    navigate(credit ? `/credit-memos/${copy.id}` : `/work-orders/${copy.id}`)
                  )
                }
              >
                Duplicate
              </Button>
            ) : null}
          </Box>
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Button type="button" onClick={() => setExpanded(value => !value)} sx={{ alignSelf: 'flex-end' }}>
          {expanded ? 'Show form' : 'Expand preview'}
        </Button>
        <PDFViewer style={{ flex: 1, width: '100%', height: '100%', border: '1px solid #e3e3e3' }} showToolbar={false}>
          <WorkOrderPdf model={model} />
        </PDFViewer>
      </Box>
    </Box>
  );
};

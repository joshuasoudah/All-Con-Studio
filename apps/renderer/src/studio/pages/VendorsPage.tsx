import type { StudioVendor } from '@invoice-builder/contracts';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useEffect, useState, type FC, type FormEvent } from 'react';
import { studioCall } from '../client';
import { EmptyState, PageHeader, Section } from '../chrome';

export const VendorsPage: FC = () => {
  const [vendors, setVendors] = useState<StudioVendor[]>([]);
  const [id, setId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [vendorNumber, setVendorNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => studioCall<StudioVendor[]>('listVendors', { includeArchived: true }).then(setVendors);
  useEffect(() => {
    void load();
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Enter a vendor name.');
      return;
    }
    void studioCall('saveVendor', { id, name, vendorNumber, email, phone, addressLine1 })
      .then(() => {
        setId(undefined);
        setName('');
        setVendorNumber('');
        setEmail('');
        setPhone('');
        setAddressLine1('');
        return load();
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not save the vendor.'));
  };

  return (
    <Box>
      <PageHeader
        title="Vendors"
        lede="Vendor numbers print on the work order. Email addresses are stored as text and are not used to send mail."
      />
      <Section title={id ? 'Edit vendor' : 'New vendor'}>
        <Box
          component="form"
          onSubmit={onSubmit}
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}
        >
          <TextField label="Name" value={name} onChange={event => setName(event.target.value)} />
          <TextField label="Vendor no." value={vendorNumber} onChange={event => setVendorNumber(event.target.value)} />
          <TextField label="Email" value={email} onChange={event => setEmail(event.target.value)} />
          <TextField label="Phone" value={phone} onChange={event => setPhone(event.target.value)} />
          <TextField label="Address" value={addressLine1} onChange={event => setAddressLine1(event.target.value)} />
          <Button type="submit" variant="contained" sx={{ alignSelf: 'end' }}>
            {id ? 'Update vendor' : 'Save vendor'}
          </Button>
        </Box>
      </Section>
      {error ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      ) : null}
      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet." detail="Add the company that appears as Vendor No. on the PDF." />
      ) : (
        <Paper>
          {vendors.map(vendor => (
            <Box
              key={vendor.id}
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                px: 2,
                py: 1.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 }
              }}
            >
              <Typography sx={{ flex: 1 }}>
                {vendor.name} · {vendor.vendorNumber}
                {vendor.archived ? ' (archived)' : ''}
              </Typography>
              <Button
                onClick={() => {
                  setId(vendor.id);
                  setName(vendor.name);
                  setVendorNumber(vendor.vendorNumber);
                  setEmail(vendor.email);
                  setPhone(vendor.phone);
                  setAddressLine1(vendor.addressLine1);
                }}
              >
                Edit
              </Button>
              <Button
                onClick={() =>
                  void studioCall('archiveVendor', { id: vendor.id, archived: !vendor.archived }).then(load)
                }
              >
                {vendor.archived ? 'Unarchive' : 'Archive'}
              </Button>
              <Button
                onClick={() =>
                  void studioCall('deleteVendor', { id: vendor.id })
                    .then(load)
                    .catch((reason: unknown) => setError(String(reason)))
                }
              >
                Delete
              </Button>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
};

import type { StudioVendor } from '@invoice-builder/contracts';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useEffect, useState, type FC, type FormEvent } from 'react';
import { studioCall } from '../client';

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
      <Typography variant="h4" sx={{ mb: 2 }}>
        Vendors
      </Typography>
      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mb: 3 }}
      >
        <TextField label="Name" value={name} onChange={event => setName(event.target.value)} />
        <TextField label="Vendor no." value={vendorNumber} onChange={event => setVendorNumber(event.target.value)} />
        <TextField label="Email" value={email} onChange={event => setEmail(event.target.value)} />
        <TextField label="Phone" value={phone} onChange={event => setPhone(event.target.value)} />
        <TextField label="Address" value={addressLine1} onChange={event => setAddressLine1(event.target.value)} />
        <Button type="submit" variant="contained">
          {id ? 'Update vendor' : 'Save vendor'}
        </Button>
      </Box>
      {error ? <Typography color="error">{error}</Typography> : null}
      {vendors.map(vendor => (
        <Box key={vendor.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5 }}>
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
            onClick={() => void studioCall('archiveVendor', { id: vendor.id, archived: !vendor.archived }).then(load)}
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
    </Box>
  );
};

import type { StudioCompany, StudioSettings, StudioState } from '@invoice-builder/contracts';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { useEffect, useState, type ChangeEvent, type FC, type FormEvent } from 'react';
import { Confirmation } from '../../shared/components/modals/confirmation';
import { studioCall } from '../client';

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const StudioSettingsPage: FC = () => {
  const [company, setCompany] = useState<StudioCompany | null>(null);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    void studioCall<StudioState>('getState').then(state => {
      setCompany(state.company);
      setSettings(state.settings);
    });
  }, []);

  if (!company || !settings) return <Typography>Loading settings…</Typography>;

  const save = (event: FormEvent) => {
    event.preventDefault();
    void Promise.all([studioCall('updateCompany', company), studioCall('updateSettings', settings)])
      .then(() => setMessage('Saved. The logo and numbering settings are reused on new documents.'))
      .catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'Could not save settings.'));
  };

  const onLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const logoBase64 = await fileToBase64(file);
    setCompany({ ...company, logoBase64, logoMime: file.type || 'image/png' });
  };

  return (
    <Box component="form" onSubmit={save} sx={{ maxWidth: 820 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Settings
      </Typography>
      <Typography sx={{ mb: 2 }}>Database: {settings.databasePath}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        <TextField
          label="Company"
          value={company.name}
          onChange={event => setCompany({ ...company, name: event.target.value })}
        />
        <TextField
          label="Phone"
          value={company.phone}
          onChange={event => setCompany({ ...company, phone: event.target.value })}
        />
        <TextField
          label="Street"
          value={company.addressLine1}
          onChange={event => setCompany({ ...company, addressLine1: event.target.value })}
        />
        <TextField
          label="Email"
          value={company.email}
          onChange={event => setCompany({ ...company, email: event.target.value })}
          helperText="Shown as text only. All Con Studio does not send email."
        />
        <TextField
          label="City"
          value={company.city}
          onChange={event => setCompany({ ...company, city: event.target.value })}
        />
        <TextField
          label="State"
          value={company.region}
          onChange={event => setCompany({ ...company, region: event.target.value })}
        />
        <TextField
          label="Postal code"
          value={company.postalCode}
          onChange={event => setCompany({ ...company, postalCode: event.target.value })}
        />
        <TextField
          label="Credit prefix"
          value={settings.creditPrefix}
          onChange={event => setSettings({ ...settings, creditPrefix: event.target.value })}
        />
        <TextField
          label="Credit start"
          value={String(settings.creditStart)}
          onChange={event => setSettings({ ...settings, creditStart: Number(event.target.value) })}
        />
        <TextField
          label="Credit padding"
          value={String(settings.creditPadding)}
          onChange={event => setSettings({ ...settings, creditPadding: Number(event.target.value) })}
        />
        <TextField
          label="PDF filename pattern"
          value={settings.filenamePattern}
          onChange={event => setSettings({ ...settings, filenamePattern: event.target.value })}
          helperText="Use {number} and {project}."
        />
        <TextField
          select
          label="Manual total"
          value={settings.totalOverrideBasis}
          onChange={event =>
            setSettings({ ...settings, totalOverrideBasis: event.target.value as StudioSettings['totalOverrideBasis'] })
          }
        >
          <MenuItem value="post-tax">Post-tax adjustment</MenuItem>
          <MenuItem value="pre-tax">Pre-tax adjustment</MenuItem>
        </TextField>
      </Box>
      <Button component="label" sx={{ mt: 2 }}>
        Upload logo
        <input hidden type="file" accept="image/png,image/jpeg" onChange={event => void onLogo(event)} />
      </Button>
      {company.logoBase64 ? (
        <Box
          component="img"
          alt="Company logo"
          src={`data:${company.logoMime || 'image/png'};base64,${company.logoBase64}`}
          sx={{ display: 'block', mt: 1, maxWidth: 220 }}
        />
      ) : null}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button type="submit" variant="contained">
          Save settings
        </Button>
        <Button
          type="button"
          onClick={() =>
            void studioCall<{ filePath?: string; canceled?: boolean }>('backup').then(result =>
              setMessage(result.filePath ? `Backup saved to ${result.filePath}` : 'Backup canceled.')
            )
          }
        >
          Backup database
        </Button>
        <Button type="button" color="warning" onClick={() => setConfirmRestore(true)}>
          Restore database
        </Button>
      </Box>
      {message ? <Typography sx={{ mt: 2 }}>{message}</Typography> : null}
      <Confirmation
        isOpen={confirmRestore}
        text="Restore replaces the current database. A safety copy is written first."
        onCancel={() => setConfirmRestore(false)}
        onConfirm={() => {
          setConfirmRestore(false);
          void studioCall<{ safetyPath?: string; canceled?: boolean }>('restore', { confirmed: true })
            .then(result => {
              setMessage(result.safetyPath ? `Restored. Safety copy: ${result.safetyPath}` : 'Restore canceled.');
              return studioCall<StudioState>('getState');
            })
            .then(state => {
              setCompany(state.company);
              setSettings(state.settings);
            })
            .catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : 'Restore failed.'));
        }}
      />
    </Box>
  );
};

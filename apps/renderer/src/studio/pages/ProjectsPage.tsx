import type { StudioProject, StudioProjectWrite } from '@invoice-builder/contracts';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { useEffect, useState, type FC, type FormEvent } from 'react';
import { studioCall } from '../client';

const empty = (): StudioProjectWrite & { id?: string } => ({
  groupNumber: '',
  name: '',
  jobNumber: '',
  subcontractNumber: '',
  billToName: '',
  billToAddressLine1: '',
  billToCity: '',
  billToRegion: '',
  billToPostalCode: '',
  billToEmail: '',
  taxName: 'Default',
  taxRateBps: 750,
  dueDateRule: 'net',
  dueDateDays: 30
});

export const ProjectsPage: FC = () => {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [form, setForm] = useState(empty());
  const [error, setError] = useState<string | null>(null);

  const load = () => studioCall<StudioProject[]>('listProjects', { includeArchived: true }).then(setProjects);

  useEffect(() => {
    void load();
  }, []);

  const edit = (project: StudioProject) =>
    setForm({
      id: project.id,
      groupNumber: project.groupNumber,
      name: project.name,
      jobNumber: project.jobNumber,
      subcontractNumber: project.subcontractNumber,
      billToName: project.billToName,
      billToAddressLine1: project.billToAddressLine1,
      billToCity: project.billToCity,
      billToRegion: project.billToRegion,
      billToPostalCode: project.billToPostalCode,
      billToEmail: project.billToEmail,
      taxName: project.taxName,
      taxRateBps: project.taxRateBps,
      dueDateRule: project.dueDateRule,
      dueDateDays: project.dueDateDays,
      archived: project.archived
    });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void studioCall('saveProject', { ...form, taxRateBps: Number(form.taxRateBps) })
      .then(() => {
        setForm(empty());
        return load();
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not save the project.'));
  };

  const set = (key: keyof StudioProjectWrite, value: string) => setForm(current => ({ ...current, [key]: value }));

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Projects
      </Typography>
      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mb: 3 }}
      >
        <TextField
          label="Group number"
          value={form.groupNumber}
          onChange={event => set('groupNumber', event.target.value)}
        />
        <TextField label="Project name" value={form.name} onChange={event => set('name', event.target.value)} />
        <TextField label="Job no." value={form.jobNumber} onChange={event => set('jobNumber', event.target.value)} />
        <TextField
          label="Subcontract no."
          value={form.subcontractNumber}
          onChange={event => set('subcontractNumber', event.target.value)}
        />
        <TextField label="Bill to" value={form.billToName} onChange={event => set('billToName', event.target.value)} />
        <TextField
          label="Bill to address"
          value={form.billToAddressLine1}
          onChange={event => set('billToAddressLine1', event.target.value)}
        />
        <TextField label="City" value={form.billToCity} onChange={event => set('billToCity', event.target.value)} />
        <TextField
          label="State"
          value={form.billToRegion}
          onChange={event => set('billToRegion', event.target.value)}
        />
        <TextField
          label="Postal code"
          value={form.billToPostalCode}
          onChange={event => set('billToPostalCode', event.target.value)}
        />
        <TextField
          label="Bill to email"
          value={form.billToEmail}
          onChange={event => set('billToEmail', event.target.value)}
        />
        <TextField label="Tax name" value={form.taxName} onChange={event => set('taxName', event.target.value)} />
        <TextField
          label="Tax basis points"
          value={String(form.taxRateBps ?? 0)}
          onChange={event => setForm(current => ({ ...current, taxRateBps: Number(event.target.value) }))}
        />
        <TextField
          select
          label="Due date"
          value={form.dueDateRule}
          onChange={event => setForm(current => ({ ...current, dueDateRule: event.target.value as 'none' | 'net' }))}
        >
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="net">Net days</MenuItem>
        </TextField>
        <TextField
          label="Net days"
          value={String(form.dueDateDays ?? 0)}
          onChange={event => setForm(current => ({ ...current, dueDateDays: Number(event.target.value) }))}
        />
        <Button type="submit" variant="contained">
          {form.id ? 'Update project' : 'Save project'}
        </Button>
      </Box>
      {error ? <Typography color="error">{error}</Typography> : null}
      {projects.map(project => (
        <Box key={project.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5 }}>
          <Typography sx={{ flex: 1 }}>
            {project.groupNumber} · {project.name}
            {project.archived ? ' (archived)' : ''}
          </Typography>
          <Button onClick={() => edit(project)}>Edit</Button>
          <Button onClick={() => void studioCall('duplicateProject', { id: project.id }).then(load)}>Duplicate</Button>
          <Button
            onClick={() =>
              void studioCall('archiveProject', { id: project.id, archived: !project.archived }).then(load)
            }
          >
            {project.archived ? 'Unarchive' : 'Archive'}
          </Button>
          <Button
            onClick={() =>
              void studioCall('deleteProject', { id: project.id })
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

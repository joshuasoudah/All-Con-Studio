import type { StudioDocument, StudioState } from '@invoice-builder/contracts';
import { formatUsd } from '@invoice-builder/contracts';
import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { studioCall } from '../client';
import { EmptyState, PageHeader } from '../chrome';

const pathFor = (document: StudioDocument) =>
  document.documentType === 'credit_memo' ? `/credit-memos/${document.id}` : `/work-orders/${document.id}`;

export const DashboardPage: FC = () => {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<StudioDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void studioCall<StudioState>('getState')
      .then(state => setRecent(state.recent))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load the dashboard.'));
  }, []);

  const drafts = recent.filter(document => document.status === 'draft').length;
  const openBalance = recent.reduce((sum, document) => {
    const balance = document.balanceCents;
    return sum + (document.documentType === 'credit_memo' ? -balance : balance);
  }, 0);

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        lede="Recent work orders and credit memos on this computer."
        action={
          <Button variant="contained" size="large" onClick={() => navigate('/work-orders/new')}>
            New Work Order
          </Button>
        }
      />
      {error ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      ) : null}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        {[
          ['On this computer', String(recent.length)],
          ['Drafts', String(drafts)],
          ['Balance on recent', formatUsd(openBalance)]
        ].map(([label, value]) => (
          <Paper key={label} sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Paper>
        ))}
      </Box>
      {recent.length === 0 ? (
        <EmptyState
          title="No documents yet. Start with New Work Order."
          detail="Work orders are numbered by project group, such as WO8.17."
        />
      ) : (
        <Paper>
          {recent.map(document => (
            <Box
              key={document.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1.25,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 }
              }}
            >
              <Button onClick={() => navigate(pathFor(document))} sx={{ justifyContent: 'flex-start' }}>
                {document.numberText} · {document.projectName}
              </Button>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Chip
                  size="small"
                  label={document.documentType === 'credit_memo' ? 'Credit' : document.status}
                  color={document.status === 'finalized' ? 'success' : 'default'}
                  variant="outlined"
                />
                <Typography sx={{ minWidth: 96, textAlign: 'right' }}>{formatUsd(document.totalCents)}</Typography>
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
};

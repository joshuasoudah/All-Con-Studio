import type { StudioDocument, StudioState } from '@invoice-builder/contracts';
import { formatUsd } from '@invoice-builder/contracts';
import { Box, Button, Paper, Typography } from '@mui/material';
import { useEffect, useState, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { studioCall } from '../client';

export const DashboardPage: FC = () => {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<StudioDocument[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void studioCall<StudioState>('getState')
      .then(state => setRecent(state.recent))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load the dashboard.'));
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4">Dashboard</Typography>
          <Typography color="text.secondary">Recent work orders and credit memos on this computer.</Typography>
        </Box>
        <Button variant="contained" size="large" onClick={() => navigate('/work-orders/new')}>
          New Work Order
        </Button>
      </Box>
      {error ? <Typography color="error">{error}</Typography> : null}
      <Paper>
        {recent.length === 0 ? (
          <Typography sx={{ p: 3 }}>No documents yet. Start with New Work Order.</Typography>
        ) : (
          recent.map(document => (
            <Box
              key={document.id}
              sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.5, borderBottom: '1px solid #eee' }}
            >
              <Button
                onClick={() =>
                  navigate(
                    document.documentType === 'credit_memo'
                      ? `/credit-memos/${document.id}`
                      : `/work-orders/${document.id}`
                  )
                }
              >
                {document.numberText} · {document.projectName}
              </Button>
              <Typography sx={{ alignSelf: 'center' }}>
                {document.documentType === 'credit_memo' ? 'Credit' : document.status} {formatUsd(document.totalCents)}
              </Typography>
            </Box>
          ))
        )}
      </Paper>
    </Box>
  );
};

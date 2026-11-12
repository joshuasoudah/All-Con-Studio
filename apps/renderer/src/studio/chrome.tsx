import { Box, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export const PageHeader = ({ title, lede, action }: { title: string; lede?: string; action?: ReactNode }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3 }}>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em' }}>
        All Con Studio
      </Typography>
      <Typography variant="h4">{title}</Typography>
      {lede ? (
        <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 640 }}>
          {lede}
        </Typography>
      ) : null}
    </Box>
    {action}
  </Box>
);

export const EmptyState = ({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) => (
  <Paper sx={{ px: 4, py: 6, textAlign: 'center' }}>
    <Typography variant="h6">{title}</Typography>
    {detail ? (
      <Typography color="text.secondary" sx={{ mt: 1, mb: action ? 2 : 0 }}>
        {detail}
      </Typography>
    ) : null}
    {action}
  </Paper>
);

export const Section = ({ title, children }: { title?: string; children: ReactNode }) => (
  <Paper sx={{ p: 2.5, mb: 2 }}>
    {title ? (
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
    ) : null}
    {children}
  </Paper>
);

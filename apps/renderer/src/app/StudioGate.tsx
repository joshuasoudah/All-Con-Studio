import { Box, Typography } from '@mui/material';
import { useEffect, useState, type FC } from 'react';
import { studioCall } from '../studio/client';

export const StudioGate: FC<{ onReady: () => void }> = ({ onReady }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void studioCall<{ databasePath: string }>('ensureDefault')
      .then(() => {
        if (!cancelled) onReady();
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not open the database.');
      });
    return () => {
      cancelled = true;
    };
  }, [onReady]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 4 }}>
      <Box>
        <Typography variant="h5">All Con Studio</Typography>
        <Typography sx={{ mt: 1 }} color={error ? 'error' : 'text.secondary'}>
          {error ?? 'Opening the local database…'}
        </Typography>
      </Box>
    </Box>
  );
};

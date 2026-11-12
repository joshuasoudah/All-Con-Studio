import { Box } from '@mui/material';
import type { FC } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export const AppLayout: FC = () => {
  return (
    <>
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <Box
          component="main"
          sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, overflow: 'auto', bgcolor: 'background.default' }}
        >
          <Outlet />
        </Box>
      </Box>
    </>
  );
};

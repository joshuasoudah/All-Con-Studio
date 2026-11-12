import { createTheme, type ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    customBorder?: string;
  }
  interface PaletteOptions {
    customBorder?: string;
  }
}

const fontFamily = '"Figtree", "Segoe UI", sans-serif';

const buildTheme = (mode: 'light' | 'dark') => {
  const dark = mode === 'dark';
  const ink = dark ? '#f6f1ea' : '#1c1917';
  const muted = dark ? '#b7afa4' : '#6b645c';
  const paper = dark ? '#221f1c' : '#fffcf8';
  const canvas = dark ? '#141210' : '#f3efe8';
  const line = dark ? '#3a342e' : '#e4ddd2';
  const thumb = dark ? '#6a534c' : '#c4b8ac';

  const options: ThemeOptions = {
    palette: {
      mode,
      primary: { main: '#8e2a2a', contrastText: '#fffaf7' },
      secondary: { main: dark ? '#d7c4b8' : '#3f4a45' },
      success: { main: dark ? '#8fbfa4' : '#2f6b4f' },
      warning: { main: dark ? '#e2c08a' : '#9a6b2f' },
      error: { main: dark ? '#f0a8a0' : '#9f2d2d' },
      divider: line,
      background: { default: canvas, paper },
      text: { primary: ink, secondary: muted },
      customBorder: line
    },
    typography: {
      fontFamily,
      h1: { fontWeight: 600, fontSize: '2rem', letterSpacing: '-0.03em' },
      h2: { fontWeight: 600, fontSize: '1.75rem', letterSpacing: '-0.03em' },
      h3: { fontWeight: 600, letterSpacing: '-0.02em' },
      h4: { fontWeight: 600, fontSize: '1.75rem', letterSpacing: '-0.03em' },
      h5: { fontWeight: 600, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
      body1: { fontSize: '0.95rem' },
      body2: { fontSize: '0.875rem' }
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily,
            backgroundColor: canvas,
            scrollbarWidth: 'thin',
            scrollbarColor: `${thumb} ${canvas}`
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 14, boxShadow: 'none' },
          contained: { boxShadow: 'none' },
          containedPrimary: { '&:hover': { boxShadow: 'none' } }
        }
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${line}`
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { backgroundColor: dark ? '#1a1715' : '#fff' }
        }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 8,
            marginBlock: 2,
            '&.Mui-selected': {
              backgroundColor: dark ? 'rgba(224, 137, 124, 0.16)' : 'rgba(142, 42, 42, 0.1)',
              color: dark ? '#f3d2cb' : '#8e2a2a',
              '& .MuiListItemIcon-root': { color: dark ? '#f3d2cb' : '#8e2a2a' },
              '&:hover': { backgroundColor: dark ? 'rgba(224, 137, 124, 0.22)' : 'rgba(142, 42, 42, 0.16)' }
            }
          }
        }
      },
      MuiListItemIcon: {
        styleOverrides: { root: { minWidth: 38, color: muted } }
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } }
      }
    }
  };

  return createTheme(options);
};

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');

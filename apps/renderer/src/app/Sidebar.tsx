import { ChevronLeft, ChevronRight, DarkMode, Description, LightMode, People, Settings } from '@mui/icons-material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { Box, Divider, Drawer, IconButton, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useContext, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/allcon/default-logo.png';
import { getApi } from '../shared/api/restApi';
import { ThemeContext } from '../shared/components/layout/theme/ThemeProviderWrapper';
import { MenuList } from '../shared/components/lists/menuList/MenuList';
import { Themes } from '../shared/enums/themes';
import type { MenuItem } from '../shared/types/menuItem';
import { useAppDispatch, useAppSelector } from '../state/configureStore';
import { selectSettings, selectVersion, setMode, setVersion } from '../state/pageSlice';

const DRAWER_WIDTH = 248;
const COLLAPSED_WIDTH = 72;

export const Sidebar: FC = () => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const version = useAppSelector(selectVersion);
  const storeSettings = useAppSelector(selectSettings);
  const { mode, toggleMode } = useContext(ThemeContext);

  const onClickNavigate = useCallback(
    (menuItem: MenuItem) => {
      if (typeof menuItem.path !== 'undefined') navigate(menuItem.path);
    },
    [navigate]
  );

  const isSelected = useCallback(
    (menuItem: MenuItem) => {
      if (!menuItem.path) return false;
      if (menuItem.path === '/') return location.pathname === '/';
      return location.pathname === menuItem.path || location.pathname.startsWith(`${menuItem.path}/`);
    },
    [location]
  );

  const item = (text: string, path: string, icon: MenuItem['icon']): MenuItem => ({
    text,
    icon,
    path,
    isToggle: false,
    minHeight: 44,
    isSelected,
    onClick: onClickNavigate
  });

  const menuItems = [
    {
      items: [
        item(t('menuItems.dashboard'), '/', <DashboardIcon />),
        item(t('menuItems.workOrders'), '/work-orders', <Description />),
        item(t('menuItems.creditMemos'), '/credit-memos', <ReceiptIcon />),
        item(t('menuItems.projects'), '/projects', <AccountTreeIcon />),
        item(t('menuItems.vendors'), '/vendors', <People />),
        item(t('menuItems.settings'), '/settings', <Settings />)
      ]
    }
  ];

  const handleToggle = () => setOpen(!open);

  const switchColorMode = () => {
    const nextDark = mode !== Themes.dark;
    if (storeSettings) {
      dispatch(setMode(nextDark));
      const api = getApi() as { updateSettings?: (data: { isDarkMode: boolean }) => Promise<unknown> };
      void api.updateSettings?.({ isDarkMode: nextDark });
      return;
    }
    toggleMode();
  };

  useEffect(() => {
    if (!isDesktop) setOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    getApi()
      .getAppVersion()
      .then(appVersion => dispatch(setVersion(appVersion)));
  }, [dispatch]);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: open ? DRAWER_WIDTH : COLLAPSED_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : COLLAPSED_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderRight: `1px solid ${theme.palette.divider}`,
          overflowX: 'hidden',
          transition: 'width 0.2s ease',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          gap: 1,
          px: 1.5,
          minHeight: 76
        }}
      >
        {open ? (
          <Box sx={{ minWidth: 0, pl: 0.5 }}>
            <Box
              component="img"
              src={logo}
              alt="All Construction Group"
              sx={{ height: 28, width: 'auto', display: 'block', bgcolor: '#fff', borderRadius: 1, px: 0.5 }}
            />
            <Typography variant="subtitle2" noWrap sx={{ mt: 0.75, color: 'text.primary' }}>
              {t('app.title')}
            </Typography>
          </Box>
        ) : null}
        {isDesktop ? (
          <Tooltip title={t('ariaLabel.menu')}>
            <IconButton onClick={handleToggle} aria-label={t('ariaLabel.menu')} size="small">
              {open ? <ChevronLeft /> : <ChevronRight />}
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
      <Divider />
      <MenuList useTooltip={true} items={menuItems} showText={open} />
      <Box sx={{ mt: 'auto', px: 1.5, pb: 2 }}>
        <Divider sx={{ mb: 1 }} />
        <Tooltip title={mode === Themes.dark ? 'Light mode' : 'Dark mode'}>
          <IconButton aria-label="Color mode" onClick={switchColorMode} size="small">
            {mode === Themes.dark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </IconButton>
        </Tooltip>
        {open ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, pl: 0.5 }}>
            {t('app.version')}: {version}
          </Typography>
        ) : null}
      </Box>
    </Drawer>
  );
};

import { ChevronLeft, ChevronRight, Description, Folder, People, Settings } from '@mui/icons-material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { Box, Divider, Drawer, IconButton, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApi } from '../shared/api/restApi';
import { MenuList } from '../shared/components/lists/menuList/MenuList';
import type { MenuItem } from '../shared/types/menuItem';
import { useAppDispatch, useAppSelector } from '../state/configureStore';
import { selectVersion, setVersion } from '../state/pageSlice';

const DRAWER_WIDTH = 240;
const COLLAPSED_WIDTH = 60;

export const Sidebar: FC = () => {
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const version = useAppSelector(selectVersion);

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
    minHeight: 50,
    isSelected,
    onClick: onClickNavigate
  });

  const menuItems = [
    {
      groupName: t('common.documents'),
      groupIcon: <Folder />,
      isOpen: true,
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
        display: 'flex',
        flexDirection: 'column',
        '& .MuiDrawer-paper': {
          width: open ? DRAWER_WIDTH : COLLAPSED_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderRight: `1px solid ${theme.palette.divider}`,
          overflowX: 'hidden',
          transition: 'width 0.3s',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {isDesktop && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: open ? 'space-between' : 'center',
            px: 1,
            minHeight: 64
          }}
        >
          <Box sx={{ flexGrow: 1 }}></Box>
          {open && (
            <Typography variant="h6" noWrap component="div" sx={{ color: theme.palette.primary.main }}>
              {t('app.title')}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }}></Box>
          <Tooltip title={t('ariaLabel.menu')}>
            <IconButton onClick={handleToggle} aria-label={t('ariaLabel.menu')}>
              {open ? <ChevronLeft /> : <ChevronRight />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
      {isDesktop && <Divider />}
      <MenuList useTooltip={true} items={menuItems} showText={open} />
      <Box sx={{ p: 2 }}>
        <Divider />
        {open && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
            {t('app.version')}: {version}
          </Typography>
        )}
      </Box>
    </Drawer>
  );
};

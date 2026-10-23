import { describe, beforeEach, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '../../i18n';
import type { MenuItem, MenuItemMetadata } from '../../shared/types/menuItem';
import type { Settings } from '@invoice-builder/contracts';

import { store } from '../../state/configureStore';
import { setDbReady, setSettings } from '../../state/pageSlice';
import { Sidebar } from '../Sidebar';

const mocks = vi.hoisted(() => ({
  desktop: true,
  menuItems: [] as MenuItemMetadata[],
  getAppVersion: vi.fn()
}));

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => mocks.desktop }));
vi.mock('../../shared/api/restApi', () => ({ getApi: () => ({ getAppVersion: mocks.getAppVersion }) }));
vi.mock('../../shared/components/lists/menuList/MenuList', () => ({
  MenuList: ({ items, showText }: { items: MenuItemMetadata[]; showText: boolean }) => {
    mocks.menuItems = items;
    return <div data-testid="menu-state">{String(showText)}</div>;
  }
}));

const Location = () => <div data-testid="location">{useLocation().pathname}</div>;
const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/']}>
        {children}
        <Location />
      </MemoryRouter>
    </I18nextProvider>
  </Provider>
);
const items = () => mocks.menuItems.flatMap(group => group.items);
const findItem = (text: string) => items().find(item => item.text === text) as MenuItem;

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.desktop = true;
    mocks.getAppVersion.mockResolvedValue('9.9.9');
    store.dispatch(setDbReady(true));
    store.dispatch(
      setSettings({ quotesON: true, presetsON: true, styleProfilesON: true, reportsON: true } as Settings)
    );
  });

  it('builds the All Con Studio navigation and collapses', async () => {
    render(<Sidebar />, { wrapper });
    await waitFor(() => expect(mocks.getAppVersion).toHaveBeenCalledTimes(1));

    const dashboard = findItem(i18n.t('menuItems.dashboard'));
    expect((dashboard.isSelected as (item: MenuItem) => boolean)(dashboard)).toBe(true);
    expect(findItem(i18n.t('menuItems.workOrders'))).toBeDefined();
    expect(findItem(i18n.t('menuItems.creditMemos'))).toBeDefined();
    expect(findItem(i18n.t('menuItems.projects'))).toBeDefined();
    expect(findItem(i18n.t('menuItems.vendors'))).toBeDefined();
    expect(items().some(item => item.text === i18n.t('menuItems.quotes'))).toBe(false);
    expect(items().some(item => item.text === i18n.t('menuItems.reports'))).toBe(false);

    const settings = findItem(i18n.t('menuItems.settings'));
    act(() => settings.onClick?.(settings));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');

    act(() => screen.getByRole('button', { name: i18n.t('ariaLabel.menu') }).click());
    expect(screen.getByTestId('menu-state')).toHaveTextContent('false');
  });

  it('starts collapsed on a narrow screen', () => {
    mocks.desktop = false;
    render(<Sidebar />, { wrapper });
    expect(screen.getByTestId('menu-state')).toHaveTextContent('false');
    expect(screen.queryByRole('button', { name: i18n.t('ariaLabel.menu') })).not.toBeInTheDocument();
  });
});

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createBrowserRouter, createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { App } from './app/App';
import { frontendConfig } from './config';
import './globalErrorHandlers';
import './i18n';
import './polyfills';
import { isWebMode } from './shared/api/restApi';
import { GlobalErrorBoundaryWrapper } from './shared/components/feedback/globalErrorBoundaryWrapper/GlobalErrorBoundaryWrapper';
import { ThemeProviderWrapper } from './shared/components/layout/theme/ThemeProviderWrapper';
import { DashboardPage } from './studio/pages/DashboardPage';
import { DocumentEditor } from './studio/pages/DocumentEditor';
import { LibraryPage } from './studio/pages/LibraryPage';
import { ProjectsPage } from './studio/pages/ProjectsPage';
import { StudioSettingsPage } from './studio/pages/StudioSettingsPage';
import { VendorsPage } from './studio/pages/VendorsPage';

import { store } from './state/configureStore';

const createRouter = () => {
  const routes = [
    {
      path: '/',
      element: (
        <ThemeProviderWrapper>
          <App />
        </ThemeProviderWrapper>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'work-orders', element: <LibraryPage documentType="work_order" /> },
        { path: 'work-orders/new', element: <DocumentEditor documentType="work_order" /> },
        { path: 'work-orders/:id', element: <DocumentEditor documentType="work_order" /> },
        { path: 'credit-memos', element: <LibraryPage documentType="credit_memo" /> },
        { path: 'credit-memos/new', element: <DocumentEditor documentType="credit_memo" /> },
        { path: 'credit-memos/:id', element: <DocumentEditor documentType="credit_memo" /> },
        { path: 'projects', element: <ProjectsPage /> },
        { path: 'vendors', element: <VendorsPage /> },
        { path: 'settings', element: <StudioSettingsPage /> },
        { path: '*', element: <Navigate to="/" replace /> }
      ]
    }
  ];

  return isWebMode() ? createBrowserRouter(routes) : createHashRouter(routes);
};

const startApp = async () => {
  if (frontendConfig.mocksEnabled) {
    try {
      const { worker } = await import('./mocks/browser');
      await worker.start();
    } catch (err) {
      console.error('Failed to load mocks:', err);
    }
  }

  const router = createRouter();

  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <StrictMode>
      <Provider store={store}>
        <GlobalErrorBoundaryWrapper>
          <RouterProvider router={router} />
        </GlobalErrorBoundaryWrapper>
      </Provider>
    </StrictMode>
  );
};

startApp();

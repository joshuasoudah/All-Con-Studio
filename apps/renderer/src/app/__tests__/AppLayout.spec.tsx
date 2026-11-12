import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from '../AppLayout';

vi.mock('../Sidebar', () => ({ Sidebar: () => <div>Studio navigation</div> }));

describe('AppLayout', () => {
  it('shows the sidebar beside the current page', () => {
    render(
      <MemoryRouter initialEntries={['/work-orders']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/work-orders" element={<div>Work order library</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Studio navigation')).toBeInTheDocument();
    expect(screen.getByText('Work order library')).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioGate } from '../StudioGate';

const studio = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('../../studio/client', () => ({ studioCall: studio.call }));

describe('StudioGate', () => {
  it('opens the database and reports a failure', async () => {
    const onReady = vi.fn();
    studio.call.mockResolvedValueOnce({ databasePath: 'C:\\Users\\Example\\all-con-studio.db' });
    const { unmount } = render(<StudioGate onReady={onReady} />);
    expect(screen.getByText('Opening the local database…')).toBeInTheDocument();
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    unmount();

    studio.call.mockRejectedValueOnce(new Error('disk full'));
    render(<StudioGate onReady={onReady} />);
    expect(await screen.findByText('disk full')).toBeInTheDocument();

    studio.call.mockRejectedValueOnce('offline');
    render(<StudioGate onReady={onReady} />);
    expect(await screen.findByText('Could not open the database.')).toBeInTheDocument();
  });
});

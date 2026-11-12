import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ studio: vi.fn() }));
vi.mock('../../shared/api/restApi', () => ({ getApi: () => api }));

import { studioCall } from '../client';

describe('studioCall', () => {
  it('returns data and surfaces a failed response', async () => {
    api.studio.mockResolvedValueOnce({ success: true, data: { id: 'wo' } });
    await expect(studioCall('getState')).resolves.toEqual({ id: 'wo' });

    api.studio.mockResolvedValueOnce({ success: false, message: 'Closed', key: 'error.closed' });
    await expect(studioCall('getState')).rejects.toThrow('Closed');

    api.studio.mockResolvedValueOnce({ success: false, key: 'error.closed' });
    await expect(studioCall('backup', { folder: '/tmp' })).rejects.toThrow('error.closed');

    api.studio.mockResolvedValueOnce({ success: false });
    await expect(studioCall('backup')).rejects.toThrow('Request failed');
  });
});

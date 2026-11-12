import type { StudioRequest } from '@invoice-builder/contracts';
import { getApi } from '../shared/api/restApi';

export const studioCall = async <T>(action: string, payload?: unknown): Promise<T> => {
  const response = await getApi().studio({ action, payload } satisfies StudioRequest);
  if (!response.success) {
    throw new Error(response.message || response.key || 'Request failed');
  }
  return response.data as T;
};

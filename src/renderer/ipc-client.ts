// Thin typed accessor over the preload-exposed bridge.
import type { AppApi } from '@shared/types';

export const api: AppApi = window.api;

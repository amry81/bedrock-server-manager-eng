import { create } from 'zustand';
import type {
  DownloadProgress,
  InstallState,
  LogLine,
  OnlinePlayer,
  PlayitStatus,
  ServerEvent,
  ServerStatus,
  SystemMetrics,
} from '@shared/types';
import { api } from '../ipc-client';

export type PageKey = 'dashboard' | 'world' | 'addon' | 'player' | 'config' | 'console';

const MAX_LOGS = 5000;
const MAX_METRICS = 300; // 5 minutes at 1s interval

interface ServerState {
  status: ServerStatus;
  activePage: PageKey;
  logs: LogLine[];
  exePath: string | null;
  onlinePlayers: OnlinePlayer[];

  installState: InstallState | null;
  downloadProgress: DownloadProgress | null;
  downloading: boolean;

  metrics: SystemMetrics[];
  lanAddress: string | null;
  playit: PlayitStatus | null;

  setActivePage: (p: PageKey) => void;
  clearLogs: () => void;
  refreshExePath: () => Promise<void>;
  selectExe: () => Promise<void>;

  enablePlayit: () => Promise<void>;
  disablePlayit: () => Promise<void>;
  setPlayitSecret: (secret: string) => Promise<void>;
  setPlayitAddress: (address: string) => Promise<void>;

  refreshInstallState: () => Promise<void>;
  acceptEula: () => Promise<void>;
  startDownload: () => Promise<void>;

  /** Subscribe to main-process push channels. Returns an unsubscribe fn. */
  init: () => () => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  status: 'stopped',
  activePage: 'dashboard',
  logs: [],
  exePath: null,
  onlinePlayers: [],

  installState: null,
  downloadProgress: null,
  downloading: false,

  metrics: [],
  lanAddress: null,
  playit: null,

  setActivePage: (activePage) => set({ activePage }),
  clearLogs: () => set({ logs: [] }),

  enablePlayit: async () => {
    const playit = await api.enablePlayit();
    set({ playit });
  },
  disablePlayit: async () => {
    const playit = await api.disablePlayit();
    set({ playit });
  },
  setPlayitSecret: async (secret) => {
    const playit = await api.setPlayitSecret(secret);
    set({ playit });
  },
  setPlayitAddress: async (address) => {
    const playit = await api.setPlayitAddress(address);
    set({ playit });
  },

  refreshExePath: async () => {
    const exePath = await api.getExePath();
    set({ exePath });
  },

  selectExe: async () => {
    const exePath = await api.selectExe();
    set({ exePath });
  },

  refreshInstallState: async () => {
    const installState = await api.getInstallState();
    set({ installState });
  },

  acceptEula: async () => {
    await api.acceptEula();
    await get().refreshInstallState();
  },

  startDownload: async () => {
    if (get().downloading) return;
    set({ downloading: true, downloadProgress: { phase: 'resolving' } });
    const result = await api.downloadServer();
    set({ downloading: false });
    if (result.ok) {
      await get().refreshInstallState();
      await get().refreshExePath();
    }
  },

  init: () => {
    // Seed current state.
    api.getStatus().then((status) => set({ status }));
    get().refreshExePath();
    get().refreshInstallState();
    api.getLanAddress().then((lanAddress) => set({ lanAddress }));
    api.getPlayitStatus().then((playit) => set({ playit }));

    const offProgress = api.onDownloadProgress((downloadProgress: DownloadProgress) => {
      set({ downloadProgress });
    });

    const offPlayit = api.onPlayitStatus((playit: PlayitStatus) => {
      set({ playit });
    });

    const offMetrics = api.onMetrics((m: SystemMetrics) => {
      set((s) => {
        const metrics = s.metrics.length >= MAX_METRICS ? s.metrics.slice(-MAX_METRICS + 1) : s.metrics;
        return { metrics: [...metrics, m] };
      });
    });

    const offLog = api.onLog((line: LogLine) => {
      set((s) => {
        const logs = s.logs.length >= MAX_LOGS ? s.logs.slice(-MAX_LOGS + 1) : s.logs;
        return { logs: [...logs, line] };
      });
    });

    const offStatus = api.onStatus((status: ServerStatus) => {
      set({ status });
      // Clear the online roster and metrics whenever the server is no longer running.
      if (status === 'stopped' || status === 'error') set({ onlinePlayers: [], metrics: [] });
    });

    const offEvent = api.onEvent((event: ServerEvent) => {
      if (event.type === 'player-join' && event.player) {
        set((s) =>
          s.onlinePlayers.some((p) => p.name === event.player)
            ? s
            : { onlinePlayers: [...s.onlinePlayers, { name: event.player!, xuid: event.xuid }] },
        );
      } else if (event.type === 'player-leave' && event.player) {
        set((s) => ({ onlinePlayers: s.onlinePlayers.filter((p) => p.name !== event.player) }));
      }
    });

    return () => {
      offProgress();
      offPlayit();
      offMetrics();
      offLog();
      offStatus();
      offEvent();
    };
  },
}));

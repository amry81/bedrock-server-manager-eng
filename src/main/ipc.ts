import { ipcMain, dialog, shell, BrowserWindow, WebContentsView } from 'electron';
import type {
  AddonActionResult,
  AddonImportResult,
  AddonPack,
  AddonType,
  AllowlistEntry,
  BackupInfo,
  BackupResult,
  BackupSettings,
  BiomeFinderBounds,
  ConfigSetPayload,
  ConfigSetResult,
  CreateWorldInput,
  DownloadProgress,
  DownloadResult,
  InstallState,
  KnownPlayer,
  LogLine,
  PermissionEntry,
  PlayerActionResult,
  PlayitStatus,
  ScheduleEntry,
  ServerEvent,
  ServerPropertiesData,
  ServerStatus,
  StartResult,
  SystemMetrics,
  WorldActionResult,
  WorldImportResult,
  WorldInfo,
  WorldPacks,
} from '../shared/types';
import { serverManager } from './server-manager';
import { readSettings, writeSettings } from './settings';
import { downloadServer, getInstallState } from './downloader';
import { readConfig, writeConfig } from './config-manager';
import { createWorld, importWorld, listWorlds, switchWorld, worldFolderPath } from './world-manager';
import {
  createBackup,
  deleteBackup,
  getBackupSettings,
  listBackups,
  restoreBackup,
  setBackupSettings,
} from './backup-manager';
import { backupsDir } from './paths';
import { getSchedule, setSchedule, startScheduler } from './scheduler';
import {
  deleteAddon,
  getWorldPacks,
  importAddons,
  listAddons,
  setWorldPacks,
} from './addon-manager';
import {
  getAllowlist,
  getKnownPlayers,
  getPermissions,
  recordKnownPlayer,
  setAllowlist,
  setPermissions,
} from './player-manager';
import { getLanAddress, startMetricsSampler } from './metrics';
import { playitManager } from './playit-manager';

let biomeFinderView: WebContentsView | null = null;
let biomeFinderWindow: BrowserWindow | null = null;

function validBiomeFinderBounds(
  bounds: BiomeFinderBounds,
  win: BrowserWindow,
): BiomeFinderBounds | null {
  if (
    !bounds ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null;
  }

  const [contentWidth, contentHeight] = win.getContentSize();
  const x = Math.max(0, Math.round(bounds.x));
  const y = Math.max(0, Math.round(bounds.y));
  const width = Math.min(Math.round(bounds.width), contentWidth - x);
  const height = Math.min(Math.round(bounds.height), contentHeight - y);
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

function createBiomeFinderUrl(seed: string): string {
  const url = new URL('https://www.chunkbase.com/apps/biome-finder');
  url.hash = new URLSearchParams({
    seed,
    platform: 'bedrock_26_3',
    dimension: 'overworld',
    x: '0',
    z: '0',
    zoom: '0.5',
  }).toString();
  return url.toString();
}

/** Wire IPC handlers and forward server-manager events to the renderer. */
export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // Push server-manager events to the renderer.
  serverManager.on('log', (line: LogLine) => {
    getWindow()?.webContents.send('server:log', line);
  });
  let prevStatus: ServerStatus = serverManager.getStatus();
  serverManager.on('status', (status: ServerStatus) => {
    getWindow()?.webContents.send('server:status', status);
    // Auto-backup the active world when the server transitions running -> stopped.
    if (prevStatus === 'running' && status === 'stopped' && getBackupSettings().autoBackupOnStop) {
      const activeWorld = readConfig().values['level-name'];
      if (activeWorld) {
        const res = createBackup(activeWorld);
        getWindow()?.webContents.send(
          'server:log',
          {
            id: -Date.now(),
            ts: Date.now(),
            level: res.ok ? 'INFO' : 'ERROR',
            source: 'system',
            text: res.ok
              ? `Automatic backup created: ${res.id}`
              : `Automatic backup failed: ${res.error}`,
          } satisfies LogLine,
        );
      }
    }
    prevStatus = status;
  });
  serverManager.on('event', (event: ServerEvent) => {
    if (event.type === 'player-join' && event.player) {
      recordKnownPlayer(event.player, event.xuid);
    }
    getWindow()?.webContents.send('server:event', event);
  });

  // Server control
  ipcMain.handle('server:start', (): StartResult => serverManager.start());
  ipcMain.handle('server:stop', (): StartResult => serverManager.stop());
  ipcMain.handle('server:restart', (): StartResult => serverManager.restart());
  ipcMain.handle('server:status', (): ServerStatus => serverManager.getStatus());
  ipcMain.handle('server:command', (_e, command: string): StartResult =>
    serverManager.sendCommand(command),
  );

  // Exe location (P1: manual selection until auto-DL lands in P2)
  ipcMain.handle('server:getExePath', (): string | null => {
    return serverManager.resolveExePath();
  });

  ipcMain.handle('server:selectExe', async (): Promise<string | null> => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select bedrock_server.exe',
      properties: ['openFile'],
      filters: [{ name: 'Bedrock Server', extensions: ['exe'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return serverManager.resolveExePath();
    }
    const chosen = result.filePaths[0];
    writeSettings({ bedrockExePath: chosen });
    return chosen;
  });

  // Setup / auto-download (P2)
  ipcMain.handle('setup:getInstallState', (): Promise<InstallState> => getInstallState());

  ipcMain.handle('setup:download', (): Promise<DownloadResult> => {
    return downloadServer((p: DownloadProgress) => {
      getWindow()?.webContents.send('setup:progress', p);
    });
  });

  ipcMain.handle('setup:acceptEula', (): void => {
    writeSettings({ eulaAcceptedAt: new Date().toISOString() });
  });

  // server.properties (P3)
  ipcMain.handle('config:get', (): ServerPropertiesData => readConfig());
  ipcMain.handle('config:set', (_e, payload: ConfigSetPayload): ConfigSetResult =>
    writeConfig(payload),
  );

  // worlds (P4)
  ipcMain.handle('world:list', (): WorldInfo[] => listWorlds());
  ipcMain.handle('world:create', (_e, input: CreateWorldInput): WorldActionResult =>
    createWorld(input),
  );
  ipcMain.handle('world:switch', (_e, name: string): WorldActionResult => switchWorld(name));
  ipcMain.handle('world:openFolder', async (_e, name: string): Promise<void> => {
    await shell.openPath(worldFolderPath(name));
  });
  ipcMain.handle('world:import', async (): Promise<WorldImportResult> => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import .mcworld',
      properties: ['openFile'],
      filters: [
        { name: 'Bedrock World Export', extensions: ['mcworld', 'mctemplate', 'zip'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, cancelled: true };
    }
    return importWorld(result.filePaths[0]);
  });

  // backups (v2)
  ipcMain.handle('backup:list', (): BackupInfo[] => listBackups());
  ipcMain.handle('backup:create', (_e, world: string): BackupResult => createBackup(world));
  ipcMain.handle('backup:restore', (_e, id: string): BackupResult => {
    if (serverManager.getStatus() !== 'stopped' && serverManager.getStatus() !== 'error') {
      return { ok: false, error: 'Stop the server before restoring a backup.' };
    }
    return restoreBackup(id);
  });
  ipcMain.handle('backup:delete', (_e, id: string): BackupResult => deleteBackup(id));
  ipcMain.handle('backup:openFolder', async (): Promise<void> => {
    await shell.openPath(backupsDir());
  });
  ipcMain.handle('backup:getSettings', (): BackupSettings => getBackupSettings());
  ipcMain.handle('backup:setSettings', (_e, s: BackupSettings): BackupSettings =>
    setBackupSettings(s),
  );

  // schedule (v2)
  ipcMain.handle('schedule:get', (): ScheduleEntry[] => getSchedule());
  ipcMain.handle('schedule:set', (_e, entries: ScheduleEntry[]): ScheduleEntry[] =>
    setSchedule(entries),
  );

  // Kick off the scheduler. Fired actions log into the renderer console.
  startScheduler((line: LogLine) => {
    getWindow()?.webContents.send('server:log', line);
  });

  // addons (v2)
  ipcMain.handle('addon:list', (): AddonPack[] => listAddons());
  ipcMain.handle('addon:import', async (): Promise<AddonImportResult> => {
    const win = getWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import Add-ons',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Minecraft Addon', extensions: ['mcpack', 'mcaddon', 'zip'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, cancelled: true };
    }
    return importAddons(result.filePaths);
  });
  ipcMain.handle('addon:delete', (_e, type: AddonType, folder: string): AddonActionResult =>
    deleteAddon(type, folder),
  );
  ipcMain.handle('addon:getWorldPacks', (_e, world: string): WorldPacks => getWorldPacks(world));
  ipcMain.handle(
    'addon:setWorldPacks',
    (_e, world: string, packs: WorldPacks): AddonActionResult => setWorldPacks(world, packs),
  );

  // players (P5)
  ipcMain.handle('allowlist:get', (): AllowlistEntry[] => getAllowlist());
  ipcMain.handle('allowlist:set', (_e, entries: AllowlistEntry[]): PlayerActionResult => {
    const res = setAllowlist(entries);
    // Apply live without restart when the server is running.
    if (res.ok && serverManager.getStatus() === 'running') {
      serverManager.sendCommand('allowlist reload');
    }
    return res;
  });
  ipcMain.handle('permission:get', (): PermissionEntry[] => getPermissions());
  ipcMain.handle('permission:set', (_e, entries: PermissionEntry[]): PlayerActionResult => {
    const res = setPermissions(entries);
    if (res.ok && serverManager.getStatus() === 'running') {
      serverManager.sendCommand('permission reload');
    }
    return res;
  });
  ipcMain.handle('player:known', (): KnownPlayer[] => getKnownPlayers());

  // metrics / network (P6)
  ipcMain.handle('system:lanAddress', (): string | null => getLanAddress());
  startMetricsSampler((m: SystemMetrics) => {
    getWindow()?.webContents.send('system:metrics', m);
  });

  // tunneling (P7)
  playitManager.on('status', (s: PlayitStatus) => {
    getWindow()?.webContents.send('playit:status', s);
  });
  ipcMain.handle('playit:enable', (): Promise<PlayitStatus> => playitManager.enable());
  ipcMain.handle('playit:disable', (): PlayitStatus => playitManager.disable());
  ipcMain.handle('playit:status', (): PlayitStatus => playitManager.getStatus());
  ipcMain.handle('playit:setSecret', (_e, secret: string): PlayitStatus =>
    playitManager.setSecret(secret),
  );
  ipcMain.handle('playit:setAddress', (_e, address: string): PlayitStatus =>
    playitManager.setAddress(address),
  );

  // misc
  ipcMain.handle('app:openExternal', async (_e, url: string): Promise<void> => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url);
  });

  ipcMain.handle(
    'biome-finder:show',
    async (_e, seed: string, bounds: BiomeFinderBounds): Promise<void> => {
      const win = getWindow();
      if (!win) throw new Error('The application window is not available.');
      if (typeof seed !== 'string' || !seed.trim() || seed.length > 256) {
        throw new Error('Enter a valid world seed before opening the biome map.');
      }
      const viewBounds = validBiomeFinderBounds(bounds, win);
      if (!viewBounds) throw new Error('The biome map area has invalid dimensions.');

      if (!biomeFinderView) {
        biomeFinderView = new WebContentsView({
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });
        biomeFinderView.webContents.setWindowOpenHandler(({ url }) => {
          if (/^https?:\/\//i.test(url)) {
            void shell.openExternal(url).catch((err: unknown) => console.error(err));
          }
          return { action: 'deny' };
        });
        biomeFinderView.webContents.on('will-navigate', (event, target) => {
          const targetUrl = new URL(target);
          if (
            targetUrl.protocol === 'https:' &&
            ['chunkbase.com', 'www.chunkbase.com'].includes(targetUrl.hostname)
          ) {
            return;
          }
          event.preventDefault();
          if (/^https?:\/\//i.test(target)) {
            void shell.openExternal(target).catch((err: unknown) => console.error(err));
          }
        });
      }
      if (biomeFinderWindow !== win) {
        win.contentView.addChildView(biomeFinderView);
        biomeFinderWindow = win;
        win.once('closed', () => {
          biomeFinderView = null;
          biomeFinderWindow = null;
        });
      }

      biomeFinderView.setVisible(true);
      biomeFinderView.setBounds(viewBounds);
      const url = createBiomeFinderUrl(seed.trim());
      if (biomeFinderView.webContents.getURL() !== url) {
        await biomeFinderView.webContents.loadURL(url);
      }
    },
  );
  ipcMain.handle('biome-finder:setBounds', (_e, bounds: BiomeFinderBounds): void => {
    const win = getWindow();
    if (!win || !biomeFinderView) return;
    const viewBounds = validBiomeFinderBounds(bounds, win);
    if (viewBounds) biomeFinderView.setBounds(viewBounds);
  });
  ipcMain.handle('biome-finder:hide', (): void => {
    biomeFinderView?.setVisible(false);
  });

  // Touch settings so the file exists from first launch.
  readSettings();
}

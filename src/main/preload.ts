import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  AppApi,
  DownloadProgress,
  LogLine,
  PlayitStatus,
  ServerEvent,
  ServerStatus,
  SystemMetrics,
} from '../shared/types';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: AppApi = {
  start: () => ipcRenderer.invoke('server:start'),
  stop: () => ipcRenderer.invoke('server:stop'),
  restart: () => ipcRenderer.invoke('server:restart'),
  getStatus: () => ipcRenderer.invoke('server:status'),
  sendCommand: (command) => ipcRenderer.invoke('server:command', command),

  selectExe: () => ipcRenderer.invoke('server:selectExe'),
  getExePath: () => ipcRenderer.invoke('server:getExePath'),

  getInstallState: () => ipcRenderer.invoke('setup:getInstallState'),
  downloadServer: () => ipcRenderer.invoke('setup:download'),
  acceptEula: () => ipcRenderer.invoke('setup:acceptEula'),
  onDownloadProgress: (cb) => subscribe<DownloadProgress>('setup:progress', cb),

  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (payload) => ipcRenderer.invoke('config:set', payload),

  listWorlds: () => ipcRenderer.invoke('world:list'),
  createWorld: (input) => ipcRenderer.invoke('world:create', input),
  switchWorld: (name) => ipcRenderer.invoke('world:switch', name),
  openWorldFolder: (name) => ipcRenderer.invoke('world:openFolder', name),
  importWorld: () => ipcRenderer.invoke('world:import'),

  listBackups: () => ipcRenderer.invoke('backup:list'),
  createBackup: (world) => ipcRenderer.invoke('backup:create', world),
  restoreBackup: (id) => ipcRenderer.invoke('backup:restore', id),
  deleteBackup: (id) => ipcRenderer.invoke('backup:delete', id),
  openBackupsFolder: () => ipcRenderer.invoke('backup:openFolder'),
  getBackupSettings: () => ipcRenderer.invoke('backup:getSettings'),
  setBackupSettings: (s) => ipcRenderer.invoke('backup:setSettings', s),

  getSchedule: () => ipcRenderer.invoke('schedule:get'),
  setSchedule: (entries) => ipcRenderer.invoke('schedule:set', entries),

  listAddons: () => ipcRenderer.invoke('addon:list'),
  importAddons: () => ipcRenderer.invoke('addon:import'),
  deleteAddon: (type, folder) => ipcRenderer.invoke('addon:delete', type, folder),
  getWorldPacks: (world) => ipcRenderer.invoke('addon:getWorldPacks', world),
  setWorldPacks: (world, packs) => ipcRenderer.invoke('addon:setWorldPacks', world, packs),

  getAllowlist: () => ipcRenderer.invoke('allowlist:get'),
  setAllowlist: (entries) => ipcRenderer.invoke('allowlist:set', entries),
  getPermissions: () => ipcRenderer.invoke('permission:get'),
  setPermissions: (entries) => ipcRenderer.invoke('permission:set', entries),
  getKnownPlayers: () => ipcRenderer.invoke('player:known'),

  onMetrics: (cb) => subscribe<SystemMetrics>('system:metrics', cb),
  getLanAddress: () => ipcRenderer.invoke('system:lanAddress'),

  enablePlayit: () => ipcRenderer.invoke('playit:enable'),
  disablePlayit: () => ipcRenderer.invoke('playit:disable'),
  getPlayitStatus: () => ipcRenderer.invoke('playit:status'),
  setPlayitSecret: (secret) => ipcRenderer.invoke('playit:setSecret', secret),
  setPlayitAddress: (address) => ipcRenderer.invoke('playit:setAddress', address),
  onPlayitStatus: (cb) => subscribe<PlayitStatus>('playit:status', cb),

  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),

  onLog: (cb) => subscribe<LogLine>('server:log', cb),
  onStatus: (cb) => subscribe<ServerStatus>('server:status', cb),
  onEvent: (cb) => subscribe<ServerEvent>('server:event', cb),
};

contextBridge.exposeInMainWorld('api', api);

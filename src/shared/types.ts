export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'RAW';
export type LogSource = 'stdout' | 'stderr' | 'system';

export interface LogLine {
  id: number;
  ts: number;
  level: LogLevel;
  source: LogSource;
  text: string;
}

export type ServerEventType = 'player-join' | 'player-leave' | 'server-ready';

export interface ServerEvent {
  type: ServerEventType;
  ts: number;
  player?: string;
  xuid?: string;
}

export interface OnlinePlayer {
  name: string;
  xuid?: string;
}

export type PermissionLevel = 'visitor' | 'member' | 'operator';

export interface AllowlistEntry {
  ignoresPlayerLimit: boolean;
  name: string;
  xuid?: string;
}

export interface PermissionEntry {
  permission: PermissionLevel;
  xuid: string;
}

export interface KnownPlayer {
  name: string;
  xuid: string;
}

export interface PlayerActionResult {
  ok: boolean;
  error?: string;
}

export interface SystemMetrics {
  ts: number;
  /** CPU usage percent (may exceed 100 on multi-core). */
  cpu: number;
  /** Resident memory in MB. */
  memoryMB: number;
  /** Seconds since the server reached running state. */
  uptimeSec: number;
}

export type PlayitState =
  | 'disabled'
  | 'installing'
  | 'needs-secret'
  | 'starting'
  | 'connected'
  | 'error';

export interface PlayitStatus {
  state: PlayitState;
  /** True if playit.exe is present locally. */
  installed: boolean;
  /** True if a playit secret key has been saved. */
  hasSecret: boolean;
  /** Public tunnel address (host:port) — detected from logs or user-provided. */
  tunnelAddress?: string;
  message?: string;
}

export interface StartResult {
  ok: boolean;
  error?: string;
}

export interface InstallState {
  /** A managed server install exists at the canonical data-folder location. */
  installed: boolean;
  /** Version recorded for the managed install (if any). */
  currentVersion: string | null;
  /** Latest stable version from the BDS-Versions list (null if lookup failed). */
  latestVersion: string | null;
  /** True if an update is available (latest > current). */
  updateAvailable: boolean;
  /** Microsoft EULA acceptance has been recorded. */
  eulaAccepted: boolean;
}

export type DownloadPhase = 'resolving' | 'downloading' | 'extracting' | 'done' | 'error';

export interface DownloadProgress {
  phase: DownloadPhase;
  /** 0-100 for the downloading phase; undefined for indeterminate phases. */
  percent?: number;
  receivedBytes?: number;
  totalBytes?: number;
  version?: string;
  message?: string;
  error?: string;
}

export interface DownloadResult {
  ok: boolean;
  version?: string;
  error?: string;
}

export interface ServerPropertiesData {
  /** Full raw text of server.properties (for the advanced editor). */
  raw: string;
  /** Parsed key -> value map (comments/blank lines excluded). */
  values: Record<string, string>;
}

export interface ConfigSetPayload {
  /** Merge these key/values into the file, preserving comments and order. */
  values?: Record<string, string>;
  /** Replace the entire file with this raw text (advanced editor). */
  raw?: string;
}

export interface ConfigSetResult {
  ok: boolean;
  error?: string;
}

export interface WorldInfo {
  /** Folder name = the server.properties level-name selector. */
  name: string;
  /** Display name from levelname.txt (falls back to folder name). */
  displayName: string;
  /** True if this world is the active level-name. */
  active: boolean;
  /** True if BDS has generated level data (level.dat/db present). */
  generated: boolean;
}

export interface CreateWorldInput {
  name: string;
  seed?: string;
  gamemode: string;
  difficulty: string;
}

export interface WorldActionResult {
  ok: boolean;
  error?: string;
}

export interface WorldImportResult {
  ok: boolean;
  error?: string;
  /** Folder name of the newly imported world (if ok). */
  worldName?: string;
  /** True if the user cancelled the file dialog. */
  cancelled?: boolean;
}

export interface BackupInfo {
  /** Stable id: "<worldFolder>/<filename>.zip". */
  id: string;
  world: string;
  ts: number;
  sizeBytes: number;
}

export interface BackupResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export interface BackupSettings {
  autoBackupOnStop: boolean;
  maxBackupsPerWorld: number;
}

export type AddonType = 'behavior' | 'resource';

export interface AddonPack {
  type: AddonType;
  /** Folder name under behavior_packs/ or resource_packs/. */
  folder: string;
  uuid: string;
  version: number[];
  name: string;
  description?: string;
}

export interface WorldPackEntry {
  pack_id: string;
  version: number[];
}

export interface WorldPacks {
  behavior: WorldPackEntry[];
  resource: WorldPackEntry[];
}

export interface AddonImportResult {
  ok: boolean;
  error?: string;
  cancelled?: boolean;
  imported?: { type: AddonType; name: string }[];
}

export interface AddonActionResult {
  ok: boolean;
  error?: string;
}

export type ScheduleAction = 'start' | 'stop' | 'restart';

export interface ScheduleEntry {
  id: string;
  enabled: boolean;
  action: ScheduleAction;
  /** Local time "HH:MM" (24h). */
  time: string;
  /** Days of week: 0=Sun, 1=Mon, ..., 6=Sat. Empty = never. */
  daysOfWeek: number[];
}

export interface AppApi {
  // server control
  start: () => Promise<StartResult>;
  stop: () => Promise<StartResult>;
  restart: () => Promise<StartResult>;
  getStatus: () => Promise<ServerStatus>;
  sendCommand: (command: string) => Promise<StartResult>;

  // exe location
  selectExe: () => Promise<string | null>;
  getExePath: () => Promise<string | null>;

  // setup / auto-download
  getInstallState: () => Promise<InstallState>;
  downloadServer: () => Promise<DownloadResult>;
  acceptEula: () => Promise<void>;
  onDownloadProgress: (cb: (p: DownloadProgress) => void) => () => void;

  // server.properties
  getConfig: () => Promise<ServerPropertiesData>;
  setConfig: (payload: ConfigSetPayload) => Promise<ConfigSetResult>;

  // worlds
  listWorlds: () => Promise<WorldInfo[]>;
  createWorld: (input: CreateWorldInput) => Promise<WorldActionResult>;
  switchWorld: (name: string) => Promise<WorldActionResult>;
  openWorldFolder: (name: string) => Promise<void>;
  importWorld: () => Promise<WorldImportResult>;

  // backups (v2)
  listBackups: () => Promise<BackupInfo[]>;
  createBackup: (world: string) => Promise<BackupResult>;
  restoreBackup: (id: string) => Promise<BackupResult>;
  deleteBackup: (id: string) => Promise<BackupResult>;
  openBackupsFolder: () => Promise<void>;
  getBackupSettings: () => Promise<BackupSettings>;
  setBackupSettings: (s: BackupSettings) => Promise<BackupSettings>;

  // schedule (v2)
  getSchedule: () => Promise<ScheduleEntry[]>;
  setSchedule: (entries: ScheduleEntry[]) => Promise<ScheduleEntry[]>;

  // addons (v2)
  listAddons: () => Promise<AddonPack[]>;
  importAddons: () => Promise<AddonImportResult>;
  deleteAddon: (type: AddonType, folder: string) => Promise<AddonActionResult>;
  getWorldPacks: (world: string) => Promise<WorldPacks>;
  setWorldPacks: (world: string, packs: WorldPacks) => Promise<AddonActionResult>;

  // players
  getAllowlist: () => Promise<AllowlistEntry[]>;
  setAllowlist: (entries: AllowlistEntry[]) => Promise<PlayerActionResult>;
  getPermissions: () => Promise<PermissionEntry[]>;
  setPermissions: (entries: PermissionEntry[]) => Promise<PlayerActionResult>;
  getKnownPlayers: () => Promise<KnownPlayer[]>;

  // metrics / network
  onMetrics: (cb: (m: SystemMetrics) => void) => () => void;
  getLanAddress: () => Promise<string | null>;

  // tunneling (playit.gg)
  enablePlayit: () => Promise<PlayitStatus>;
  disablePlayit: () => Promise<PlayitStatus>;
  getPlayitStatus: () => Promise<PlayitStatus>;
  setPlayitSecret: (secret: string) => Promise<PlayitStatus>;
  setPlayitAddress: (address: string) => Promise<PlayitStatus>;
  onPlayitStatus: (cb: (s: PlayitStatus) => void) => () => void;

  // misc
  openExternal: (url: string) => Promise<void>;

  // push subscriptions (return an unsubscribe fn)
  onLog: (cb: (line: LogLine) => void) => () => void;
  onStatus: (cb: (status: ServerStatus) => void) => () => void;
  onEvent: (cb: (event: ServerEvent) => void) => () => void;
}

declare global {
  interface Window {
    api: AppApi;
  }
}

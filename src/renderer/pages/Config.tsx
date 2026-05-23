import { useEffect, useState } from 'react';
import { useServerStore } from '../store/server-store';
import { api } from '../ipc-client';
import type { PlayitState, ScheduleAction, ScheduleEntry } from '@shared/types';

type FieldType = 'text' | 'number' | 'select' | 'toggle';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
}

// Spec 3.5 main fields. Note: BDS 1.26 uses `allow-list` (formerly white-list).
const FIELDS: FieldDef[] = [
  { key: 'server-name', label: 'サーバー名', type: 'text', placeholder: 'Dedicated Server' },
  {
    key: 'gamemode',
    label: 'ゲームモード',
    type: 'select',
    options: [
      { value: 'survival', label: 'サバイバル' },
      { value: 'creative', label: 'クリエイティブ' },
      { value: 'adventure', label: 'アドベンチャー' },
    ],
  },
  {
    key: 'difficulty',
    label: '難易度',
    type: 'select',
    options: [
      { value: 'peaceful', label: 'ピースフル' },
      { value: 'easy', label: 'イージー' },
      { value: 'normal', label: 'ノーマル' },
      { value: 'hard', label: 'ハード' },
    ],
  },
  { key: 'max-players', label: '最大プレイヤー数', type: 'number', min: 1, max: 30 },
  { key: 'server-port', label: 'ポート (IPv4)', type: 'number', min: 1, max: 65535 },
  { key: 'server-portv6', label: 'ポート (IPv6)', type: 'number', min: 1, max: 65535 },
  { key: 'view-distance', label: '描画距離 (チャンク)', type: 'number', min: 3, max: 64 },
  { key: 'tick-distance', label: 'tick 距離', type: 'number', min: 4, max: 12 },
  { key: 'allow-cheats', label: 'チート許可', type: 'toggle' },
  { key: 'online-mode', label: 'オンライン認証', type: 'toggle' },
  { key: 'allow-list', label: 'ホワイトリスト (allow-list)', type: 'toggle' },
  {
    key: 'default-player-permission-level',
    label: 'デフォルト権限',
    type: 'select',
    options: [
      { value: 'visitor', label: 'visitor' },
      { value: 'member', label: 'member' },
      { value: 'operator', label: 'operator' },
    ],
  },
];

export default function Config() {
  const installState = useServerStore((s) => s.installState);
  const downloading = useServerStore((s) => s.downloading);
  const progress = useServerStore((s) => s.downloadProgress);
  const startDownload = useServerStore((s) => s.startDownload);
  const status = useServerStore((s) => s.status);

  const [values, setValues] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const canUpdate = status === 'stopped' || status === 'error';
  const serverRunning = status === 'running' || status === 'starting';

  const load = async () => {
    const cfg = await api.getConfig();
    setValues(cfg.values);
    setRaw(cfg.raw);
    setLoaded(true);
  };

  useEffect(() => {
    load();
  }, []);

  const setField = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const saveForm = async () => {
    setSaveMsg(null);
    const subset: Record<string, string> = {};
    for (const f of FIELDS) {
      if (values[f.key] !== undefined) subset[f.key] = values[f.key];
    }
    const res = await api.setConfig({ values: subset });
    if (res.ok) {
      setSaveMsg('保存しました');
      await load();
    } else {
      setSaveMsg(`保存失敗: ${res.error}`);
    }
  };

  const saveRaw = async () => {
    setSaveMsg(null);
    const res = await api.setConfig({ raw });
    if (res.ok) {
      setSaveMsg('raw を保存しました');
      await load();
    } else {
      setSaveMsg(`保存失敗: ${res.error}`);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Config</h2>
        <p className="text-neutral-400">server.properties の編集とサーバー本体の管理。</p>
      </div>

      {/* server.properties form (P3) */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-200">server.properties</h3>
          {saveMsg && <span className="text-xs text-emerald-400">{saveMsg}</span>}
        </div>

        {serverRunning && (
          <p className="mt-2 text-xs text-yellow-400">
            サーバー稼働中です。変更は次回起動時に反映されます。
          </p>
        )}

        {!installState?.installed ? (
          <p className="mt-3 text-sm text-neutral-500">
            サーバー本体が未インストールです。先にダウンロードしてください。
          </p>
        ) : !loaded ? (
          <p className="mt-3 text-sm text-neutral-500">読み込み中...</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400">{f.label}</label>
                  {f.type === 'text' && (
                    <input
                      type="text"
                      value={values[f.key] ?? ''}
                      placeholder={f.placeholder}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
                    />
                  )}
                  {f.type === 'number' && (
                    <input
                      type="number"
                      min={f.min}
                      max={f.max}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
                    />
                  )}
                  {f.type === 'select' && (
                    <select
                      value={values[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="rounded bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
                    >
                      {f.options!.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {f.type === 'toggle' && (
                    <label className="flex items-center gap-2 py-1.5 text-sm text-neutral-300">
                      <input
                        type="checkbox"
                        checked={values[f.key] === 'true'}
                        onChange={(e) => setField(f.key, e.target.checked ? 'true' : 'false')}
                      />
                      {values[f.key] === 'true' ? '有効' : '無効'}
                    </label>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={saveForm}
              className="mt-5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              保存
            </button>

            {/* Advanced raw editor */}
            <div className="mt-6 border-t border-neutral-800 pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((s) => !s)}
                className="text-sm text-neutral-300 hover:text-white"
              >
                {showAdvanced ? '▼' : '▶'} 詳細設定（raw テキスト編集）
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    spellCheck={false}
                    className="h-72 w-full resize-y rounded bg-neutral-950 p-3 font-mono text-xs text-neutral-200 outline-none focus:ring-1 focus:ring-neutral-600"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={saveRaw}
                      className="rounded-md bg-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-600"
                    >
                      raw を保存
                    </button>
                    <span className="text-xs text-neutral-500">
                      ※ raw 保存はファイル全体を上書きします。フォームの値より優先されます。
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Schedule (v2) */}
      <ScheduleSection />

      {/* Tunneling (P7) */}
      <TunnelingSection />

      {/* Server binary version / update (P2) */}
      <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold text-neutral-200">サーバー本体</h3>
        <div className="mt-3 space-y-1 text-sm text-neutral-400">
          <p>
            インストール済み:{' '}
            <span className="text-neutral-200">
              {installState?.installed ? (installState.currentVersion ?? '不明') : '未インストール'}
            </span>
          </p>
          <p>
            最新安定版:{' '}
            <span className="text-neutral-200">{installState?.latestVersion ?? '取得不可'}</span>
          </p>
          {installState?.updateAvailable && (
            <p className="text-yellow-400">アップデートが利用可能です。</p>
          )}
        </div>

        {progress && downloading && (
          <p className="mt-3 text-xs text-neutral-500">
            {progress.phase === 'downloading'
              ? `ダウンロード中 ${progress.percent ?? 0}%`
              : progress.phase}
          </p>
        )}

        <button
          type="button"
          disabled={downloading || !canUpdate}
          onClick={startDownload}
          title={!canUpdate ? 'サーバー停止中のみ実行できます' : undefined}
          className="mt-4 rounded-md bg-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading
            ? '処理中...'
            : installState?.installed
              ? 'アップデート / 再ダウンロード'
              : 'ダウンロード'}
        </button>
        <p className="mt-2 text-xs text-neutral-500">
          アップデート時もワールドデータ・設定ファイルは保持されます。
        </p>
      </section>
    </div>
  );
}

const PLAYIT_LABEL: Record<PlayitState, string> = {
  disabled: '無効',
  installing: 'playit.exe をDL中...',
  'needs-secret': 'シークレット未設定',
  starting: '起動中...',
  connected: '接続済み',
  error: 'エラー',
};

const PLAYIT_DOT: Record<PlayitState, string> = {
  disabled: 'bg-neutral-500',
  installing: 'bg-yellow-400 animate-pulse',
  'needs-secret': 'bg-blue-400',
  starting: 'bg-yellow-400 animate-pulse',
  connected: 'bg-emerald-500',
  error: 'bg-red-500',
};

function TunnelingSection() {
  const playit = useServerStore((s) => s.playit);
  const enablePlayit = useServerStore((s) => s.enablePlayit);
  const disablePlayit = useServerStore((s) => s.disablePlayit);
  const setPlayitSecret = useServerStore((s) => s.setPlayitSecret);
  const setPlayitAddress = useServerStore((s) => s.setPlayitAddress);
  const lanAddress = useServerStore((s) => s.lanAddress);

  const [secret, setSecret] = useState('');
  const [address, setAddress] = useState('');
  const [showSecretForm, setShowSecretForm] = useState(false);

  const state = playit?.state ?? 'disabled';
  const running = state === 'starting' || state === 'connected';
  const busy = state === 'installing' || state === 'starting';

  const toggle = () => {
    if (running) disablePlayit();
    else enablePlayit();
  };

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-200">外部接続（playit.gg）</h3>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={
            'rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ' +
            (running ? 'bg-red-600/80 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-500')
          }
        >
          {running ? '無効にする' : '外部接続を有効にする'}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className={'inline-block h-2 w-2 rounded-full ' + PLAYIT_DOT[state]} />
        <span className="text-neutral-300">{PLAYIT_LABEL[state]}</span>
        {playit?.message && <span className="text-xs text-neutral-500">— {playit.message}</span>}
      </div>

      {/* Setup guide */}
      <div className="mt-4 rounded bg-neutral-950/60 p-3 text-xs text-neutral-400 space-y-1">
        <p>
          1. {' '}
          <button
            type="button"
            onClick={() => api.openExternal('https://playit.gg')}
            className="text-emerald-400 underline"
          >
            playit.gg
          </button>{' '}
          でアカウント作成 → Agent を追加し、シークレットキーを取得
        </p>
        <p>2. Bedrock（UDP）トンネルを作成し、ローカル <code>127.0.0.1:19132</code> に向ける</p>
        <p>3. 下にシークレットキーと割り当てられた外部アドレスを設定</p>
      </div>

      {/* Secret config */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowSecretForm((v) => !v)}
          className="text-sm text-neutral-300 hover:text-white"
        >
          {showSecretForm ? '▼' : '▶'} シークレットキー設定{' '}
          {playit?.hasSecret && <span className="text-xs text-emerald-400">（設定済み）</span>}
        </button>
        {showSecretForm && (
          <div className="mt-2 space-y-3">
            <div className="flex gap-2">
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="playit シークレットキー"
                className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (secret.trim()) {
                    setPlayitSecret(secret.trim());
                    setSecret('');
                  }
                }}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
              >
                保存
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="外部アドレス (例: purple-foo.gl.at.ply.gg:23456)"
                className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
              />
              <button
                type="button"
                onClick={() => {
                  if (address.trim()) {
                    setPlayitAddress(address.trim());
                    setAddress('');
                  }
                }}
                className="rounded-md bg-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-600"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tunnel address */}
      {playit?.tunnelAddress && <TunnelAddressShare address={playit.tunnelAddress} />}

      {/* LAN address when off */}
      {!running && (
        <p className="mt-4 text-xs text-neutral-500">
          外部接続が無効の間は、同一LAN内から{' '}
          <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-emerald-300">
            {lanAddress ? `${lanAddress}:19132` : 'LAN アドレス取得不可'}
          </code>{' '}
          で接続できます。
        </p>
      )}
    </section>
  );
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const ACTION_LABEL: Record<ScheduleAction, string> = {
  start: '起動',
  stop: '停止',
  restart: '再起動',
};

function newScheduleId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'sch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function ScheduleSection() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getSchedule().then((e) => {
      setEntries(e);
      setLoaded(true);
    });
  }, []);

  const save = async (next: ScheduleEntry[]) => {
    setEntries(next);
    setEntries(await api.setSchedule(next));
  };

  const update = (id: string, patch: Partial<ScheduleEntry>) => {
    save(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const remove = (id: string) => {
    save(entries.filter((e) => e.id !== id));
  };

  const add = () => {
    save([
      ...entries,
      {
        id: newScheduleId(),
        enabled: true,
        action: 'start',
        time: '20:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
    ]);
  };

  const toggleDay = (entry: ScheduleEntry, day: number) => {
    const set = new Set(entry.daysOfWeek);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    update(entry.id, { daysOfWeek: [...set].sort() });
  };

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-200">スケジュール起動/停止</h3>
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
        >
          ＋ 追加
        </button>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        指定した曜日・時刻にサーバーを自動で起動/停止します（PC が起動中・本アプリが立ち上がっている間に限ります）。
      </p>

      {loaded && entries.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">スケジュールはありません。「＋追加」から作成してください。</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded border border-neutral-800 bg-neutral-950/40 p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={e.enabled}
                    onChange={(ev) => update(e.id, { enabled: ev.target.checked })}
                  />
                  有効
                </label>
                <select
                  value={e.action}
                  onChange={(ev) => update(e.id, { action: ev.target.value as ScheduleAction })}
                  className="rounded bg-neutral-800 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
                >
                  {(['start', 'stop', 'restart'] as ScheduleAction[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABEL[a]}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={e.time}
                  onChange={(ev) => update(e.id, { time: ev.target.value })}
                  className="rounded bg-neutral-800 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-neutral-600"
                />
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  className="ml-auto rounded bg-red-700/80 px-2 py-1 text-xs text-white hover:bg-red-600"
                >
                  削除
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {DAY_LABELS.map((label, i) => {
                  const on = e.daysOfWeek.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(e, i)}
                      className={
                        'h-7 w-8 rounded text-xs font-medium ' +
                        (on
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-800 text-neutral-500 hover:text-neutral-200')
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function splitHostPort(address: string): { host: string; port: string } {
  const idx = address.lastIndexOf(':');
  if (idx === -1) return { host: address, port: '19132' };
  return { host: address.slice(0, idx), port: address.slice(idx + 1) };
}

function TunnelAddressShare({ address }: { address: string }) {
  const { host, port } = splitHostPort(address);
  const [copied, setCopied] = useState<'addr' | 'msg' | null>(null);

  const shareMessage =
    `Minecraft 統合版サーバーに招待！\n` +
    `サーバーアドレス: ${host}\n` +
    `ポート: ${port}\n` +
    `※「サーバーを追加」で一度登録すれば、次回からはタップするだけで入れます。`;

  const copy = (text: string, which: 'addr' | 'msg') => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-xs text-neutral-400">外部接続アドレス</p>
        <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
          <div className="flex flex-col gap-1 rounded bg-neutral-800 px-3 py-2 text-sm">
            <span>
              <span className="text-neutral-500">アドレス: </span>
              <span className="text-emerald-300">{host}</span>
            </span>
            <span>
              <span className="text-neutral-500">ポート: </span>
              <span className="text-emerald-300">{port}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => copy(address, 'addr')}
            className="self-start rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-600"
          >
            {copied === 'addr' ? 'コピー済' : 'アドレスをコピー'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => copy(shareMessage, 'msg')}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        {copied === 'msg' ? 'コピーしました！' : '友達への案内文をコピー'}
      </button>
      <p className="text-xs text-neutral-500">
        案内文には接続手順も含まれます。LINE などに貼って友達に送ってください。
      </p>
    </div>
  );
}

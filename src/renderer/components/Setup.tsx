import { useEffect, useRef, useState } from 'react';
import { useServerStore } from '../store/server-store';

function fmtMB(bytes?: number): string {
  if (!bytes) return '0';
  return (bytes / 1024 / 1024).toFixed(1);
}

type Step = 'welcome' | 'progress' | 'done';

interface StepItem {
  key: string;
  label: string;
}

const SETUP_STEPS: StepItem[] = [
  { key: 'folders', label: 'データフォルダ作成' },
  { key: 'download', label: 'サーバー本体ダウンロード' },
  { key: 'extract', label: '展開・配置' },
  { key: 'world', label: 'デフォルトワールド準備' },
];

const PHASE_RANK: Record<string, number> = {
  resolving: 0,
  downloading: 1,
  extracting: 2,
  done: 3,
};

/**
 * First-run setup wizard (spec 5): terms + EULA → progress → Dashboard landing.
 * Shown until a managed server install exists.
 */
export default function Setup() {
  const installState = useServerStore((s) => s.installState);
  const downloading = useServerStore((s) => s.downloading);
  const progress = useServerStore((s) => s.downloadProgress);
  const acceptEula = useServerStore((s) => s.acceptEula);
  const startDownload = useServerStore((s) => s.startDownload);

  const [step, setStep] = useState<Step>('welcome');
  const [agreed, setAgreed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const autoStarted = useRef(false);

  // Sync initial step to known state.
  useEffect(() => {
    if (!installState) return;
    if (installState.eulaAccepted && !installState.installed) {
      setStep((s) => (s === 'welcome' ? 'progress' : s));
    }
  }, [installState]);

  // Auto-start the download once we reach the progress step.
  useEffect(() => {
    if (
      step === 'progress' &&
      !autoStarted.current &&
      !downloading &&
      progress?.phase !== 'error' &&
      installState &&
      !installState.installed
    ) {
      autoStarted.current = true;
      startDownload();
    }
  }, [step, downloading, progress, installState, startDownload]);

  // Advance to done when the install finishes.
  useEffect(() => {
    if (progress?.phase === 'done' && installState?.installed) {
      setStep('done');
    }
  }, [progress, installState]);

  if (!installState || dismissed) return null;
  // Returning user with an existing install: no overlay.
  if (installState.installed && step !== 'done') return null;

  const phase = progress?.phase;
  const rank = phase ? (PHASE_RANK[phase] ?? -1) : -1;

  const stepStatus = (key: string): 'done' | 'active' | 'pending' => {
    switch (key) {
      case 'folders':
        return rank >= 0 ? 'done' : 'active';
      case 'download':
        if (rank >= 2) return 'done';
        if (rank >= 0) return 'active';
        return 'pending';
      case 'extract':
        if (rank >= 3) return 'done';
        if (rank === 2) return 'active';
        return 'pending';
      case 'world':
        return rank >= 3 ? 'done' : 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950/95 p-8">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
        {step === 'welcome' && (
          <>
            <h2 className="text-xl font-semibold">ようこそ</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Bedrock Server Manager は、Minecraft 統合版サーバーを簡単に立てて友達と遊ぶための
              無料アプリです。続行する前に以下に同意してください。
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              最新安定版:{' '}
              <span className="text-neutral-200">
                {installState.latestVersion ?? '取得できませんでした'}
              </span>
            </p>

            <label className="mt-6 flex items-start gap-3 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                本アプリの利用規約、および Microsoft の{' '}
                <a
                  href="https://www.minecraft.net/eula"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline"
                >
                  Minecraft EULA
                </a>{' '}
                ・{' '}
                <a
                  href="https://www.microsoft.com/servicesagreement"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline"
                >
                  サービス規約
                </a>{' '}
                に同意します。
              </span>
            </label>

            <button
              type="button"
              disabled={!agreed}
              onClick={async () => {
                await acceptEula();
                setStep('progress');
              }}
              className="mt-6 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              同意してセットアップを開始
            </button>
          </>
        )}

        {step === 'progress' && (
          <>
            <h2 className="text-xl font-semibold">セットアップ中...</h2>
            <p className="mt-2 text-sm text-neutral-400">
              サーバーに必要なファイルを準備しています。完了までお待ちください。
            </p>

            <ul className="mt-6 space-y-3">
              {SETUP_STEPS.map((s) => {
                const st = stepStatus(s.key);
                return (
                  <li key={s.key} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        'flex h-5 w-5 items-center justify-center rounded-full text-xs ' +
                        (st === 'done'
                          ? 'bg-emerald-600 text-white'
                          : st === 'active'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-neutral-800 text-neutral-600')
                      }
                    >
                      {st === 'done' ? '✓' : st === 'active' ? '…' : '○'}
                    </span>
                    <span
                      className={st === 'pending' ? 'text-neutral-600' : 'text-neutral-200'}
                    >
                      {s.label}
                      {s.key === 'download' && st === 'active' && progress?.totalBytes && (
                        <span className="ml-2 text-xs text-neutral-500">
                          {fmtMB(progress.receivedBytes)} / {fmtMB(progress.totalBytes)} MB
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            {phase === 'downloading' && (
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
            )}

            {phase === 'error' && (
              <div className="mt-4 space-y-3">
                <p className="rounded bg-red-950/60 px-3 py-2 text-sm text-red-300">
                  セットアップに失敗しました: {progress?.error}
                </p>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => {
                    autoStarted.current = false;
                    startDownload();
                  }}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  再試行
                </button>
              </div>
            )}
          </>
        )}

        {step === 'done' && (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white">
                ✓
              </div>
              <h2 className="mt-4 text-xl font-semibold">セットアップ完了</h2>
              <p className="mt-2 text-sm text-neutral-400">
                サーバーの準備ができました。Dashboard の「▶ サーバーを起動」で起動し、
                表示される接続アドレスを友達に送ってください。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="mt-6 w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Dashboard を開く
            </button>
          </>
        )}
      </div>
    </div>
  );
}

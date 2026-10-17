import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { BiomeFinderBounds } from '@shared/types';
import { api } from '../ipc-client';

function makeChunkbaseUrl(seed: string): string {
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function BiomeFinder() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState('');
  const [appliedSeed, setAppliedSeed] = useState('');
  const [loadingSeed, setLoadingSeed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSeed = useCallback(async () => {
    setLoadingSeed(true);
    setError(null);
    try {
      const config = await api.getConfig();
      const activeSeed = config.values['level-seed']?.trim() ?? '';
      setSeed(activeSeed);
      setAppliedSeed(activeSeed);
    } catch (err) {
      setError(`Could not read the configured world seed: ${errorMessage(err)}`);
    } finally {
      setLoadingSeed(false);
    }
  }, []);

  useEffect(() => {
    void refreshSeed();
  }, [refreshSeed]);

  useEffect(() => {
    if (!appliedSeed) {
      void api.hideBiomeFinder().catch((err: unknown) => console.error(err));
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    const updateBounds = (show: boolean) => {
      const rect = map.getBoundingClientRect();
      const bounds: BiomeFinderBounds = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
      const request = show
        ? api.showBiomeFinder(appliedSeed, bounds)
        : api.setBiomeFinderBounds(bounds);
      void request.catch((err: unknown) => {
        setError(`Could not display the biome map: ${errorMessage(err)}`);
      });
    };

    const onWindowResize = () => updateBounds(false);
    updateBounds(true);
    const observer = new ResizeObserver(() => updateBounds(false));
    observer.observe(map);
    window.addEventListener('resize', onWindowResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onWindowResize);
      void api.hideBiomeFinder().catch((err: unknown) => console.error(err));
    };
  }, [appliedSeed]);

  const applySeed = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSeed = seed.trim();
    if (!nextSeed) {
      setError('Enter a world seed to open the biome map.');
      return;
    }
    setError(null);
    setAppliedSeed(nextSeed);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-neutral-800 bg-neutral-950 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Biome Finder</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Explore your configured Bedrock world seed on Chunkbase.
            </p>
          </div>
          <a
            href="https://www.chunkbase.com/apps/biome-finder"
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              void api
                .openExternal(makeChunkbaseUrl(appliedSeed || seed.trim()))
                .catch((err: unknown) => setError(`Could not open Chunkbase: ${errorMessage(err)}`));
            }}
            className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
          >
            Open in browser
          </a>
        </div>

        <form onSubmit={applySeed} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-neutral-400">
            World seed
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              disabled={loadingSeed}
              placeholder={loadingSeed ? 'Loading active seed…' : 'Enter a world seed'}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-600 disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={loadingSeed || !seed.trim()}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Apply seed
          </button>
          <button
            type="button"
            onClick={() => void refreshSeed()}
            disabled={loadingSeed}
            className="rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          >
            Refresh
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          The seed is read from <code>level-seed</code> in server.properties. Imported or existing
          worlds may need the seed entered manually. The map opens with Bedrock 26.3 selected; choose
          the version that generated your world in Chunkbase if it differs. Your seed is sent to
          Chunkbase to render the map.
        </p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </header>

      <div ref={mapRef} className="relative min-h-0 flex-1 bg-neutral-900">
        {!appliedSeed && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-neutral-400">
            {loadingSeed
              ? 'Loading the active world seed…'
              : 'No seed is configured. Enter a seed above to open the map.'}
          </div>
        )}
      </div>
    </div>
  );
}

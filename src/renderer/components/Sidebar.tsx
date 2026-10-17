import { useServerStore, type PageKey } from '../store/server-store';
import ServerControl from './ServerControl';

interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '\u{1F3E0}' },
  { key: 'world', label: 'World', icon: '\u{1F30D}' },
  { key: 'biome-finder', label: 'Biome Finder', icon: '\u{1F5FA}' },
  { key: 'addon', label: 'Addon', icon: '\u{1F9E9}' },
  { key: 'player', label: 'Player', icon: '\u{1F465}' },
  { key: 'config', label: 'Config', icon: '⚙️' },
  { key: 'console', label: 'Console', icon: '\u{1F4DF}' },
];

export default function Sidebar() {
  const activePage = useServerStore((s) => s.activePage);
  const setActivePage = useServerStore((s) => s.setActivePage);

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-neutral-800 bg-neutral-900">
      <div className="px-4 py-5 border-b border-neutral-800">
        <h1 className="text-sm font-semibold text-neutral-200">Bedrock Server</h1>
        <p className="text-xs text-neutral-500">Manager</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
          const active = item.key === activePage;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActivePage(item.key)}
              className={
                'flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ' +
                (active
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100')
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <ServerControl />
    </aside>
  );
}

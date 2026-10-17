import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Setup from './components/Setup';
import Dashboard from './pages/Dashboard';
import World from './pages/World';
import Addon from './pages/Addon';
import Player from './pages/Player';
import Config from './pages/Config';
import Console from './pages/Console';
import BiomeFinder from './pages/BiomeFinder';
import { useServerStore } from './store/server-store';

export default function App() {
  const activePage = useServerStore((s) => s.activePage);
  const init = useServerStore((s) => s.init);

  useEffect(() => init(), [init]);

  return (
    <div className="relative flex h-full w-full bg-neutral-950 text-neutral-100">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'world' && <World />}
        {activePage === 'biome-finder' && <BiomeFinder />}
        {activePage === 'addon' && <Addon />}
        {activePage === 'player' && <Player />}
        {activePage === 'config' && <Config />}
        {activePage === 'console' && <Console />}
      </main>
      <Setup />
    </div>
  );
}

// Verify importWorld logic on synthetic flat and nested .mcworld archives.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from '../node_modules/adm-zip/adm-zip.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsm-imp-'));

const flat = new AdmZip();
flat.addFile('level.dat', Buffer.from('FAKEDAT'));
flat.addFile('levelname.txt', Buffer.from('Imported Flat'));
flat.addFile('db/CURRENT', Buffer.from('x'));
const flatPath = path.join(tmp, 'flat.mcworld');
flat.writeZip(flatPath);

const nest = new AdmZip();
nest.addFile('MyWorld/level.dat', Buffer.from('FAKEDAT'));
nest.addFile('MyWorld/levelname.txt', Buffer.from('Imported Nest'));
nest.addFile('MyWorld/db/CURRENT', Buffer.from('x'));
const nestPath = path.join(tmp, 'nest.zip');
nest.writeZip(nestPath);

function san(n) {
  return n.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\.+$/, '').trim();
}

function imp(src, worldsDir) {
  const zip = new AdmZip(src);
  const entries = zip.getEntries();
  const top = new Set(
    entries.map((e) => e.entryName.replace(/\\/g, '/').split('/')[0]).filter((s) => s.length > 0),
  );
  const hasSlash = entries.some((e) => e.entryName.includes('/'));
  const stripTop = top.size === 1 && hasSlash;
  const ln = entries.find((e) => !e.isDirectory && /(^|\/)levelname\.txt$/i.test(e.entryName));
  const disp = ln ? ln.getData().toString('utf-8').trim() : path.basename(src, path.extname(src));
  const folder = san(disp) || 'Imported World';
  const target = path.join(worldsDir, folder);
  fs.mkdirSync(target, { recursive: true });
  let n = 0;
  for (const e of entries) {
    if (e.isDirectory) continue;
    let nm = e.entryName.replace(/\\/g, '/');
    if (stripTop) {
      const i = nm.indexOf('/');
      if (i >= 0) nm = nm.slice(i + 1);
      if (!nm) continue;
    }
    const out = path.resolve(target, nm);
    if (!out.startsWith(path.resolve(target))) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, e.getData());
    n++;
  }
  return {
    folder,
    extracted: n,
    files: fs.readdirSync(target).sort(),
    hasDb: fs.existsSync(path.join(target, 'db', 'CURRENT')),
    hasLevel: fs.existsSync(path.join(target, 'level.dat')),
    stripTop,
    display: disp,
  };
}

const worlds = path.join(tmp, 'worlds');
fs.mkdirSync(worlds);
console.log('FLAT :', imp(flatPath, worlds));
console.log('NEST :', imp(nestPath, worlds));
fs.rmSync(tmp, { recursive: true, force: true });

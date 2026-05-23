// Validates the P2 download+extract mechanics (web-stream -> file, adm-zip) end to end
// against the real Microsoft endpoint, into a throwaway temp dir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import AdmZip from '../node_modules/adm-zip/adm-zip.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const VERSIONS = 'https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsm-dltest-'));
const zipPath = path.join(tmp, 'server.zip');
const extractDir = path.join(tmp, 'extract');

try {
  const vj = await (await fetch(VERSIONS, { headers: { 'User-Agent': UA } })).json();
  const version = vj.windows.stable;
  const url = `${vj.cdn_root.replace(/\/$/, '')}/bin-win/bedrock-server-${version}.zip`;
  console.log('version:', version);
  console.log('url:', url);

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
  const total = Number(res.headers.get('content-length')) || 0;
  let received = 0;
  let lastPct = -1;

  const reader = res.body.getReader();
  const node = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) return this.push(null);
      received += value.length;
      const pct = total ? Math.round((received / total) * 100) : -1;
      if (pct !== lastPct && pct % 20 === 0) {
        console.log(`  ${pct}% (${(received / 1048576).toFixed(1)}MB)`);
        lastPct = pct;
      }
      this.push(Buffer.from(value));
    },
  });
  await pipeline(node, fs.createWriteStream(zipPath));
  console.log('downloaded bytes:', received, 'expected:', total);

  const zip = new AdmZip(zipPath);
  fs.mkdirSync(extractDir, { recursive: true });
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    zip.extractEntryTo(e, extractDir, true, true);
  }
  const exe = path.join(extractDir, 'bedrock_server.exe');
  const ok = fs.existsSync(exe);
  console.log('bedrock_server.exe extracted:', ok, ok ? fs.statSync(exe).size + ' bytes' : '');
  process.exitCode = ok && received === total ? 0 : 1;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('cleaned temp:', tmp);
}

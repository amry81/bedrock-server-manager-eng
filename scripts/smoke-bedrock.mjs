// Standalone smoke test: verifies the real bedrock_server.exe lifecycle matches
// the assumptions in src/main/server-manager.ts (start -> "Server started" -> stop).
import { spawn } from 'node:child_process';
import path from 'node:path';

const exePath = process.argv[2];
if (!exePath) {
  console.error('usage: node smoke-bedrock.mjs <path-to-bedrock_server.exe>');
  process.exit(2);
}

const cwd = path.dirname(exePath);
let started = false;
let buf = '';
const child = spawn(exePath, [], { cwd, windowsHide: true });

const killTimer = setTimeout(() => {
  console.error('TIMEOUT: server did not start within 30s');
  child.kill();
  process.exit(1);
}, 30_000);

function onLine(line) {
  if (!line) return;
  console.log('[BDS]', line);
  if (!started && /Server started/i.test(line)) {
    started = true;
    console.log('>>> detected "Server started" — sending stop in 2s');
    clearTimeout(killTimer);
    setTimeout(() => child.stdin.write('stop\n'), 2000);
  }
}

child.stdout.setEncoding('utf-8');
child.stdout.on('data', (chunk) => {
  buf += chunk;
  const lines = buf.split(/\r?\n/);
  buf = lines.pop() ?? '';
  lines.forEach(onLine);
});
child.stderr.setEncoding('utf-8');
child.stderr.on('data', (c) => console.log('[BDS:err]', c.trimEnd()));

child.on('exit', (code, signal) => {
  console.log(`>>> exited code=${code} signal=${signal} startedDetected=${started}`);
  process.exit(started && (code === 0 || code === null) ? 0 : 1);
});
child.on('error', (err) => {
  console.error('spawn error:', err.message);
  process.exit(1);
});

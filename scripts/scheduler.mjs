/**
 * One-shot pipeline runner — intended to be called by crontab at 07:00 daily.
 * Run manually any time with: node ./scripts/scheduler.mjs
 *
 * Crontab setup (run `crontab -e` and add this line, replacing the path):
 *   0 7 * * * cd /Users/oliviachew/Documents/AheadNews/AheadNews && node ./scripts/scheduler.mjs >> /tmp/aheadnews-scheduler.log 2>&1
 */

import { exec, execSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import process from 'node:process';

const execAsync = promisify(exec);

const PIPELINES = [
  'home-rss-pipeline.mjs',
  'discover-rss-pipeline.mjs',
];

const METRO_PORT = process.env.METRO_PORT ?? '8081';

// ── Step 1: Run all RSS pipelines ─────────────────────────────────────────────

async function runPipelines() {
  const ts = new Date().toLocaleTimeString('en-SG', { hour12: false });
  console.log(`\n[${ts}] Running RSS pipelines...`);

  for (const script of PIPELINES) {
    try {
      const { stdout, stderr } = await execAsync(
        `node ./scripts/${script}`,
        { cwd: process.cwd() },
      );
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    } catch (e) {
      console.error(`  ✗ ${script}: ${e.message}`);
    }
  }
}

// ── Step 2: Clear Metro's transform cache ─────────────────────────────────────

async function clearMetroCache() {
  // Metro stores its transform cache in the OS temp dir
  const tmpDir = os.tmpdir();
  const patterns = ['metro-cache', 'haste-map', 'metro-transform'];

  let cleared = 0;
  for (const pat of patterns) {
    try {
      // find matching dirs under tmpdir
      const { stdout } = await execAsync(`find "${tmpDir}" -maxdepth 1 -name "${pat}*" -type d 2>/dev/null`);
      for (const dir of stdout.trim().split('\n').filter(Boolean)) {
        await rm(dir, { recursive: true, force: true });
        cleared++;
      }
    } catch { /* nothing to clear */ }
  }

  // Also clear Expo's local metro cache if present
  const expoCache = path.join(process.cwd(), '.expo');
  try {
    await rm(path.join(expoCache, 'metro'), { recursive: true, force: true });
    cleared++;
  } catch { /* not present */ }

  console.log(`  Metro cache cleared (${cleared} entries removed).`);
}

// ── Step 3: Signal Metro to reload ────────────────────────────────────────────

async function reloadMetro() {
  try {
    const res = await fetch(`http://localhost:${METRO_PORT}/reload`, { method: 'POST' });
    if (res.ok) {
      console.log('  Metro reload triggered — app is refreshing.');
    } else {
      throw new Error(`status ${res.status}`);
    }
  } catch {
    console.log('  Metro not reachable. Reload Expo manually ("r" in Expo terminal).');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

await runPipelines();
await clearMetroCache();
await reloadMetro();

console.log(`\n  Done at ${new Date().toLocaleTimeString('en-SG', { hour12: false })}.`);

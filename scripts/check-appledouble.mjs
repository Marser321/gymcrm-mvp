#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

const failWithList = (files) => {
  if (files.length === 0) {
    console.log('OK: no AppleDouble files tracked.');
    process.exit(0);
  }

  console.error('AppleDouble files found (remove these before merge):');
  for (const file of files) {
    console.error(`- ${file}`);
  }
  process.exit(1);
};

if (existsSync(join(root, '.git'))) {
  let tracked = '';
  try {
    tracked = execSync('git ls-files', { cwd: root, encoding: 'utf-8' });
  } catch (error) {
    console.error(`No se pudo ejecutar "git ls-files": ${error}`);
    process.exit(2);
  }

  const offenders = tracked
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => file.split('/').pop()?.startsWith('._'));

  failWithList(offenders);
}

const allowFallbackScan = process.env.APPLEDOUBLE_SCAN_FALLBACK === 'true';
if (!allowFallbackScan) {
  console.log('SKIP: no .git directory found; AppleDouble check requiere repo git o APPLEDOUBLE_SCAN_FALLBACK=true.');
  process.exit(0);
}

const skipDirs = new Set(['node_modules', '.next', '.playwright-artifacts', 'test-results', '.agent']);
const found = [];

const walk = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absPath = join(dir, entry.name);
    const relPath = relative(root, absPath);

    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(absPath);
      continue;
    }

    if (!entry.name.startsWith('._')) continue;
    try {
      if (!statSync(absPath).isFile()) continue;
    } catch {
      continue;
    }
    found.push(relPath);
  }
};

walk(root);
failWithList(found);

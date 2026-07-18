#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'SKILL.md', 'agents/openai.yaml',
  ...Array.from({ length: 13 }, (_, i) => `references/${String(i + 1).padStart(2, '0')}-`),
  'scripts/validate-project.mjs', 'scripts/calculate-kpis.mjs', 'scripts/export-package.mjs',
  'scripts/validate-skill.mjs', 'scripts/migrate-data.mjs',
  'assets/project-template', 'assets/script-template', 'assets/topview-template',
  'assets/analytics-template', 'assets/review-template'
];
const all = fs.readdirSync(path.join(root, 'references'));
const missing = required.filter((item) => item.endsWith('-')
  ? !all.some((name) => name.startsWith(item.split('/').at(-1)))
  : !fs.existsSync(path.join(root, item)));
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
if (!skill.startsWith('---\nname: topview-growth-monetization\n')) missing.push('valid frontmatter');
if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, references: all.length, filesChecked: required.length }, null, 2));

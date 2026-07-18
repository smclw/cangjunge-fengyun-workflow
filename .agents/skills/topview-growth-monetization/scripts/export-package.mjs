#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('用法: node export-package.mjs <project.json> <output-dir>');
const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'../../../..');
const result=spawnSync(process.execPath,['--import','tsx',path.join(here,'export-package-runner.ts'),path.resolve(input),path.resolve(output)],{cwd:projectRoot,stdio:'inherit'});
process.exit(result.status??1);

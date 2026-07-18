#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const input=process.argv[2];
if(!input)throw new Error('用法: node calculate-kpis.mjs <metric-values.json>');
const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'../../../..');
const runner=path.join(here,'calculate-kpis-runner.ts');
const result=spawnSync(process.execPath,['--import','tsx',runner,path.resolve(input)],{cwd:projectRoot,stdio:'inherit'});
process.exit(result.status??1);

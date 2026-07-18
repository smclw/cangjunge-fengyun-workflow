#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const input=process.argv[2];
if(!input)throw new Error('用法: node validate-project.mjs <project.json>');
const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'../../../..');
const result=spawnSync(process.execPath,['--import','tsx',path.join(here,'validate-project-runner.ts'),path.resolve(input)],{cwd:projectRoot,stdio:'inherit'});
process.exit(result.status??1);

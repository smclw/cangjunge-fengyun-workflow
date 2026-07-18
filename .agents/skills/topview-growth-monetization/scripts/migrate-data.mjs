#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const file=process.argv[2];
if(!file)throw new Error('用法: node migrate-data.mjs <project.json>');
const here=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(file,'utf8'));
if(data.schemaVersion===1){console.log('无需迁移');process.exit(0);}
const template=JSON.parse(fs.readFileSync(path.resolve(here,'../assets/project-template/project.json'),'utf8'));
const now=new Date().toISOString();
const migrated=Object.fromEntries(Object.keys(template).map((key)=>[key,data[key]??template[key]]));
Object.assign(migrated,{schemaVersion:1,revision:Number.isInteger(data.revision)&&data.revision>=0?data.revision:0,dataClass:data.dataClass??(data.isDemo?'demo':'real'),demoNotice:data.dataClass==='demo'||data.isDemo?(data.demoNotice||'演示数据，不代表真实经营结果'):'',createdAt:data.createdAt??now,updatedAt:now});
migrated.goals={...template.goals,...(data.goals??{})};
migrated.positioning={...template.positioning,...(data.positioning??{})};
const tmp=`${file}.${process.pid}.tmp`;
fs.writeFileSync(tmp,`${JSON.stringify(migrated,null,2)}\n`,{encoding:'utf8',flag:'wx'});
const projectRoot=path.resolve(here,'../../../..');
const checked=spawnSync(process.execPath,['--import','tsx',path.join(here,'validate-project-runner.ts'),path.resolve(tmp)],{cwd:projectRoot,stdio:'inherit'});
if(checked.status!==0){fs.rmSync(tmp,{force:true});process.exit(checked.status??1);}
fs.copyFileSync(file,`${file}.pre-v1.bak`);
fs.renameSync(tmp,file);
console.log('已迁移到 schemaVersion 1，并保留 pre-v1 备份');

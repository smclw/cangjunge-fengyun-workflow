import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach,describe,expect,it } from 'vitest';
import { makeTemp } from '../helpers.js';

const root=path.resolve('.'),scripts=path.join(root,'.agents','skills','topview-growth-monetization','scripts'),template=path.join(root,'.agents','skills','topview-growth-monetization','assets','project-template','project.json');
const temporary:string[]=[];
afterEach(async()=>{await Promise.all(temporary.splice(0).map((dir)=>fs.rm(dir,{recursive:true,force:true})));});
function run(name:string,...args:string[]){return spawnSync(process.execPath,[path.join(scripts,name),...args],{cwd:root,encoding:'utf8'});}

describe('项目 Skill 可执行脚本',()=>{
  it('复用主 Schema 校验项目并导出真实20文件',async()=>{const dir=await makeTemp('topview-skill-');temporary.push(dir);const checked=run('validate-project.mjs',template);expect(checked.status,checked.stderr).toBe(0);const output=path.join(dir,'export');const exported=run('export-package.mjs',template,output);expect(exported.status,exported.stderr).toBe(0);expect((await fs.readdir(output)).filter((name)=>/^\d{2}-/.test(name))).toHaveLength(20);});
  it('复用配置公式计算分单位KPI',async()=>{const dir=await makeTemp('topview-kpi-');temporary.push(dir);const input=path.join(dir,'values.json');await fs.writeFile(input,JSON.stringify({views:100,followersGained:2,orders:1,actualRevenueMinor:1000,refundsMinor:100,productionCostMinor:200,adCostMinor:300}));const result=run('calculate-kpis.mjs',input);expect(result.status,result.stderr).toBe(0);expect(JSON.parse(result.stdout)).toMatchObject({revenuePerThousandViews:10000,costPerFollower:250,netProfitMinor:400,roi:2});});
  it('迁移旧数据前备份并以主 Schema 复验',async()=>{const dir=await makeTemp('topview-migrate-');temporary.push(dir);const file=path.join(dir,'project.json');await fs.writeFile(file,JSON.stringify({schemaVersion:0,id:'legacy-project',name:'旧项目',isDemo:false}));const migrated=run('migrate-data.mjs',file);expect(migrated.status,migrated.stderr).toBe(0);expect(JSON.parse(await fs.readFile(file,'utf8')).schemaVersion).toBe(1);expect(await fs.stat(`${file}.pre-v1.bak`)).toBeTruthy();expect(run('validate-project.mjs',file).status).toBe(0);});
});

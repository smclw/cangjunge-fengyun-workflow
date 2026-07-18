import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { projectSchema } from '../schemas/project.js';
import { safeResolve } from '../utils/paths.js';

async function walk(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current,{withFileTypes:true});
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(current,entry.name);
    if (entry.isDirectory()) files.push(...await walk(root,full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

export async function createBackup(projectRoot: string, dataDir: string, configDir: string, retention = 20): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const output = safeResolve(dataDir,'backups',`topview-workflow-${stamp}.zip`);
  await fs.mkdir(path.dirname(output),{recursive:true});
  const zip = new AdmZip();
  const manifest: { schemaVersion:number; createdAt:string; included:Array<{path:string;size:number;sha256:string}>; excluded:Array<{path:string;reason:string}> } = { schemaVersion:1,createdAt:new Date().toISOString(),included:[],excluded:[] };
  for (const [base,prefix] of [[configDir,'config'],[safeResolve(dataDir,'projects'),'data/projects'],[safeResolve(dataDir,'logs'),'data/logs']] as const) {
    try {
      for (const file of await walk(base)) {
        const relative = path.relative(base,file).replaceAll('\\','/');
        const archivePath = `${prefix}/${relative}`;
        const stat = await fs.stat(file);
        if (/\.(mp4|mov)$/i.test(file)) { manifest.excluded.push({path:archivePath,reason:'大型原始视频默认不重复复制'}); continue; }
        const buffer = await fs.readFile(file);
        zip.addFile(archivePath,buffer);
        manifest.included.push({path:archivePath,size:stat.size,sha256:crypto.createHash('sha256').update(buffer).digest('hex')});
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  for (const file of ['README.md','DECISIONS.md','PLANS.md']) {
    try { const buffer=await fs.readFile(safeResolve(projectRoot,file));const archivePath=`docs/${file}`;zip.addFile(archivePath,buffer);manifest.included.push({path:archivePath,size:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')}); } catch { /* optional */ }
  }
  zip.addFile('manifest.json',Buffer.from(`${JSON.stringify(manifest,null,2)}\n`,'utf8'));
  zip.writeZip(output);
  const backupDir=path.dirname(output);
  const backups=(await fs.readdir(backupDir)).filter((name)=>/^topview-workflow-.*\.zip$/.test(name)).sort().reverse();
  for(const expired of backups.slice(Math.max(1,retention))) await fs.rm(safeResolve(backupDir,expired),{force:true});
  return output;
}

type ProjectReplacer=(project: ReturnType<typeof projectSchema.parse>)=>Promise<unknown>;
type Manifest={schemaVersion:1;included:Array<{path:string;size:number;sha256:string}>};

export async function restoreBackup(buffer: Buffer, dataDir: string, configDir: string, replaceProject?:ProjectReplacer): Promise<{ projects:number; configs:number; files:number }> {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (entries.length > 2000) throw Object.assign(new Error('备份文件数量超限'),{status:400,code:'BACKUP_TOO_MANY_FILES'});
  let advertisedTotal = 0;
  const entryMap=new Map<string,AdmZip.IZipEntry>();
  for(const entry of entries){
    const name=normalizeArchivePath(entry.entryName);
    if(entryMap.has(name))throw Object.assign(new Error('备份包含重复路径'),{status:400,code:'BACKUP_DUPLICATE_PATH'});
    entryMap.set(name,entry);
    if(!entry.isDirectory){advertisedTotal+=entry.header.size;if(advertisedTotal>100*1024*1024)throw Object.assign(new Error('备份解压大小超限'),{status:400,code:'BACKUP_TOO_LARGE'});}
  }
  const manifestEntry=entryMap.get('manifest.json');
  if(!manifestEntry||manifestEntry.isDirectory)throw Object.assign(new Error('备份缺少完整性清单'),{status:400,code:'BACKUP_MANIFEST_REQUIRED'});
  let manifest:Manifest;
  try{manifest=JSON.parse(manifestEntry.getData().toString('utf8')) as Manifest;}catch{throw Object.assign(new Error('备份清单无法解析'),{status:400,code:'BACKUP_MANIFEST_INVALID'});}
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.included))throw Object.assign(new Error('备份清单版本或结构无效'),{status:400,code:'BACKUP_MANIFEST_INVALID'});
  const included=new Set<string>();
  for(const item of manifest.included){
    const name=normalizeArchivePath(item.path);
    if(included.has(name)||!Number.isSafeInteger(item.size)||item.size<0||!/^[a-f0-9]{64}$/i.test(item.sha256))throw Object.assign(new Error('备份清单条目无效'),{status:400,code:'BACKUP_MANIFEST_INVALID'});
    included.add(name);
    const entry=entryMap.get(name);
    if(!entry||entry.isDirectory||entry.header.size!==item.size)throw Object.assign(new Error(`备份文件与清单不一致：${name}`),{status:400,code:'BACKUP_INTEGRITY_FAILED'});
    const data=entry.getData();
    if(data.length!==item.size||crypto.createHash('sha256').update(data).digest('hex')!==item.sha256.toLowerCase())throw Object.assign(new Error(`备份文件校验失败：${name}`),{status:400,code:'BACKUP_INTEGRITY_FAILED'});
  }
  const projects: Array<{ id:string; data: unknown }> = [];
  const allowedConfigs = new Set(['app.json','platforms.json','scoring.json','kpis.json','diagnostics.json','workflow.json','compliance.json']);
  const configs: Array<{ name:string; data:Buffer }> = [];
  const projectFiles:Array<{relative:string;data:Buffer}>=[];
  for (const entry of entries) {
    const name = normalizeArchivePath(entry.entryName);
    if (entry.isDirectory) continue;
    const data = entry.getData();
    if(name!=='manifest.json'&&!included.has(name))throw Object.assign(new Error(`备份存在未登记文件：${name}`),{status:400,code:'BACKUP_UNLISTED_FILE'});
    const match = name.match(/^data\/projects\/([a-z0-9][a-z0-9-]{2,63})\/project\.json$/);
    if (match){const validated=projectSchema.parse(JSON.parse(data.toString('utf8')));if(validated.id!==match[1])throw Object.assign(new Error(`项目ID与备份路径不一致：${name}`),{status:400,code:'BACKUP_PROJECT_ID_MISMATCH'});projects.push({id:match[1],data:validated});}
    const fileMatch=name.match(/^data\/projects\/([a-z0-9][a-z0-9-]{2,63})\/(materials|outputs)\/(.+)$/);
    if(fileMatch){
      const parts=fileMatch[3].split('/');
      if(parts.some((part)=>!isSafeWindowsSegment(part)))throw Object.assign(new Error(`项目文件路径无效：${name}`),{status:400,code:'BACKUP_PROJECT_FILE_INVALID'});
      projectFiles.push({relative:name.slice('data/'.length),data});
    }
    const configMatch = name.match(/^config\/([^/]+\.json)$/);
    if (configMatch && allowedConfigs.has(configMatch[1])) {
      validateConfig(configMatch[1],JSON.parse(data.toString('utf8')));
      configs.push({name:configMatch[1],data});
    }
  }
  if (!projects.length) throw Object.assign(new Error('备份中没有可恢复项目'),{status:400,code:'BACKUP_NO_PROJECTS'});
  const projectIds=new Set(projects.map((project)=>project.id));
  for(const file of projectFiles){const id=file.relative.split('/')[1];if(!projectIds.has(id))throw Object.assign(new Error(`备份包含无所属项目的文件：${file.relative}`),{status:400,code:'BACKUP_ORPHAN_PROJECT_FILE'});}
  for (const project of projects) {
    const validated=projectSchema.parse(project.data);
    if(replaceProject) await replaceProject(validated);
    else {
      const dir = safeResolve(dataDir,'projects',project.id);
      await fs.mkdir(dir,{recursive:true});
      const target = safeResolve(dir,'project.json');
      try { await fs.copyFile(target,`${target}.pre-restore-${Date.now()}.bak`); } catch { /* new project */ }
      const tmp = safeResolve(dir,`project.${process.pid}.restore.tmp`);
      await fs.writeFile(tmp,`${JSON.stringify(validated,null,2)}\n`,{encoding:'utf8',flag:'wx'});
      await fs.rename(tmp,target);
    }
  }
  for (const config of configs) {
    const target = safeResolve(configDir,config.name);
    try { await fs.copyFile(target,`${target}.pre-restore-${Date.now()}.bak`); } catch { /* new config */ }
    const tmp = safeResolve(configDir,`.${config.name}.${process.pid}.restore.tmp`);
    await fs.writeFile(tmp,config.data,{flag:'wx'});
    await fs.rename(tmp,target);
  }
  for(const file of projectFiles){
    const target=safeResolve(dataDir,file.relative);
    await fs.mkdir(path.dirname(target),{recursive:true});
    try{await fs.copyFile(target,`${target}.pre-restore-${Date.now()}.bak`);}catch{/* new file */}
    const tmp=safeResolve(path.dirname(target),`.${path.basename(target)}.${process.pid}.restore.tmp`);
    await fs.writeFile(tmp,file.data,{flag:'wx'});
    await fs.rename(tmp,target);
  }
  return {projects:projects.length,configs:configs.length,files:projects.length+configs.length+projectFiles.length};
}

function normalizeArchivePath(value:string):string {
  const name=value.replaceAll('\\','/');
  if(!name||name.startsWith('/')||/^[a-z]:/i.test(name)||name.split('/').includes('..'))throw Object.assign(new Error('备份包含不安全路径'),{status:400,code:'ZIP_SLIP'});
  return name;
}

function validateConfig(name:string,value:unknown):void {
  const data=value as Record<string,unknown>;
  const arrays=(key:string)=>Array.isArray(data[key]);
  const records=(key:string)=>typeof data[key]==='object'&&data[key]!==null&&!Array.isArray(data[key]);
  let valid=data?.schemaVersion===1;
  if(name==='app.json')valid=valid&&typeof data.host==='string'&&Number.isInteger(data.uploadLimitBytes)&&Number.isInteger(data.backupRetention);
  else if(name==='platforms.json')valid=valid&&arrays('platforms');
  else if(name==='scoring.json')valid=valid&&records('growth')&&records('monetization')&&records('risks')&&arrays('hardBlocks');
  else if(name==='kpis.json')valid=valid&&arrays('formulas');
  else if(name==='diagnostics.json')valid=valid&&records('minimumSamples')&&records('fallbackThresholds');
  else if(name==='workflow.json')valid=valid&&arrays('steps')&&arrays('states');
  else if(name==='compliance.json')valid=valid&&arrays('blockedPatterns')&&arrays('requiredChecks');
  if(!valid)throw Object.assign(new Error(`备份配置结构无效：${name}`),{status:400,code:'BACKUP_CONFIG_INVALID'});
}

function isSafeWindowsSegment(value:string):boolean {
  if(!value||value==='.'||value==='..'||value.endsWith('.')||value.endsWith(' ')||!/^[-_.()\p{L}\p{N} ]{1,160}$/u.test(value))return false;
  const stem=value.split('.')[0].toUpperCase();
  return !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem);
}

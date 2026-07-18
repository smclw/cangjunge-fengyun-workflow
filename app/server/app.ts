import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import multer from 'multer';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createProjectSchema, deleteProjectSchema, projectSchema, revisionSchema, updateProjectSchema } from './schemas/project.js';
import { ProjectStore } from './storage/project-store.js';
import { readJsonConfig, type AppConfig, type ScoringConfig, type WorkflowConfig } from './services/config.js';
import { createEmptyProject } from './services/project-factory.js';
import { generateReview, generateScripts, generateTopics, generateTopviewPackages } from './services/generators.js';
import { buildDashboard } from './analytics/dashboard.js';
import { aggregateMetricValues } from './analytics/kpis.js';
import { deepMerge } from './utils/merge.js';
import { assertSafeProjectId, safeResolve, slugifyName } from './utils/paths.js';
import { saveMaterial } from './services/materials.js';
import { createProjectExport } from './services/export-service.js';
import { createBackup, restoreBackup } from './services/backup-service.js';

export interface AppOptions { projectRoot:string; dataDir:string; configDir:string; staticDir:string; }

export async function createApp(options:AppOptions) {
  const [appConfig,workflowConfig,scoringConfig]=await Promise.all([
    readJsonConfig<AppConfig>(options.configDir,'app.json'),readJsonConfig<WorkflowConfig>(options.configDir,'workflow.json'),readJsonConfig<ScoringConfig>(options.configDir,'scoring.json')
  ]);
  const store=new ProjectStore(options.dataDir); await store.initialize();
  const app=express(); app.disable('x-powered-by');
  app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'");
    const origin=req.get('origin');if(origin&&![`http://127.0.0.1:${req.socket.localPort}`,`http://localhost:${req.socket.localPort}`].includes(origin))return res.status(403).json({error:{code:'ORIGIN_BLOCKED',message:'跨域请求已被拒绝'}});next();});
  app.use(express.json({limit:appConfig.jsonLimit,strict:true}));
  app.use((req,res,next)=>{(req as express.Request & {requestId?:string}).requestId=crypto.randomUUID();res.setHeader('X-Request-Id',(req as express.Request & {requestId?:string}).requestId!);next();});
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:appConfig.uploadLimitBytes,files:1}});

  app.get('/api/health',(_req,res)=>res.json({ok:true,name:'Topview涨粉变现工作流',schemaVersion:1,time:new Date().toISOString()}));
  app.get('/api/config',async(_req,res)=>res.json({app:appConfig,workflow:workflowConfig,scoring:scoringConfig,platforms:await readJsonConfig(options.configDir,'platforms.json'),kpis:await readJsonConfig(options.configDir,'kpis.json'),diagnostics:await readJsonConfig(options.configDir,'diagnostics.json')}));
  app.get('/api/projects',async(_req,res)=>{const projects=await store.list();res.json(projects.map((p)=>{const latest=aggregateMetricValues(p.metrics).values;return {id:p.id,name:p.name,projectType:p.projectType,platforms:p.goals.platforms,stage:p.stage,status:p.status,videos:p.topviewPackages.length,published:p.publications.filter((x)=>x.status==='published').length,followers:latest.followersGained??0,revenueMinor:latest.actualRevenueMinor??0,updatedAt:p.updatedAt,dataClass:p.dataClass,demoNotice:p.demoNotice};}));});
  app.post('/api/projects',async(req,res)=>{const input=createProjectSchema.parse(req.body);const project=createEmptyProject(input,workflowConfig);await store.create(project);res.status(201).json(project);});
  app.get('/api/projects/:id',async(req,res)=>{const id=routeParam(req,'id');assertSafeProjectId(id);res.json(await store.read(id));});
  app.patch('/api/projects/:id',async(req,res)=>{const id=routeParam(req,'id');assertSafeProjectId(id);const body=updateProjectSchema.parse(req.body);const current=await store.read(id);const merged=deepMerge(current,body.changes);
    merged.id=current.id;merged.schemaVersion=1;merged.revision=current.revision;merged.createdAt=current.createdAt;res.json(await store.save(projectSchema.parse(merged),body.expectedRevision));});
  app.post('/api/projects/:id/duplicate',async(req,res)=>{const source=await store.read(routeParam(req,'id'));const now=new Date().toISOString();const copy=structuredClone(source);copy.id=slugifyName(`${source.name}-副本`);copy.name=`${source.name}（副本）`;copy.revision=0;copy.createdAt=now;copy.updatedAt=now;copy.dataClass='real';copy.demoNotice='';await store.create(projectSchema.parse(copy));try{const sourceMaterials=safeResolve(options.dataDir,'projects',source.id,'materials');const targetMaterials=safeResolve(options.dataDir,'projects',copy.id,'materials');await fs.cp(sourceMaterials,targetMaterials,{recursive:true,errorOnExist:true,force:false});}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'){await store.delete(copy.id);throw error;}}res.status(201).json(copy);});
  app.delete('/api/projects/:id',async(req,res)=>{const project=await store.read(routeParam(req,'id'));const confirmation=deleteProjectSchema.parse(req.body);if(confirmation.confirmName!==project.name)return res.status(400).json({error:{code:'DELETE_CONFIRMATION_REQUIRED',message:'删除确认名称不匹配'}});await store.delete(project.id);res.status(204).end();});
  app.post('/api/projects/:id/materials',upload.single('file'),async(req,res)=>{const project=await store.read(routeParam(req,'id'));if(!req.file)throw Object.assign(new Error('请选择文件'),{status:400,code:'FILE_REQUIRED'});const expectedRevision=Number(req.body.expectedRevision);if(!Number.isInteger(expectedRevision)||expectedRevision<0)throw Object.assign(new Error('缺少有效的数据修订号'),{status:400,code:'REVISION_REQUIRED'});const material=await saveMaterial(project,req.file,{type:req.body.type??'other',source:req.body.source??'用户上传',authorization:req.body.authorization??'unknown',commercialUseAllowed:req.body.commercialUseAllowed==='true'},options.dataDir,appConfig.allowedExtensions);project.materials.push(material);try{res.status(201).json(await store.save(project,expectedRevision));}catch(error){const latest=await store.read(project.id);if(!latest.materials.some((item)=>item.id===material.id)&&material.storedName)await fs.rm(safeResolve(options.dataDir,'projects',project.id,'materials',material.storedName),{force:true});throw error;}});
  app.post('/api/projects/:id/actions/:action',async(req,res)=>{const project=await store.read(routeParam(req,'id'));const action=routeParam(req,'action');const revision=revisionSchema.parse(req.body);
    if(action==='generate-topics'){project.topics=generateTopics(project,scoringConfig);setStep(project,'topics','completed');}
    else if(action==='generate-scripts'){project.scripts=generateScripts(project);setStep(project,'scripts','completed');}
    else if(action==='generate-topview'){project.topviewPackages=generateTopviewPackages(project);setStep(project,'topview','waiting_manual');}
    else if(action==='generate-review'){const review=generateReview(project,revision.reviewScope);project.reviews.push(review);project.experiments.push({id:crypto.randomUUID(),name:`${review.primaryVariable} A/B测试`,hypothesis:review.nextTest,primaryVariable:review.primaryVariable,control:'保持当前版本',variant:`只改变：${review.primaryVariable}`,metric:review.winningCriterion,winningCriterion:review.winningCriterion,status:'planned'});setStep(project,'review','completed');}
    else if(action==='archive'){project.status='archived';}
    else if(action==='restore-archive'){project.status='active';}
    else throw Object.assign(new Error('未知项目动作'),{status:404,code:'UNKNOWN_ACTION'});
    res.json(await store.save(project,revision.expectedRevision));});
  app.get('/api/projects/:id/dashboard',async(req,res)=>{const days=Math.min(365,Math.max(1,Number(req.query.days??7)));let custom:{from:string;to:string}|undefined;const from=String(req.query.from??''),to=String(req.query.to??'');if(from||to){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||Number.isNaN(Date.parse(from))||Number.isNaN(Date.parse(to))||from>to||Date.parse(to)-Date.parse(from)>365*86_400_000)throw Object.assign(new Error('自定义日期范围无效或超过365天'),{status:400,code:'INVALID_DATE_RANGE'});custom={from,to};}res.json(buildDashboard(await store.read(routeParam(req,'id')),days,custom));});
  app.get('/api/projects/:id/export',async(req,res)=>{const project=await store.read(routeParam(req,'id'));const zipPath=await createProjectExport(project,options.dataDir);res.download(zipPath,path.basename(zipPath));});
  app.post('/api/projects/:id/open-materials',async(req,res)=>{const project=await store.read(routeParam(req,'id'));const dir=safeResolve(options.dataDir,'projects',project.id,'materials');await fs.mkdir(dir,{recursive:true});if(process.platform!=='win32')return res.status(501).json({error:{code:'WINDOWS_ONLY',message:'打开文件夹功能仅支持Windows'}});const child=spawn('explorer.exe',[dir],{detached:true,stdio:'ignore',windowsHide:false});child.unref();res.json({ok:true,path:dir});});
  app.post('/api/system/backup',async(_req,res)=>{const backup=await createBackup(options.projectRoot,options.dataDir,options.configDir,appConfig.backupRetention);res.json({ok:true,path:backup,fileName:path.basename(backup)});});
  app.post('/api/system/restore',upload.single('backup'),async(req,res)=>{if(req.get('x-confirm-restore')!=='RESTORE')return res.status(400).json({error:{code:'RESTORE_CONFIRMATION_REQUIRED',message:'恢复需要显式确认'}});if(!req.file)throw Object.assign(new Error('请选择备份文件'),{status:400,code:'BACKUP_REQUIRED'});await createBackup(options.projectRoot,options.dataDir,options.configDir,appConfig.backupRetention);res.json({ok:true,...await restoreBackup(req.file.buffer,options.dataDir,options.configDir,(project)=>store.restore(project))});});

  try{await fs.access(options.staticDir);app.use(express.static(options.staticDir,{fallthrough:true,index:false,maxAge:'1h'}));app.get('*path',async(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(safeResolve(options.staticDir,'index.html'));});}catch{/* build not present during API tests */}
  app.use((error:unknown,req:express.Request,res:express.Response,_next:express.NextFunction)=>{const err=error as {status?:number;code?:string;message?:string;name?:string;stack?:string};const status=err.status??(err.name==='ZodError'?400:err.name==='MulterError'?413:500);const requestId=(req as express.Request & {requestId?:string}).requestId;void store.audit(`request-error:${requestId}:${err.code??err.name??'INTERNAL_ERROR'}`,'system',false).catch(()=>undefined);if(status>=500)console.error(JSON.stringify({at:new Date().toISOString(),requestId,method:req.method,path:req.path,code:err.code??err.name??'INTERNAL_ERROR',message:err.message}));res.status(status).json({error:{code:err.code??err.name??'INTERNAL_ERROR',message:status>=500?'系统处理失败，请查看本地日志。':err.message??'请求无效',requestId}});});
  return {app,store,config:{appConfig,workflowConfig,scoringConfig}};
}

function setStep(project:Awaited<ReturnType<ProjectStore['read']>>,id:string,state:'completed'|'waiting_manual') {const step=project.workflow.find((x)=>x.id===id);if(step)step.state=state;project.stage=id;}
function routeParam(req:express.Request,name:string):string {const value=req.params[name];if(typeof value!=='string')throw Object.assign(new Error('路由参数无效'),{status:400,code:'INVALID_ROUTE_PARAM'});return value;}

import fs from 'node:fs/promises';
import path from 'node:path';
import type { MetricSnapshot, MetricValues, Project } from '../app/server/schemas/project.js';
import { createEmptyProject } from '../app/server/services/project-factory.js';
import type { WorkflowConfig } from '../app/server/services/config.js';

export const workflow:WorkflowConfig={schemaVersion:1,steps:[
  {id:'initialize',label:'项目初始化',manualGate:false},{id:'goals',label:'平台与目标',manualGate:false},{id:'positioning',label:'账号定位',manualGate:false},{id:'materials',label:'资料录入',manualGate:true},{id:'topics',label:'选题评分',manualGate:false},
  {id:'scripts',label:'脚本生成',manualGate:false},{id:'topview',label:'Topview制作',manualGate:true},{id:'quality',label:'质量检查',manualGate:true},{id:'publishing',label:'发布素材',manualGate:true},{id:'review',label:'数据复盘',manualGate:false}
],states:['not_started','in_progress','waiting_manual','completed','risk']};

export function emptyValues(changes:Partial<MetricValues>={}):MetricValues {return {
  impressions:null,views:null,threeSecondViews:null,averageWatchSeconds:null,totalWatchSeconds:null,completions:null,likes:null,comments:null,shares:null,saves:null,
  followersGained:null,profileVisits:null,linkClicks:null,productClicks:null,addToCarts:null,orders:null,gmvMinor:null,commissionMinor:null,refundsMinor:null,
  productionCostMinor:null,adCostMinor:null,actualRevenueMinor:null,...changes
};}

export function metric(id:string,videoId:string,dataThroughAt:string,values:Partial<MetricValues>,platform='douyin'):MetricSnapshot {return {
  id,videoId,publicationId:`pub-${videoId}`,platform,checkpoint:'24h',valueMode:'cumulative_since_publish',publishedAt:'2026-07-10T00:00:00.000Z',dataThroughAt,
  capturedAt:dataThroughAt,sourceMode:'manual',completeness:'complete',currency:'CNY',values:emptyValues(values)
};}

export function testProject(id='test-project'):Project {return createEmptyProject({name:'测试项目',projectType:'问题解决型好物视频',platforms:['douyin'],dataClass:'real'},workflow,id);}

export async function makeTemp(prefix='topview-test-'):Promise<string>{return fs.mkdtemp(path.join(process.env.TEMP??process.cwd(),prefix));}

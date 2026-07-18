import path from 'node:path';
import crypto from 'node:crypto';
import { ProjectStore } from '../app/server/storage/project-store.js';
import { createEmptyProject } from '../app/server/services/project-factory.js';
import { generateReview, generateScripts, generateTopics, generateTopviewPackages, topviewManualChecklist } from '../app/server/services/generators.js';
import { readJsonConfig, type ScoringConfig, type WorkflowConfig } from '../app/server/services/config.js';
import { projectSchema } from '../app/server/schemas/project.js';

const projectRoot=path.resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);const arg=(name:string)=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const dataDir=path.resolve(projectRoot,arg('--data-dir')??'data');
const configDir=path.join(projectRoot,'config');
const [workflow,scoring]=await Promise.all([readJsonConfig<WorkflowConfig>(configDir,'workflow.json'),readJsonConfig<ScoringConfig>(configDir,'scoring.json')]);
const store=new ProjectStore(dataDir);await store.initialize();
const id='demo-problem-solving-product';
if(await store.exists(id)){
  if(!args.includes('--refresh')){console.log(JSON.stringify({ok:true,id,existing:true}));process.exit(0);}
  const existing=await store.read(id),taskTemplate=createEmptyProject({name:existing.name,projectType:existing.projectType,platforms:existing.goals.platforms,dataClass:'demo'},workflow,'refresh-template');
  existing.products=existing.products.map((product,index)=>({...product,materialIds:index===0?existing.materials.map((material)=>material.id):product.materialIds}));
  existing.topviewPackages=existing.topviewPackages.map((item)=>({...item,exportChecklist:topviewManualChecklist,completedChecklist:item.completedChecklist.filter((label)=>topviewManualChecklist.includes(label))}));
  existing.manualTasks=taskTemplate.manualTasks.map((task)=>{const old=existing.manualTasks.find((item)=>item.label===task.label);return old?{...task,completed:old.completed,updatedAt:old.updatedAt}:task;});
  existing.publications=existing.publications.map((publication)=>({...publication,topicId:publication.topicId??existing.topics[0]?.id??null,productId:publication.productId??existing.products[0]?.id??null}));
  await store.save(projectSchema.parse(existing),existing.revision);console.log(JSON.stringify({ok:true,id,existing:true,refreshed:true}));process.exit(0);
}
const p=createEmptyProject({name:'演示-问题解决型好物视频',projectType:'问题解决型好物视频',platforms:['douyin','xiaohongshu'],dataClass:'demo'},workflow,id);
p.goals={...p.goals,region:'中国',language:'中文',currentFollowers:3200,weeklyPosts:4,budgetMinor:30000,hasPhysicalProduct:true,hasProductLink:true,monetizationMethods:['商品带货','视频代制作'],growthWeight:.6,monetizationWeight:.4};
p.positioning={accountName:'生活问题解决局',statement:'用可验证的小工具，解决每天反复出现的麻烦',audience:'重视效率和真实体验的城市家庭',corePain:'日常工具看起来相似，难以判断是否真能解决问题',promise:'只展示素材能证明的操作和适用边界',style:'干净、真实、快节奏但不过度推销',avatar:'中性可信的AI讲解人物（明确AI标记）',series:['30秒解决一个日常麻烦','买前先看判断标准'],languages:['中文'],prohibitedContent:['伪造实测','绝对化效果','冒充真实用户']};
p.sources=[{id:crypto.randomUUID(),label:'虚拟保温杯演示简报',fileName:'demo-brief.md',capturedAt:new Date().toISOString(),originalText:'虚拟产品，仅用于系统演示。卖点、价格和经营数据均非真实。',summary:'构造一个可验证工作流的非真实保温杯示例。',verification:'user_fact',authorization:'owned'}];
const productId=crypto.randomUUID();
p.products=[{id:productId,name:'恒温随行杯（虚拟演示产品）',brand:'DemoLab',category:'家居/随行杯',link:'',priceMinor:12900,commissionMinor:2580,marginPercent:32,audience:'通勤、带娃和居家办公人群',painPoints:['忙起来忘记喝水，温度下降后口感差','普通杯盖清洁死角多'],sellingPoints:['旋拧杯盖可拆洗，操作步骤清晰','杯身窄口适配常见车载杯架','演示只说明结构与操作，不声称未验证保温时长'],competitors:['普通按压杯（仅作结构比较）'],risks:['保温时长尚未实测，不得使用“24小时保温”确定性表述'],evidenceIds:[p.sources[0].id],materialIds:[],parameters:{容量:'420ml（演示）',杯盖:'可拆洗结构'},status:'active'}];
p.materials=[{id:crypto.randomUUID(),name:'虚拟保温杯产品示意图',type:'image',source:'项目内演示矢量图',authorization:'owned',uploadedAt:new Date().toISOString(),isOriginal:true,commercialUseAllowed:false,aiAnalysis:'演示用产品轮廓；不代表真实商品。',url:'/demo-thumbnail.svg'}];
p.topics=generateTopics(p,scoring);p.scripts=generateScripts(p);p.topviewPackages=generateTopviewPackages(p);
const publishedAt=new Date(Date.now()-7*86_400_000);
p.publications=[{id:'pub-demo-001',videoId:'video-demo-001',platform:'douyin',plannedAt:publishedAt.toISOString(),actualAt:publishedAt.toISOString(),title:'保温杯别急着买：先看这三个可拆洗细节',tags:['问题解决','家居好物','演示项目'],productLink:'',status:'published',aiDisclosure:true,commercialDisclosure:true,videoLink:'',topicId:p.topics[0].id,productId,experimentId:null,variant:'none'}];
const checkpoints=['custom','custom','custom','custom','custom','custom','7d'] as const;
const rows=[
  [82000,12600,7800,4100,560,88,146,220,190,820,460,260,36,5,9800],
  [146000,23800,15000,8200,1120,176,280,420,360,1460,820,480,68,9,23600],
  [218000,36100,23000,13100,1800,250,410,620,570,2310,1270,760,108,15,46800],
  [301000,48700,31800,18100,2480,340,560,830,760,3260,1810,1080,148,21,71200],
  [396000,61200,40500,23400,3190,430,720,1020,940,4280,2390,1420,201,28,101500],
  [482000,74400,50100,29200,4020,535,900,1240,1160,5420,3020,1820,260,35,134900],
  [558000,86400,59200,35100,4860,640,1080,1460,1370,6480,3620,2210,324,42,168800]
];
p.metrics=rows.map((r,index)=>{const through=new Date(publishedAt.getTime()+(index+1)*86_400_000).toISOString();return {id:`metric-demo-${index+1}`,videoId:'video-demo-001',publicationId:'pub-demo-001',platform:'douyin',checkpoint:checkpoints[index],valueMode:'cumulative_since_publish' as const,publishedAt:publishedAt.toISOString(),dataThroughAt:through,capturedAt:through,sourceMode:'manual' as const,completeness:'complete' as const,currency:'CNY',values:{impressions:r[0],views:r[1],threeSecondViews:r[2],averageWatchSeconds:13.8,totalWatchSeconds:r[1]*13.8,completions:r[3],likes:r[4],comments:r[5],shares:r[6],saves:r[7],followersGained:r[8],profileVisits:r[9],linkClicks:r[10],productClicks:r[11],addToCarts:r[12],orders:r[13],gmvMinor:r[13]*12900,commissionMinor:r[13]*2580,refundsMinor:6400,productionCostMinor:22000,adCostMinor:30000,actualRevenueMinor:r[14]}};});
p.reviews=[generateReview(p)];p.experiments=[{id:crypto.randomUUID(),name:'首句钩子A/B',hypothesis:'直接呈现清洁死角比泛化问题更能提高3秒留存',primaryVariable:'首句钩子',control:p.scripts[0].hooks[0],variant:p.scripts[0].hooks[1],metric:'threeSecondRetentionRate',winningCriterion:'每版播放≥500且相对提升≥10%',status:'planned'}];
p.workflow=p.workflow.map((step,index)=>({...step,state:index<7?'completed':index===7?'waiting_manual':index===9?'completed':'in_progress'}));p.stage='quality';p.currentWizardStep=10;p.manualTasks=p.manualTasks.map((t,index)=>({...t,completed:index>=1&&index<=2}));p.qualityChecks=p.qualityChecks.map((q)=>({...q,status:q.label==='虚假实测'?'risk':'pass',note:q.label==='虚假实测'?'保温时长未实测，必须删除“24小时保温”表述':'演示检查已完成'}));p.risks=['保温时长未实测，发布前必须使用合规改写'];p.unverified=['具体保温时长','真实用户评价','真实销量'];p.summary='虚拟保温杯问题解决型视频演示，包含4个选题、3类脚本、Topview制作包、7天累计数据、复盘和单变量实验。';
await store.create(projectSchema.parse(p));console.log(JSON.stringify({ok:true,id,existing:false,dataDir}));

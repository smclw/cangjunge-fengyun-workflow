import type { Project, MetricSnapshot } from '../schemas/project.js';
import { aggregateMetricValues, calculateKpis, selectLatestSnapshots } from './kpis.js';

export function buildDashboard(project: Project, days = 7, custom?:{from:string;to:string}) {
  const periodEnd=custom?new Date(`${custom.to}T23:59:59.999Z`).getTime():Date.now();
  const cutoff=custom?new Date(`${custom.from}T00:00:00.000Z`).getTime():periodEnd-days*86_400_000;
  const inRange = project.metrics.filter((snapshot) => {const time=new Date(snapshot.dataThroughAt).getTime();return time>=cutoff&&time<=periodEnd;});
  const source = inRange;
  const aggregate = aggregateMetricValues(source);
  const values = aggregate.values;
  const kpis = calculateKpis(values);
  const trend = [...new Set(source.map((snapshot)=>snapshot.dataThroughAt))].sort().map((fullDate) => {
    const current=aggregateMetricValues(project.metrics.filter((snapshot)=>snapshot.dataThroughAt<=fullDate)).values;
    return {date:fullDate.slice(5,10),fullDate,views:current.views??0,followers:current.followersGained??0,
      engagement:sumValues(current,['likes','comments','shares','saves']),clicks:current.linkClicks??0,
      orders:current.orders??0,revenueMinor:current.actualRevenueMinor??0};
  });
  const engagement = sumNullable(values,['likes','comments','shares','saves']);
  const funnelBase = [
    ['曝光',values.impressions],['播放',values.views],['互动',engagement],['主页访问',values.profileVisits],['点击',values.linkClicks],['加购',values.addToCarts],['成交',values.orders]
  ] as const;
  const funnel = funnelBase.map(([label,value],index) => ({
    label, value, conversion: index === 0 ? (value === null ? null : 1) : ratio(value,funnelBase[index-1][1])
  }));
  const videoPerformance = latestByVideo(source).map((snapshot) => {
    const publication = project.publications.find((p)=>p.videoId===snapshot.videoId);
    const videoKpis = calculateKpis(snapshot.values);
    return { videoId:snapshot.videoId,title:publication?.title ?? snapshot.videoId,platform:snapshot.platform,publishedAt:snapshot.publishedAt,
      views:snapshot.values.views ?? 0,followers:snapshot.values.followersGained ?? 0,revenueMinor:snapshot.values.actualRevenueMinor ?? 0,
      completionRate:videoKpis.completionRate,clickThroughRate:videoKpis.clickThroughRate,conversionRate:videoKpis.conversionRate,
      thumbnail:'/demo-thumbnail.svg' };
  }).sort((a,b)=>b.revenueMinor-a.revenueMinor || b.views-a.views);
  const latestReview = project.reviews.at(-1);
  return {
    project: { id:project.id,name:project.name,dataClass:project.dataClass,demoNotice:project.demoNotice,updatedAt:project.updatedAt,currency:project.currency },
    periodDays:custom?Math.max(1,Math.ceil((periodEnd-cutoff)/86_400_000)):days,periodFrom:new Date(cutoff).toISOString().slice(0,10),periodTo:new Date(periodEnd).toISOString().slice(0,10),
    kpis: { published:project.publications.filter((p)=>{const time=new Date(p.actualAt??p.plannedAt).getTime();return p.status==='published'&&time>=cutoff&&time<=periodEnd;}).length,followers:values.followersGained,orders:values.orders,revenueMinor:values.actualRevenueMinor,...kpis },
    trend, funnel, warnings:aggregate.warnings,
    topics:[...project.topics].sort((a,b)=>b.compositeScore-a.compositeScore).slice(0,5),
    manualTasks:project.manualTasks,
    aiTasks:[
      {label:'趋势研究',done:project.sources.some((s)=>Boolean(s.url))},{label:'产品分析',done:project.products.length>0},{label:'选题生成',done:project.topics.length>0},
      {label:'脚本生成',done:project.scripts.length>=3},{label:'Topview提示词',done:project.topviewPackages.length>0},{label:'标题文案',done:project.topics.length>0},
      {label:'标签建议',done:project.topics.length>0},{label:'数据诊断',done:project.reviews.length>0}
    ],
    workflow:project.workflow,bestVideo:videoPerformance[0] ?? null,videoPerformance,
    review:latestReview ?? null, dataQuality:{selectedSnapshots:selectLatestSnapshots(source).length,sourceSnapshots:source.length,warnings:aggregate.warnings}
  };
}

function sumValues(values:MetricSnapshot['values'],keys:Array<keyof MetricSnapshot['values']>):number {
  return keys.reduce((sum,key)=>sum+Number(values[key]??0),0);
}
function sumNullable(values: MetricSnapshot['values'], keys: Array<keyof MetricSnapshot['values']>): number|null {
  const items=keys.map((key)=>values[key]); return items.some((item)=>item===null)?null:items.reduce<number>((sum,item)=>sum+Number(item),0);
}
function ratio(a:number|null,b:number|null):number|null { return a===null||b===null||b===0?null:a/b; }
function latestByVideo(snapshots: MetricSnapshot[]): MetricSnapshot[] {
  const map=new Map<string,MetricSnapshot>();
  for(const snapshot of snapshots){const key=`${snapshot.videoId}:${snapshot.platform}`;const current=map.get(key);if(!current||snapshot.dataThroughAt>current.dataThroughAt||(snapshot.dataThroughAt===current.dataThroughAt&&snapshot.capturedAt>current.capturedAt))map.set(key,snapshot);}
  return [...map.values()];
}

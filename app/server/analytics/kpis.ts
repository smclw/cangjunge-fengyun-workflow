import type { MetricSnapshot, MetricValues } from '../schemas/project.js';
import defaultKpiConfig from '../../../config/kpis.json' with { type: 'json' };

export interface CalculatedKpis {
  threeSecondRetentionRate: number | null;
  completionRate: number | null;
  engagementRate: number | null;
  shareRate: number | null;
  saveRate: number | null;
  followerRate: number | null;
  profileVisitRate: number | null;
  clickThroughRate: number | null;
  addToCartRate: number | null;
  conversionRate: number | null;
  revenuePerThousandViews: number | null;
  costPerFollower: number | null;
  costPerOrder: number | null;
  netProfitMinor: number | null;
  roi: number | null;
}

type Key = keyof MetricValues;

function sumRequired(values: MetricValues, keys: Key[]): number | null {
  const items = keys.map((key) => values[key]);
  return items.some((value) => value === null) ? null : items.reduce<number>((sum, value) => sum + Number(value), 0);
}

function divide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

interface Formula {id:string;op:string;numerator:Key[];denominator?:Key;denominatorSum?:Key[];subtract?:Key[];}
interface KpiConfig {formulas:Formula[];}
export function calculateKpis(values: MetricValues, config:KpiConfig=defaultKpiConfig as KpiConfig): CalculatedKpis {
  const output:Record<string,number|null>={};
  for(const formula of config.formulas){
    const numerator=sumRequired(values,formula.numerator);
    const denominator=formula.denominator?values[formula.denominator]:formula.denominatorSum?sumRequired(values,formula.denominatorSum):null;
    if(formula.op==='subtract'){
      const subtract=formula.subtract?sumRequired(values,formula.subtract):0;
      output[formula.id]=numerator===null||subtract===null?null:numerator-subtract;
    }else if(formula.op==='perThousand'){
      output[formula.id]=divide(numerator,denominator);if(output[formula.id]!==null)output[formula.id]=Number(output[formula.id])*1000;
    }else if(['divide','sumDivide','divideSum'].includes(formula.op))output[formula.id]=divide(numerator,denominator);
    else throw new Error(`未知KPI运算：${formula.op}`);
  }
  return output as unknown as CalculatedKpis;
}

export function selectLatestSnapshots(snapshots: MetricSnapshot[]): MetricSnapshot[] {
  const latest = new Map<string, MetricSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.videoId}:${snapshot.platform}`;
    const existing = latest.get(key);
    if (!existing || snapshot.dataThroughAt > existing.dataThroughAt || (snapshot.dataThroughAt === existing.dataThroughAt && snapshot.capturedAt > existing.capturedAt)) {
      latest.set(key, snapshot);
    }
  }
  return [...latest.values()];
}

export function aggregateMetricValues(snapshots: MetricSnapshot[]): { values: MetricValues; warnings: string[] } {
  const selected = selectLatestSnapshots(snapshots);
  const warnings = analyzeMetricDataQuality(snapshots);
  const currencies = new Set(selected.map((snapshot) => snapshot.currency));
  if (currencies.size > 1) warnings.push('不同币种已分开记录，不能直接汇总金额');
  const keys: Key[] = ['impressions','views','threeSecondViews','averageWatchSeconds','totalWatchSeconds','completions','likes','comments','shares','saves','followersGained','profileVisits','linkClicks','productClicks','addToCarts','orders','gmvMinor','commissionMinor','refundsMinor','productionCostMinor','adCostMinor','actualRevenueMinor'];
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as unknown as MetricValues;
  for (const key of keys) {
    const amounts = selected.map((snapshot) => snapshot.values[key]);
    if (amounts.length === 0 || amounts.some((value) => value === null) || (currencies.size > 1 && key.toLowerCase().includes('minor'))) {
      result[key] = null;
    } else if (key === 'averageWatchSeconds') {
      const canWeight = selected.every((snapshot) => snapshot.values.totalWatchSeconds !== null && snapshot.values.views !== null);
      result[key] = canWeight
        ? divide(selected.reduce((sum, s) => sum + Number(s.values.totalWatchSeconds), 0), selected.reduce((sum, s) => sum + Number(s.values.views), 0))
        : amounts.reduce<number>((sum, value) => sum + Number(value), 0) / amounts.length;
    } else {
      result[key] = amounts.reduce<number>((sum, value) => sum + Number(value), 0);
    }
  }
  return { values: result, warnings };
}

export function analyzeMetricDataQuality(snapshots: MetricSnapshot[]): string[] {
  const warnings:string[]=[];
  const ids=new Set<string>();
  for(const snapshot of snapshots){if(ids.has(snapshot.id))warnings.push(`重复快照ID：${snapshot.id}`);ids.add(snapshot.id);if(snapshot.completeness==='partial')warnings.push(`视频 ${snapshot.videoId} 的 ${snapshot.checkpoint} 快照标记为部分数据`);}
  const platforms=new Set(snapshots.map((snapshot)=>snapshot.platform));
  if(platforms.size>1)warnings.push('不同平台指标定义可能不同，平台对比仅作方向参考');
  const cumulativeKeys:Array<keyof MetricValues>=['impressions','views','threeSecondViews','totalWatchSeconds','completions','likes','comments','shares','saves','followersGained','profileVisits','linkClicks','productClicks','addToCarts','orders','gmvMinor','commissionMinor','refundsMinor','productionCostMinor','adCostMinor','actualRevenueMinor'];
  const groups=new Map<string,MetricSnapshot[]>();
  for(const snapshot of snapshots){const key=`${snapshot.videoId}:${snapshot.platform}`;groups.set(key,[...(groups.get(key)??[]),snapshot]);}
  for(const [key,items] of groups){const ordered=[...items].sort((a,b)=>a.dataThroughAt.localeCompare(b.dataThroughAt)||a.capturedAt.localeCompare(b.capturedAt));for(let index=1;index<ordered.length;index++){for(const metricKey of cumulativeKeys){const before=ordered[index-1].values[metricKey],after=ordered[index].values[metricKey];if(before!==null&&after!==null&&after<before){warnings.push(`${key} 的累计字段 ${metricKey} 在 ${ordered[index].checkpoint} 下降`);break;}}}}
  return [...new Set(warnings)];
}

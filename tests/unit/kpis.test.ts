import { describe,expect,it } from 'vitest';
import { aggregateMetricValues, analyzeMetricDataQuality, calculateKpis, selectLatestSnapshots } from '../../app/server/analytics/kpis.js';
import { emptyValues, metric } from '../helpers.js';

describe('KPI 口径',()=>{
  it('按集中定义计算全部核心指标',()=>{
    const result=calculateKpis(emptyValues({views:1000,threeSecondViews:600,completions:250,likes:50,comments:20,shares:10,saves:20,followersGained:25,profileVisits:100,linkClicks:80,productClicks:50,addToCarts:10,orders:5,actualRevenueMinor:10000,refundsMinor:500,productionCostMinor:1000,adCostMinor:2000}));
    expect(result).toMatchObject({threeSecondRetentionRate:.6,completionRate:.25,engagementRate:.1,shareRate:.01,saveRate:.02,followerRate:.025,profileVisitRate:.1,clickThroughRate:.08,addToCartRate:.2,conversionRate:.1,revenuePerThousandViews:10000,costPerFollower:120,costPerOrder:600,netProfitMinor:6500,roi:10/3});
  });
  it('分母为零或字段未知时返回 null，而不是报错',()=>{
    const zero=calculateKpis(emptyValues({views:0,followersGained:0,orders:0,productClicks:0,productionCostMinor:0,adCostMinor:0}));
    expect(zero.threeSecondRetentionRate).toBeNull();expect(zero.costPerFollower).toBeNull();expect(zero.roi).toBeNull();
  });
  it('同一视频只取最新累计快照，跨视频汇总分子分母',()=>{
    const early=metric('m1','v1','2026-07-10T02:00:00.000Z',{views:100,followersGained:2});
    const latest=metric('m2','v1','2026-07-11T00:00:00.000Z',{views:500,followersGained:20});
    const other=metric('m3','v2','2026-07-11T00:00:00.000Z',{views:300,followersGained:15});
    expect(selectLatestSnapshots([early,latest,other]).map((x)=>x.id).sort()).toEqual(['m2','m3']);
    const total=aggregateMetricValues([early,latest,other]);expect(total.values.views).toBe(800);expect(total.values.followersGained).toBe(35);
  });
  it('币种混合时拒绝汇总金额',()=>{
    const cny=metric('m1','v1','2026-07-11T00:00:00.000Z',{views:100,actualRevenueMinor:1000});
    const usd={...metric('m2','v2','2026-07-11T00:00:00.000Z',{views:100,actualRevenueMinor:500}),currency:'USD'} as typeof cny;
    const result=aggregateMetricValues([cny,usd]);expect(result.values.actualRevenueMinor).toBeNull();expect(result.warnings[0]).toContain('不同币种');
  });
  it('识别重复、部分数据、跨平台与累计值下降',()=>{const early=metric('same','v1','2026-07-10T02:00:00.000Z',{views:100});const later={...metric('same','v1','2026-07-11T00:00:00.000Z',{views:90},'xiaohongshu'),completeness:'partial'} as typeof early;const warnings=analyzeMetricDataQuality([early,later]);expect(warnings.some((x)=>x.includes('重复快照ID'))).toBe(true);expect(warnings.some((x)=>x.includes('部分数据'))).toBe(true);expect(warnings.some((x)=>x.includes('不同平台'))).toBe(true);});
});

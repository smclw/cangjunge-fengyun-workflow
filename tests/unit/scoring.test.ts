import fs from 'node:fs/promises';
import path from 'node:path';
import { describe,expect,it } from 'vitest';
import { calculateTopicScore } from '../../app/server/analytics/scoring.js';
import type { ScoringConfig } from '../../app/server/services/config.js';
const config=JSON.parse(await fs.readFile(path.resolve('config/scoring.json'),'utf8')) as ScoringConfig;
const growth=Object.fromEntries(Object.entries(config.growth).map(([key,max])=>[key,max]));
const monetization=Object.fromEntries(Object.entries(config.monetization).map(([key,max])=>[key,max]));
describe('选题评分',()=>{
  it('满分在无风险时按权重得到100',()=>{expect(calculateTopicScore({growth,monetization,risks:{},weights:{growth:.6,monetization:.4}},config)).toMatchObject({growthScore:100,monetizationScore:100,riskPenalty:0,compositeScore:100,publishBlocked:false});});
  it('风险按配置扣分且硬阻断发布',()=>{const result=calculateTopicScore({growth,monetization,risks:{falseAdvertising:true,missingEvidence:3},weights:{growth:.5,monetization:.5}},config);expect(result.compositeScore).toBe(91);expect(result.publishBlocked).toBe(true);});
  it('拒绝超范围评分和权重不等于1',()=>{expect(()=>calculateTopicScore({growth:{...growth,pain:99},monetization,risks:{},weights:{growth:.6,monetization:.4}},config)).toThrow(/pain/);expect(()=>calculateTopicScore({growth,monetization,risks:{},weights:{growth:.6,monetization:.5}},config)).toThrow(/权重/);});
});

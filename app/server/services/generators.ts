import crypto from 'node:crypto';
import type { Project, Script, Topic } from '../schemas/project.js';
import type { ScoringConfig } from './config.js';
import { calculateTopicScore } from '../analytics/scoring.js';
import { aggregateMetricValues, calculateKpis } from '../analytics/kpis.js';
import diagnosticsConfig from '../../../config/diagnostics.json' with { type: 'json' };
import complianceConfig from '../../../config/compliance.json' with { type: 'json' };

const now = () => new Date().toISOString();
export const topviewManualChecklist=['登录Topview','新建项目','按顺序上传素材','粘贴提示词','导入口播脚本','检查场景','删除无关素材','替换错误产品图','核对Logo和包装','选择人物和声音','设置9:16','先生成预览','检查前两秒','检查虚假画面','经确认后生成正式版','下载到项目目录'];

export function generateTopics(project: Project, scoring: ScoringConfig): Topic[] {
  if (!project.products.length) throw Object.assign(new Error('请先录入至少一个产品'), { status: 400, code: 'PRODUCT_REQUIRED' });
  return project.products.flatMap((product)=>{
    const ideas = [
    { name: `${product.name}解决${product.painPoints[0] ?? '日常麻烦'}的三个细节`, type: '问题解决', angle: '先呈现麻烦，再用一个可验证动作展示解决过程', scores: [18,17,13,13,9,8,9,18,13,12,14,9,9,8,4] },
    { name: `别急着买${product.name}：先看这三个判断标准`, type: '信任清单', angle: '用适用边界和选择标准建立信任，不做绝对承诺', scores: [16,12,14,14,10,8,10,14,10,10,15,9,10,10,5] },
    { name: `${product.name}前后30秒场景对比`, type: '场景对比', angle: '只展示可由素材证明的操作变化，不伪造效果', scores: [18,20,14,12,8,8,8,17,15,11,14,9,8,8,4] },
    { name: `${product.name}最容易被忽略的使用误区`, type: '避坑教育', angle: '用错误动作与正确动作对照，强调证据和限制', scores: [17,14,13,13,10,9,9,13,12,8,15,9,10,9,5] }
  ];
    return ideas.map((idea, index) => {
    const s = idea.scores;
    const growth = { pain:s[0], visualContrast:s[1], curiosity:s[2], audienceBreadth:s[3], saveShareValue:s[4], freshness:s[5], seriesPotential:s[6] };
    const monetization = { purchaseIntent:s[7], demonstrability:s[8], margin:s[9], audienceFit:s[10], purchaseEase:s[11], trustCompliance:s[12], longTermValue:s[13], differentiation:s[14] };
    const evidence=project.sources.filter((source)=>product.evidenceIds.includes(source.id));
    const usableEvidence=evidence.some((source)=>['user_fact','public_verified'].includes(source.verification)&&['owned','licensed'].includes(source.authorization));
    const claimText=[product.name,...product.sellingPoints,...product.risks].join('；');
    const blockedClaim=complianceConfig.blockedPatterns.some((pattern)=>claimText.includes(pattern));
    const prohibitedSource=project.sources.some((source)=>source.verification==='prohibited'||source.authorization==='prohibited');
    const prohibitedMaterial=project.materials.some((material)=>material.authorization==='prohibited');
    const medicalClaim=/治愈|根治|医疗|减肥|美容功效/.test(claimText);
    const risks = { falseAdvertising:blockedClaim?scoring.risks.falseAdvertising:0, copyright:prohibitedSource||prohibitedMaterial?scoring.risks.copyright:0, medicalClaim:medicalClaim?scoring.risks.medicalClaim:0, supply:0, afterSales:0, price:0, missingEvidence:usableEvidence?0:scoring.risks.missingEvidence, homogeneity:index === 2 ? 1 : 0 };
    const score = calculateTopicScore({ growth, monetization, risks, weights: { growth: project.goals.growthWeight, monetization: project.goals.monetizationWeight } }, scoring);
    const riskDetails:string[]=[];
    if(risks.falseAdvertising)riskDetails.push(`原文：${complianceConfig.blockedPatterns.filter((pattern)=>claimText.includes(pattern)).join('、')}；原因：绝对化或无法证实的宣传；合规改写：改为“以实际使用场景和发布前核验信息为准”；所需证据：可追溯的产品测试或官方证明`);
    if(risks.copyright)riskDetails.push('原文：存在禁止使用的来源或素材；原因：授权状态明确为 prohibited；合规改写：删除该素材并换用自有或已许可内容；所需证据：授权文件或自有版权记录');
    if(risks.medicalClaim)riskDetails.push(`原文：${claimText}；原因：可能构成医疗或功效宣称；合规改写：仅描述可观察的产品功能和适用边界；所需证据：合法有效的资质与对应检测材料`);
    if(risks.missingEvidence)riskDetails.push('原文：当前卖点；原因：未关联可核实且获授权的证据；合规改写：改为待验证描述，禁止确定性结论；所需证据：用户自有实拍、已许可资料或公开可核实的一手来源');
    if(risks.homogeneity)riskDetails.push('原因：常见前后对比结构同质化风险；合规改写：增加具体场景、判断标准和真实操作细节；所需证据：差异化场景素材');
    return { id: crypto.randomUUID(), name: idea.name, contentType: idea.type, productId: product.id, platform: project.goals.platforms[0] ?? 'douyin', ...score, growthBreakdown: growth, monetizationBreakdown: monetization, risks:riskDetails, angle: idea.angle, status: index === 0 ? 'recommended' : 'draft' };
  });
  });
}

function scriptFor(project: Project, topic: Topic, version: Script['version']): Script {
  const product = project.products.find((item) => item.id === topic.productId)!;
  const pain = product.painPoints[0] ?? '这个日常麻烦';
  const point = product.sellingPoints[0] ?? '使用方式简单';
  const modes = {
    growth: { title: '涨粉版', hook: `如果你也被“${pain}”反复困扰，先别划走。`, body: `我用${product.name}做一个不夸张的现场演示：${point}。重点不是立刻下单，而是记住这三个判断动作。`, cta: '收藏这份判断清单，关注下一条实测边界。' },
    conversion: { title: '成交版', hook: `解决“${pain}”，先看产品能不能把关键动作做简单。`, body: `${product.name}的核心卖点是：${point}。这里只展示现有素材可证明的部分；价格、链接和适用范围请以发布前核验为准。`, cta: '需要这个场景解决方案，可查看商品信息并再次核对价格。' },
    trust: { title: '信任版', hook: `${product.name}不是人人都需要，先看你是否属于这类场景。`, body: `适合经常遇到“${pain}”的人。当前能确认的是：${point}；未提供证据的效果不做承诺。`, cta: '把你的使用场景留言，我会按证据回答是否适合。' }
  } as const;
  const copy = modes[version];
  return {
    id: crypto.randomUUID(), topicId: topic.id, version, title: `${topic.name}｜${copy.title}`, durationSeconds: 28,
    hooks: [copy.hook, `你可能一直用错了${product.name}的第一个步骤。`, `先看这段不剪辑的操作，再决定${product.name}值不值得了解。`],
    narration: `${copy.hook}${copy.body}${copy.cta}`, subtitles: [copy.hook, copy.body, copy.cta],
    shots: [
      { time:'0-3s', visual:`痛点场景：${pain}`, camera:'近景快速切入', subtitle:copy.hook, audio:'轻提示音' },
      { time:'3-9s', visual:`展示${product.name}外观和关键部位`, camera:'稳定推近', subtitle:product.name, audio:'节奏进入' },
      { time:'9-21s', visual:`真实操作：${point}`, camera:'手部与产品同框，避免遮挡包装', subtitle:copy.body, audio:'保留操作声' },
      { time:'21-28s', visual:'适用边界与行动提示', camera:'定镜+文字卡', subtitle:copy.cta, audio:'收束音' }
    ],
    productShots: ['包装正面清晰镜头','关键操作近景','使用后状态（仅限可证明）'], soundEffects: ['开头轻提示','操作声保留'], bgmMood: version === 'conversion' ? '利落、可信' : '轻快、克制', cta: copy.cta,
    prohibitedContent: ['伪造实测','无法证明的绝对化效果','未授权音乐或品牌素材'], requiredMaterials: [`${product.name}正面图`, '关键操作视频', '授权/证据说明'],
    abVariant: 'B版只替换首句钩子，其他镜头、口播、CTA保持不变', createdAt: now()
  };
}

export function generateScripts(project: Project): Script[] {
  if(project.sources.some((source)=>source.verification==='prohibited'||source.authorization==='prohibited')||project.materials.some((material)=>material.authorization==='prohibited'))throw Object.assign(new Error('存在明确禁止使用的来源或素材，不能生成可发布脚本'),{status:400,code:'PROHIBITED_SOURCE'});
  const topic = [...project.topics].filter((item)=>!item.publishBlocked).sort((a,b) => b.compositeScore - a.compositeScore)[0];
  if (!topic) throw Object.assign(new Error('请先生成选题'), { status: 400, code: 'TOPIC_REQUIRED' });
  return (['growth','conversion','trust'] as const).map((version) => scriptFor(project, topic, version));
}

export function generateTopviewPackages(project: Project) {
  if(project.sources.some((source)=>source.verification==='prohibited'||source.authorization==='prohibited')||project.materials.some((material)=>material.authorization==='prohibited'))throw Object.assign(new Error('存在禁止使用的来源或素材，不能生成制作包'),{status:400,code:'PROHIBITED_SOURCE'});
  if (!project.scripts.length) throw Object.assign(new Error('请先生成脚本'), { status: 400, code: 'SCRIPT_REQUIRED' });
  return project.scripts.map((script) => {
    const topic=project.topics.find((item)=>item.id===script.topicId);
    const product = project.products.find((item)=>item.id===topic?.productId);
    const base = `9:16竖屏电商短视频，28秒，产品为${product?.name ?? '当前产品'}。${script.shots.map((s) => `${s.time}:${s.visual}；${s.camera}`).join('；')}。字幕使用简洁中文HTML文字感，包装和Logo不得变形。`;
    return {
      id: crypto.randomUUID(), scriptId: script.id, chinesePrompt: `${base}口播：${script.narration}`, englishPrompt: `Create a 28-second 9:16 product video for ${product?.name ?? 'the product'}. Follow the supplied shot list, keep packaging and logo accurate, use clean pacing, and do not invent product effects. Narration meaning: ${script.narration}`,
      concisePrompt: `9:16，28秒，问题→产品→真实操作→边界→CTA；保持包装文字和产品外观；禁止虚假效果。`, narration: script.narration,
      scenes: script.shots.map((shot) => `${shot.time}｜${shot.visual}｜${shot.camera}`), uploadOrder: ['产品正面图','关键操作视频','Logo/包装参考','场景参考（可选）'],
      avatarSuggestion: project.goals.onCamera ? '真人出镜，动作自然克制' : '中性可信的AI讲解人物；不得冒充真实用户', voiceSuggestion: '自然中文，语速约1.05x，避免促销吼叫',
      subtitleSuggestion: '白字+深蓝半透明底，每行不超过16字，重点词用青色', bgmSuggestion: script.bgmMood, aspectRatio: '9:16', durationSeconds: script.durationSeconds,
      negativePrompt: '错误包装文字、变形Logo、多余手指、漂浮产品、虚假前后对比、绝对化疗效、未授权品牌或音乐、画面乱码', variants: [script.hooks[0], script.hooks[1]],
      exportChecklist: topviewManualChecklist,completedChecklist:[], enteredTopview:false, createdAt:now()
    };
  });
}

export function generateReview(project: Project,scope?:{videoId?:string;platform?:string;days?:number}) {
  const cutoff=scope?.days?Date.now()-scope.days*86_400_000:0;
  const metrics=project.metrics.filter((metric)=>(!scope?.videoId||metric.videoId===scope.videoId)&&(!scope?.platform||metric.platform===scope.platform)&&new Date(metric.dataThroughAt).getTime()>=cutoff);
  const aggregate = aggregateMetricValues(metrics);
  const values = aggregate.values;
  const kpis = calculateKpis(values);
  const views = values.views ?? 0;
  let conclusion = '数据样本不足，先补齐至少24小时累计数据。';
  let primaryVariable = '数据完整性';
  let nextTest = '保持内容不变，补录同一视频的24小时累计快照。';
  let confidence: 'insufficient_data' | 'directional' | 'supported' = 'insufficient_data';
  if (views >= diagnosticsConfig.minimumSamples.rateViews) {
    confidence = views >= diagnosticsConfig.minimumSamples.followViews ? 'supported' : 'directional';
    if (kpis.threeSecondRetentionRate !== null && kpis.threeSecondRetentionRate < diagnosticsConfig.fallbackThresholds.threeSecondRetentionRate) {
      conclusion = '主要漏损发生在前三秒，当前应先优化首帧和第一句。'; primaryVariable = '首句钩子'; nextTest = '只替换首句钩子，其他画面、时长、CTA和发布时间保持不变。';
    } else if (kpis.completionRate !== null && kpis.completionRate < diagnosticsConfig.fallbackThresholds.completionRate) {
      conclusion = '前三秒尚可，但中后段完播偏低，优先压缩冗余信息。'; primaryVariable = '中段节奏'; nextTest = '只把产品证明段缩短3秒，其他元素保持不变。';
    } else if (views >= diagnosticsConfig.minimumSamples.followViews && (values.followersGained ?? 0) === 0) {
      conclusion = '播放已有样本但未带来关注，账号承诺或系列价值不清晰。'; primaryVariable = '关注CTA'; nextTest = '只替换关注CTA为明确的系列承诺。';
    } else if ((values.productClicks ?? 0) >= diagnosticsConfig.minimumSamples.productClicks && (values.orders ?? 0) === 0) {
      conclusion = '有商品点击但无订单，优先检查价格、链接、证据和商品匹配。'; primaryVariable = '信任证据'; nextTest = '只增加一个可核实的产品证据卡，其他元素保持不变。';
    } else {
      conclusion = '当前漏斗未出现单一异常断点，可围绕最佳钩子做单变量复测。'; primaryVariable = '首句钩子'; nextTest = '只测试A/B首句，保持受众、产品、时长和CTA一致。';
    }
  }
  return {
    id: crypto.randomUUID(), period: `${scope?.videoId?`视频 ${scope.videoId}`:scope?.platform?`平台 ${scope.platform}`:'全项目'}｜${scope?.days?`${scope.days}天内更新的最新累计快照`:'全部最新累计快照'}（非期间增量）`, conclusion, anomalies: aggregate.warnings,
    likelyCauses: [conclusion.replace('主要漏损发生在', '可能与')], effectiveElements: ['产品和使用场景保持一致'], ineffectiveElements: confidence === 'insufficient_data' ? ['数据不足，暂不判定'] : [primaryVariable],
    nextTest, keepConstant: ['产品','目标受众','视频时长','CTA（非本轮变量时）'], primaryVariable, winningCriterion: `目标指标相对对照版本提升至少${Math.round(diagnosticsConfig.relativeThresholds.minimumLift*100)}%，且样本量达到配置门槛`, confidence, createdAt: now()
  };
}

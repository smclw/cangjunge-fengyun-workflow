import { z } from 'zod';

export const safeIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/);
const isoDate = z.string().datetime({ offset: true });
const nullableCount = z.number().int().nonnegative().nullable().default(null);
const nullableNumber = z.number().nonnegative().nullable().default(null);
const assetUrlSchema=z.union([z.string().url(),z.string().regex(/^\/[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]+$/)]);

export const evidenceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url().optional(),
  fileName: z.string().optional(),
  capturedAt: isoDate,
  originalText: z.string().default(''),
  summary: z.string().default(''),
  verification: z.enum(['user_fact', 'public_verified', 'ai_inference', 'unverified', 'prohibited']),
  authorization: z.enum(['owned', 'licensed', 'public_reference_only', 'unknown', 'prohibited']).default('unknown'),
  sha256: z.string().optional()
}).strict();

export const materialSchema = z.object({
  id: z.string(),
  name: z.string(),
  storedName: z.string().optional(),
  type: z.enum(['image', 'video', 'logo', 'document', 'spreadsheet', 'link', 'review', 'competitor', 'other']),
  source: z.string(),
  authorization: z.enum(['owned', 'licensed', 'public_reference_only', 'unknown', 'prohibited']),
  uploadedAt: isoDate,
  isOriginal: z.boolean(),
  commercialUseAllowed: z.boolean(),
  aiAnalysis: z.string().default('尚未分析'),
  size: z.number().int().nonnegative().optional(),
  sha256: z.string().optional(),
  url: assetUrlSchema.optional()
}).strict();

export const productSchema = z.object({
  id: z.string(), name: z.string().min(1), brand: z.string().default(''), category: z.string().default(''),
  link: z.string().default(''), priceMinor: nullableCount, commissionMinor: nullableCount, marginPercent: nullableNumber,
  audience: z.string().default(''), painPoints: z.array(z.string()).default([]), sellingPoints: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]), risks: z.array(z.string()).default([]), evidenceIds: z.array(z.string()).default([]), materialIds:z.array(z.string()).default([]),parameters:z.record(z.string(),z.string()).default({}),
  status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft')
}).strict();

const scoreBreakdownSchema = z.record(z.string(), z.number().min(0));
export const topicSchema = z.object({
  id: z.string(), name: z.string().min(1), contentType: z.string(), productId: z.string(), platform: z.string(),
  growthScore: z.number().min(0).max(100), monetizationScore: z.number().min(0).max(100), riskPenalty: z.number().min(0).max(30),
  compositeScore: z.number().min(-30).max(100), growthBreakdown: scoreBreakdownSchema, monetizationBreakdown: scoreBreakdownSchema,
  risks: z.array(z.string()).default([]), publishBlocked: z.boolean().default(false), angle: z.string(),
  status: z.enum(['draft', 'recommended', 'selected', 'scripted', 'archived']).default('draft')
}).strict();

const shotSchema = z.object({ time: z.string(), visual: z.string(), camera: z.string(), subtitle: z.string(), audio: z.string() }).strict();
export const scriptSchema = z.object({
  id: z.string(), topicId: z.string(), version: z.enum(['growth', 'conversion', 'trust']), title: z.string(), durationSeconds: z.number().min(10).max(180),
  hooks: z.array(z.string()).min(3), narration: z.string(), subtitles: z.array(z.string()), shots: z.array(shotSchema), productShots: z.array(z.string()),
  soundEffects: z.array(z.string()), bgmMood: z.string(), cta: z.string(), prohibitedContent: z.array(z.string()), requiredMaterials: z.array(z.string()),
  abVariant: z.string(), createdAt: isoDate
}).strict();

export const topviewPackageSchema = z.object({
  id: z.string(), scriptId: z.string(), chinesePrompt: z.string(), englishPrompt: z.string(), concisePrompt: z.string(), narration: z.string(),
  scenes: z.array(z.string()), uploadOrder: z.array(z.string()), avatarSuggestion: z.string(), voiceSuggestion: z.string(), subtitleSuggestion: z.string(),
  bgmSuggestion: z.string(), aspectRatio: z.string(), durationSeconds: z.number(), negativePrompt: z.string(), variants: z.array(z.string()),
  exportChecklist: z.array(z.string()), completedChecklist:z.array(z.string()).default([]), enteredTopview: z.boolean().default(false), createdAt: isoDate
}).strict();

export const metricValuesSchema = z.object({
  impressions: nullableCount, views: nullableCount, threeSecondViews: nullableCount, averageWatchSeconds: nullableNumber,
  totalWatchSeconds: nullableNumber, completions: nullableCount, likes: nullableCount, comments: nullableCount, shares: nullableCount,
  saves: nullableCount, followersGained: nullableCount, profileVisits: nullableCount, linkClicks: nullableCount,
  productClicks: nullableCount, addToCarts: nullableCount, orders: nullableCount, gmvMinor: nullableCount, commissionMinor: nullableCount,
  refundsMinor: nullableCount, productionCostMinor: nullableCount, adCostMinor: nullableCount, actualRevenueMinor: nullableCount
}).strict().superRefine((value, ctx) => {
  if (value.views !== null && value.threeSecondViews !== null && value.threeSecondViews > value.views) {
    ctx.addIssue({ code: 'custom', message: '3秒播放不能大于播放量', path: ['threeSecondViews'] });
  }
  if (value.views !== null && value.completions !== null && value.completions > value.views) {
    ctx.addIssue({ code: 'custom', message: '完播量不能大于播放量', path: ['completions'] });
  }
});

export const metricSnapshotSchema = z.object({
  id: z.string(), videoId: z.string(), publicationId: z.string(), platform: z.string(),
  checkpoint: z.enum(['2h', '24h', '72h', '7d', '30d', 'custom']), valueMode: z.literal('cumulative_since_publish'),
  publishedAt: isoDate, dataThroughAt: isoDate, capturedAt: isoDate, sourceMode: z.enum(['manual', 'platform_export']),
  completeness: z.enum(['complete', 'partial']), currency: z.string().length(3), values: metricValuesSchema
}).strict();

export const publicationSchema = z.object({
  id: z.string(), videoId: z.string(), platform: z.string(), plannedAt: isoDate, actualAt: isoDate.nullable().default(null),
  title: z.string(), tags: z.array(z.string()), productLink: z.string().default(''), status: z.enum(['draft', 'planned', 'published', 'paused']),
  aiDisclosure: z.boolean(), commercialDisclosure: z.boolean(), videoLink: z.string().default(''),topicId:z.string().nullable().default(null),productId:z.string().nullable().default(null),experimentId:z.string().nullable().default(null),variant:z.enum(['none','control','variant']).default('none')
}).strict();

export const reviewSchema = z.object({
  id: z.string(), period: z.string(), conclusion: z.string(), anomalies: z.array(z.string()), likelyCauses: z.array(z.string()),
  effectiveElements: z.array(z.string()), ineffectiveElements: z.array(z.string()), nextTest: z.string(), keepConstant: z.array(z.string()),
  primaryVariable: z.string(), winningCriterion: z.string(), confidence: z.enum(['insufficient_data', 'directional', 'supported']), createdAt: isoDate
}).strict();

export const workflowStepSchema = z.object({ id: z.string(), label: z.string(), state: z.enum(['not_started', 'in_progress', 'waiting_manual', 'completed', 'risk']) }).strict();
export const manualTaskSchema = z.object({ id: z.string(), label: z.string(), category: z.enum(['topview', 'publishing', 'data']), completed: z.boolean(), updatedAt: isoDate }).strict();

export const projectSchema = z.object({
  schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), id: safeIdSchema, name: z.string().min(1).max(120),
  projectType: z.string().default('问题解决型好物视频'), dataClass: z.enum(['demo', 'real']), demoNotice: z.string().default(''),
  status: z.enum(['active', 'paused', 'archived']).default('active'), stage: z.string().default('initialize'), currentWizardStep: z.number().int().min(0).max(10).default(0),
  createdAt: isoDate, updatedAt: isoDate, timezone: z.string().default('Australia/Perth'), locale: z.string().default('zh-CN'), currency: z.string().length(3).default('CNY'),
  goals: z.object({ platforms: z.array(z.string()), region: z.string(), language: z.string(), currentFollowers: z.number().int().nonnegative(), weeklyPosts: z.number().int().min(0).max(100), budgetMinor: nullableCount, onCamera: z.boolean(), hasPhysicalProduct: z.boolean(), hasProductLink: z.boolean(), monetizationMethods: z.array(z.string()), growthWeight: z.number().min(0).max(1), monetizationWeight: z.number().min(0).max(1) }).strict(),
  positioning: z.object({ accountName: z.string(), statement: z.string(), audience: z.string(), corePain: z.string(), promise: z.string(), style: z.string(), avatar: z.string(), series: z.array(z.string()), languages: z.array(z.string()), prohibitedContent: z.array(z.string()) }).strict(),
  sources: z.array(evidenceSchema), materials: z.array(materialSchema), products: z.array(productSchema), topics: z.array(topicSchema), scripts: z.array(scriptSchema),
  topviewPackages: z.array(topviewPackageSchema), publications: z.array(publicationSchema), metrics: z.array(metricSnapshotSchema), reviews: z.array(reviewSchema),
  experiments: z.array(z.object({ id: z.string(), name: z.string(), hypothesis: z.string(), primaryVariable: z.string(), control: z.string(), variant: z.string(), metric: z.string(), winningCriterion: z.string(), status: z.enum(['planned', 'running', 'completed', 'cancelled']) }).strict()),
  workflow: z.array(workflowStepSchema), manualTasks: z.array(manualTaskSchema), qualityChecks: z.array(z.object({ id: z.string(), label: z.string(), status: z.enum(['pending', 'pass', 'risk']), note: z.string() }).strict()),
  risks: z.array(z.string()), unverified: z.array(z.string()), summary: z.string()
}).strict().superRefine((project, ctx) => {
  if (Math.abs(project.goals.growthWeight + project.goals.monetizationWeight - 1) > 0.000001) {
    ctx.addIssue({ code: 'custom', message: '涨粉与变现权重之和必须为1', path: ['goals'] });
  }
  if (project.dataClass === 'demo' && !project.demoNotice.includes('演示数据')) {
    ctx.addIssue({ code: 'custom', message: '演示项目必须包含演示数据声明', path: ['demoNotice'] });
  }
  const metricIds=new Set<string>();
  const publicationIds=new Set<string>();
  const productIds=new Set(project.products.map((product)=>product.id)),materialIds=new Set(project.materials.map((material)=>material.id)),sourceIds=new Set(project.sources.map((source)=>source.id)),topicMap=new Map(project.topics.map((topic)=>[topic.id,topic])),experimentIds=new Set(project.experiments.map((experiment)=>experiment.id));
  project.products.forEach((product,index)=>{product.materialIds.forEach((id)=>{if(!materialIds.has(id))ctx.addIssue({code:'custom',message:'产品引用了不存在的素材',path:['products',index,'materialIds']});});product.evidenceIds.forEach((id)=>{if(!sourceIds.has(id))ctx.addIssue({code:'custom',message:'产品引用了不存在的证据',path:['products',index,'evidenceIds']});});});
  project.topics.forEach((topic,index)=>{if(!productIds.has(topic.productId))ctx.addIssue({code:'custom',message:'选题必须关联存在的产品',path:['topics',index,'productId']});});
  const scriptIds=new Set(project.scripts.map((script)=>script.id));project.scripts.forEach((script,index)=>{if(!topicMap.has(script.topicId))ctx.addIssue({code:'custom',message:'脚本必须关联存在的选题',path:['scripts',index,'topicId']});});project.topviewPackages.forEach((item,index)=>{if(!scriptIds.has(item.scriptId))ctx.addIssue({code:'custom',message:'Topview制作包必须关联存在的脚本',path:['topviewPackages',index,'scriptId']});});
  project.publications.forEach((publication,index)=>{if(publicationIds.has(publication.id))ctx.addIssue({code:'custom',message:'发布记录ID不能重复',path:['publications',index,'id']});publicationIds.add(publication.id);const topic=publication.topicId?topicMap.get(publication.topicId):undefined;if(publication.topicId&&!topic)ctx.addIssue({code:'custom',message:'发布记录引用了不存在的选题',path:['publications',index,'topicId']});if(publication.productId&&!productIds.has(publication.productId))ctx.addIssue({code:'custom',message:'发布记录引用了不存在的产品',path:['publications',index,'productId']});if(topic&&publication.productId&&topic.productId!==publication.productId)ctx.addIssue({code:'custom',message:'发布记录的选题与产品不一致',path:['publications',index,'productId']});if(publication.experimentId&&!experimentIds.has(publication.experimentId))ctx.addIssue({code:'custom',message:'发布记录引用了不存在的实验',path:['publications',index,'experimentId']});if(Boolean(publication.experimentId)!==(publication.variant!=='none'))ctx.addIssue({code:'custom',message:'实验映射与A/B变体必须同时设置',path:['publications',index,'variant']});});
  const publicationMap=new Map(project.publications.map((publication)=>[publication.id,publication]));
  project.metrics.forEach((metric,index)=>{
    if(metricIds.has(metric.id))ctx.addIssue({code:'custom',message:'数据快照ID不能重复',path:['metrics',index,'id']});metricIds.add(metric.id);
    const publication=publicationMap.get(metric.publicationId);
    if(!publication)ctx.addIssue({code:'custom',message:'数据快照必须关联存在的发布记录',path:['metrics',index,'publicationId']});
    else{if(metric.videoId!==publication.videoId)ctx.addIssue({code:'custom',message:'数据快照视频编号与发布记录不一致',path:['metrics',index,'videoId']});if(metric.platform!==publication.platform)ctx.addIssue({code:'custom',message:'数据快照平台与发布记录不一致',path:['metrics',index,'platform']});}
    if(metric.publishedAt>metric.dataThroughAt)ctx.addIssue({code:'custom',message:'数据截至时间不能早于发布时间',path:['metrics',index,'dataThroughAt']});
    if(metric.dataThroughAt>metric.capturedAt)ctx.addIssue({code:'custom',message:'采集时间不能早于数据截至时间',path:['metrics',index,'capturedAt']});
  });
});

export type Project = z.infer<typeof projectSchema>;
export type MetricValues = z.infer<typeof metricValuesSchema>;
export type MetricSnapshot = z.infer<typeof metricSnapshotSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Script = z.infer<typeof scriptSchema>;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120), projectType: z.string().default('问题解决型好物视频'), platforms: z.array(z.string()).default(['douyin']),
  dataClass: z.enum(['demo', 'real']).default('real')
}).strict();

export const revisionSchema = z.object({ expectedRevision: z.number().int().nonnegative(),reviewScope:z.object({videoId:z.string().optional(),platform:z.string().optional(),days:z.number().int().min(1).max(365).optional()}).strict().optional() }).strict();
export const updateProjectSchema = z.object({ expectedRevision: z.number().int().nonnegative(), changes: z.record(z.string(), z.unknown()) }).strict();
export const deleteProjectSchema = z.object({ confirmName: z.string().min(1).max(120) }).strict();

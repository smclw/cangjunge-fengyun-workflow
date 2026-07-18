import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type { Project } from '../schemas/project.js';
import { calculateKpis, aggregateMetricValues } from '../analytics/kpis.js';
import { safeResolve } from '../utils/paths.js';

function meta(project: Project): string {
  return [
    `项目编号：${project.id}`,
    `视频编号：${project.publications[0]?.videoId ?? '待分配'}`,
    `创建时间：${project.createdAt}`,
    `当前版本：${project.schemaVersion}.${project.revision}`,
    `资料来源：${project.sources.map((s) => s.label).join('；') || '用户输入'}`,
    `未核实信息：${project.unverified.join('；') || '无'}`,
    `风险提示：${project.risks.join('；') || '发布前仍需人工检查'}`,
    `最后更新时间：${project.updatedAt}`,
    project.dataClass === 'demo' ? project.demoNotice : ''
  ].filter(Boolean).join('\n');
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(project: Project, headers: string[], rows: unknown[][]): string {
  const common = ['项目编号','视频编号','创建时间','当前版本','资料来源','未核实信息','风险提示','最后更新时间','数据声明'];
  const commonValues = [project.id,project.publications[0]?.videoId ?? '待分配',project.createdAt,`${project.schemaVersion}.${project.revision}`,project.sources.map((s)=>s.label).join('；')||'用户输入',project.unverified.join('；')||'无',project.risks.join('；')||'发布前人工检查',project.updatedAt,project.dataClass==='demo'?project.demoNotice:''];
  const safeRows = rows.length ? rows : [headers.map(() => '')];
  return `\uFEFF${[...common,...headers].map(csvEscape).join(',')}\r\n${safeRows.map((row) => [...commonValues,...row].map(csvEscape).join(',')).join('\r\n')}\r\n`;
}

export async function exportProjectFiles(project: Project, outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const metadata = meta(project);
  const top = [...project.topics].sort((a,b) => b.compositeScore-a.compositeScore)[0];
  const scripts = Object.fromEntries(project.scripts.map((script) => [script.version, script]));
  const packages = project.topviewPackages;
  const latestReview = project.reviews.at(-1);
  const aggregate = aggregateMetricValues(project.metrics);
  const kpis = calculateKpis(aggregate.values);
  const md = (title: string, body: string) => `${metadata}\n\n# ${title}\n\n${body.trim()}\n`;
  const files: Record<string,string> = {
    '00-项目输入.md': md('项目输入', `- 项目名称：${project.name}\n- 项目类型：${project.projectType}\n- 平台：${project.goals.platforms.join('、')}\n- 地区/语言：${project.goals.region}/${project.goals.language}\n- 当前阶段：${project.stage}`),
    '01-账号与商业目标.md': md('账号与商业目标', `- 一句话定位：${project.positioning.statement}\n- 目标人群：${project.positioning.audience}\n- 核心痛点：${project.positioning.corePain}\n- 账号承诺：${project.positioning.promise}\n- 变现方式：${project.goals.monetizationMethods.join('、')}\n- 权重：涨粉 ${project.goals.growthWeight} / 变现 ${project.goals.monetizationWeight}`),
    '02-资料来源清单.md': md('资料来源清单', project.sources.map((s) => `- ${s.label}｜${s.verification}｜${s.url ?? s.fileName ?? '本地输入'}｜${s.capturedAt}`).join('\n') || '- 暂无外部来源，当前为用户输入与演示资料。'),
    '03-趋势研究.md': md('趋势研究', project.sources.filter((s)=>s.url).map((s)=>`## ${s.label}\n\n原始表述：${s.originalText}\n\nAI归纳：${s.summary}\n\n是否核实：${s.verification}`).join('\n\n') || '尚未执行公开趋势研究；不得用演示资料冒充实时趋势。'),
    '04-产品分析.md': md('产品分析', project.products.map((p)=>`## ${p.name}\n\n品牌/类别：${p.brand}/${p.category}\n\n目标人群：${p.audience}\n\n痛点：${p.painPoints.join('、')}\n\n卖点：${p.sellingPoints.join('、')}\n\n风险：${p.risks.join('、')||'发布前检查'}`).join('\n\n') || '尚未录入产品。'),
    '05-选题评分.csv': csv(project,['选题','内容类型','平台','涨粉分','变现分','风险扣分','综合分','推荐角度','状态','发布阻断'],project.topics.map((t)=>[t.name,t.contentType,t.platform,t.growthScore,t.monetizationScore,t.riskPenalty,t.compositeScore,t.angle,t.status,t.publishBlocked])),
    '06-选题策划简报.md': md('选题策划简报', project.topics.map((t)=>`- **${t.name}**：${t.angle}（综合 ${t.compositeScore}，风险 ${t.riskPenalty}）`).join('\n') || '尚未生成选题。'),
    '07-涨粉版脚本.md': md('涨粉版脚本', formatScript(scripts.growth)),
    '08-成交版脚本.md': md('成交版脚本', formatScript(scripts.conversion)),
    '09-信任版脚本.md': md('信任版脚本', formatScript(scripts.trust)),
    '10-分镜表.csv': csv(project,['脚本版本','时间','画面','机位','字幕','音频'],project.scripts.flatMap((s)=>s.shots.map((shot)=>[s.version,shot.time,shot.visual,shot.camera,shot.subtitle,shot.audio]))),
    '11-Topview中文提示词.txt': `${metadata}\n\n${packages.map((p)=>p.chinesePrompt).join('\n\n---\n\n') || '尚未生成 Topview 制作包。'}\n`,
    '12-Topview英文提示词.txt': `${metadata}\n\n${packages.map((p)=>p.englishPrompt).join('\n\n---\n\n') || 'Topview package has not been generated.'}\n`,
    '13-Topview操作清单.md': md('Topview 操作清单', ['登录Topview','新建项目','按顺序上传素材','粘贴提示词','导入口播脚本','检查场景','删除无关素材','替换错误产品图','核对Logo和包装','选择人物和声音','设置9:16','先生成预览','检查前两秒','检查虚假画面','经确认后生成正式版','下载到项目目录'].map((x,i)=>`${i+1}. [ ] ${x}`).join('\n')),
    '14-视频质量检查.md': md('视频质量检查', project.qualityChecks.map((q)=>`- [${q.status==='pass'?'x':' '}] ${q.label}｜${q.status}｜${q.note||'待检查'}`).join('\n')),
    '15-发布素材包.md': md('发布素材包', formatPublishingPackage(project,top)),
    '16-发布记录.csv': csv(project,['发布ID','视频ID','平台','计划时间','实际时间','标题','标签','商品链接','状态','AI标记','商业推广标记','视频链接','选题ID','产品ID','实验ID','实验变体'],project.publications.map((p)=>[p.id,p.videoId,p.platform,p.plannedAt,p.actualAt,p.title,p.tags.join(' '),p.productLink,p.status,p.aiDisclosure,p.commercialDisclosure,p.videoLink,p.topicId,p.productId,p.experimentId,p.variant])),
    '17-数据记录.csv': csv(project,['快照ID','视频ID','发布记录ID','平台','时间节点','值模式','发布时间','数据截至时间','采集时间','来源模式','完整性','币种','曝光','播放','3秒播放','平均观看秒数','总观看秒数','完播','点赞','评论','分享','收藏','新增粉丝','主页访问','链接点击','商品点击','加购','订单','成交金额(分)','佣金(分)','退款(分)','制作成本(分)','投流成本(分)','实际收入(分)'],project.metrics.map((m)=>[m.id,m.videoId,m.publicationId,m.platform,m.checkpoint,m.valueMode,m.publishedAt,m.dataThroughAt,m.capturedAt,m.sourceMode,m.completeness,m.currency,m.values.impressions,m.values.views,m.values.threeSecondViews,m.values.averageWatchSeconds,m.values.totalWatchSeconds,m.values.completions,m.values.likes,m.values.comments,m.values.shares,m.values.saves,m.values.followersGained,m.values.profileVisits,m.values.linkClicks,m.values.productClicks,m.values.addToCarts,m.values.orders,m.values.gmvMinor,m.values.commissionMinor,m.values.refundsMinor,m.values.productionCostMinor,m.values.adCostMinor,m.values.actualRevenueMinor])),
    '18-复盘报告.md': md('复盘报告', `${latestReview ? `核心结论：${latestReview.conclusion}\n\n可能原因：${latestReview.likelyCauses.join('、')}\n\n下一轮：${latestReview.nextTest}\n\n唯一变量：${latestReview.primaryVariable}\n\n胜出标准：${latestReview.winningCriterion}` : '尚未生成复盘。'}\n\n指标快照：${JSON.stringify(kpis, null, 2)}`),
    '19-下一轮测试计划.md': md('下一轮测试计划', latestReview ? `- 假设：${latestReview.nextTest}\n- 保持不变：${latestReview.keepConstant.join('、')}\n- 唯一改变变量：${latestReview.primaryVariable}\n- 胜出标准：${latestReview.winningCriterion}` : '先补齐数据并生成复盘；每轮只改变一个主要变量。')
  };
  for (const [name, content] of Object.entries(files)) await fs.writeFile(safeResolve(outputDir,name),content,'utf8');
  return Object.keys(files);
}

function formatScript(script: Project['scripts'][number] | undefined): string {
  if (!script) return '尚未生成该版本脚本。';
  return `## ${script.title}\n\n### 三个钩子\n${script.hooks.map((h)=>`- ${h}`).join('\n')}\n\n### 完整口播\n${script.narration}\n\n### 屏幕字幕\n${script.subtitles.map((s)=>`- ${s}`).join('\n')}\n\n### 产品镜头\n${script.productShots.map((s)=>`- ${s}`).join('\n')}\n\n### CTA\n${script.cta}\n\n### 禁止内容\n${script.prohibitedContent.map((s)=>`- ${s}`).join('\n')}\n\n### 所需素材\n${script.requiredMaterials.map((s)=>`- ${s}`).join('\n')}`;
}

function formatPublishingPackage(project:Project,top:Project['topics'][number]|undefined):string {
  if(!top)return '请先生成选题。';
  const rows=project.publications.length?project.publications.map((publication)=>({platform:publication.platform,title:publication.title,tags:publication.tags,productLink:publication.productLink,aiDisclosure:publication.aiDisclosure,commercialDisclosure:publication.commercialDisclosure})):
    project.goals.platforms.map((platform)=>({platform,title:top.name,tags:['问题解决','好物清单','AI辅助创作'],productLink:'待人工核验',aiDisclosure:true,commercialDisclosure:true}));
  return rows.map((row)=>`## ${row.platform}\n\n- 标题：${row.title}\n- 封面文案：先看判断标准｜别踩这个误区｜真实操作边界\n- 描述：从真实问题切入，只展示现有证据可支持的操作、结果与适用边界。\n- 标签：${row.tags.map((tag)=>`#${tag}`).join(' ')}\n- 置顶评论：你的使用场景是什么？我会按已有证据说明是否适合。\n- CTA：收藏判断清单；需要产品信息时再次核对链接、价格和库存。\n- 商品链接：${row.productLink||'待人工核验'}\n- AI生成标记：${row.aiDisclosure?'已计划':'缺失，发布前必须补充'}\n- 商业推广标记：${row.commercialDisclosure?'已计划':'缺失，发布前必须补充'}\n- 平台差异：发布前按该平台的标题长度、标签、音乐版权和披露规则人工复核。`).join('\n\n')+`\n\n## 通用人工门槛\n\n核对价格、库存、链接、包装、Logo、人物/音乐/素材版权；先预览再正式生成和发布。`;
}

export async function createProjectExport(project: Project, dataDir: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const outputDir = safeResolve(dataDir,'projects',project.id,'outputs',stamp);
  const files = await exportProjectFiles(project,outputDir);
  await fs.writeFile(safeResolve(outputDir,'project.json'),`${JSON.stringify(project,null,2)}\n`,'utf8');
  const zip = new AdmZip();
  for (const file of [...files,'project.json']) zip.addLocalFile(safeResolve(outputDir,file),'',file);
  const zipPath = safeResolve(dataDir,'projects',project.id,'outputs',`${stamp}-${project.id}.zip`);
  zip.writeZip(zipPath);
  return zipPath;
}

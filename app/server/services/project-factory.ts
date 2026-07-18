import crypto from 'node:crypto';
import type { Project } from '../schemas/project.js';
import type { WorkflowConfig } from './config.js';
import { slugifyName } from '../utils/paths.js';

const topviewLabels=['登录Topview','新建项目','按顺序上传素材','粘贴提示词','导入口播脚本','检查场景','删除无关素材','替换错误产品图','核对Logo和包装','选择人物和声音','设置9:16','先生成预览','检查前两秒','检查虚假画面','经确认后生成正式版','下载到项目目录'] as const;
const manualLabels = [...topviewLabels.map((label,index)=>[`topview-${index+1}`,label,'topview'] as const),['publish-platform','上传目标平台','publishing'] as const,['record-data','录入数据','data'] as const];

export function createEmptyProject(input: { name: string; projectType: string; platforms: string[]; dataClass: 'demo' | 'real' }, workflow: WorkflowConfig, id?: string): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, revision: 0, id: id ?? slugifyName(input.name), name: input.name, projectType: input.projectType,
    dataClass: input.dataClass, demoNotice: input.dataClass === 'demo' ? '演示数据，不代表真实经营结果' : '',
    status: 'active', stage: 'initialize', currentWizardStep: 0, createdAt: now, updatedAt: now,
    timezone: 'Australia/Perth', locale: 'zh-CN', currency: 'CNY',
    goals: { platforms: input.platforms, region: '中国', language: '中文', currentFollowers: 0, weeklyPosts: 3, budgetMinor: null, onCamera: false, hasPhysicalProduct: false, hasProductLink: false, monetizationMethods: ['商品带货'], growthWeight: 0.6, monetizationWeight: 0.4 },
    positioning: { accountName: '', statement: '', audience: '', corePain: '', promise: '', style: '真实、清晰、问题解决型', avatar: '不指定', series: [], languages: ['中文'], prohibitedContent: ['虚假实测', '绝对化承诺'] },
    sources: [], materials: [], products: [], topics: [], scripts: [], topviewPackages: [], publications: [], metrics: [], reviews: [], experiments: [],
    workflow: workflow.steps.map((step, index) => ({ id: step.id, label: step.label, state: index === 0 ? 'in_progress' : 'not_started' })),
    manualTasks: manualLabels.map(([taskId, label, category]) => ({ id: taskId, label, category, completed: false, updatedAt: now })),
    qualityChecks: ['前两秒','痛点','产品出现时间','节奏','字幕','Logo','包装','人物手部','画面跳变','绝对化用语','虚假实测','AI标记','商业披露','音乐版权'].map((label) => ({ id: crypto.randomUUID(), label, status: 'pending', note: '' })),
    risks: [], unverified: [], summary: '项目已创建，等待补充平台、定位、产品和素材。'
  };
}

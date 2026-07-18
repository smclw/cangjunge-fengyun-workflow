---
name: topview-growth-monetization
description: "Run a traceable growth-and-monetization video workflow from positioning, product evidence, trend research, topic scoring, three script variants, and Topview production packages through manual quality gates, publishing records, KPI diagnosis, reviews, and one-variable experiments. Use for 启动涨粉变现工作流、新建或继续视频项目、分析产品或赛道、生成或评分选题、生成三套脚本或 Topview 制作包、检查视频、生成发布素材、录入数据、复盘、诊断不涨粉/不成交、批量视频方案。"
---

# Topview Growth Monetization

Use the local project at `E:\AI\CodexProjects\涨粉变现` as the durable workspace. Keep observed facts, verified public sources, AI inference, unverified claims, and prohibited claims distinct.

## Select one mode

- **引导模式**: Start or continue a project one stage at a time. Ask only for the current stage's missing blocking input.
- **快速模式**: Accept one product brief, link, or material set and produce a clearly caveated draft topic, three scripts, and Topview package.
- **批量模式**: Validate a UTF-8 CSV, process each product independently, preserve row-level errors, and export a manifest.
- **复盘模式**: Validate video metrics, calculate KPIs, diagnose the largest bottleneck, and create one next-round experiment with one changed variable.

Choose the mode from the request. If unclear, default to 引导模式 for new work and 复盘模式 for data/why questions.

## Required workflow

1. Locate the active project in `data/projects/<project-id>/project.json`. Never use browser state as the project fact source.
2. Validate the project before changing it:
   ```powershell
   node .agents\skills\topview-growth-monetization\scripts\validate-project.mjs <project.json>
   ```
3. Load only the focused reference for the current stage. Do not load every reference.
4. Record provenance for each claim: `user_fact`, `public_verified`, `ai_inference`, `unverified`, or `prohibited`.
5. Run compliance screening before topic, script, production, quality, or publishing output. For risky claims, show the text, reason, compliant rewrite, and evidence needed. Do not turn insufficient evidence into a certainty.
6. Use the project configuration for scores and KPIs. Do not restate formulas differently in prose or code.
7. Save the stage output through the local API or deterministic scripts, then validate again.
8. Stop at manual gates for Topview login, paid generation, formal export, platform login, and publication.
9. For reviews, cite the measured period, source project/video, missing data, confidence, bottleneck, and one-variable next experiment.

## Stage routing

| Request | Primary reference | Output |
| --- | --- | --- |
| 启动/新建/继续 | `references/01-工作流总览.md` | current stage and next required input |
| 平台/定位 | `references/02-平台与账号定位.md` | account and business goal |
| 研究赛道/趋势/竞品 | `references/03-趋势和竞品研究.md` | sourced research record |
| 分析产品/资料 | `references/04-产品资料提取.md` | evidence-tagged product brief |
| 生成/评分选题 | `references/05-选题评分标准.md` | scored topic set |
| 三套脚本/A-B 钩子 | `references/06-爆款脚本结构.md` | growth, conversion, trust scripts |
| Topview 制作包 | `references/07-Topview制作规范.md` | Chinese, English, concise prompts and checklist |
| 检查视频 | `references/08-视频质量检查.md` | 通过/修改后通过/不建议发布 |
| 发布素材 | `references/09-发布规范.md` | titles, cover text, description, tags, disclosures |
| 数据录入/KPI | `references/10-数据指标体系.md` | validated metrics and KPIs |
| 为什么不涨粉/不成交/复盘 | `references/11-复盘诊断规则.md` | diagnosis and one-variable experiment |
| 规模化变现 | `references/12-变现路径.md` | hypothesis and validation plan |
| 合规/版权 | `references/13-合规与版权.md` | risk findings and rewrites |

## Skill cooperation

- Use `topview-ai:video-script-writer` for production-ready hook, narration, captions, storyboard, CTA, and model prompt structure.
- Use `topview-ai:topview-video` only in Mock mode unless the user separately approves credentials, cost, and paid/formal generation.
- Use `topview-ai:multi-platform-content-collector` or Firecrawl only for public research requested by the user; preserve URL, platform, author, observed wording, capture time, summary, and verification state. Do not upload local private materials.
- Use `data-analytics:analyze-data-quality` before diagnosing unreliable data; use `metric-diagnostics` for movement explanations and `validate-data` before sharing conclusions.
- Never use a social-media uploader for formal publication without a separate explicit confirmation.

## Deterministic tools

- `scripts/validate-project.mjs`: validate required project shape and safe identifiers.
- `scripts/calculate-kpis.mjs`: calculate configured KPI semantics with `null` for zero denominators.
- `scripts/export-package.mjs`: create the required 00–19 UTF-8 delivery files.
- `scripts/migrate-data.mjs`: migrate older local project JSON to schema version 1 with a backup.
- `scripts/validate-skill.mjs`: verify the skill layout, frontmatter, resources, and agent metadata.

## Safety and completion

- Never invent product tests, reviews, orders, sales, outcomes, medical/beauty effects, authorization, or market demand.
- Never overwrite original material. Store uploads with unique names and immutable provenance.
- Never place credentials in project files, commands, logs, exports, or Memory.
- Demo projects and every derived export must say `演示数据，不代表真实经营结果`.
- A stage is complete only when its output is persisted, validated, traceable to sources, and the next manual or automated action is explicit.

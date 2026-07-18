# 标准 `npm run dev` 开发启动设计规格

## 目标

让开发者克隆仓库后只需执行 `npm install` 和 `npm run dev`，即可同时启动带热更新的后端 API 与 Vite 前端，并自动打开浏览器。现有中文 BAT 启停和生产构建流程继续保留，供非开发者使用。

## 方案选择

采用 `concurrently` 作为唯一新增开发依赖，由 npm 脚本并发管理前后端进程。相比自写 Node 子进程管理脚本，该方案在 Windows 上的中断和异常退出处理更成熟；相比把 Vite 嵌入 Express，改动范围更小，也保留前后端各自清晰的开发职责。

## 启动架构

- `npm run dev` 同时执行 `dev:server` 和 `dev:client`，日志使用 `api`、`web` 前缀区分。
- `dev:server` 使用 `tsx watch` 启动 `app/server/index.ts`，监听 `127.0.0.1:4173`，后端源码变化时自动重启。
- `dev:client` 使用 Vite 启动 `app/client`，监听 `127.0.0.1:5173`，保留 React 热更新，并自动打开该地址。
- Vite 将 `/api` 代理到 `http://127.0.0.1:4173`；浏览器只需要访问 5173。
- 任一子进程启动失败或退出时，`concurrently` 结束另一子进程；用户按 `Ctrl+C` 时同时关闭两者，不遗留开发服务。

## 端口与浏览器行为

- 开发模式对 4173 和 5173 使用严格端口：端口被占用时直接给出明确错误并退出，不自动漂移，避免 Vite 代理到错误的后端。
- 原有 BAT 启动仍可从 4173 向后寻找可用端口，不改变普通用户体验。
- Vite 默认自动打开浏览器；设置 `TOPVIEW_DEV_NO_BROWSER=1` 时不打开，用于自动化测试和无界面环境。

## 修改范围

- `package.json`、`package-lock.json`：增加 `concurrently`，新增 `dev`、`dev:server`，调整 `dev:client`。
- `app/server/index.ts`：支持仅供开发脚本使用的 `--strict-port` 参数；不改变默认端口顺延逻辑。
- `app/client/vite.config.ts`：开发端口设为严格模式，并按环境变量控制自动打开浏览器。
- `README.md` 与故障排查文档：把 `npm install`、`npm run dev` 作为开发者标准入口，保留 BAT 入口说明。
- 启动专项测试：在禁止打开浏览器的条件下运行 `npm run dev`，验证前端页面和 `/api/health` 可访问，结束后验证两个端口均已释放。

## 错误处理

- 4173 被占用：后端输出端口占用错误，整个开发命令退出。
- 5173 被占用：Vite 输出严格端口错误，整个开发命令退出。
- 前端或后端异常退出：另一进程随即终止，命令返回非零状态。
- 首次未安装依赖：npm 按标准行为提示先执行 `npm install`，不在开发脚本内隐式安装。

## 验收标准

- 全新依赖安装后，单独执行 `npm run dev` 可启动前端和后端，并默认打开 `http://127.0.0.1:5173`。
- 修改前端或后端源码时，对应服务具备热更新或自动重启能力。
- `/api/health` 通过 Vite 代理返回成功响应。
- `Ctrl+C`、任一进程失败和自动化测试结束后均不遗留 4173/5173 监听进程。
- 原有 `启动工作流.bat`、`停止工作流.bat`、生产构建、E2E 和 Windows 启停测试保持通过。
- 提交不包含 `data/projects/demo-problem-solving-product/project.json` 的本地运行时间戳变化，也不重新跟踪两份仅本地参考资料。

## 非目标

- 不改变业务逻辑、Schema、项目数据、生产服务架构或部署方式。
- 不移除中文 BAT，不把 Vite 开发服务器用于生产运行。
- 不新增 Docker、环境管理框架或其他开发工具链。

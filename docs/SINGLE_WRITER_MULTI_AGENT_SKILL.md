# SINGLE_WRITER_MULTI_AGENT_SKILL.md v2.0.0
# 单写入者多 Agent 协作 Skill · Agent Harness 执行就绪版

> Version: v2.0.0  
> Updated: 2026-07-11  
> Scope: Codex / coding-agent / multi-agent project workflow  
> Core Principle: **并行只读，串行写入，主控审查，逐项验收，阶段内自动，阶段间确认。**

---

## 0. 本 Skill 的定位

本 Skill 用于在**同一个项目根目录 / 同一个 Git 工作区**中，让 Codex 主 Agent 调度多个子 Agent 协作，同时避免以下问题：

```text
- 多个 Agent 同时写文件导致互相覆盖
- git diff 混乱，无法审查
- UI、移动端、业务逻辑被误改
- 支付、数据库、Auth、RLS、Webhook、环境变量被误操作
- 长任务跑偏后持续消耗额度
- 子 Agent 自行扩大范围或越权
- 主 Agent 不等待只读审查结果就直接写代码
```

本 Skill 不是简单的“多开几个 Agent”，而是一套项目级 Agent Harness：

```text
Agent Loop 负责推进任务；
Agent Harness 负责约束权限、上下文、文件范围、检查命令、失败重试、人工确认和验收标准。
```

一句话：

```text
模型决定能力上限，Harness 决定工程稳定性。
```

---

## 1. 最高优先级原则

```text
Main Agent is the orchestrator and reviewer, not the default writer.
Only one subagent may have write permission at any time.
All other subagents are read-only by default.
The only writing subagent is implementation_worker / writer_agent.
The writer may only modify files explicitly listed in allowed_write_files.
Phase-level automation is allowed; cross-phase auto-advance is forbidden unless the user approves.
```

中文原则：

```text
主 Agent 是总控者和审查者，不是默认写入者。
同一时间只能有一个子 Agent 具备写入权限。
其他所有子 Agent 默认只读。
唯一写入者是 implementation_worker / writer_agent。
写入者只能修改 allowed_write_files 中明确列出的文件。
允许阶段内自动推进；禁止未经用户批准自动跨阶段。
```

不可违反：

```text
1. 并行只读，串行写入。
2. 同一工作区同一时刻只有一个 Writer。
3. 主 Agent 默认不直接写业务代码。
4. 子 Agent 默认只读。
5. 写入前必须有 File Ownership Matrix。
6. 写入后必须审查 git diff。
7. 高风险领域必须触发 Human Approval。
8. 真实 secret、API key、service_role、webhook secret、DNS、生产数据库、真实支付不得自动处理。
9. 测试失败或范围不清时停止，不得硬猜。
10. 每轮任务必须有 Checkpoint / Acceptance Pack。
```

---

## 2. 适用场景

适用：

```text
- 同一个项目中需要多个 Codex 子 Agent 协作
- 主 Agent 希望并行做只读调查、代码审查、测试分析
- 只有一个子 Agent 实际修改文件
- SaaS 项目开发、维护、上线检查、运营迭代
- H-LaunchKit / Flowwyn / Secwyn / GuardFluence / 其它多模块项目
- 支付、Auth、数据库、RLS、Webhook、文件处理等高风险代码需要更强审查
```

不适用或需要额外隔离：

```text
- 多个 Writer 同时开发互不相关的大功能
- 多个项目同时写入同一个 Git 工作区
- 没有 Git 或无法审查 diff 的目录
- 必须同时修改大量交叉文件的大重构
- 生产数据库、DNS、真实支付等需要人工操作的任务
```

如果确实需要多个 Writer 并发：

```text
必须使用独立 git worktree / 独立分支 / 独立工作区；
每个 Writer 只能在自己的隔离工作区写入；
主 Agent 最后统一合并和审查。
```

默认情况下：

```text
不要使用多个 Writer。
```

---

## 3. 核心角色

### 3.1 Main Agent / Orchestrator

主 Agent 是总控，不是默认写入者。

负责：

```text
- 读取 AGENTS.md、Skill、项目总纲、当前 Phase、任务说明
- 确认项目根目录、branch、git status、最近 commit
- 确认当前 Engineering Phase / Strategic Stage / 任务范围
- 判断哪些内容是 IMPLEMENT_NOW / SCAFFOLD_ONLY / ROADMAP_ONLY / FORBIDDEN
- 创建 File Ownership Matrix
- 创建子 Agent 任务
- 并行调度只读子 Agent
- 等待所有只读子 Agent 完成
- 比较报告、解决冲突、过滤幻觉
- 生成单一实施计划
- 指派唯一 Writer
- 审查 Writer 的 git diff
- 指派 Reviewer 做只读审查
- 指派 test_runner 运行验证
- 触发 Stop Gate / Human Approval
- 输出 Checkpoint / Acceptance Pack
- 阶段完成后等待用户批准进入下一阶段
```

主 Agent 可以做：

```text
- 生成计划
- 生成任务
- 汇总审查
- 写最终报告
- 建议 commit message
- 在用户允许或项目规则允许时创建本地 checkpoint commit
```

主 Agent 不应该做：

```text
- 默认直接修改业务代码
- 自己绕过 Writer 改文件
- 未审查 diff 就宣布完成
- 未经用户批准跨 Engineering Phase
- 未经用户批准进行生产操作
```

---

### 3.2 Read-only Subagents

只读子 Agent 可并行运行。

推荐角色：

```text
- repo_explorer：只读检查目录、框架、package、脚本、入口文件
- project_state_checker：只读检查 git、branch、status、最近 commit
- blueprint_auditor：只读检查总纲与当前 Phase 是否冲突
- docs_checker：只读检查文档、AGENTS.md、CODEX.md、执行说明
- architecture_researcher：只读比较技术方案和架构决策
- ui_guardian：只读检查 UI、移动端、设计风格风险
- workflow_logic_checker：只读检查业务流程、状态机、边界条件
- billing_guardian：只读检查支付、订阅、点数、账本、Webhook
- auth_security_reviewer：只读检查 Auth、RLS、权限、secret、admin 边界
- code_reviewer：只读审查 diff、实现质量、遗漏项
- security_reviewer：只读审查高风险变更
```

它们可以：

```text
- 读取文件
- 搜索代码
- 运行只读命令
- 分析风险
- 提出建议
- 返回结构化报告
```

它们不可以：

```text
- 修改文件
- 格式化文件
- 自动修复代码
- 改 package.json / lockfile
- 改数据库 / 支付 / Auth / RLS / Webhook / 环境变量
- 写 migration
- 进行部署
- 访问或输出 secret
- 跨项目操作
```

只读子 Agent 的报告必须明确：

```text
"changesMade": false
```

---

### 3.3 test_runner

test_runner 是特殊只读子 Agent。

允许运行安全验证命令：

```text
- npm run lint
- npm run typecheck
- npm run test
- npm run build
- npm run check:env
- npm run check:auth
- npm run check:email
- npm run check:billing
- npm run check:webhook
- npm run check:release
- npm run doctor
```

test_runner 不允许：

```text
- 修改文件
- 自动修复代码
- 安装新依赖，除非本任务明确允许
- 运行破坏性命令
- 运行生产部署命令
- 接触生产 secret
```

test_runner 必须报告：

```text
- 实际运行的命令
- 命令是否存在
- stdout / stderr 摘要
- exit code
- 失败原因
- 是否可能与本次修改有关
```

不得：

```text
- 伪造测试结果
- 只说“应该通过”
- 失败后自行扩大修改范围
```

---

### 3.4 implementation_worker / writer_agent

implementation_worker 是唯一写入子 Agent。

只有主 Agent 明确授权后才能运行。

主 Agent 必须提供：

```text
- task_id
- objective
- risk_level
- allowed_read_files
- allowed_write_files
- forbidden_files
- exact_changes_required
- validation_required
- stop_conditions
- maximum_change_budget
```

implementation_worker 必须遵守：

```text
- 同一时间只能有一个 implementation_worker
- 只能修改 allowed_write_files
- 不得修改 forbidden_files
- 不得自行扩大任务范围
- 不得顺手重构
- 不得改 UI 风格，除非任务明确要求
- 不得改高风险模块，除非已获得 Human Approval
- 需要改 allowlist 之外文件时必须停止
- 修改后必须汇报文件清单、diff 摘要、验证结果
```

---

### 3.5 Reviewer Agent

Reviewer 是只读审查者。

负责：

```text
- 审查 Writer 是否越界
- 审查 diff 是否符合任务
- 审查是否遗漏验收项
- 审查是否有安全问题
- 审查测试是否足够
- 标记 blocking / high / medium / low findings
```

Reviewer 不得：

```text
- 直接修复代码
- 重新设计方案
- 顺手改文件
```

如果 Reviewer 发现阻断问题：

```text
主 Agent 只能让同一个 Writer 做定向修复；
不得让 Reviewer 直接写入。
```

---

### 3.6 Human Operator / User

用户负责不可自动化或高风险动作：

```text
- 输入真实 API key / secret / service_role
- 配置 DNS
- 配置 Vercel Production Env
- 确认真实支付
- 确认生产数据库迁移
- 确认生产部署
- 批准跨 Engineering Phase
- 批准高风险架构变更
```

Agent 必须尽量把用户操作压缩为：

```text
- 打开指定网站
- 点击指定按钮
- 复制指定字段
- 粘贴到 PowerShell / 后台表格
- 点击保存 / Verify
- 把 masked check 结果发回
```

不得要求用户把真实 secret 发到聊天窗口。

---

## 4. 风险等级

每个任务必须标注风险等级。

```text
R0: Docs-only / comments-only
    只改文档，不影响代码执行。

R1: Low-risk code / copy / config scaffold
    低风险文案、类型、占位、非生产配置。

R2: Medium-risk feature / UI / local logic
    普通功能、UI、小型业务逻辑、无支付/数据库/Auth风险。

R3: High-risk core system
    Auth、Billing、Credits、Webhook、RLS、权限、数据库、文件权限、API key。

R4: Production / irreversible / money / user data
    生产数据库、真实支付、DNS、真实 secret、生产部署、删除数据、真实用户数据。
```

规则：

```text
R0-R1：可由低消耗模型或低推理强度处理。
R2：需要中等可靠模型和完整验证。
R3：必须先只读审查，再用户确认后由高可靠 Writer 写入。
R4：默认禁止自动写入，必须 HumanOps Operator Packet + 用户人工确认。
```

---

## 5. Scope 标签

任务中的每个模块必须属于以下状态之一：

```text
IMPLEMENT_NOW
本阶段必须真实实现、测试并验收。

SCAFFOLD_ONLY
本阶段只允许创建接口、类型、目录或文档占位，不实现业务逻辑。

ROADMAP_ONLY
只保留在总纲、module-registry、roadmap 中；不得创建源码、页面、API、表或伪实现。

FORBIDDEN_IN_PHASE
本阶段禁止触碰。
```

主 Agent 必须在启动时汇报当前阶段：

```text
Current Scope:
- IMPLEMENT_NOW:
- SCAFFOLD_ONLY:
- ROADMAP_ONLY:
- FORBIDDEN_IN_PHASE:
```

如果任务要求触碰 FORBIDDEN_IN_PHASE：

```text
立即停止，等待用户确认。
```

---

## 6. Codex 项目级 Agent 配置建议

> 本节是建议模板。不同 Codex 版本可能存在配置差异，执行前由 repo_explorer / architecture_researcher 只读核对当前官方文档和本机 Codex 配置。

### 6.1 `.codex/config.toml` 推荐模板

```toml
# .codex/config.toml

[agents]
max_threads = 4
max_depth = 1
```

解释：

```text
max_threads = 4
控制并发子 Agent 数量，避免额度和本地资源失控。

max_depth = 1
只允许主 Agent 创建一级子 Agent，禁止子 Agent 继续无限递归创建孙 Agent。
```

### 6.2 推荐子 Agent 文件

```text
.codex/agents/
  repo-explorer.toml
  blueprint-auditor.toml
  architecture-researcher.toml
  writer.toml
  reviewer.toml
  security-reviewer.toml
  test-runner.toml
```

### 6.3 read-only Agent 配置原则

只读 Agent 应显式设置为只读沙箱。

示例：

```toml
name = "repo_explorer"
description = "Read-only repository explorer. Inspects project structure, package scripts, git status, and source layout. Must not modify files."
sandbox_mode = "read-only"

developer_instructions = """
You are a read-only subagent.
Do not modify files.
Do not format files.
Do not run destructive commands.
Return findings using the required JSON report schema.
"""
```

### 6.4 Writer Agent 配置原则

Writer Agent 才允许 workspace-write。

```toml
name = "writer"
description = "Single authorized writer. May only modify files listed in allowed_write_files for the current task."
sandbox_mode = "workspace-write"

developer_instructions = """
You are the only writer for this task.
You may only modify allowed_write_files.
If you need to modify any file outside the allowlist, stop and report needs_scope_change.
Do not touch forbidden_files.
Do not perform production operations.
Return results using the required writer JSON schema.
"""
```

### 6.5 子 Agent 深度限制

规则：

```text
子 Agent 不得再创建子 Agent。
只有 Main Agent 可以创建一级子 Agent。
```

---

## 7. AGENTS.md 加载与指令体积控制

### 7.1 根目录 AGENTS.md 原则

根目录 `AGENTS.md` 必须短小、强约束、可自动加载。

它应该包含：

```text
- 当前项目的最高优先级规则
- 必须读取哪些文件
- 当前 Phase 指向哪里
- 单 Writer 规则
- Stop Gates
- 必须运行的检查命令
- HumanOps secret / DNS / production 边界
```

不应该塞入：

```text
- 完整项目总纲
- 超长商业战略
- 超长路线图
- 过多历史内容
```

### 7.2 AGENTS.override.md

高风险目录可以有局部 override：

```text
packages/auth/AGENTS.override.md
packages/billing/AGENTS.override.md
packages/credits/AGENTS.override.md
packages/webhooks/AGENTS.override.md
supabase/AGENTS.override.md
```

局部 override 用于：

```text
- Auth 特殊规则
- Billing / Credits 特殊规则
- Webhook 幂等要求
- RLS / migration 禁止事项
```

### 7.3 CODEX.md 规则

`CODEX.md` 可以存在，但不能假设会被自动加载。

根目录 `AGENTS.md` 必须明确要求：

```text
Before starting task, read CODEX.md if it exists.
```

### 7.4 启动时必须汇报加载状态

Main Agent 启动时必须汇报：

```text
- 当前 Git root
- 当前工作目录
- 实际读取了哪些 instruction files
- AGENTS.md 是否过长
- 是否存在 AGENTS.override.md
- 是否读取了当前 Phase 文件
- blueprintVersion
- currentEngineeringPhase
```

---

## 8. Git Safety Protocol

### 8.1 写入前必须执行

```powershell
git rev-parse --show-toplevel
git branch --show-current
git status --short
git log -5 --oneline
```

必须确认：

```text
- 当前目录是预期项目根目录
- 当前 branch 正确
- 工作区干净，或已有改动已由用户明确说明
- 最近 commit 与用户上下文不冲突
```

如果发现不明改动：

```text
STOP: unexpected_worktree_changes
```

不得继续写入。

### 8.2 禁止命令

默认禁止：

```powershell
git reset --hard
git clean -fd
git clean -fdx
git checkout -- .
git push
git push --force
rm -rf
Remove-Item -Recurse -Force
supabase db push --linked
vercel --prod
```

除非用户明确批准且当前任务就是对应操作。

### 8.3 写入后必须执行

```powershell
git status --short
git diff --name-only
git diff --stat
```

必须确认：

```text
- 所有修改文件都在 allowed_write_files 内
- 没有计划外文件
- 没有跨项目文件
- 没有高风险文件被误改
- package.json / lockfile / config 没有被意外修改
```

如果异常：

```text
STOP: file_scope_violation
```

### 8.4 Checkpoint Commit

默认规则：

```text
Writer 完成
→ Reviewer 通过
→ test_runner 通过
→ Main Agent 确认 DoD
→ 建议本地 checkpoint commit
→ 不自动 push
```

commit message 模板：

```text
checkpoint(<phase>): <short summary>
```

如未获得用户批准，不得 push。

---

## 9. File Ownership Matrix v2

每个 Phase 或写入任务开始前，Main Agent 必须生成 File Ownership Matrix。

模板：

```yaml
fileOwnershipMatrix:
  phase:
  taskId:
  riskLevel:
  strategicStage:
  engineeringPhase:

  allowedReadFiles:
    - ...

  allowedWriteFiles:
    - ...

  forbiddenFiles:
    - ...

  sensitiveFiles:
    - ...

  allowedCommands:
    - ...

  forbiddenCommands:
    - ...

  readOnlySubagents:
    - repo_explorer
    - blueprint_auditor
    - security_reviewer

  singleWriter:
    name: implementation_worker
    enabled: true

  changeBudget:
    maxFiles:
    maxLinesApprox:
    maxAttempts:

  validationRequired:
    - npm run lint
    - npm run typecheck
    - npm run build

  stopGates:
    - unexpected_git_status
    - need_file_outside_allowlist
    - high_risk_area
    - test_fail_twice
```

没有 File Ownership Matrix：

```text
不得调用 Writer。
```

---

## 10. 标准 Main Agent 编排流程

Main Agent 必须按顺序执行：

```text
1. Preflight
   - 读取 AGENTS.md / Skill / 总纲 / 当前 Phase
   - 检查 Git root、branch、status
   - 汇报当前 Phase 和 scope 标签

2. Create File Ownership Matrix
   - 明确 allowed_read_files
   - 明确 allowed_write_files
   - 明确 forbidden_files
   - 明确 stop gates

3. Parallel Read-only Investigation
   - 创建 repo_explorer / blueprint_auditor / architecture_researcher / security_reviewer 等只读子 Agent
   - 子 Agent 不得修改文件

4. Wait for All Read-only Reports
   - 必须等待全部只读子 Agent 完成或明确失败

5. Resolve Conflicts
   - 比较子 Agent 报告
   - 标注证据
   - 过滤无依据猜测
   - 如果结论冲突且无法解决，停止

6. Final Implementation Plan
   - 生成唯一写入计划
   - 限定 allowed_write_files
   - 限定 change budget

7. Assign Single Writer
   - 只允许一个 implementation_worker
   - Writer 串行修改

8. Main Agent Diff Review
   - git status / diff / stat
   - 检查越界修改

9. Reviewer
   - 只读审查 diff
   - 输出 pass / changes_required / blocked

10. Targeted Fix If Needed
   - 只让同一个 Writer 修 blocking findings
   - 不得扩大范围

11. test_runner Validation
   - 运行指定命令
   - 汇报结果

12. Definition of Done Check
   - 主 Agent 逐项核对

13. Checkpoint / Acceptance Pack
   - 输出报告
   - 建议本地 checkpoint commit
   - 等待用户确认进入下一阶段
```

---

## 11. 子 Agent JSON 返回格式

### 11.1 只读子 Agent 返回格式

所有只读子 Agent 必须返回：

```json
{
  "taskId": "",
  "role": "",
  "status": "completed | blocked | failed",
  "changesMade": false,
  "filesRead": [],
  "commandsRun": [],
  "findings": [
    {
      "severity": "blocking | high | medium | low | info",
      "summary": "",
      "evidence": "",
      "files": [],
      "confidence": "high | medium | low"
    }
  ],
  "recommendation": "",
  "alternatives": [],
  "risks": [],
  "openQuestions": [],
  "stopGateTriggered": false,
  "stopGateReason": ""
}
```

要求：

```text
- changesMade 必须是 false
- filesRead 必须真实
- commandsRun 必须真实
- 没有证据不得写 high confidence
- 不得声称运行了未运行的命令
```

### 11.2 Writer 返回格式

```json
{
  "taskId": "",
  "role": "implementation_worker",
  "status": "completed | needs_scope_change | blocked | failed",
  "filesChanged": [],
  "actualFilesChangedOutsideAllowlist": [],
  "commandsRun": [],
  "testsPassed": [],
  "testsFailed": [],
  "scopeDeviations": [],
  "remainingRisks": [],
  "gitStatusShort": "",
  "diffSummary": "",
  "needsHumanInput": false,
  "humanInputReason": ""
}
```

### 11.3 Reviewer 返回格式

```json
{
  "taskId": "",
  "role": "reviewer",
  "verdict": "pass | changes_required | blocked",
  "findings": [
    {
      "severity": "blocking | high | medium | low",
      "file": "",
      "evidence": "",
      "requiredFix": ""
    }
  ],
  "missingTests": [],
  "scopeViolations": [],
  "securityConcerns": [],
  "approval": "approved | not_approved"
}
```

### 11.4 test_runner 返回格式

```json
{
  "taskId": "",
  "role": "test_runner",
  "status": "completed | failed | blocked",
  "commandsRun": [
    {
      "command": "",
      "exitCode": 0,
      "passed": true,
      "stdoutSummary": "",
      "stderrSummary": ""
    }
  ],
  "missingCommands": [],
  "failureLikelyCausedByCurrentChange": "yes | no | unknown",
  "recommendation": ""
}
```

---

## 12. Stop Gates

遇到以下情况，必须停止。

### 12.1 写入与范围风险

```text
- 多个子 Agent 试图同时写文件
- 只读子 Agent 修改了文件
- Writer 修改了 allowlist 外文件
- git status 出现计划外文件
- diff 混入不相关修改
- 当前任务需要修改 forbidden_files
- 需要跨 Engineering Phase
```

### 12.2 高风险业务区

```text
- 支付 / Billing
- Credits / Points Ledger
- Creem / Stripe / LemonSqueezy
- Webhook
- Supabase schema
- Supabase RLS
- Auth
- 用户权限 / admin 权限
- API key
- 文件权限 / Storage RLS
- 生产环境变量
- Vercel production 配置
- 数据库迁移
- 用户真实数据
- 删除 / 匿名化用户数据
```

### 12.3 HumanOps 风险

```text
- 需要真实 API key
- 需要 service_role
- 需要 webhook secret
- 需要 SMTP password
- 需要 DNS 配置
- 需要真实支付
- 需要生产部署
- 需要生产数据库写入
```

必须生成 Operator Packet，并等待用户操作。

### 12.4 UI / 产品风险

```text
- 改变整体 UI 设计风格
- 改变移动端布局结构
- 大范围重构组件系统
- 重写页面结构
- 文案变化可能撑爆布局
```

### 12.5 验证失败

```text
- 同一错误连续修复 2 次仍失败
- lint/typecheck/test/build 连续失败 2 次
- 命令不存在且无法判断替代命令
- build 失败原因不明确
- 测试结果互相矛盾
```

### 12.6 上下文冲突

```text
- 总纲、AGENTS.md、当前用户指令互相冲突
- 当前工作目录和预期项目不一致
- 当前 branch 不明确
- 找不到当前 Phase
- 发现旧版本总纲与当前总纲冲突
```

---

## 13. Retry Budget

每轮任务必须有重试预算。

默认：

```text
maxWriterAttempts: 2
maxTestFixAttempts: 2
maxReviewerFixAttempts: 2
maxUnexpectedScopeExpansions: 0
maxCrossPhaseAdvance: 0
```

超过预算：

```text
status = blocked
需要用户确认
```

禁止：

```text
无限循环修复
为了通过测试而删除测试
为了构建通过而移除功能
为了省事而扩大修改范围
```

---

## 14. 决策权限矩阵

### 14.1 Main Agent 可以自行决定

```text
- 可逆的目录命名
- 文档结构
- 内部类型命名
- 测试文件布局
- 低风险 lint / formatting
- 非生产 mock 命名
- 无付费成本的开发工具细节
```

前提：

```text
必须记录在报告或 ADR 草案中。
```

### 14.2 E0/E1 阶段末尾统一请求用户批准

```text
- monorepo 工具选择
- package manager
- testing stack
- local Supabase / mock 策略
- versioned package + generator 边界
- CI 基础策略
```

### 14.3 必须单独请求用户批准

```text
- 付费外部服务
- 生产环境
- 真实密钥
- DNS
- 生产数据库
- destructive migration
- 真实支付
- 公开定价与商业模式
- 不可逆架构迁移
- 多 Writer 并发写入
```

---

## 15. HumanOps / Operator Packet

任何涉及外部后台或人工操作的任务，必须生成 Operator Packet。

目录模板：

```text
operator-packets/<service>/<environment>/<YYYY-MM-DD>/
  README.md
  fields-to-copy.md
  env-table.csv
  dns-records.csv
  powershell-commands.ps1
  verification.md
  rollback.md
```

Operator Packet 必须包含：

```text
1. 服务名称
2. 配置目的
3. 是否涉及敏感密钥
4. 打开的网站
5. 登录后点击路径
6. 需要复制的字段
7. 需要填入的位置
8. PowerShell 安全输入方式
9. Vercel env 表格
10. DNS 记录表
11. Webhook URL / Redirect URL
12. 验证命令
13. 成功标准
14. 常见失败原因
15. 回滚方式
16. 是否需要真实生产确认
```

禁止：

```text
- 让用户把 secret 发到聊天窗口
- 在命令中明文写 secret
- 把 secret 写进日志
- 把 secret 写进前端
```

推荐：

```powershell
npm run setup:secrets
npm run check:env
npm run check:release
```

检查输出只能是：

```text
true / false / masked / manual-check-required
```

---

## 16. Validation Strategy

### 16.1 默认验证命令

优先运行存在的命令：

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run doctor
```

如项目没有对应命令：

```text
报告 missingCommands；
不得伪造成功。
```

### 16.2 高风险模块额外验证

Auth:

```text
- 登录 / 注册 mock 流程
- email verification mock
- reset password mock
- session guard
- admin access denied
```

Billing / Credits:

```text
- duplicate webhook 不重复加点
- credits grant / consume / refund
- entitlement gating
- idempotency key
```

File / Job / Report:

```text
- ownership check
- job status transition
- failure rollback
- signed download mock
```

Security:

```text
- server-only env 不进入前端
- service_role 不出现在 client bundle
- 普通用户不能访问 admin
- 用户 A 不能访问用户 B 数据
```

### 16.3 测试层级

```text
Unit:
  纯逻辑、状态机、扣点、权限判断

Integration:
  模块组合、mock webhook、mock auth、mock jobs

E2E:
  Golden Path 用户流程

Security:
  权限、secret、越权访问、重复事件
```

---

## 17. Golden Path

对于项目生产线或 SaaS 底座类项目，必须定义 Golden Path。

示例：

```text
创建 Reference App
→ 读取 app config
→ 本地启动
→ 注册账号
→ mock 验证邮箱
→ 登录 dashboard
→ mock checkout
→ mock webhook
→ subscription / credits 到账
→ 创建 mock job
→ reserve credits
→ job succeeded
→ commit credits
→ 生成 mock report
→ 检查 report ownership
→ 查看 audit log
→ doctor 通过
→ release-check 通过
```

Golden Path 未跑通：

```text
不得宣布 Core 完成。
```

---

## 18. Multi-Agent Phase Automation 边界

允许：

```text
在同一个 Engineering Phase 内自动：
- 调查
- 分工
- 写入
- 审查
- 测试
- 定向修复
- 输出 Acceptance Pack
```

禁止：

```text
未经用户批准自动进入下一 Engineering Phase。
```

阶段结束时：

```text
Main Agent 必须停止，并询问：
是否批准进入下一 Engineering Phase？
```

---

## 19. Checkpoint / Acceptance Pack 模板

每轮完成必须输出：

```text
Single Writer Multi-Agent Checkpoint

Project:
Blueprint Version:
Strategic Stage:
Engineering Phase:
Task ID:
Risk Level:

Main Agent Role:
- orchestrator/reviewer

Subagents Called:
- ...

Read-only Reports Summary:
- ...

Implementation Worker:
- called / not called
- model / reasoning:
- allowed_write_files:
- actual_modified_files:

File Safety Review:
- Were all modified files in allowed_write_files? yes/no
- Unexpected files? yes/no
- Cross-project files? yes/no
- Forbidden files touched? yes/no

Git Status:
- ...

Git Diff Summary:
- ...

Validation:
- commands:
- results:
- missing commands:

Reviewer Verdict:
- pass / changes_required / blocked

Stop Gates:
- triggered: yes/no
- reason:

HumanOps:
- needed: yes/no
- operator packet path:

UI / Mobile Risk:
- ...

Business Logic Risk:
- ...

Security Risk:
- ...

Suggested Commit Message:
- ...

Next Step:
- ...

Need User Confirmation:
- ...
```

---

## 20. 模型与速度路由原则

不要永久写死模型版本。应按当时可用模型、任务风险和额度动态选择。

原则：

```text
1. 低风险文档、复制、占位任务：低消耗模型 / 低或中推理。
2. 中风险 UI、普通功能：中等可靠模型 / 中推理。
3. 高风险 Auth、Billing、Credits、DB、RLS、Webhook：高可靠模型 / 中高推理。
4. 安全审查、架构锁定、生产前检查：最高可靠模型 / 中高推理。
5. 不可用时不得静默降级处理高风险任务。
6. 写入任务必须只有一个 Writer，无论使用哪个模型。
```

输出时必须说明：

```text
- 推荐模型类型
- 推荐速度 / reasoning effort
- 选择理由
- 是否为了节省额度
- 是否存在高风险
```

---

## 21. AGENTS.md 推荐最小插入内容

将以下内容放入项目根目录 `AGENTS.md`，保持简短：

```text
## Single Writer Multi-Agent Workflow

Before starting any task, read:

1. docs/SINGLE_WRITER_MULTI_AGENT_SKILL.md
2. current phase / execution plan, if present
3. project blueprint or PROJECT_BLUEPRINT, if present

Rules:

1. Main Agent is the orchestrator and reviewer, not the default writer.
2. Only one subagent may have write permission at any time.
3. All other subagents are read-only by default.
4. The only writing subagent is implementation_worker / writer.
5. The writer may only modify files listed in allowed_write_files.
6. Before any write task, Main Agent must create a File Ownership Matrix.
7. Read-only subagents may inspect files and propose changes, but must not edit files.
8. test_runner may run safe verification commands but must not edit files.
9. Main Agent must inspect git status and git diff before and after any write operation.
10. If unexpected files appear in git status or git diff, stop immediately.
11. Stop before payment, billing, credits, database, RLS, Auth, webhook, environment variable, DNS, or production deployment changes.
12. Do not ask the user to paste secrets into chat. Use HumanOps / Operator Packet.
13. Do not auto-advance to the next Engineering Phase without user approval.
```

---

## 22. Codex 安装本 Skill 的指令模板

```text
【当前任务】
请把我提供的 SINGLE_WRITER_MULTI_AGENT_SKILL.md 安装为本项目的多 Agent 协作安全规范。

【推荐模型与速度】
使用低消耗模型 / 中速。
理由：这是低风险文档安装任务，不需要高消耗模型。

【执行前检查】
请先只读汇报：
1. 当前工作目录
2. Git root
3. 当前 git branch
4. git status --short
5. 最近 5 个 commit
6. 项目根目录是否已有 AGENTS.md
7. 项目根目录是否已有 docs/ 目录
8. 是否存在 .codex/ 目录

【允许修改】
- 可以新建或更新 docs/SINGLE_WRITER_MULTI_AGENT_SKILL.md
- 可以新建或小范围更新 AGENTS.md，让它引用该 Skill
- 可以创建 docs/ 目录
- 可以创建 .codex/agents/ 示例配置，但必须先说明

【禁止修改】
- 不得修改业务代码
- 不得修改 UI
- 不得修改数据库
- 不得修改支付
- 不得修改 Auth / RLS / webhook
- 不得修改环境变量
- 不得修改 package.json，除非用户批准
- 不得运行破坏性命令
- 不得跨项目操作
- 不得 push

【安装要求】
1. 如果 docs/ 目录不存在，请创建 docs/。
2. 将 SINGLE_WRITER_MULTI_AGENT_SKILL.md 放入 docs/。
3. 如果 AGENTS.md 已存在，只追加一个简短章节引用本 Skill，不要重写整个 AGENTS.md。
4. 如果 AGENTS.md 不存在，请创建一个最小版 AGENTS.md，并引用本 Skill。
5. 安装完成后运行：
   - git status --short
   - git diff -- docs/SINGLE_WRITER_MULTI_AGENT_SKILL.md AGENTS.md
6. 确认没有业务代码被修改。

【完成后汇报】
必须汇报：
1. 新建或修改了哪些文件
2. AGENTS.md 是否已引用本 Skill
3. git status
4. git diff 摘要
5. 是否确认没有修改业务代码
6. 是否需要用户确认创建 .codex 配置
```

---

## 23. Main Agent 启动模板

```text
【当前项目】
项目名称：

【本次角色】
你是本项目的 Main Agent / Orchestrator。
你负责总控、审查、调度、下达命令、验收。
你不是默认写入者。

【必须遵守】
请先读取：
1. AGENTS.md
2. docs/SINGLE_WRITER_MULTI_AGENT_SKILL.md
3. 项目执行总纲 / 当前 Phase 文档

【核心规则】
- 同一时间只能有一个子 Agent 写入。
- 所有子 Agent 默认只读。
- 唯一写入子 Agent 是 implementation_worker / writer。
- Writer 只能修改 allowed_write_files。
- 主 Agent 原则上不直接写文件，只审查、调度和验收。
- 遇到 Stop Gate 必须停止等待用户确认。
- 阶段内可以自动推进；不得自动跨阶段。

【本次任务】
请自动推进当前 Engineering Phase 的一轮闭环：
Preflight → 只读子 Agent 审查 → 主 Agent 汇总 → 唯一 Writer 写入 → 主 Agent 审查 diff → Reviewer 审查 → test_runner 验证 → Checkpoint / Acceptance Pack。

【执行前检查】
请先只读汇报：
1. 当前工作目录
2. Git root
3. 当前 git branch
4. git status --short
5. 最近 5 个 commit
6. 当前项目是否正确
7. 当前 Strategic Stage
8. 当前 Engineering Phase
9. 当前 IMPLEMENT_NOW / SCAFFOLD_ONLY / ROADMAP_ONLY / FORBIDDEN_IN_PHASE
10. 本次 File Ownership Matrix 草案
11. 本次可能调用哪些子 Agent

【Stop Gates】
遇到以下情况必须停止：
- 多个子 Agent 需要写入
- 计划外文件变化
- 需要修改 allowlist 外文件
- 支付 / billing / credits / database / RLS / Auth / webhook / env / DNS / production
- UI 风格或移动端布局结构需要大改
- 测试连续失败 2 次
- 任务范围超出当前 Engineering Phase
- 无法确认业务规则
- 需要真实 secret 或生产操作

【完成后输出】
请输出：
1. Phase 名称
2. File Ownership Matrix
3. 调用了哪些子 Agent
4. 每个子 Agent 的报告摘要
5. implementation_worker 是否被调用
6. 修改了哪些文件
7. 是否全部在 allowed_write_files 内
8. git status
9. git diff 摘要
10. 验证命令和结果
11. Reviewer verdict
12. 是否触发 Stop Gate
13. 是否建议本地 checkpoint commit
14. 下一步建议
15. 是否需要用户批准进入下一阶段
```

---

## 24. Phase E0 专用启动模板

用于 H-LaunchKit 或大型项目的架构锁定阶段。

```text
【当前任务】
你是 Main Agent。请按照 Single Writer Multi-Agent Skill 执行 Engineering Phase E0：Architecture Lock。

【目标】
只做架构锁定、执行规则、Agent Harness、ADR、模块契约、测试策略、Phase 边界、HumanOps 可执行包设计。
不得实现 Auth、Billing、Email、Credits、Webhook、File、Job、Report 等业务代码。

【允许】
- 只读调查当前仓库
- 创建架构文档
- 创建 ADR 草案
- 创建 module registry 草案
- 创建 current-phase 草案
- 创建 .codex 配置草案
- 创建 Agent 返回 schema
- 创建 test matrix
- 创建 E1 任务草案

【禁止】
- 不得写业务功能
- 不得接真实 Supabase
- 不得接真实 Creem
- 不得接真实 Resend
- 不得创建真实生产 env
- 不得写生产数据库 migration
- 不得创建 GrowthOps / OperateKit 空壳
- 不得自动进入 E1

【推荐只读子 Agent】
- repo_explorer
- blueprint_auditor
- architecture_researcher
- security_reviewer

【唯一 Writer】
只有在只读报告汇总后，才能让 writer 创建 E0 允许的文档和配置草案。

【完成标准】
输出 E0 Acceptance Pack：
1. 总纲冲突已解决
2. Monorepo / package / generator 边界明确
3. 模块状态分类明确
4. Agent 配置草案明确
5. AGENTS.md 加载策略明确
6. Git / checkpoint 协议明确
7. Test strategy 明确
8. HumanOps Operator Packet 格式明确
9. E1 入口条件明确
10. 明确等待用户批准进入 E1
```

---

## 25. 高风险任务专用前置审查模板

用于支付、Auth、Credits、RLS、Webhook、数据库任务。

```text
【高风险前置审查】
当前任务涉及高风险模块：
- Auth / Billing / Credits / Webhook / RLS / DB / Env / Production

在写任何代码前，必须先执行只读审查：

1. 当前文件范围
2. 相关数据模型
3. 幂等要求
4. 权限边界
5. 失败回滚
6. 测试计划
7. Human Approval 是否需要
8. allowed_write_files
9. forbidden_files
10. rollback plan

只有用户批准后，才能调用唯一 Writer。
```

---

## 26. 常见错误模式与修正

### 错误模式 1：多个子 Agent都写代码

错误：

```text
ui_agent 修改 UI
billing_agent 修改 billing
test_agent 修测试
main_agent 又改了一遍
```

正确：

```text
ui_agent / billing_agent / test_agent 都只读；
主 Agent 汇总；
唯一 Writer 串行写入。
```

### 错误模式 2：只读 Agent 顺手修复

错误：

```text
Reviewer 看到 bug 后直接改代码。
```

正确：

```text
Reviewer 只返回 changes_required；
主 Agent 指派唯一 Writer 定向修复。
```

### 错误模式 3：allowed_write_files 太宽

错误：

```text
Allowed Write Files:
- src/**
```

正确：

```text
Allowed Write Files:
- src/app/login/page.tsx
- src/lib/auth/auth-errors.ts
```

除非是架构阶段，否则不要给目录级无限写权限。

### 错误模式 4：AGENTS.md 过长

错误：

```text
把完整项目总纲塞进 AGENTS.md。
```

正确：

```text
AGENTS.md 只放硬规则；
长总纲放 docs/blueprint；
任务开始时按需读取。
```

### 错误模式 5：ROADMAP_ONLY 变成空壳代码

错误：

```text
为了表示未来要做 GrowthOps，先创建 src/growth/*
```

正确：

```text
ROADMAP_ONLY 只存在总纲和 module-registry roadmap 字段；
不得创建源码空壳。
```

---

## 27. 最终工作模式

本 Skill 的最终工作模式：

```text
多个子 Agent 可以并行读取、审查、测试、提出建议。
主 Agent 负责统一判断、统一调度、统一验收。
同一时间只有一个 Writer 可以写文件。
所有写入必须受 allowed_write_files 限制。
所有写入后必须由主 Agent 审查 git diff。
所有高风险动作必须经过 Human Approval。
所有 Phase 完成后必须输出 Checkpoint / Acceptance Pack。
```

最重要的一条：

```text
并行只读，串行写入，主控审查，逐项验收。
```

---

## 28. 版本更新记录

### v2.0.0

相对 v1 主要升级：

```text
- 加入 Agent Harness 概念
- 加入阶段内自动、阶段间确认
- 加入 Codex .codex/config.toml / .codex/agents 配置建议
- 加入 AGENTS.md 加载与体积控制
- 加入风险等级 R0-R4
- 加入 IMPLEMENT_NOW / SCAFFOLD_ONLY / ROADMAP_ONLY / FORBIDDEN_IN_PHASE
- 加入 File Ownership Matrix v2
- 加入子 Agent JSON 返回格式
- 加入 Retry Budget
- 加入决策权限矩阵
- 加入 HumanOps Operator Packet
- 加入 Golden Path
- 加入 E0 专用启动模板
- 加入高风险任务前置审查模板
- 移除固定模型版本依赖，改为动态模型路由原则
- 强化 Git 安全协议
- 强化单 Writer 多 Agent 执行闭环
```

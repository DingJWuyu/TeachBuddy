# dsh headless code-review 收尾调查

- 调查日期：2026-09-21
- 本机入口：`dsh --version` 为 `0.1.5-rc.1`；入口解析到的 `dsh-headless`、`dsh-base`、`dsh-subagent` 和相关 provider 为 `0.1.5-rc.2`。以下结论针对这套实际安装，不外推到当前 master。
- 范围：只检查 B13@1 的保存产物、候选提交、本机匹配版本实现和已保存 session；没有启动 dsh、调用模型、测试产品或联系任何 session。

## 结论

两位 reviewer 当前都不存活，且没有可直接取用的最终审查结果。能取到的是两个 child 的部分压缩 transcript 和 child ID，不是 reviewer 的 closing message，也不是 `subagent/end` settlement。B13 父进程退出码 0 只证明父 Agent 的最后一轮正常结束，不能证明两轴审查完成。

正确的最小路径是：保留候选 `80769179f7caf367fda4e0467aa7601cb3fc8ed0`，新 dsh 只做收尾审查；在同一个 assistant turn 中并行发出 Standards 和 Spec 两个 `subagent` 调用，并且每个调用都显式传 `run_in_background:false`。等两个工具调用都返回后，父 Agent 才聚合、更新 B13 回执并提交。不要复用这次悬挂 child，也不要把最终回答写成“等待后会自动续跑”。

## B13 保存状态核对

调度目录 `/home/liam_t/项目/TeacherWorkspace-mvp/.scratch/dag-dispatch/B13/1/` 给出：

- `launch.json`：PID `121778`，启动时间 `2026-09-21T19:35:54.559580+00:00`。
- `exit.json`：`exit_code: 0`，结束时间 `2026-09-21T19:48:45.350228+00:00`。
- `stdout.log` 和 `receipt.md` 只有“**两位 reviewer 仍在运行**，等两份审查结果到达后聚合”的草稿，没有审查内容。
- `notification.json` 只是外层已将 `exit_code: 0` 的消息排入根线程；它不包含两份审查结果。

父 session 的保存日志为：

`/home/liam_t/.dsh/sessions/--home-liam_t-~9879~76EE-TeacherWorkspace-b13--/session-bd3f4354-152a-465a-9b1c-93732a28219f/session.v3.jsonl.zstd`

其中 seq 453、454 的两个 `subagent` 调用都没有 `run_in_background` 参数；seq 456、458 立即返回两个 child ID。父 seq 486 的最终 assistant message 仍是“reviewer 仍在运行”，seq 488 随即写入 `turn/end`。这就是父 Agent 在未收到结果时自行完成最后一轮的直接证据。

两个 child 的保存日志分别是：

```text
/home/liam_t/.dsh/sessions/--home-liam_t-~9879~76EE-TeacherWorkspace-b13--/da1d2568-13d3-4e11-86ea-e1f8aee81114/session.v3.jsonl.zstd
/home/liam_t/.dsh/sessions/--home-liam_t-~9879~76EE-TeacherWorkspace-b13--/283573a5-c9f3-42fe-9aac-057d6a9f475b/session.v3.jsonl.zstd
```

两者都保存了 `subagent/descriptor`、prompt、工具调用和部分审查步骤，但 `turn/end` 数量都是 0；Standards child 最后停在 seq 97 的 `step/start`，Spec child 最后停在 seq 100 的 `step/start`。没有 `subagent/end`、`send_message` 或最终 reviewer 文本。父 PID 已不存在，进程内 spawn child 不可能继续存活。因此：

- 已证实保存可取：部分 transcript、child descriptor、child ID。
- 已证实没有保存可取：两份最终 review、settlement notice、聚合结果。
- 未证实且不应猜测：退出时两个 child 是被 root teardown 取消，还是在下一步前因进程结束丢失。这个区别不影响收尾结论。

候选状态也没有被破坏：B13 worktree `HEAD` 仍为 `8076917`，唯一未提交文件是 `docs/acceptance/evidence/B13/v1/author.md`，其中 `review_target` 和 `internal_reviewers` 仍为 pending/empty。实现、测试证据和候选提交已经存在，不需要从头实现。

## 本机实现说明

### headless 等待的边界

安装包 `/home/liam_t/.local/share/pi-node/node-v22.23.2-linux-x64/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-headless/lib/index.js:127-167` 的流程是：

1. `agent.followup(...)` 投递父任务。
2. `await agent.whenIdle()`，只等待这个父 Agent 自身达到 quiescence。
3. `sessions.flush(agent.session)`，从父 session 汇总最后 assistant 文本。
4. 写 stdout，再按父 `turn/end` reason 请求退出。

这里没有等待 `subagentCatalog` 中的 child，也没有 `Promise.all`、child settlement barrier 或“最终回答后再自动续一轮”。profile 的 app exit 也是异步请求：`lib/profile-boot-Dk-7KqJc.js:286-318` 将 runner 的 `exit` 接到 shutdown，但不存在外层 Codex 的完成 callback。

### 为什么这次调用立即返回

本机 `/home/liam_t/.local/share/pi-node/node-v22.23.2-linux-x64/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml:328-355` 把 `tool-subagent` 配置为：

```yaml
provider: spawn
backgroundMode: continuable
```

对应实现 `/home/liam_t/.local/share/pi-node/node-v22.23.2-linux-x64/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-tool-subagent/lib/index.js:354-360, 521-560` 将省略的 `run_in_background` 解析为 `true`，调用 `startContinuable()`，只等 child inbox 接受初始 prompt。`dsh-subagent/lib/index.js:1637-1642, 2873-2883` 明确说明该 API 在接受 prompt 时返回，不等待 child turn 或结果。

背景 child 完成后，runtime 会通过 `/home/liam_t/.local/share/pi-node/node-v22.23.2-linux-x64/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-subagent/lib/index.js:1244-1258` 尝试唤醒仍存活的父 Agent并发送 settlement notice；这不是当前工具调用的返回值，也不是持久 parent mailbox。父 Agent 已进入最终回答和退出流程后，不能依赖该 notice 触发新的聚合回合。

### 可用的等待方式

| 调用方式 | 本机行为 | 两轴收尾是否可靠 |
| --- | --- | --- |
| 省略 `run_in_background` | continuable 默认后台，立即返回 child ID | 否 |
| 每个调用显式 `run_in_background:false` | `dsh-tool-subagent/lib/index.js:314-329, 557-560` 等待 `run.result`，随后等待 dispose | 是 |
| 同一 assistant turn 发两个 `run_in_background:false` 调用 | tool 标记为 concurrency-safe，两个独立前台调用可并行；父 Agent 在两个结果返回后再生成下一步 | 是，必须显式等待并聚合 |
| 后台调用后直接 final，指望 notice 续跑 | parent `whenIdle()` 不等待 child，且 headless 会退出 | 否 |

## 给下一 dsh 的最小必要指令

把下面内容作为在 B13 worktree 启动的最小续接任务。它只重做丢失的 review 收尾，不重做实现：

```text
继续 B13@1 的收尾，不从头实现、不修改生产代码。工作区：
/home/liam_t/项目/TeacherWorkspace-b13。现有候选 HEAD：
80769179f7caf367fda4e0467aa7601cb3fc8ed0；code-review fixed point：
b938f8af0b8152718f5063d4326d494bf8b5426c。现有 self test/build 证据和
apps/api 实现已在候选中，docs/acceptance/evidence/B13/v1/author.md 是待补完的
未提交回执。

只做 code-review 收尾：按 code-review skill 的 Standards/Spec 两轴要求，在同一个
assistant turn 中并行调用两次 subagent，两个调用都必须显式设置
run_in_background:false。不要省略该字段，不要只接收 child ID，不要先写 final。
等两个前台工具调用都返回后，在父 Agent 内聚合两份结果；若任一调用失败，明确记为
review 未完成，不得伪造 PASS。然后只更新 B13 author.md 的 reviewer、aggregate、
commit_range 和实际未决项，提交该回执文件；保留候选实现和已有证据，不合 main、不 push。
最终报告候选 SHA、两轴原文结果、聚合结果和未决项。
```

这条指令选择新建两个前台 reviewer，而不是尝试恢复本次 child：本次 child 只有未完成 transcript，父 Agent 已不再存活，继续它们没有可证明的结果交付路径。已有候选正是接续点。

## 依据与已知边界

- 本机 headless README 的 run flow 说明它等待父 Agent quiescence、flush session、输出最终文本并退出；tool-subagent README 说明 `continuable` 默认后台、`run_in_background:false` 才前台等待。安装包源码是本次主要依据。
- `docs/research/dsh-receipts.md` 已记录同版本的 stdout/stderr、退出映射和不存在跨 harness callback 的结论；本次新增的 B13 session 时间线与压缩日志核对了该边界。
- 没有运行真实 dsh 任务来验证新的前台续接命令，也没有实际发起 `codex queue`；下一 dsh 需要自己产生两份真实 review 后再写回执。

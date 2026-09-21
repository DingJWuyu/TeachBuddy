# dsh headless 回执能力调研

- 核查日期：2026-09-21
- 受查本机：`dsh --version` 为 `0.1.5-rc.1`；入口链接到 `@deepseek-ai/dsh/lib/bin.js`。已解析的 `@deepseek-ai/dsh-headless`、`dsh-base` 及核心包为 `0.1.5-rc.2`。
- 安装源证据：本机包路径为 `/home/liam_t/.local/share/pi-node/node-v22.23.2-linux-x64/lib/node_modules/@deepseek-ai/dsh`，包的 repository 指向 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)，目录为 `apps/cli`。
- 证据范围：本机 help、安装包源码、无模型调用的 CLI 检查，以及匹配 `dsh-v0.1.5-rc.2` 的官方源码和文档。没有执行真实任务。

## 主结论

| 问题 | 结论 | 证据 |
| --- | --- | --- |
| 是否同步等待并退出 | **[已确认] 是。** headless 等待 Agent 空闲、flush Session、写最终文本，再请求 launcher 退出；调用 shell 会一直等待该进程。 | 本机 `dsh-headless/lib/index.js:127-167`；[官方匹配版本 runner 源码](https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/dsh-v0.1.5-rc.2/packages/bundle/headless/src/index.ts#L160-L201) |
| 最终结果能否落盘 | **[已确认] 能，但靠 stdout 重定向。** 本机没有 `--output` 或结果文件选项；`>result.txt` 可保存最终 assistant 文本，`2>log.txt` 可保存 reasoning 和错误。 | 本机 `dsh --profile headless --help` 只列 `-h/--help`；[官方 headless README](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/bundle/headless/README.md#running-a-one-shot-task) |
| 是否有 CLI 可解析事件流 | **[已确认于本机版本] 没有。** stdout 是最终文本，stderr 是 reasoning/错误，不是事件协议；`dsh --profile headless --json` 实测返回 `error: unknown option '--json'`。内部 Session 会另存 JSONL，但 base 默认用 `$DSH_HOME/sessions` 和 zstd 压缩，它不是 stdout 事件流。 | 本机 `dsh-headless/lib/index.js:27-55,65-115`、`dsh-base/cordis.patch.yml:107-113`；[官方 Session JSONL 文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/session/session-persistence-jsonl/README.md#%E6%A6%82%E8%BF%B0) |
| 是否返回真实任务状态 | **[已确认] 正常任务有。** `completed` 为 0，aborted/error/no turn 和直接 driver failure 为 1；error 会写 stderr。注意 launcher 自己把 SIGINT 映射为 130，把 SIGTERM 映射为 0，因此不能只把所有 `rc=0` 当成模型正常完成。 | 本机 `dsh-headless/lib/index.js:116-167`、`profile-boot-Dk-7KqJc.js:21-69,290-300`；[官方退出映射](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/bundle/headless/README.md#exit-mapping) |
| 是否有跨 harness 完成 callback/hook/queue | **[已确认] headless 没有。** dsh 的内部 jobs completion notice、subagent settlement notice 和可选 Codex hooks 都是 dsh 进程/会话内机制，不会主动定位并唤醒一个外部 Codex session。 | [jobs-local 官方限制](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/jobs/jobs-local/README.md#known-limitations-and-deferred-work)、[Codex hooks bridge](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/hooks/hooks-codex/README.md#what-your-hooks-can-do)、[subagent 限制](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/subagent/subagent/README.md#known-limitations-and-deferred-work) |

## 主动通知与内部能力的边界

- **jobs**：headless 继承的 `dsh-base` 确实挂载了 `dsh-jobs-local` 和 `dsh-tool-jobs`。它们可在同一 dsh 会话中发送完成通知，但实现是进程内记录，harness 进程结束即消失，不能通知外部 Codex。
- **Codex hooks**：`dsh-hooks-codex` 需要显式挂载并提供 `hooks.json`。它支持 `SessionStart`、prompt、tool 和 `Stop` 等 Agent 生命周期点；`Stop` 是即将停止时的 dsh 内部事件，不是父进程退出后的 callback。配置的 command hook 理论上可以自行调用 `codex queue`，但那是外层用户 glue，不是 dsh 的原生跨 harness 回执。
- **Schedule**：官方 [Schedule README](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/schedule/schedule/README.md#known-limitations-and-deferred-work) 说明它是 session-local reminder，没有 email、push、外部 channel 或 receipt；而且需要 live root agent。它不能替代任务完成回执。
- **内部 subagent，次要事实**：`dsh-base` 静态挂载 in-process spawn/fork provider；one-shot 可等待结果，continuable 可在 dsh parent 会话里收到 settlement notice。它们不是独立的外部 session 通知机制；进程本地、无持久 parent mailbox，headless 退出后不能继续承担 Codex 回执责任。

因此，“没有原生跨 harness 通知”只说明回执责任在外层，不说明 dsh 不能用于编排。

## 可行的最小外层路径

**[已确认可行，静态证据]** 本机 `codex-cli` 为 `0.155.1`，`codex queue --help` 明确支持：`codex queue --thread <THREAD> --message <TEXT>`。不使用持续轮询时，外层按顺序执行即可：

```sh
set +e
dsh --profile headless "$TASK" >"$RESULT" 2>"$LOG"
rc=$?

# 先落盘结构化 receipt，至少包含 task、attempt、rc、RESULT 和 LOG 路径
# 正常 rc=0 写 PASS；正常 rc!=0 写 FAIL，不把正常 FAIL 伪装成异常
codex queue --thread "$ORCHESTRATOR_THREAD" \
  --message "[DSH_DONE] rc=$rc receipt=$RECEIPT result=$RESULT log=$LOG"
exit "$rc"
```

这里的 stdout/stderr 文件是被动日志或结果；`codex queue` 才是主动唤醒。若 dsh 子进程异常退出而外层仍在，外层仍可收退出码并投递 FAIL/异常信息。若外层 shell、机器或用户服务本身在 queue 前被杀死、断电或失联，则没有 dsh 原生机制能补发该通知；已落盘的 receipt 只能等待恢复检查。

仓库现有协议已经规定外层在进程结束后使用 `codex queue` 主动回执，[执行协议](../plans/execution-protocol.md#启动与主动通知)；本机已有的 45 分钟 systemd `check` 也只调用该 CLI，不是持续 watcher。[运行台账的 check 约定](../plans/run-state.md#低频-check-与回执监测)说明它只在有未完成任务且近 45 分钟没有回执时做一次恢复检查，并明确依赖本机、用户服务和 Codex 收件服务。这个兜底不能保证机器离线期间即时通知，也不应据此杀掉仍在运行的 dsh。

## 已确认、未验证与版本漂移

### 已确认

- 本机 `dsh --profile headless --help` 返回 0；无 task 返回 1；没有发起模型请求。
- 本机 `--json` 不是 headless 接受的选项。
- 安装包源码和官方 `dsh-v0.1.5-rc.2` 源码的 headless 输出、flush 和退出映射一致。
- `codex queue` 的本机命令形状已由 help 确认；本次没有实际投递通知。

### 未验证

- 没有运行真实 dsh task，因此没有实测正常模型完成、模型错误、超时、SIGINT/SIGTERM、父进程死亡时的完整外层链路。
- 没有实际写入结果文件后调用 `codex queue`，遵守本次禁止发送测试通知的要求。
- 上游当前 `master` 的 headless README 已出现 `--json`、stdin 和 `--session-id` 等新能力；这与本机 rc.1 launcher 加 rc.2 bundle 不同，不能当成本机能力。[当前 master 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/headless/README.md)

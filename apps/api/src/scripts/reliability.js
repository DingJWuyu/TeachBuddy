#!/usr/bin/env node
// Maintenance CLI for stopped-service backup, restore, activate and stale-lock removal.
// --help is the operator reference; guarantees and restore order live in workbench/reliability/backup.js.
import {
  backup,
  restore,
  activate,
  unlock,
} from "../workbench/reliability/backup.js";
const [command, ...args] = process.argv.slice(2);
const usage = `维护前停止 API、转换子进程和自动重启，保持原库、原文件与原配置。
backup --database <sqlite> --files <files目录> --target <不存在的备份目录> --stopped
restore --source <部署备份目录> --target <不存在的恢复目录> --stopped
activate --target <已准备的恢复目录> --stopped
unlock --database <sqlite> --files <files目录> --stopped （仅异常退出遗留锁）
恢复是时间点还原，备份之后的资料和密码变更不会合并。旧登录凭据失效，使用备份内密码重新登录。
activate 后将 SQLITE_PATH 与 WORKBENCH_FILES_DIR 指向输出路径，保留原认证/邮件配置，再启动服务。
个人 ZIP 仅供取回内容，不能作为部署备份恢复。`;
try {
  if (!command || command === "--help") {
    console.log(usage);
    process.exit(0);
  }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--stopped") options.stopped = true;
    else if (
      /^--(database|files|source|target)$/.test(key) &&
      args[i + 1] &&
      !args[i + 1].startsWith("--")
    )
      options[key.slice(2)] = args[++i];
    else throw new Error("Unknown or incomplete option");
  }
  const operation = { backup, restore, activate, unlock }[command];
  if (!operation) throw new Error("Unknown command");
  const required = {
    backup: ["database", "files", "target"],
    restore: ["source", "target"],
    activate: ["target"],
    unlock: ["database", "files"],
  }[command];
  if (required.some((k) => !options[k]))
    throw new Error("Missing required path");
  console.log(JSON.stringify(await operation(options), null, 2));
} catch (error) {
  console.error(`未完成：${error.message}\n${usage}`);
  process.exitCode = 1;
}

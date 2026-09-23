# MANUAL-SUPPORT-RECOVERY@1

状态：PASS / self；本次增量内部双轴审查完成，待维护者接入及独立复验。Codex，gpt-6-astra，low；内部助手继承。

- 固定基线：`655d4595b09328d3b3475bcb285b3582f99c8a0a`。
- 产品候选：`b4f36312fef653a5c19c92686ca4ff74693f4755`，分支 `fix/manual-support-recovery`。
- 范围：[合流阻断](../../MANUAL-INTEGRATION/v1/support.md)。设置页沿恢复归档中的账户限定指针读取题库、资源、数学原文件，兼容旧键及新格式多分支，去重同一指针；请求清理保留归档引用的字节。已隔离现场无需再次恢复备份。活动请求恢复语义不变。

## 实际红绿

在本树生产 Web 构建、独立 Chrome context、随机 loopback HTTPS 端口和自有 TMPDIR 中，真实注册后执行 `backup → restore → activate → 重登`。未使用维护树原现场写入。

| 检查 | 实际结果 |
| --- | --- |
| 基线复现 | 两次红灯：第一次缺少“下载 question-original.txt”，第二次缺少“下载 question-first.txt”；第二次先确认归档指针及 IndexedDB 原字节存在，下载按钮数量为 0。 |
| 修复后同一路径 | 1/1 PASS，用例 2.9 秒，总计 7.4 秒。recoveryId 改变、活动指针移除；进入题库/资源/数学并刷新，没有旧上传重放；三个模块各两个新格式分支及旧资源/数学共 8 份下载字节一致。 |
| 既有上传行为 | 3/3 PASS，总计 10.2 秒：资源双标签页上传、题库刷新重选原文件、数学 HTML 原键确认。 |
| 构建与差异 | `npm run build:web`、`git diff --check` PASS。未重跑完整数据或产品套件。 |

复验命令（先安装锁定依赖、创建自己的短 TMPDIR 及本树 `.tmp-ms`，构建 Web）：

```bash
./node_modules/.bin/playwright test -c apps/web/e2e/manual-data/manual-data.config.mjs recovery-upload.spec.js
./node_modules/.bin/playwright test -c apps/web/e2e/manual-support/playwright.config.mjs --grep '资源两标签页上传|题库原文件刷新|数学 HTML 上传'
```

[真实设置页截图](recovery-fix.png)。临时隔离库、测试输出和运行日志已清理；可复现用例随候选提交保留。

## 内部审查

固定 diff：`git diff 655d4595b09328d3b3475bcb285b3582f99c8a0a...b4f36312fef653a5c19c92686ca4ff74693f4755`。

- Standards：PASS，0 项。修复限于恢复读取、字节保留及 E2E，符合授权边界，未增加 UI 单元测试或抽象层。
- Spec：PASS，0 项。新旧原文件可取回、旧请求隔离，未发现缺失、范围扩张或错误实现。

## 维护者接入条件

接入上述产品候选后重新构建 Web，在维护者隔离环境独立执行定向命令，并核对已有恢复归档也能下载原文件。若接入基线改变或冲突触及恢复/请求存储，需复验新候选。无需数据库迁移，也无需重新执行用户备份恢复。

本回执不代签独立验收或授权部署；未合 main、push 或更新 preview/50880，未操作用户库、秘密及其他 session。注入 AGENTS.md 保持未提交。

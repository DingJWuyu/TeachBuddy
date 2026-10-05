# Domain Docs

工程技能探索本仓库代码时，应遵循以下领域文档规则。

## 探索前读取

- 根目录的 `GLOSSARY.md`
- 根目录的 `docs/adr/`
- 如果存在 `GLOSSARY-MAP.md`，读取其中与当前主题相关的 `GLOSSARY.md`

如果这些文件不存在，静默继续，不要专门报告缺失，也不要提前建议创建。`/domain-modeling` 会在领域术语或架构决策真正确定时按需创建它们。

## 文件结构

本仓库采用 single-context 布局：

```text
/
├── GLOSSARY.md
├── docs/adr/
└── apps/
```

## 使用领域词汇

在 issue 标题、重构提案、假设和测试名称中使用 `GLOSSARY.md` 定义的领域术语。不要随意替换已有术语。

如果需要的概念尚未出现在术语表中，应重新评估是否正在发明项目不使用的语言，或记录为需要 `/domain-modeling` 处理的领域缺口。

## 标记 ADR 冲突

如果输出与已有 ADR 冲突，应明确指出，而不是静默覆盖。

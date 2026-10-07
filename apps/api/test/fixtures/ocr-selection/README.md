# OCR 固定输入

运行本轮比较时先读 `manifest.json` 的页顺序与图像摘要，再按阶段读取真值。选型门槛固定在 `ed721ea9` 的 [OCR 规则](../../../../../docs/acceptance/ocr-selection.md)；字段投影与计数方式在 `scoring.json`。

- 开发使用 `development.truth.json`，8 页、4 个内容组。
- 留出使用 `heldout.truth.json`，4 页、3 个内容组；初筛与调参期间只读取 manifest 中的图像元数据，作者稿 `authoring-heldout.json` 同样留到留出阶段。
- `damaged.truth.json` 定义 F 的可见区域和破损边界。F 不进入普通质量、速度分母。

12 页是有目的的小样本，涵盖两份公开教学原稿和四份自编作者稿，不代表全部教师材料。原有四页题目与答案同组，公开原稿各自的相邻页同组；来源组不跨开发与留出。

## 真值字段

每页 `body` 按冻结的阅读顺序记录中文叙述，包含教学表格中的正文，排除数学串、数值表、图标签及页眉页码。正文按 NFKC 后去空白计字。`formulas` 以完整表达式、条件组、分段式或等式链为单位；`mathFragments` 保存不单列评分的数学符号或函数名。`tables.cells` 的行列从 0 开始，逻辑单元包含表头、空白格和合并区域。公式通过 `formulaIds` 引用；E 的 `content[].latex` 保存归并前的原句片段，`sourceText` 可供人工对照原句。`figures` 保存原图范围与关键标签；`blocks` 是内容保留指标的固定单位。所有 bbox 为原页像素 `[left, top, right, bottom]`，人工矩形可能含少量余白。

`denominators` 固定逐页分母。E 的跨页单元只记本页可见片段，原稿疑似笔误保留在正文并在 `notes` 标明。图中公式可通过保留原图而完整保留，评分不要求重建为矢量；整页、整栏、系统性公式或关键图标签遗漏仍依选型规则淘汰。真值来自原图或自编源稿；相邻目录的既有 OCR 输出不参与真值制作。

## 重建

仓库已包含 12 张固定页图所需字节，已有四张图用仓库相对路径引用。模型实验直接使用 manifest 的固定图片。需要重新核对公开原件时，在仓库根目录执行以下命令；脚本下载两份 PDF、核对文件大小和 SHA256，再用 Poppler 以 200 dpi 渲染指定页，不读取旧本机样本目录。

```bash
python3 apps/api/test/fixtures/ocr-selection/rebuild-public.py test-results/ocr-selection/inputs/public-rebuild
```

重建作者稿需要 Node.js、仓库依赖和 Playwright Chromium。字体来自锁定的 `@fontsource/noto-sans-sc`，公式来自 KaTeX。先按项目安装方法执行 `npm ci`，必要时执行 `npx playwright install chromium`，再运行：

```bash
node apps/api/test/fixtures/ocr-selection/rebuild-authored.mjs test-results/ocr-selection/inputs/author-rebuild development
node apps/api/test/fixtures/ocr-selection/rebuild-authored.mjs test-results/ocr-selection/inputs/author-heldout-rebuild heldout
```

重建文件进入指定输出目录，固定 fixture 保持只读。不同 Poppler、Chromium 或平台可能产生不同 PNG 编码字节；比较实验始终使用 manifest 校验通过的入库图。任何原图或真值修订都先记录原摘要、具体错误与原因，再由总控决定是否重启受影响的比较。

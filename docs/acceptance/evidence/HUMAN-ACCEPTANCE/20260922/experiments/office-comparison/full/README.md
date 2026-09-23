# Pandoc 完整固定样例

六份 DOCX 与同源 PDF 已生成，正文、数学文本顺序、公式数量、原图字节、学生/教师标记均已核对；15页最终 PDF 已目视审看，未见裁切、重叠或空白页。完整学生讲义 handout-student.docx 已由用户在个人 Windows 的 Word/WPS 中实测反馈“完全正常”：中文、分母和根式指数修改、另存关闭重开、公式仍可编辑及全部打印预览通过。此反馈对应最近一次三步清单，未确认第二轮修改；目标软件具体页数、版本及改后PDF导出未单独报告，未收集保存件。其余五份完整样例已由用户按清单在 Word/WPS 中逐页检查并反馈“全都正常”：公式与图片完整，无裁切、重叠或异常空白页，学生版无答案或教师注记。该批次目标兼容性切片通过，建议后续实现线采用 Pandoc；正式产品未修改，原失败制品未修复，不据此关闭完整 C22/R35。小样例通过结论见上级 README。未修改产品候选或发送编排回执。

## 输入与实现

固定源 `7f965c6408a73d30524ff8e11c40484a352232c1:experiments/C22/control-1/`。make-sources.py 按原 generate.js 内容组合六份 Markdown；source/latex.json 和三张原图直接提取固定 Git blob。公式解析、OMML 和 DOCX 封装全部使用 Pandoc 3.11，无自写数学解析器、公式XML或输出后修补。source/*.md 是脚本生成物，应从 make-sources.py 重建。

正文比较只忽略空白、Pandoc 在独占公式段落添加的零宽空格以及标题生成器名；数学比较按对象顺序忽略空白及减号表示差异，另经 Pandoc 读回和PDF目视核对结构。图片字节哈希集合与原文档一致。校验结果见 evidence/content-checks.json 和 pdf-checks.json；不是完整OOXML模式校验。

采用默认 Pandoc 样式和 Letter 纸张，固定样例原版也是 Letter；未设计正式产品打印模板。分页采用 Markdown 中标准 raw OpenXML 分页段落，仅用于版式，不用于公式。教师讲义将同一个分页点移至答案区之前，使答案、注记与后续公式位于第二页；题文顺序不变。其余固定分页点保留。

## 复现

在上级目录执行 `python full/make-sources.py`，随后对 source/ 下六个 Markdown 在 source/ 工作目录逐一执行：

```sh
../../tools/pandoc-3.11/bin/pandoc handout-student.md --standalone --fail-if-warnings -o ../docx/handout-student.docx
```

其余五稿同名替换即可。Pandoc 读回 Markdown 放在 evidence/。PDF 使用现有只读 LibreOffice 26.8.0.3 二进制，`SAL_USE_VCLPLUGIN=gen`、本实验独占 `file:///tmp/c22-pandoc-full-profile-20260922`，`--headless --convert-to pdf --outdir full/pdf full/docx/*.docx`。工具位置沿用原回执环境，仅运行全新输出转换，未进入或更改原候选数据库、profile、端口或服务。没有真实邮件、产品模型调用或付费。

最终页数：教案学生/教师2/2、讲义学生/教师2/2、练习学生/教师3/4。目视依据为 evidence/ 中对应 overview 图片，教师讲义以 handout-teacher-final-overview.png 为准。PDF字体由本机替换，Word/WPS合理重排不按页数相同一刀切。

## 真人接点

使用验收清单.txt，先完成学生讲义两轮真实中文/公式编辑、保存关闭重开及改后PDF，然后在两款目标软件逐页检查其余文件。按原文件名、软件版本、页数和实际结果记录，不能将小样例通过替代完整批次。通过后才形成可供用户交给实现线的路线建议；当前没有产品修复、main合入或完整C22通过声明。

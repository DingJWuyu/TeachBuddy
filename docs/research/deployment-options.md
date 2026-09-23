# 正式环境的选择条件

当前只交付本机体验。用户将后续选择服务器与域名，尚未批准采购或部署，也没有已验证的正式环境。[运行指南](../SETUP.md)拥有当前启动、持久化和转换要求。

## 必须具备

一台可运行 Node/pi、SQLite、持久文件、系统转换程序及中文字体的主机；同源 HTTPS、真实邮件、受控模型出站、备份目标与可重复还原。只有静态托管或临时磁盘不足以承载当前实现。Windows 是用户的目标客户端环境，不要求服务端必须 Windows。

优先核对单主机端到端路径。已有持续联网主机加 Tunnel 可作为候选，但主机关机/休眠即不可访问，稳定 URL、域名、备份与中国大陆网络仍需验证。拆成 Workers/D1/R2 加独立 pi/Office 执行节点并未获选；它会改变当前 SQLite/文件接缝，只有具体部署条件需要时再评估，不能把免费额度当作已经兼容。

## 不能由旧调研推出的结论

2026-09-21 的平台调查未证明完全免费、无需支付条件或大陆可靠访问。Cloudflare 全球服务与 China Network 是不同产品，不能从后一产品的限制推断全球域名必然不可达。平台价格、额度、Node 兼容与网络能力在选定方案时重查。

部署候选应实际验证 DNS/TLS、Cookie 页面绑定、上传/下载、SSE、Office 预览与输出、浏览器离线包、重启持久化、停服一致备份及恢复。Edge/Chrome、iPad/学校网络、Word/WPS 和课堂设备分别报告，不用本机成功代签。

可继续查的一手来源：[Tunnel](https://developers.cloudflare.com/tunnel/)、[Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[Node 兼容](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)、[D1](https://developers.cloudflare.com/d1/platform/pricing/)、[R2](https://developers.cloudflare.com/r2/get-started/)、[China Network](https://developers.cloudflare.com/china-network/)。

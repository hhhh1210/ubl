# 哔哩哔哩 9.13.0 · Surge iOS

基于指定版本 IPA 的未加密数据段、资源文件、公开接口和固定版本公开 schema 制作。主程序仍有加密区；未完成运行时解密与 iPhone 实测。2026-09-24 发布。

## 安装链接

推荐导入 **组合版**（基础清理 + 播放页增强，自动下载配套脚本）：

https://raw.githubusercontent.com/hhhh1210/ubl/main/bilibili/9.13.0/Bilibili.sgmodule

在 Surge iOS → 模块 → 安装新模块中粘贴地址。需要支持 JQ / Body Rewrite 的版本（按 5.14+ 编写），并开启重写、脚本、MitM 和 MitM over HTTP/2，安装并完全信任自己的 Surge CA。

请先停用旧 `Bilibili_remove_ads.sgmodule` 或其他重复修改哔哩哔哩接口的模块。组合版已包含基础和播放页规则，不要再同时导入以下两个独立模块。

| 文件 | 作用 |
|---|---|
| [Bilibili.sgmodule](Bilibili.sgmodule) | 组合版，推荐安装 |
| [Bilibili_Basic.sgmodule](Bilibili_Basic.sgmodule) | 仅开屏与 JSON 信息流，无外部脚本 |
| [Bilibili_Playback.sgmodule](Bilibili_Playback.sgmodule) | 仅播放页增强，自动下载本目录脚本 |
| [Bilibili_AdReports.sgmodule](Bilibili_AdReports.sgmodule) | 可选广告计费／转化上报本地截断；可与组合版并用 |

## 覆盖与限制

- 清理开屏 `/x/v2/splash/list`、`show` 和 JSON 首页／竖屏信息流中的明确广告卡。
- 增强处理 `bilibili.app.viewunite.v1.View` 的 `View`、`RelatesFeed`、`PlayPause`，不修改播放地址、账户、会员或支付接口。
- 没有整站屏蔽 `cm.bilibili.com`、`bilibili.com`、`hdslb.com` 或 `bilivideo.com`。
- 不能保证清除搜索／动态／其他 Protobuf 信息流广告、激励广告、视频内嵌广告和 UP 主口播。
- 超过 1 MiB、压缩、多帧或未知 gRPC 格式原样通过；广告缓存可能需要在 App 内清理后重新启动。
- `X-Bili-AdClean: 20260924-path-matched` 仅表示基础规则命中路径；`20260924-protobuf-modified` 才表示增强脚本实际修改响应。
- 播放异常时停用组合版并改用基础版；其他异常可停用模块恢复。

## 验证

32 项原始 JSON/匹配/语法检查与 22 项 Protobuf 行为测试通过；22 项在 Surge Mac 6.4.4 的脚本引擎重复通过。发布的组合模块另经 Surge 配置解析器检查。均非 iPhone 实际流量测试。

直接确认的自有广告组件包括 `BBAd`、`kntr.app.ad`、`BFCSplash`。未发现独立第三方广告 SDK 包，不能在加密代码未解密时断言其完全不存在。

Protobuf 字段号参考：

- `kokoryh/Sparkle@1bc5b545a544d7d59b1cf821785daddc3868e4a5` 的 `proto/bilibili/app/viewunite/v1/view.proto`。
- `Biliverse/ADBlock@1dbaef14d55006fb8c13d5b29dffb2977c10fa99` 的 `src/protobuf/bilibili/app/viewunite/v1/viewunite.proto` 与 `src/process/Response.mjs`。

脚本为本地编写的最小字段清理器，未复制这些项目的完整脚本，也未采用其非广告功能。

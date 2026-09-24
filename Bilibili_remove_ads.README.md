# 哔哩哔哩去广告：可莉 Loon 插件的 Surge 转换版

本模块根据 `https://kelee.one/Tool/Loon/Lpx/Bilibili_remove_ads.lpx` 转换，原插件标注时间为 **2026-09-14 09:14:54**，下载与转换日期为 **2026-09-24**。原脚本作者为 [kokoryh](https://github.com/kokoryh)，Loon 插件由可莉维护。

## 安装

在 Surge 的模块页面从 URL 安装：

```text
https://raw.githubusercontent.com/hhhh1210/ubl/main/Bilibili_remove_ads.sgmodule
```

[打开 Surge 导入](surge:///install-module?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhh1210%2Fubl%2Fmain%2FBilibili_remove_ads.sgmodule)

使用支持 JQ Body Rewrite、Map Local 内联数据和 WebView 脚本的新版 Surge。启用重写、脚本和 MitM，安装并信任 MitM 证书。模块添加原插件的 5 个解密域名，并开启 `http2 = true`。如已经安装其他哔哩哔哩去广告模块，请避免同时启用重叠的响应脚本。

## 转换内容

- 保留原插件 6 条网络规则、8 个模拟响应、11 条 JSON/JQ 重写和 4 个脚本入口。
- 将两份远程 JQ 文件的完整过滤表达式嵌入模块，安装时无需额外下载它们。
- 保留 JSON 与 Protobuf 清理、评论区请求处理、青少年弹窗和交互式弹幕处理，以及可选空降助手。
- 原脚本已经支持 Surge；依赖 URL 固定为 Sparkle 提交 `ab97d6fec550f784bef14e502a6746c2a4c7f262`。去掉注释和首尾空白后，三个脚本与可莉链接下载的代码完全一致。
- 原插件的 `PROXY` 策略名无法通用于每个人的 Surge 配置，空降服务器策略参数默认设为 `DIRECT`，可改为自己的代理策略名称。
- 请求脚本最多处理 1 MiB，响应脚本最多处理 5 MiB；超过上限时跳过脚本。此限制避免无限制缓冲。
- 保留原插件修改的会员显示字段；这些字段不会授予实际付费权益。

## 参数

| 参数 | 默认值 | 可选设置 |
| --- | --- | --- |
| `displayUpList` | `show` | `show` / `hide` / `auto` |
| `purifyComment` | `true` | `true` 过滤置顶广告，`false` 关闭 |
| `optimizeRequest` | `kelee.bilibili.request` | 改为 `#` 关闭请求处理 |
| `sponsorBlock` | `#` | 改为 `kelee.bilibili.airborne` 开启空降助手 |
| `sponsorBlockPolicy` | `DIRECT` | Surge 中实际存在的代理策略名 |
| `logLevel` | `off` | `off` / `error` / `warn` / `info` / `debug` |

空降助手默认关闭，与原插件一致。开启后会查询第三方 `bsbsb.top` 的视频广告片段数据，准确性取决于该服务。

## 验证范围

已通过本机 Surge 配置解析器校验，包括默认参数及“空降开启、请求优化关闭”的组合；11 条 JQ 表达式均进行了样例行为检查；8 个本地响应均检查了 JSON 或 gRPC 帧结构。

三个原始脚本在模拟 Surge 接口下通过了普通及 gzip 压缩 gRPC 清理、评论开关、未知 Protobuf 字段保留、请求重放和 trailers 保留、直播 JSON 广告清理，以及异常数据放行检查。脚本检查未向哔哩哔哩或空降服务器发送请求。

尚未在用户的 iPhone/iPad 哔哩哔哩 App 内实测，不能据此保证所有版本和广告场景均被覆盖。

## 来源

- Loon 插件：<https://kelee.one/Tool/Loon/Lpx/Bilibili_remove_ads.lpx>
- JQ：<https://kelee.one/Resource/JQLang/Bilibili/tab_Bilibili_remove_ads.jq>
- JQ：<https://kelee.one/Resource/JQLang/Bilibili/mine_Bilibili_remove_ads.jq>
- 原脚本项目：<https://github.com/kokoryh/Sparkle/tree/ab97d6fec550f784bef14e502a6746c2a4c7f262>
- 原作者提供的 Surge 模块亦可参考：<https://github.com/kokoryh/Sparkle/blob/master/release/surge/module/bilibili.sgmodule>

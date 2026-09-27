# 虎牙广告屏蔽：Surge 自有开屏修复与 SDK 分析

已完成解密 IPA 静态清点、模块制作、真实 HAR 离线回放及 Surge 本地验证。**更新后尚未在 iPhone 验证，不能保证所有广告消失。Loon 必须导入 `.plugin`，不能把 Surge 模块当作原生插件使用。**

## 使用

1. **Loon：**导入[虎牙原生插件](https://raw.githubusercontent.com/hhhh1210/ubl/ios/huya-core-scripted.plugin)，在插件设置中启用规则、复写和脚本。支持[一键导入](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhhhh1210%2Fubl%2Fios%2Fhuya-core-scripted.plugin)。插件使用 Loon `[Rewrite]` 和原生脚本语法，没有 Surge `[Map Local]`、`%APPEND%` 或专属参数。
2. **Surge：**更新原虎牙模块，或导入[主模块原地址](https://raw.githubusercontent.com/hhhh1210/ubl/ios/huya-core-scripted.sgmodule)。主模块现在包含原生开屏响应清理，不用为此另装 RPC 模块。避免同时启用新旧两份。两种客户端均需启用 MitM 并信任证书，HTTPS 路径规则/脚本才会生效。域名拒绝本身不依赖解密。更新后若仍显示旧开屏，可用虎牙设置中已有的“清理缓存”功能后退出重开，并分别复测冷启动、从后台返回；这不保证清掉独立广告缓存，请勿把退出重开等同于缓存已清除。
3. **Surge 可选：**若仍有虎牙自有广告，可另外导入[RPC 模块](https://raw.githubusercontent.com/hhhh1210/ubl/ios/Huya_RPC_Experimental.sgmodule)。模块引用固定 Git 提交的 HTTPS 脚本，Surge 自动下载。它仍为实验功能，本轮未把它移植并默认加入 Loon；HAR 未捕获广告 RPC，实际捕获的 HTTPDNS/账号 WUP 均保留。
4. 若启用 RPC 模块后直播/首页异常，先关闭该可选模块；若其他 App 的广告奖励或统计受影响，关闭主模块后复测。

主模块的第三方广告域名规则是设备级的，也会影响其他 App 使用的同类 SDK；Surge iOS 不能靠这些规则识别流量属于哪个 App。激励广告会不可用，观看广告换奖励、短剧广告解锁可能失败；没有伪造完成广告或奖励发放。

## 08:59 Surge 抓包：已生效的规则与自有开屏缺口

第二份抓包由 **Surge iOS 5.22.1** 导出，共 22 条请求，时间跨度约 6 秒，客户端仍为 13.3.60。可直接确认：

- `/exapp` 已返回 `data:{}`，响应含 `X-uBO-Huya: gdt-exapp-request-nofill-1`。
- `/updateSetting` 已返回 `stop=1`、开屏预加载关闭等配置，含对应清理标记。
- 腾讯广告图片/视频命中了 DOMAIN 拒绝或 Map Local；MMA 配置也命中了本模块 Map Local。
- 日志同时显示虎牙独立模块与 `uBO Core Scripted for Surge` 在处理请求。不能把多个模块的共同表现直接归因于某一版模块；没有改动用户的大模块或其他配置。
- 成功返回的 5 张图片均为房间/直播封面，与附图红色开屏不一致；没有找到该开屏素材或 `getMSplash` 下发响应。HAR 的记录耗时也不能直接当作脚本 CPU 耗时。

**因此：不能再用“腾讯广告接口未拦住”解释此次截图，也不能声称已经从 HAR 确认截图的具体来源。** 在解密 IPA 中进一步定位到了此前遗漏的自有开屏调用 `mobileui/getMSplash`，以及冷/热启动缓存读取、保存流程。用户反馈两种启动方式均会出现，缓存或未抓到的自有通道是合理候选；仍不是已证实的唯一根因。

此次 Surge 修复增加 `huya-splash-response.js`：

- 按 WUP v3 二进制协议确认服务 `mobileui`、方法 `getMSplash`、成功返回码、`tRsp` 结构后才改写。
- 根据 IPA 的 `HUYAMSplashRsp` 原生 JCE 属性元数据清空 `vInfo`（tag 0），把 `iNextId`（tag 1）、`iCurId`（tag 5）、`iIsEnableShake`（tag 9）归零；保留 `vContext`、请求 ID、状态、未知字段的原始字节。
- 更新 WUP 长度并清理旧 Content-Length/Encoding/ETag；修改后的响应带 `X-uBO-Huya: native-splash-empty-v1`，便于下次抓包判断是否实际命中。
- 只在 `wup.huya.com`、`cdn.wup.huya.com`、`wsapi.huya.com` 根路径及明确 `mobileui/getMSplash` 路径检查响应；不整域阻断，不修改 HTTPDNS、登录、首页或视频响应。
- 使用 **http-response** 和 256 KiB 上限。Surge 官方文档说明超限响应跳过脚本并放行；没有新增共用通道请求正文缓冲或拒绝规则。
- `getMSplash` 返回的空列表可进入应用正常缓存更新路径；脚本本身无法清除设备上已经缓存的图片、HTML，也无法处理不经过 HTTP 的私有长连接。13.4.80 协议元数据用于13.3.60抓包场景的兼容性尚待真机确认。

本次没有扩大 Loon 插件，也没有改动已经在抓包中生效的腾讯 no-fill helper。若清理缓存、更新并复测后仍出现同一广告，应从启动前开始抓包，检查是否有上述 `native-splash-empty-v1` 响应标记；如果没有对应 HTTP 响应，继续堆域名规则不能证明会生效。

## 2026-09-27 HAR 补漏

本轮 HAR 由 Loon 导出，共 413 条请求。腾讯 settings、模板请求及 TDataMaster 请求中的客户端版本一致为 **13.3.60 / build 87573**，穿山甲使用 `aid=5000546`；不是前一轮解密 IPA 的 13.4.80，因此保留旧 App ID 匹配。

抓包元数据显示：**拒绝规则命中 0、复写命中 0、脚本命中 0**。广告请求实际走了普通路由，腾讯 `/exapp` 返回 2 条广告，随后有广告图片/视频和动态渲染包成功返回。仅凭这些记录不能断言用户所有配置都未启用，但能确认这一轮请求没有受到已列出的广告规则处理。

具体修复：

- 增加 `pangolin-sdk-toutiao1.com`、`pangolin-sdk-toutiao-b.com`、`toblog.ctobsnssdk.com`、`p.l.qq.com`，补齐备用广告、增长上报和曝光域名。
- `lf-cdn-tos.bytescm.com/obj/static/ad/play-comp/` 精确阻断试玩广告组件，保留共享 CDN 其他路径。
- 从腾讯响应中的资源链接补齐 `qzs.gdtimg.com/union/res/union_site/`、AMS 对象存储的 `/ad_client/` 与 `/video/ad_profile/`、广告模板桶 `/hikari/template/`、`/hikari/module/` 和明确的点击奖励 JSON；不封整个 `myqcloud.com`。
- 原 `/exapp` 请求脚本没有 `requires-body=true`，而 HAR 中虎牙 App ID/广告位放在 POST 表单。Surge 现启用正文读取，限 64 KiB；真实样本约 8.3 KiB。Loon 也明确读取正文。原固定版本 helper 已能识别实际表单，无需扩大 JS 匹配范围。
- 新增 Loon 原生插件，规则与 Surge 同源生成；在广告专用模板/素材/SDK URL 增加请求阶段拒绝复写，便于在 MitM 已启用时阻断广告资源。

当前主规则为 **23 条域名规则 + 8 条 Surge Map Local + 2 个轻量请求脚本 + 1 个自有开屏响应脚本**；Loon 为 **23 条域名规则 + 9 条 URL 拒绝复写 + 2 个轻量请求脚本**。继续保留 `120.53.53.53/dns-query`、`cdn.wup.huya.com/launch/queryHttpDns`、账号/登录/认证、隐私页、普通头像封面及共用资源路径。

HAR 也确认 `hc.tdm.qq.com/tdm/v1/route` 与 `receiver.tdm.qq.com/tdm/v1/kv` 属于本客户端 TDataMaster 分析链路；这不能证明它们是可见广告的下发源，本轮没有把全部分析/诊断组件升级为广告封禁目标。

## 样本与范围

- Bundle ID：`com.yy.kiwi`；版本 `13.4.80`；build `89129`。
- IPA SHA-256：`83e9a7265145ce41c984f33014c2bc9c7c1210ccb3e2f4ff466c3b07f6fb6ed9`。
- 扫描归档 30 个 Mach-O，全部 `cryptid=0`；主程序解析 23,236 个 Objective-C 类、455,181 条类/实例方法记录，另解析 category。
- 扫描主程序/框架字符串、类元数据、方法实现引用、Bundle 配置与内置 Lizard 模板。类前缀数量见 `sdk-inventory.json`，不把前缀数量当作独立 SDK 数量。
- FairPlay 解密不等于全部去混淆：穿山甲仍有字符串/控制流混淆。没有执行未知 IPA 二进制，没有上传 IPA、反编译产物或本地私密文件。

## 找到的广告与营销组件

| 组件 | 已确认依据 | 屏蔽范围 |
| --- | --- | --- |
| 腾讯 AMS / GDT / Tangram 优量汇 | `HYBusinessAdAmsManager`、`TGGDTAdService`、`GDTTangramUnifiedNativeAdService`、开屏/原生/激励/预加载类；虎牙 App ID `1112179873` | 专用广告请求、报告和素材域；保留原 no-fill 脚本 |
| 字节穿山甲 CSJ / BU 7.6.0 | Bundle 版本；`HYCSJEnv`、`CSJGetADSRequest`、`CSJAdSDKManager` | SDK 与广告素材域；settings/renderer 匹配新版 App ID |
| Pangrowth DJX / PGX 短剧与内容 SDK | `DJXAPIClient`、`DJX_BUAdSDKManagerAdapter`、`DJXPlayletAdvertProtocol` | 阻断关联 CSJ 广告，保留内容、视频及许可证服务；短剧解锁可能依赖广告 |
| 虎牙 HYAdBusinessSDK 4.1.3 | `getSDKVersion` 实现返回 `4.1.3`；`HYAdTrackManager`、`HYAdURLHelper` | 广告曝光/点击/转化统计域；可选 RPC 广告请求 |
| 虎牙广告位与渲染组件 | `HYBusinessAd*`、`HYImmersionAd*`、`HYCommonRewardAd*`、`HYLiveEndAd*`、`HYLiveBusinessAd*`、`HYLiveAdx*`、`HYSubscribeAd*`、`HYSMAd`、开屏组件 | Surge 主模块清理 `getMSplash` 响应；开屏模板 + 可选 `queryAd`、预加载素材和广告位列表 RPC；不是逐个 UI 强行隐藏 |
| MMA 广告监测 | `MMA_AdViewResult`、`MMA_TaskQueue`、`MMA_SDKConfig`、虎牙 SDK 的 `sdkconfig.xml` 常量 | 精确阻断监测配置 URL 与已确认上报接口；动态下发第三方监测 URL 未穷尽 |
| RangersAppLog / BDAutoTrack 6.16.9 | Bundle 版本；`BDAutoTrackASA`、`BDAutoTrackALink*`；URL host 构造函数 | `toblog`、`tobapplog`、`alink`、`klink`、`abtest.volceapplog.com` |
| 腾讯 TDataMaster / TDMIDFA | 嵌入式 Framework；本轮 HAR 确认 route/kv 分析接口与虎牙 Bundle ID | 已清点，分析接口仍保留；未确认是可见广告下发源，没有声称完整屏蔽 |

RangersAPM、APMInsight、VolcBaseLog、虎牙 MTP/Sentry 是诊断或性能组件，未仅因名称含 report/log 就归为广告。TTSDKPlayer/Volc 视频播放、Unity、腾讯慧眼、FlyVerify 登录认证、微信/QQ 分享等保留。

本次类/资源清点未确认快手 KSU/KSAd、百度移动广告、Sigmob/WindAd、Google Mobile Ads、Meta Audience Network、Vungle、AppsFlyer、Adjust、SensorsAnalytics、GrowingIO、ThinkingAnalytics、TalkingData、友盟 UMConfigure/MobClick。此结论限于当前静态样本；不是对动态下载代码的绝对排除。`WMPageController`、`GTTSDKLib`、`KSearchBarView` 不能据名称误判为广告 SDK。

## 旧模块的具体缺口

- 原 settings/renderer 只识别 `aid=5000546`。`+[HYCSJEnv hyCsjEnvAppID]`（`0x100a31a6c`）的生产分支返回 `5004161`，测试分支返回 `5339764`。新规则覆盖两者，兼容保留旧 ID；未把旧 ID 当作新版提取结论。
- 原腾讯 `/exapp` 规则限四个历史广告位。新模块保留其 no-fill 行为，并用广告专用域名覆盖其他广告位、预加载和上报路径。
- 原模块没有处理虎牙自有 WUP 广告与增长归因。首版补充 19 条域名规则、4 条精确 Map Local 与独立可选 WUP 脚本；本次 HAR 补漏扩展为 23 条域名规则、8 条 Map Local 并提供 Loon 插件。
- `LaunchAlert/7/LaunchAlert.ios.lzc` 来自本版 `InAppConfig.json` 和内置 Lizard 模板目录；未扩展为任意模板或整个 `kiwistatic.huya.com`。

## RPC 精确匹配与证据

| 服务/方法 | 实现证据 |
| --- | --- |
| `mobileui/getMSplash` | `HYLaunchViewManager querySplashWithSource:callbackInBackground:completion:`（`0x1014830a8`）；由新增主模块响应脚本处理，不加入旧的 HTTP 204 请求拒绝表 |
| `mobileui/queryAd` | `HYBusinessAdManager doQueryAdThenFlattenRspWithADImps:...`，`0x100a9fc60` 读取服务全局变量，`0x100a9fc78` 引用方法名，调用 `wupRequestWithReq:servantName:funcName:rspClass:` |
| `adextui/getAdMaterial` | 广告预加载方法内 `0x100aa4368` 读取服务、`0x100aa4380` 引用方法名 |
| `adui/getUnionPositionList` | `HYBusinessAdCsjManager getUnionPositionList`，`0x100025a68` 读取 `0x109c24248` 指向 `adui`；`0x100025a80` 引用方法名 |
| `adextui/iosAdid` | `AdExtServerAdExtService iosAdid:completion:`（`0x100a41b44`）|
| `adui` / `ad_report` 的明确广告曝光、点击、播放、转化方法 | `AdTrackServerAdTrackService` 中各方法与 `servantWithReqEnv:`（`0x100a37c08`）|
| `ad_monitor_report/adMonitorReceive`、`adPresenterMonitorReceive` | `AdMonitorReportAdMonitorReportService`（`0x100a2c228`、`0x100a2c32c`）|

脚本解析 **WUP 外层服务名和方法名**，不在任意正文里搜索广告关键字。只识别有完整 BE32 长度前缀、WUP v1/v3、合法外层字段的单请求；返回 HTTP 204，让广告失败路径结束。没有猜测业务响应 schema，也没有伪造广告奖励。

仅检查 `wup.huya.com`、`cdn.wup.huya.com`、`wsapi.huya.com` 根路径 POST。主机是样本中存在的业务域，当前实际走哪个 HTTP/QUIC/私有长连接尚未抓包确认。未知服务方法、正常直播/登录/支付、非根路径、压缩/加密/混合批量或未知封装均不处理。

**请求脚本限制：** Surge 会先缓冲匹配请求，再执行脚本。此可选模块设置 1 MiB；超过上限会被 Surge 拒绝，无法由脚本兜底放行。因此未把它默认并入主模块。脚本内部的异常放行只对已交给脚本的请求成立。腾讯 settings 请求保持 16 KiB 上限，exapp 请求新增 64 KiB 上限；Loon 插件不使用 Surge 专属 `max-size` 参数。

## 已验证与待验证

- `node validate.cjs`：107 项检查通过，覆盖广告 RPC、正常业务保留、错误/截断/重复字段、长度溢出、伪造域名、方法边界、随机畸形样本、90 万字节正常请求、规则范围和脚本依赖。
- `node validate-har.cjs <本地HAR>`：26 项检查通过，覆盖 413 条请求中的 213 条明确广告/增长请求（旧规则匹配 150 条，新增 63 条），124 条功能性请求不匹配。另覆盖响应中 173 个明确广告资源链接。
- 真实腾讯 settings 请求 6 条及 exapp 请求 1 条可回放为无广告结果，exapp 原 2 个广告项被移除；20 条 HTTPDNS/账号 WUP 请求保持原样。
- 使用本机 Surge JavaScriptCore：前一轮 6 个合成协议样本通过，本轮 27 个真实 HAR 请求样本通过。
- 自有开屏修复：47 项检查通过；4 个合成 WUP 样本在真实 Surge JavaScriptCore 通过；08:59 HAR 已捕获的 15 个响应、前份 HAR 的 20 个 HTTPDNS/账号响应均原样放行。`getMSplash` 测试数据依据 IPA 协议字段合成，**没有实际 `getMSplash` 响应回放证据**，不能替代设备验证。
- 两个模块转换为独立最小配置后通过真实 `surge-cli --check`。仅验证语法与本地脚本行为，没有更改当前 Surge 配置。
- Loon 根据官方原生语法做结构、正则和离线脚本检查；本机没有 Loon 原生解析器或设备运行环境，未把这些检查当作设备验收。
- 仍需 iPhone 更新插件后的冷/热启动、首页列表、直播切房/弹幕、关注页/短视频、短剧、登录/支付实测。旧 HAR 不能证明新规则已在设备启用或生效。
- 原生自绘、缓存素材、服务器动态域名、加密/私有长连接广告可能残留；仅靠 Surge 网络层不能保证清除所有营销 UI。
- 主模块继续引用原固定提交的 helper，只修复 exapp 脚本行的正文读取参数。RPC 模块也引用固定 Git 提交。

证据 [sdk-inventory.json](sdk-inventory.json)、[rule-evidence.json](rule-evidence.json)、差异 [changes.patch](changes.patch)、[协议测试结果](validation-results.json)、[首份 HAR 测试结果](har-validation-results.json)、[Surge 开屏发现](surge-splash-findings.json) 与 [自有开屏测试](splash-validation-results.json) 可供审阅。HAR 原文、截图、账号/设备标识、Cookie、请求签名、IP 和提取的私密请求样本仅保存在本地，不发布到 GitHub 或交付 ZIP。

参考：[用户原模块](https://raw.githubusercontent.com/hhhh1210/ubl/ios/huya-core-scripted.sgmodule)、[Surge HTTP 请求脚本说明](https://manual.nssurge.com/scripting/http-request.html)、[脚本路径与运行参数](https://manual.nssurge.com/scripting/overview.html)、[Loon 插件说明](https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/plugin.md)、[Loon 复写说明](https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/rewrite.md)。

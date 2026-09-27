# 虎牙 13.4.80 广告屏蔽与 SDK 分析

已完成解密 IPA 静态清点、模块制作、协议样本测试及 Surge 本地验证。**尚未在 iPhone 验证，不能保证所有广告消失。**

## 使用

1. 在 Surge 更新已导入的虎牙模块，或导入[主模块原地址](https://raw.githubusercontent.com/hhhh1210/ubl/ios/huya-core-scripted.sgmodule)，避免同时启用新旧两份。它保留原模块两个固定提交版本的脚本依赖。
2. 启用 Surge 模块、脚本、MitM，并确保设备信任 MitM 证书。彻底退出虎牙后重新启动。域名拒绝本身不依赖解密，路径规则及脚本需要 MitM。
3. 若仍有虎牙自有广告，可另外导入[可选 RPC 模块](https://raw.githubusercontent.com/hhhh1210/ubl/ios/Huya_RPC_Experimental.sgmodule)。模块引用固定 Git 提交的 HTTPS 脚本，Surge 自动下载，无需手动复制脚本。
4. 若启用 RPC 模块后直播/首页异常，先关闭该可选模块；若其他 App 的广告奖励或统计受影响，关闭主模块后复测。

主模块的第三方广告域名规则是设备级的，也会影响其他 App 使用的同类 SDK；Surge iOS 不能靠这些规则识别流量属于哪个 App。激励广告会不可用，观看广告换奖励、短剧广告解锁可能失败；没有伪造完成广告或奖励发放。

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
| 虎牙广告位与渲染组件 | `HYBusinessAd*`、`HYImmersionAd*`、`HYCommonRewardAd*`、`HYLiveEndAd*`、`HYLiveBusinessAd*`、`HYLiveAdx*`、`HYSubscribeAd*`、`HYSMAd`、开屏组件 | 开屏模板 + 可选 `queryAd`、预加载素材和广告位列表 RPC；不是逐个 UI 强行隐藏 |
| MMA 广告监测 | `MMA_AdViewResult`、`MMA_TaskQueue`、`MMA_SDKConfig`、虎牙 SDK 的 `sdkconfig.xml` 常量 | 精确阻断监测配置 URL 与已确认上报接口；动态下发第三方监测 URL 未穷尽 |
| RangersAppLog / BDAutoTrack 6.16.9 | Bundle 版本；`BDAutoTrackASA`、`BDAutoTrackALink*`；URL host 构造函数 | `toblog`、`tobapplog`、`alink`、`klink`、`abtest.volceapplog.com` |
| 腾讯 TDataMaster / TDMIDFA | 嵌入式 Framework 与 IDFA/数据上报能力 | 已清点，但未恢复能安全归为虎牙营销的专用服务端；没有声称完整屏蔽 |

RangersAPM、APMInsight、VolcBaseLog、虎牙 MTP/Sentry 是诊断或性能组件，未仅因名称含 report/log 就归为广告。TTSDKPlayer/Volc 视频播放、Unity、腾讯慧眼、FlyVerify 登录认证、微信/QQ 分享等保留。

本次类/资源清点未确认快手 KSU/KSAd、百度移动广告、Sigmob/WindAd、Google Mobile Ads、Meta Audience Network、Vungle、AppsFlyer、Adjust、SensorsAnalytics、GrowingIO、ThinkingAnalytics、TalkingData、友盟 UMConfigure/MobClick。此结论限于当前静态样本；不是对动态下载代码的绝对排除。`WMPageController`、`GTTSDKLib`、`KSearchBarView` 不能据名称误判为广告 SDK。

## 旧模块的具体缺口

- 原 settings/renderer 只识别 `aid=5000546`。`+[HYCSJEnv hyCsjEnvAppID]`（`0x100a31a6c`）的生产分支返回 `5004161`，测试分支返回 `5339764`。新规则覆盖两者，兼容保留旧 ID；未把旧 ID 当作新版提取结论。
- 原腾讯 `/exapp` 规则限四个历史广告位。新模块保留其 no-fill 行为，并用广告专用域名覆盖其他广告位、预加载和上报路径。
- 原模块没有处理虎牙自有 WUP 广告与增长归因。现在提供 19 条域名规则、4 条精确 Map Local，以及独立可选 WUP 脚本。
- `LaunchAlert/7/LaunchAlert.ios.lzc` 来自本版 `InAppConfig.json` 和内置 Lizard 模板目录；未扩展为任意模板或整个 `kiwistatic.huya.com`。

## RPC 精确匹配与证据

| 服务/方法 | 实现证据 |
| --- | --- |
| `mobileui/queryAd` | `HYBusinessAdManager doQueryAdThenFlattenRspWithADImps:...`，`0x100a9fc60` 读取服务全局变量，`0x100a9fc78` 引用方法名，调用 `wupRequestWithReq:servantName:funcName:rspClass:` |
| `adextui/getAdMaterial` | 广告预加载方法内 `0x100aa4368` 读取服务、`0x100aa4380` 引用方法名 |
| `adui/getUnionPositionList` | `HYBusinessAdCsjManager getUnionPositionList`，`0x100025a68` 读取 `0x109c24248` 指向 `adui`；`0x100025a80` 引用方法名 |
| `adextui/iosAdid` | `AdExtServerAdExtService iosAdid:completion:`（`0x100a41b44`）|
| `adui` / `ad_report` 的明确广告曝光、点击、播放、转化方法 | `AdTrackServerAdTrackService` 中各方法与 `servantWithReqEnv:`（`0x100a37c08`）|
| `ad_monitor_report/adMonitorReceive`、`adPresenterMonitorReceive` | `AdMonitorReportAdMonitorReportService`（`0x100a2c228`、`0x100a2c32c`）|

脚本解析 **WUP 外层服务名和方法名**，不在任意正文里搜索广告关键字。只识别有完整 BE32 长度前缀、WUP v1/v3、合法外层字段的单请求；返回 HTTP 204，让广告失败路径结束。没有猜测业务响应 schema，也没有伪造广告奖励。

仅检查 `wup.huya.com`、`cdn.wup.huya.com`、`wsapi.huya.com` 根路径 POST。主机是样本中存在的业务域，当前实际走哪个 HTTP/QUIC/私有长连接尚未抓包确认。未知服务方法、正常直播/登录/支付、非根路径、压缩/加密/混合批量或未知封装均不处理。

**请求脚本限制：** Surge 会先缓冲匹配请求，再执行脚本。此可选模块设置 1 MiB；超过上限会被 Surge 拒绝，无法由脚本兜底放行。因此未把它默认并入主模块。脚本内部的异常放行只对已交给脚本的请求成立。继承的腾讯 settings 请求脚本也保留原 16 KiB 上限。

## 已验证与待验证

- `node validate.cjs`：107 项检查通过，覆盖广告 RPC、正常业务保留、错误/截断/重复字段、长度溢出、伪造域名、方法边界、随机畸形样本、90 万字节正常请求、规则范围和脚本依赖。
- 使用本机 Surge JavaScriptCore：6 个广告/正常业务协议样本通过。
- 两个模块转换为独立最小配置后通过真实 `surge-cli --check`。仅验证语法与本地脚本行为，没有更改当前 Surge 配置。
- 仍需 iPhone 冷启动、切后台热启动、首页列表、直播切房/弹幕、关注页/短视频、短剧、登录/支付的实测；本次没有设备流量，未声称零误伤。
- 原生自绘、缓存素材、服务器动态域名、加密/私有长连接广告可能残留；仅靠 Surge 网络层不能保证清除所有营销 UI。
- 主模块依赖的两份脚本行保持原样，引用用户原 URL 中的同一固定提交。新增 RPC 模块引用固定 Git 提交的脚本，避免远程脚本与已审阅版本不一致。

证据 [sdk-inventory.json](sdk-inventory.json)、[rule-evidence.json](rule-evidence.json)、差异 [changes.patch](changes.patch) 与 [测试结果](validation-results.json) 可供审阅；`private-analysis/` 包含原二进制和详细提取材料，只留本地，不发布到 GitHub 或交付 ZIP。

参考：[用户原模块](https://raw.githubusercontent.com/hhhh1210/ubl/ios/huya-core-scripted.sgmodule)、[Surge HTTP 请求脚本说明](https://manual.nssurge.com/scripting/http-request.html)、[脚本路径与运行参数](https://manual.nssurge.com/scripting/overview.html)。

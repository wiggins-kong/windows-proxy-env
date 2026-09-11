# 开发进度

## 当前状态

当前版本：`1.0.1`

项目已经完成 Windows 便携版的核心功能和 GitHub Actions 发布链路，并完成圆角品牌 logo、应用图标和托盘图标的统一。当前重点仍是 HTTP(S) 与 SOCKS 双通道改造，以及发布稳定性和后续签名支持。

## 当前迭代：HTTP(S) 与 SOCKS 双通道

状态：双通道改造已落地（UI 来自 `demo/two-column.html`，后端在 `src-tauri/`），logo 换成概念 C「轨道路由」，当前进入收尾验证阶段。

目标行为：

- HTTP(S) 与 SOCKS 是两个可独立启用的通道，可以单独使用，也可以同时启用。
- HTTP(S) 写 `HTTP_PROXY` 和 `HTTPS_PROXY`。
- SOCKS 写 `ALL_PROXY`，协议可选 `socks5://` 或 `socks5h://`。
- 两个通道共用 `NO_PROXY`，地址、端口和认证配置相互独立。
- HTTP(S) 已启用时，SOCKS 默认复用其地址和认证；HTTP(S) 关闭后，SOCKS 自动展开为独立地址。
- 高级模式仍以四个变量手动覆盖普通模式。
- UI 需明确说明 `HTTP_PROXY` / `HTTPS_PROXY` 优先，`ALL_PROXY` 是兜底，二者不是串联关系。
- 连通性测试分别显示 HTTP(S) 和 SOCKS 两条通道的结果。

已落地：

- `ui/`：左右分栏界面，左侧通道配置（独立开关、SOCKS5/SOCKS5h、地址复用、共用 NO_PROXY、高级模式折叠），右侧「将写入的变量 / 应用配置 / 当前用户环境变量」。
- `config.rs`：`Channel`（enabled/host/port/username/password）、`socks_scheme`、`socks_reuse_http`；旧版单通道 `config.json` 读取时自动迁移。
- `proxy_rules.rs`：按通道生成变量（`routes_for` / `values_for`）、复用来源（`socks_source`）、写入前校验（`validate`）。
- `test.rs` / `main.rs`：`test_channel(settings, channel)` 分通道测试；托盘「测试连通性」依次测试所有已启用通道并回推结果；托盘 tooltip 分列两通道地址。
- `disable_proxy`：两个通道都关掉后点「应用更改」= 清变量 + 把 `enabled=false` 写回配置；主按钮「停用代理」（`clear_proxy`）只清变量、保留配置，方便一键重开。
- 新 logo（概念 C「轨道路由」）：`ui/assets/proxyenv-logo.svg` 为设计源；`make_icon.py` 用同一套几何出两套画法——细节版（≥64px：完整轨道/光点/玻璃球）与简化版（<64px 与托盘：加粗交叉轨道 + 实心核心），`make_tray_icons.py` 再按彩色/灰度派生两态托盘图标。
- 窗口默认尺寸 1040×780，最小尺寸 1000×640（保证始终左右两栏）。

下一步：

1. 试用后确认并冻结交互与视觉细节。
2. 手动验证组合：仅 HTTP(S)、仅 SOCKS、两者同时、SOCKS5h、复用开关、高级模式覆盖、清除与停用。
3. 确认 SOCKS4 / SOCKS4a 是否彻底下线（新 UI 只保留 SOCKS5 / SOCKS5h）。
4. 补充代码签名与自动化测试。

## 已完成

- [x] Tauri 2 + Rust + 原生 HTML/CSS/JS 项目骨架
- [x] 用户级环境变量读写与 `WM_SETTINGCHANGE` 广播
- [x] HTTP、HTTPS、SOCKS4、SOCKS4a、SOCKS5、SOCKS5h 映射
- [x] 认证代理、`NO_PROXY` 和高级变量模式
- [x] 配置持久化到 `%APPDATA%\ProxyEnv\config.json`
- [x] 代理连通性测试和延迟展示
- [x] 托盘常驻、状态图标、菜单联动和单实例保护
- [x] 开机自启、静默启动、主题跟随系统、字号设置
- [x] 配置已更改横幅与无感应用更改
- [x] GitHub Actions 标签发布流程
- [x] 项目文档、更新日志和开发说明
- [x] 圆角应用 logo、标题栏 SVG 与全套平台图标（概念 C「轨道路由」，标题栏/任务栏/托盘同一几何）

## 待办

- [ ] 为发布产物增加代码签名，减少 SmartScreen 提示
- [ ] 评估多语言支持
- [ ] 增加自动化测试与发布产物校验

## 架构

| 模块 | 职责 |
| --- | --- |
| `src-tauri/src/main.rs` | Tauri 初始化、命令注册、托盘与窗口生命周期 |
| `src-tauri/src/env_util.rs` | `HKCU\Environment` 读写、状态读取和系统广播 |
| `src-tauri/src/proxy_rules.rs` | 通道到环境变量的映射、URL 构建与写入前校验 |
| `src-tauri/src/config.rs` | 用户配置模型（双通道 + 外观启动项）和持久化 |
| `src-tauri/src/autostart.rs` | `HKCU\Run` 开机自启 |
| `src-tauri/src/test.rs` | 通过代理访问 `generate_204` 并测量延迟 |
| `ui/` | 无构建步骤的原生前端界面 |
| `make_icon.py` | 生成应用源图以及 Windows、Android、iOS 全套图标 |
| `make_tray_icons.py` | 从应用源图生成启用与停用两态托盘图标 |

## 本地开发

### 环境要求

- Windows 10 或 Windows 11
- Rust stable MSVC 工具链
- Node.js，仅用于安装 Tauri CLI 和生成图标
- Python 3 和 `brotli`，仅用于构建后的前端资源校验
- WebView2 运行时，Windows 10/11 通常已随 Edge 提供

### 安装依赖

```powershell
npm install
```

如果项目已配置 Rust 和 Node.js，只需在克隆后执行一次。

### 本地构建

推荐使用构建脚本，它会强制重新嵌入前端资源、校验资源并复制到 `dist/`：

```bash
bash scripts/build.sh
```

也可以使用 Cargo 直接构建：

```powershell
cd src-tauri
cargo build --release
New-Item -ItemType Directory -Force ..\dist | Out-Null
Copy-Item .\target\release\proxyenv.exe ..\dist\ProxyEnv.exe -Force
```

产物路径：`dist/ProxyEnv.exe`

### 跨设备接续

换到新电脑后：

1. 安装 Git、Rust stable MSVC、Node.js 和 WebView2。
2. 克隆仓库 `https://github.com/wiggins-kong/windows-proxy-env.git`。
3. 执行 `npm install` 安装 Tauri CLI；Python 3、`brotli` 和 Pillow 仅在构建校验或重建图标时需要。
4. 阅读本文件“当前迭代”和 `方案.md`，以当前提交中的 `demo/two-column.html` 作为 UI 基线继续开发。
5. 修改正式代码前先执行一次 `git status`，确认没有未提交的本地改动。

### 更新 Logo 与图标

先运行应用图标脚本，再生成托盘状态图标：

```powershell
python make_icon.py
python make_tray_icons.py
```

`make_icon.py` 会更新根目录 `app-icon.png`，并生成 `src-tauri/icons/` 下的 Tauri、Windows、Android 和 iOS 图标；`make_tray_icons.py` 会在此基础上更新 `tray-on.png` 与 `tray-off.png`。

设计源是 `ui/assets/proxyenv-logo.svg`：改 logo 时先改这个 SVG，再按同样的几何更新 `make_icon.py`（脚本按 SVG 的 128 视图框逐项对应，乘 `UNIT = S/128`），否则标题栏和任务栏图标会不一致。

## 发布流程

1. 修改 `src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 中的版本号。
2. 在 `changelog.md` 顶部添加对应版本记录。
3. 本地执行 release 构建并完成启动检查。
4. 提交并推送 `main`。
5. 创建并推送版本标签，例如 `git tag -a v1.0.1 -m "ProxyEnv v1.0.1"`。
6. GitHub Actions 构建 Windows 可执行文件，并使用 `changelog.md` 创建 Release。

## 验证清单

- [ ] `cargo build --release` 成功
- [ ] `dist/ProxyEnv.exe` 文件版本正确
- [ ] 程序可启动并显示主窗口
- [ ] 启用、停用、清除和连通性测试可用
- [ ] 托盘图标、菜单和 tooltip 随状态更新
- [ ] 设置项持久化后可正常恢复

## 已知事项

- 发布文件未签名，首次运行时可能出现 SmartScreen 提示。
- 修改环境变量只影响新开的终端或程序，已打开进程需要重启。
- 配置保存在当前用户目录，不会随便携文件跨机器同步。
- 当前没有自动化单元测试，发布前执行构建验证和手动冒烟测试。

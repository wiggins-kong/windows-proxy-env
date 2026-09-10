# 开发进度

## 当前状态

当前版本：`1.0.1`

项目已经完成 Windows 便携版的核心功能和 GitHub Actions 发布链路。当前重点从功能开发转为发布稳定性、文档维护和后续签名支持。

## 当前迭代：HTTP(S) 与 SOCKS 双通道 UI

状态：交互方案已确认，静态 HTML Demo 已完成；正式 `ui/` 和 Rust 后端尚未改造。

目标行为：

- HTTP(S) 与 SOCKS 是两个可独立启用的通道，可以单独使用，也可以同时启用。
- HTTP(S) 写 `HTTP_PROXY` 和 `HTTPS_PROXY`。
- SOCKS 写 `ALL_PROXY`，协议可选 `socks5://` 或 `socks5h://`。
- 两个通道共用 `NO_PROXY`，地址、端口和认证配置相互独立。
- HTTP(S) 已启用时，SOCKS 默认复用其地址和认证；HTTP(S) 关闭后，SOCKS 自动展开为独立地址。
- 高级模式仍以四个变量手动覆盖普通模式。
- UI 需明确说明 `HTTP_PROXY` / `HTTPS_PROXY` 优先，`ALL_PROXY` 是兜底，二者不是串联关系。
- 连通性测试分别显示 HTTP(S) 和 SOCKS 两条通道的结果。

当前交付物：

- `demo/index.html`：可直接用浏览器打开的单文件交互 Demo，不会实际修改环境变量。
- Demo 已覆盖独立开关、SOCKS5/SOCKS5h 切换、地址复用、实时变量预览、高级模式、双通道测试和响应式布局。

下一步：

1. 确认并冻结 Demo 的交互与视觉方案。
2. 调整配置模型，持久化两套独立代理配置及启用状态。
3. 调整 `proxy_rules.rs` 和 `env_util.rs` 的变量构建、写入与清除逻辑。
4. 将确认后的 UI 合并进正式 `ui/`，移除只允许单协议生效的逻辑。
5. 补充双通道组合、SOCKS5h、复用地址和高级模式覆盖的手动验证。

## 已完成

- [x] Tauri 2 + Rust + 原生 HTML/CSS/JS 项目骨架
- [x] 用户级环境变量读写与 `WM_SETTINGCHANGE` 广播
- [x] HTTP、HTTPS、SOCKS4、SOCKS4a、SOCKS5、SOCKS5h 映射
- [x] 认证代理、`NO_PROXY` 和高级变量模式
- [x] 配置持久化到 `%APPDATA%\ProxyEnv\config.json`
- [x] 代理连通性测试和延迟展示
- [x] 托盘常驻、状态图标、菜单联动和单实例保护
- [x] 开机自启、三态主题、字体和字号设置
- [x] 配置已更改横幅与无感应用更改
- [x] GitHub Actions 标签发布流程
- [x] 项目文档、更新日志和开发说明

## 待办

- [ ] 为发布产物增加代码签名，减少 SmartScreen 提示
- [ ] 评估多语言支持
- [ ] 增加自动化测试与发布产物校验
- [ ] 根据反馈调整应用和托盘图标

## 架构

| 模块 | 职责 |
| --- | --- |
| `src-tauri/src/main.rs` | Tauri 初始化、命令注册、托盘与窗口生命周期 |
| `src-tauri/src/env_util.rs` | `HKCU\Environment` 读写、状态读取和系统广播 |
| `src-tauri/src/proxy_rules.rs` | 代理类型到环境变量的映射与 URL 构建 |
| `src-tauri/src/config.rs` | 用户配置模型和持久化 |
| `src-tauri/src/autostart.rs` | `HKCU\Run` 开机自启 |
| `src-tauri/src/test.rs` | 通过代理访问 `generate_204` 并测量延迟 |
| `ui/` | 无构建步骤的原生前端界面 |

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
4. 阅读本文件“当前迭代”和 `方案.md`，以当前提交中的 `demo/index.html` 作为 UI 基线继续开发。
5. 修改正式代码前先执行一次 `git status`，确认没有未提交的本地改动。

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

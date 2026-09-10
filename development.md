# 开发进度

## 当前状态

当前版本：`1.0.1`

项目已经完成 Windows 便携版的核心功能和 GitHub Actions 发布链路。当前重点从功能开发转为发布稳定性、文档维护和后续签名支持。

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

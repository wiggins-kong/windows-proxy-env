# Windows Proxy Env

一个 Windows 便携代理环境变量开关工具。通过修改用户级环境变量（`HKCU\Environment`）一键启用 / 停用代理，让**新开的终端、程序立即生效**，无需管理员权限。

- 技术栈：Tauri 2（Rust 1.77+）+ 原生 Web 前端（HTML/CSS/JS，无构建步骤）
- 产物：单文件 `ProxyEnv.exe`（约 4.5 MB），免安装、免管理员权限
- 界面：Win11 Fluent 风格，支持跟随系统 / 浅色 / 深色主题，自定义字体与字号

## 功能特性

- **代理类型全覆盖**：HTTP / HTTPS / SOCKS4 / SOCKS4a / SOCKS5 / SOCKS5h，常用协议一键分段选择
- **变量映射**：HTTP 系写入 `HTTP_PROXY` / `HTTPS_PROXY`；SOCKS 系写入 `ALL_PROXY`；始终写入 `NO_PROXY`
- **认证代理**：可选用户名 / 密码，自动拼入 `user:pass@` 形式
- **高级模式**：手动编辑四个变量值，完全自定义
- **连通测试**：内置走代理访问 `generate_204` 测速，显示延迟；未应用更改时标注「按当前表单值测试」
- **配置已更改横幅**：代理启用中修改任一参数，出现「配置已更改 · 尚未生效」横幅，点「应用更改」无感重写并保持启用（避免"改了没生效"陷阱）
- **一键清除**：清除全部 4 个相关变量
- **托盘常驻**：左键单击打开主界面，右键弹出菜单（启用 / 停用 / 测试 / 退出）；关窗最小化到托盘
- **托盘状态图标**：启用 = 彩色 logo + 绿色角标；停用 = 灰度 logo + 灰色角标；悬停 tooltip 显示状态与地址；菜单随状态置灰
- **开机自启**：可选（写入 `HKCU\...\Run`）
- **外观设置**：主题三态、13 种字体、字号滑杆（11–18px），持久化到配置
- **单实例保护**：重复启动时聚焦已有窗口
- **中文界面**，新终端立即生效（广播 `WM_SETTINGCHANGE`）

## 系统要求

- Windows 10 / 11（WebView2 运行时，Win10 1903+ 自带或随 Edge 分发）
- 便携运行：解压 `ProxyEnv.exe` 双击即用；未签名，首次运行 SmartScreen 提示时选择"仍要运行"

## 构建

```bash
# 前置：Rust stable (MSVC)、Node.js(仅图标生成)、Python 3.13+(brotli、pillow，仅验证/图标)
# 一键构建（强制重嵌前端资源 + 校验 + 分发到 dist/）
bash scripts/build.sh

# 或手动
cd src-tauri
touch src/main.rs   # 重要：让 Rust 重编译以重新嵌入 ui/ 资源
cargo build --release
cp target/release/ProxyEnv.exe ../dist/ProxyEnv.exe
```

> ⚠️ Tauri 的内嵌前端资源（brotli 压缩）只在 Rust crate 重编译时更新。**只修改 `ui/` 后必须 `touch src/main.rs` 再构建**，否则界面不会更新。`scripts/build.sh` 已内置该步骤与资源校验。

## 使用说明

1. 选择连接协议（HTTP / SOCKS5 / SOCKS5h），填服务器地址与端口
2. 点击大按钮「启用代理」——立刻写入环境变量并广播生效
3. 新开的终端 / 程序即可走代理（PowerShell、cmd、git、curl 等）
4. 点击「测试连通性」验证链路与延迟；不用了点「清除代理」
5. 标题栏齿轮打开设置：开机自启、主题、字体、字号

释放环境变量后，**已打开**的终端需要新开窗口才生效（Windows 环境变量机制）。

## 数据存放

| 数据 | 位置 |
| --- | --- |
| 配置 | `%APPDATA%\ProxyEnv\config.json` |
| 环境变量 | `HKCU\Environment`（HTTP_PROXY / HTTPS_PROXY / ALL_PROXY / NO_PROXY） |
| 自启动项 | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\ProxyEnv` |

## 项目文档

- [changelog.md](changelog.md)：版本更新记录
- [development.md](development.md)：开发进度、架构、构建与发布流程
- [方案.md](方案.md)：初始产品与技术方案

## 许可证

MIT（项目仓库见 GitHub）

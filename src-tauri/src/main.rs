#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod config;
mod env_util;
mod proxy_rules;
mod test;

use config::Settings;
use env_util::EnvStatus;
use serde::Serialize;
use tauri::image::Image;
use tauri::menu::MenuItem;
use tauri::tray::TrayIcon;
use tauri::{AppHandle, Emitter, Manager, Wry};
use test::TestResult;

#[derive(Serialize)]
struct Snapshot {
    settings: Settings,
    env: EnvStatus,
}

/// 托盘子系统：持有句柄以便运行时切换状态图标 / tooltip / 菜单置灰
struct TrayState {
    tray: TrayIcon<Wry>,
    enable: MenuItem<Wry>,
    disable: MenuItem<Wry>,
}

/// 按当前真实状态同步托盘外观：启用 → 彩色+绿点；停用 → 灰度+灰点
fn sync_tray(app: &AppHandle) {
    let st = app.state::<TrayState>();
    let env = env_util::read_status();
    if env.active {
        let icon = Image::from_bytes(include_bytes!("../icons/tray-on.png")).ok();
        let _ = st.tray.set_icon(icon);
        let url = env
            .all_proxy
            .as_deref()
            .or(env.http_proxy.as_deref())
            .unwrap_or("");
        let _ = st
            .tray
            .set_tooltip(Some(format!("ProxyEnv · 代理已启用 {url}")));
        let _ = st.enable.set_enabled(false);
        let _ = st.disable.set_enabled(true);
    } else {
        let icon = Image::from_bytes(include_bytes!("../icons/tray-off.png")).ok();
        let _ = st.tray.set_icon(icon);
        let _ = st
            .tray
            .set_tooltip(Some("ProxyEnv · 代理已停用".to_string()));
        let _ = st.enable.set_enabled(true);
        let _ = st.disable.set_enabled(false);
    }
}

fn apply_impl(settings: &Settings) -> Result<(), String> {
    if !settings.use_advanced && settings.host.trim().is_empty() {
        return Err("请先填写代理地址和端口".into());
    }
    // 先清干净，避免切换类型后残留旧变量
    env_util::clear_all()?;
    for (name, val) in proxy_rules::values_for(settings) {
        env_util::write_var(&name, &val)?;
    }
    config::save(settings)
}

#[tauri::command]
fn get_state() -> Snapshot {
    Snapshot {
        settings: config::load(),
        env: env_util::read_status(),
    }
}

#[tauri::command]
fn apply_proxy(app: AppHandle, settings: Settings) -> Result<Snapshot, String> {
    apply_impl(&settings)?;
    sync_tray(&app);
    Ok(Snapshot {
        settings,
        env: env_util::read_status(),
    })
}

#[tauri::command]
fn clear_proxy(app: AppHandle) -> Result<Snapshot, String> {
    env_util::clear_all()?;
    sync_tray(&app);
    Ok(Snapshot {
        settings: config::load(),
        env: env_util::read_status(),
    })
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<bool, String> {
    autostart::set_enabled(enabled)?;
    let mut s = config::load();
    s.autostart = enabled;
    config::save(&s)?;
    Ok(autostart::is_enabled())
}

#[tauri::command]
fn set_theme(app: AppHandle, theme: String) -> Result<(), String> {
    let mut s = config::load();
    s.theme = theme.clone();
    config::save(&s)?;
    if let Some(win) = app.get_webview_window("main") {
        let t = match theme.as_str() {
            "light" => Some(tauri::Theme::Light),
            "dark" => Some(tauri::Theme::Dark),
            _ => None,
        };
        let _ = win.set_theme(t);
    }
    Ok(())
}

#[tauri::command]
fn set_font(font: String, font_size: u16) -> Result<(), String> {
    let mut s = config::load();
    s.font = font;
    s.font_size = font_size;
    config::save(&s)
}

#[tauri::command]
async fn test_proxy(settings: Settings) -> TestResult {
    test::run(&settings).await
}

fn show_main(app: &AppHandle) {
    // 显示时校准一次托盘状态（兜底外部改动）
    sync_tray(app);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

fn handle_tray_menu(app: &AppHandle, id: &str) {
    match id {
        "show" => show_main(app),
        "enable" => {
            let s = config::load();
            match apply_impl(&s) {
                Ok(_) => {
                    sync_tray(app);
                    let _ = app.emit("proxyenv://env-changed", ());
                }
                Err(e) => {
                    let _ = app.emit("proxyenv://tray-error", e);
                }
            }
        }
        "disable" => {
            let _ = env_util::clear_all();
            sync_tray(app);
            let _ = app.emit("proxyenv://env-changed", ());
        }
        "test" => {
            let s = config::load();
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let r = test::run(&s).await;
                let _ = app.emit("proxyenv://tray-test-result", r);
            });
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .invoke_handler(tauri::generate_handler![
            get_state,
            apply_proxy,
            clear_proxy,
            set_autostart,
            set_theme,
            set_font,
            test_proxy
        ])
        .setup(|app| {
            // Mica 效果由 tauri.conf.json 的 windowEffects 配置驱动（Win11 生效，Win10 自动降级）
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
            }

            // 托盘（menu 项与 tray 句柄托管进 state，供 sync_tray 运行时切换）
            use tauri::menu::{Menu, MenuItem};
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let enable = MenuItem::with_id(app, "enable", "启用代理", true, None::<&str>)?;
            let disable = MenuItem::with_id(app, "disable", "停用代理", true, None::<&str>)?;
            let test = MenuItem::with_id(app, "test", "测试连通性", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &enable, &disable, &test, &quit])?;
            // 显式指定托盘图标：避免依赖 tauri.conf.json 的 trayIcon（会自动多建一个空托盘）
            let icon = app.default_window_icon().cloned().ok_or("缺少应用图标")?;
            let tray = tauri::tray::TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| handle_tray_menu(app, event.id().as_ref()))
                .on_tray_icon_event(|tray, event| {
                    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
                    // 左键单击：打开主界面；右键：弹出菜单（默认）
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            app.manage(TrayState {
                tray,
                enable,
                disable,
            });

            // 启动即按真实状态初始化托盘外观
            sync_tray(app.handle());

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("ProxyEnv 启动失败");
}

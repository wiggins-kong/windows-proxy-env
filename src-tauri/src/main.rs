#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod config;
mod env_util;
mod proxy_rules;
mod test;

use config::Settings;
use env_util::EnvStatus;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use test::TestResult;

#[derive(Serialize)]
struct Snapshot {
    settings: Settings,
    env: EnvStatus,
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
fn apply_proxy(settings: Settings) -> Result<Snapshot, String> {
    apply_impl(&settings)?;
    Ok(Snapshot { settings, env: env_util::read_status() })
}

#[tauri::command]
fn clear_proxy() -> Result<Snapshot, String> {
    env_util::clear_all()?;
    Ok(Snapshot { settings: config::load(), env: env_util::read_status() })
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
                    let _ = app.emit("proxyenv://env-changed", ());
                }
                Err(e) => {
                    let _ = app.emit("proxyenv://tray-error", e);
                }
            }
        }
        "disable" => {
            let _ = env_util::clear_all();
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

            // 托盘
            use tauri::menu::{Menu, MenuItem};
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let enable = MenuItem::with_id(app, "enable", "启用代理", true, None::<&str>)?;
            let disable = MenuItem::with_id(app, "disable", "停用代理", true, None::<&str>)?;
            let test = MenuItem::with_id(app, "test", "测试连通性", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &enable, &disable, &test, &quit])?;
            // 显式指定托盘图标：避免依赖 tauri.conf.json 的 trayIcon（会自动多建一个空托盘）
            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("缺少应用图标")?;
            let _tray = tauri::tray::TrayIconBuilder::new()
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
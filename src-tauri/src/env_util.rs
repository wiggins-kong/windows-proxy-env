use serde::Serialize;
use winreg::{enums::*, RegKey};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE,
};

pub const VARS: [&str; 4] = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"];

/// 当前环境变量实际生效状态（读自 HKCU\Environment）
#[derive(Debug, Default, Clone, Serialize)]
pub struct EnvStatus {
    pub http_proxy: Option<String>,
    pub https_proxy: Option<String>,
    pub all_proxy: Option<String>,
    pub no_proxy: Option<String>,
    /// HTTP_PROXY / HTTPS_PROXY / ALL_PROXY 任一存在即视为"代理已启用"
    pub active: bool,
}

fn env_key() -> Result<RegKey, String> {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
        .map_err(|e| format!("无法打开 HKCU\\Environment: {e}"))
}

fn read_var(key: &RegKey, name: &str) -> Option<String> {
    key.get_value::<String, _>(name).ok().filter(|v| !v.is_empty())
}

pub fn read_status() -> EnvStatus {
    let mut s = EnvStatus::default();
    if let Ok(key) = env_key() {
        s.http_proxy = read_var(&key, "HTTP_PROXY");
        s.https_proxy = read_var(&key, "HTTPS_PROXY");
        s.all_proxy = read_var(&key, "ALL_PROXY");
        s.no_proxy = read_var(&key, "NO_PROXY");
        s.active = s.http_proxy.is_some() || s.https_proxy.is_some() || s.all_proxy.is_some();
    }
    s
}

/// 写入（或删除）一个用户级环境变量
pub fn write_var(name: &str, value: &str) -> Result<(), String> {
    let key = env_key()?;
    key.set_value(name, &value.to_string())
        .map_err(|e| format!("写入 {name} 失败: {e}"))?;
    broadcast();
    Ok(())
}

pub fn delete_var(name: &str) -> Result<(), String> {
    let key = env_key()?;
    match key.delete_value(name) {
        Ok(_) => {
            broadcast();
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("删除 {name} 失败: {e}")),
    }
}

/// 广播环境变更通知，让新开的终端/资源管理器立即感知
pub fn broadcast() {
    unsafe {
        let name: Vec<u16> = "Environment".encode_utf16().chain(std::iter::once(0)).collect();
        let mut result: usize = 0;
        let _ = SendMessageTimeoutW(
            HWND_BROADCAST as _,
            WM_SETTINGCHANGE,
            0,
            name.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            &mut result,
        );
    }
}

/// 一键清除所有代理相关环境变量
pub fn clear_all() -> Result<(), String> {
    let errors: Vec<String> = VARS
        .iter()
        .filter_map(|v| delete_var(v).err())
        .collect();
    if !errors.is_empty() {
        return Err(errors.join("；"));
    }
    Ok(())
}
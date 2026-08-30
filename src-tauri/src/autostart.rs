use winreg::{enums::*, RegKey};

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const APP_NAME: &str = "ProxyEnv";

fn run_key() -> Result<RegKey, String> {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_KEY, KEY_READ | KEY_WRITE)
        .map_err(|e| format!("无法打开启动项注册表: {e}"))
}

pub fn is_enabled() -> bool {
    match run_key() {
        Ok(k) => k.get_value::<String, _>(APP_NAME).is_ok(),
        Err(_) => false,
    }
}

/// 写当前 exe 到开机自启，禁用时移除
pub fn set_enabled(enabled: bool) -> Result<(), String> {
    let key = run_key()?;
    if enabled {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let cmd = format!("\"{}\"", exe.display());
        key.set_value(APP_NAME, &cmd).map_err(|e| e.to_string())
    } else {
        match key.delete_value(APP_NAME) {
            Ok(_) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}
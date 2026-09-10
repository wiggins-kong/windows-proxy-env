use serde::{Deserialize, Serialize};

/// 高级模式：用户手动编辑的 4 个变量值
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct AdvancedVars {
    pub http_proxy: String,
    pub https_proxy: String,
    pub all_proxy: String,
    pub no_proxy: String,
}

/// 应用持久化的设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub proxy_type: String, // HTTP / HTTPS / SOCKS4 / SOCKS4a / SOCKS5 / SOCKS5h
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub no_proxy: String,
    pub advanced: Option<AdvancedVars>,
    pub use_advanced: bool,
    pub autostart: bool,
    pub theme: String,  // system / light / dark
    pub font: String,   // 自定义程序字体（空 = 默认）
    pub font_size: u16, // 基础字号 px（0 = 默认 13）
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            proxy_type: "HTTP".into(),
            host: String::new(),
            port: 7890,
            username: String::new(),
            password: String::new(),
            no_proxy: "localhost,127.0.0.1,::1".into(),
            advanced: None,
            use_advanced: false,
            autostart: false,
            theme: "system".into(),
            font: String::new(),
            font_size: 0,
        }
    }
}

fn config_path() -> std::path::PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let dir = std::path::Path::new(&base).join("ProxyEnv");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("config.json")
}

pub fn load() -> Settings {
    let path = config_path();
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

pub fn save(s: &Settings) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(config_path(), raw).map_err(|e| e.to_string())
}

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

/// 单条代理通道（HTTP(S) 或 SOCKS）的独立配置
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Channel {
    /// 通道开关（表单意图，实际是否生效看环境变量）
    pub enabled: bool,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
}

impl Channel {
    fn new(port: u16) -> Self {
        Self {
            enabled: false,
            host: String::new(),
            port,
            username: String::new(),
            password: String::new(),
        }
    }
}

pub const DEFAULT_NO_PROXY: &str =
    "localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16";

/// 应用持久化的设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// HTTP(S) 通道：写入 HTTP_PROXY / HTTPS_PROXY
    pub http: Channel,
    /// SOCKS 通道：写入 ALL_PROXY
    pub socks: Channel,
    /// SOCKS 解析方式：socks5（本地解析）/ socks5h（代理端解析）
    pub socks_scheme: String,
    /// HTTP(S) 已启用时，SOCKS 默认复用其地址与认证
    pub socks_reuse_http: bool,
    /// 两个通道共用
    pub no_proxy: String,
    pub advanced: Option<AdvancedVars>,
    pub use_advanced: bool,
    pub autostart: bool,
    pub silent_startup: bool,
    pub theme: String,  // system / light / dark
    pub font_size: u16, // 基础字号 px（0 = 默认）
}

impl Default for Settings {
    fn default() -> Self {
        let mut socks = Channel::new(7891);
        socks.enabled = false;
        Self {
            http: Channel::new(7890),
            socks,
            socks_scheme: "socks5h".into(),
            socks_reuse_http: true,
            no_proxy: DEFAULT_NO_PROXY.into(),
            advanced: None,
            use_advanced: false,
            autostart: false,
            silent_startup: false,
            theme: "system".into(),
            font_size: 0,
        }
    }
}

/// v1.0.1 及更早版本的单一代理配置，仅用于迁移
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
struct LegacySettings {
    proxy_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
}

fn config_path() -> std::path::PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let dir = std::path::Path::new(&base).join("ProxyEnv");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("config.json")
}

/// 把旧版单通道配置迁移成新的双通道配置（不覆盖已经存在的通道字段）
fn migrate_legacy(raw: &serde_json::Value, s: &mut Settings) {
    let legacy: LegacySettings = match serde_json::from_value(raw.clone()) {
        Ok(l) => l,
        Err(_) => return,
    };
    if legacy.host.trim().is_empty() {
        return;
    }
    let is_socks = matches!(
        legacy.proxy_type.as_str(),
        "SOCKS4" | "SOCKS4a" | "SOCKS5" | "SOCKS5h"
    );
    let channel = Channel {
        enabled: true,
        host: legacy.host.trim().to_string(),
        port: if legacy.port == 0 { 7890 } else { legacy.port },
        username: legacy.username,
        password: legacy.password,
    };
    if is_socks {
        s.socks_scheme = if legacy.proxy_type == "SOCKS5" {
            "socks5".into()
        } else {
            "socks5h".into()
        };
        let mut socks = channel;
        socks.port = if legacy.port == 0 { 7891 } else { legacy.port };
        s.socks = socks;
        s.socks_reuse_http = false;
    } else {
        s.http = channel;
    }
}

pub fn load() -> Settings {
    let raw = match std::fs::read_to_string(config_path()) {
        Ok(raw) => raw,
        Err(_) => return Settings::default(),
    };
    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Settings::default(),
    };
    let mut s: Settings = serde_json::from_value(value.clone()).unwrap_or_default();
    // 旧配置没有 http/socks 字段 → 迁移单通道设置
    if value.get("http").is_none() && value.get("socks").is_none() {
        migrate_legacy(&value, &mut s);
    }
    s
}

pub fn save(s: &Settings) -> Result<(), String> {
    let raw = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    std::fs::write(config_path(), raw).map_err(|e| e.to_string())
}

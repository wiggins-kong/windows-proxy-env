use crate::config::{AdvancedVars, Settings};
use urlencoding::encode;

pub fn scheme_for(t: &str) -> &str {
    match t {
        "SOCKS4" => "socks4",
        "SOCKS4a" => "socks4a",
        "SOCKS5" => "socks5",
        "SOCKS5h" => "socks5h",
        _ => "http",
    }
}

/// 把主机/端口/认证拼成 代理 URL
pub fn proxy_url(s: &Settings, scheme: &str) -> String {
    if s.host.trim().is_empty() {
        return String::new();
    }
    let mut url = format!("{scheme}://");
    if !s.username.is_empty() {
        url.push_str(&encode(s.username.as_str()));
        if !s.password.is_empty() {
            url.push(':');
            url.push_str(&encode(s.password.as_str()));
        }
        url.push('@');
    }
    url.push_str(s.host.trim());
    url.push(':');
    url.push_str(&s.port.to_string());
    url
}

/// 根据类型生成要写入的变量集合（不含 NO_PROXY 之外的其他保留）
pub fn values_for(s: &Settings) -> Vec<(String, String)> {
    if s.use_advanced {
        return advanced_values(s.advanced.as_ref());
    }
    let mut v: Vec<(String, String)> = Vec::new();
    match s.proxy_type.as_str() {
        "SOCKS4" | "SOCKS4a" | "SOCKS5" | "SOCKS5h" => {
            let u = proxy_url(s, scheme_for(&s.proxy_type));
            if !u.is_empty() {
                v.push(("ALL_PROXY".into(), u));
            }
        }
        _ => {
            // HTTP / HTTPS：HTTP_PROXY 与 HTTPS_PROXY 都指向同一个 http 代理
            let u = proxy_url(s, "http");
            if !u.is_empty() {
                v.push(("HTTP_PROXY".into(), u.clone()));
                v.push(("HTTPS_PROXY".into(), u));
            }
        }
    }
    // NO_PROXY 恒跟随写入（即使 host 为空，也保证豁免清单生效）
    v.push(("NO_PROXY".into(), s.no_proxy.trim().to_string()));
    v
}

pub fn advanced_values(a: Option<&AdvancedVars>) -> Vec<(String, String)> {
    let a = a.cloned().unwrap_or_default();
    let mut v = Vec::new();
    for (name, val) in [
        ("HTTP_PROXY", a.http_proxy),
        ("HTTPS_PROXY", a.https_proxy),
        ("ALL_PROXY", a.all_proxy),
        ("NO_PROXY", a.no_proxy),
    ] {
        if !val.trim().is_empty() {
            v.push((name.into(), val.trim().to_string()));
        }
    }
    v
}

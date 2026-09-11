use crate::config::{AdvancedVars, Channel, Settings};
use urlencoding::encode;

/// SOCKS 解析方式（UI 只提供这两种）
pub fn normalize_scheme(s: &str) -> &'static str {
    if s == "socks5" {
        "socks5"
    } else {
        "socks5h"
    }
}

/// 把通道的主机/端口/认证拼成代理 URL
pub fn channel_url(c: &Channel, scheme: &str) -> String {
    if c.host.trim().is_empty() {
        return String::new();
    }
    let mut url = format!("{scheme}://");
    if !c.username.is_empty() {
        url.push_str(&encode(c.username.as_str()));
        if !c.password.is_empty() {
            url.push(':');
            url.push_str(&encode(c.password.as_str()));
        }
        url.push('@');
    }
    url.push_str(c.host.trim());
    url.push(':');
    url.push_str(&c.port.to_string());
    url
}

/// SOCKS 实际使用的地址来源：HTTP(S) 已启用且勾选复用时跟随 HTTP(S)
pub fn socks_source(s: &Settings) -> &Channel {
    if s.http.enabled && s.socks_reuse_http {
        &s.http
    } else {
        &s.socks
    }
}

pub fn http_url(s: &Settings) -> String {
    channel_url(&s.http, "http")
}

pub fn socks_url(s: &Settings) -> String {
    channel_url(socks_source(s), normalize_scheme(&s.socks_scheme))
}

/// 通道与对应测试用的认证信息
pub fn channel_credentials(s: &Settings, channel: &str) -> (String, String) {
    let c = if channel == "socks" {
        socks_source(s)
    } else {
        &s.http
    };
    (c.username.clone(), c.password.clone())
}

/// 普通模式生成的代理变量（不含 NO_PROXY 之外的豁免处理）
pub fn routes_for(s: &Settings) -> Vec<(String, String)> {
    let mut v: Vec<(String, String)> = Vec::new();
    if s.http.enabled {
        let u = http_url(s);
        if !u.is_empty() {
            v.push(("HTTP_PROXY".into(), u.clone()));
            v.push(("HTTPS_PROXY".into(), u));
        }
    }
    if s.socks.enabled {
        let u = socks_url(s);
        if !u.is_empty() {
            v.push(("ALL_PROXY".into(), u));
        }
    }
    v
}

/// 根据设置生成要写入的变量集合
pub fn values_for(s: &Settings) -> Vec<(String, String)> {
    if s.use_advanced {
        return advanced_values(s.advanced.as_ref());
    }
    let mut v = routes_for(s);
    // NO_PROXY 共用；没有可用通道时不单独写入豁免清单
    if !v.is_empty() && !s.no_proxy.trim().is_empty() {
        v.push(("NO_PROXY".into(), s.no_proxy.trim().to_string()));
    }
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

/// 写入前的校验：缺地址 / 没有任何通道时给出明确提示
pub fn validate(s: &Settings) -> Result<(), String> {
    if s.use_advanced {
        if advanced_values(s.advanced.as_ref()).is_empty() {
            return Err("高级模式已开启，但四个变量均为空".into());
        }
        return Ok(());
    }
    if !s.http.enabled && !s.socks.enabled {
        return Err("请至少启用一个代理通道".into());
    }
    if s.http.enabled && s.http.host.trim().is_empty() {
        return Err("请先填写 HTTP(S) 服务器地址".into());
    }
    if s.socks.enabled && socks_source(s).host.trim().is_empty() {
        return Err(if s.http.enabled && s.socks_reuse_http {
            "请先填写 HTTP(S) 服务器地址".into()
        } else {
            "请先填写 SOCKS 服务器地址".into()
        });
    }
    if routes_for(s).is_empty() {
        return Err("当前配置没有可写入的代理通道".into());
    }
    Ok(())
}

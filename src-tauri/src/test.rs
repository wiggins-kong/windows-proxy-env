use crate::config::Settings;
use crate::proxy_rules::{channel_credentials, http_url, socks_url};
use serde::Serialize;
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
pub struct TestResult {
    pub ok: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

/// 单个通道的测试结果（带通道名，供托盘批量测试回推）
#[derive(Debug, Clone, Serialize)]
pub struct ChannelOutcome {
    pub channel: String,
    pub ok: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

fn err(msg: String) -> TestResult {
    TestResult {
        ok: false,
        latency_ms: 0,
        error: Some(msg),
    }
}

/// 当前设置下指定通道要测试的代理 URL
pub fn channel_proxy_str(s: &Settings, channel: &str) -> String {
    if s.use_advanced {
        let a = match &s.advanced {
            Some(a) => a.clone(),
            None => return String::new(),
        };
        let raw = if channel == "socks" {
            a.all_proxy
        } else {
            let http = a.http_proxy.trim();
            if http.is_empty() {
                a.https_proxy
            } else {
                a.http_proxy
            }
        };
        return raw
            .split(',')
            .next()
            .map(|x| x.trim().to_string())
            .unwrap_or_default();
    }
    if channel == "socks" {
        socks_url(s)
    } else {
        http_url(s)
    }
}

/// 指定通道是否有可测试的目标
pub fn channel_available(s: &Settings, channel: &str) -> bool {
    if s.use_advanced {
        return !channel_proxy_str(s, channel).is_empty();
    }
    if channel == "socks" {
        s.socks.enabled
    } else {
        s.http.enabled
    }
}

pub async fn run(s: &Settings, channel: &str) -> TestResult {
    let proxy_str = channel_proxy_str(s, channel);
    let proxy_str = proxy_str.trim();
    if proxy_str.is_empty() {
        return err("请先填写代理地址（或启用高级模式变量）".into());
    }

    let mut builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(8));
    match reqwest::Proxy::all(proxy_str) {
        Ok(mut proxy) => {
            let (user, pass) = channel_credentials(s, channel);
            if !user.is_empty() {
                proxy = proxy.basic_auth(&user, &pass);
            }
            builder = builder.proxy(proxy);
        }
        Err(e) => return err(format!("代理地址格式无法解析: {e}")),
    }

    let client = match builder.build() {
        Ok(c) => c,
        Err(e) => return err(format!("HTTP 客户端初始化失败: {e}")),
    };

    let start = Instant::now();
    match client
        .get("https://www.gstatic.com/generate_204")
        .send()
        .await
    {
        Ok(resp) => {
            let ms = start.elapsed().as_millis() as u64;
            let code = resp.status();
            if code.is_success() {
                TestResult {
                    ok: true,
                    latency_ms: ms,
                    error: None,
                }
            } else {
                TestResult {
                    ok: false,
                    latency_ms: ms,
                    error: Some(format!("目标返回 HTTP {code}")),
                }
            }
        }
        Err(e) => TestResult {
            ok: false,
            latency_ms: 0,
            error: Some(e.to_string()),
        },
    }
}

/// 托盘菜单用：依次测试所有已启用通道
pub async fn run_enabled(s: &Settings) -> Vec<ChannelOutcome> {
    let mut out = Vec::new();
    for channel in ["http", "socks"] {
        if !channel_available(s, channel) {
            continue;
        }
        let r = run(s, channel).await;
        out.push(ChannelOutcome {
            channel: channel.to_string(),
            ok: r.ok,
            latency_ms: r.latency_ms,
            error: r.error,
        });
    }
    out
}

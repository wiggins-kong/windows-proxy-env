use crate::config::Settings;
use crate::proxy_rules::{proxy_url, scheme_for};
use serde::Serialize;
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
pub struct TestResult {
    pub ok: bool,
    pub latency_ms: u64,
    pub error: Option<String>,
}

fn err(msg: String) -> TestResult {
    TestResult { ok: false, latency_ms: 0, error: Some(msg) }
}

/// 用当前设置生成代理 URL 字符串（用于测试）
fn test_proxy_str(s: &Settings) -> String {
    if s.use_advanced {
        // 高级模式下优先拿 ALL_PROXY，否则 HTTP_PROXY
        if let Some(a) = &s.advanced {
            if let Some(v) = a
                .all_proxy
                .split(',')
                .next()
                .filter(|x| !x.trim().is_empty())
            {
                return v.trim().to_string();
            }
            if let Some(v) = a
                .http_proxy
                .split(',')
                .next()
                .filter(|x| !x.trim().is_empty())
            {
                return v.trim().to_string();
            }
        }
        return String::new();
    }
    proxy_url(s, scheme_for(&s.proxy_type))
}

pub async fn run(s: &Settings) -> TestResult {
    let proxy_str = test_proxy_str(s);
    let proxy_str = proxy_str.trim();
    if proxy_str.is_empty() {
        return err("请先填写代理地址（或启用高级模式变量）".into());
    }

    let mut builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(8));
    match reqwest::Proxy::all(proxy_str) {
        Ok(mut proxy) => {
            if !s.username.is_empty() {
                proxy = proxy.basic_auth(&s.username, &s.password);
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
    match client.get("https://www.gstatic.com/generate_204").send().await {
        Ok(resp) => {
            let ms = start.elapsed().as_millis() as u64;
            let code = resp.status();
            if code.is_success() {
                TestResult { ok: true, latency_ms: ms, error: None }
            } else {
                TestResult {
                    ok: false,
                    latency_ms: ms,
                    error: Some(format!("目标返回 HTTP {code}")),
                }
            }
        }
        Err(e) => TestResult { ok: false, latency_ms: 0, error: Some(e.to_string()) },
    }
}
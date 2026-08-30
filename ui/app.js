/* ProxyEnv 前端逻辑 */
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { listen } = window.__TAURI__.event;

/* 错误面罩：任何 JS 错误/未捕获 Promise 异常都显示到状态徽标，便于快速定位 */
window.addEventListener("error", (e) => {
  const b = document.getElementById("state-badge");
  if (b) b.textContent = "JS错误:" + String(e.message || e).slice(0, 28);
});
window.addEventListener("unhandledrejection", (e) => {
  const b = document.getElementById("state-badge");
  if (b) b.textContent = "JS异常:" + String(e.reason || "").slice(0, 28);
});

let win = null;
try {
  win = getCurrentWindow();
} catch (e) {
  const b = document.getElementById("state-badge");
  if (b) b.textContent = "API失败:" + String(e).slice(0, 28);
}

const $ = (id) => document.getElementById(id);
const els = {
  badge: $("state-badge"),
  protoSeg: $("proto-seg"),
  protoHint: $("proto-hint"),
  host: $("host"),
  port: $("port"),
  username: $("username"),
  password: $("password"),
  noProxy: $("no-proxy"),
  advToggle: $("adv-toggle"),
  advBody: $("adv-body"),
  advChevron: $("adv-chevron"),
  useAdvanced: $("use-advanced"),
  advHttp: $("adv-http"),
  advHttps: $("adv-https"),
  advAll: $("adv-all"),
  advNoProxy: $("adv-noproxy"),
  master: $("btn-master"),
  masterText: $("master-text"),
  testBtn: $("btn-test"),
  clearBtn: $("btn-clear"),
  testResult: $("test-result"),
  stateStrip: $("state-strip"),
  autostart: $("autostart"),
  themeSeg: $("theme-seg"),
  toast: $("toast"),
  // 标题栏
  btnSettings: $("btn-settings"),
  btnMin: $("btn-min"),
  btnClose: $("btn-close"),
  // 设置弹窗
  modal: $("modal-settings"),
  modalClose: $("modal-close"),
  modalTabs: document.querySelectorAll(".modal-tabs .seg"),
  fontSelect: $("font-select"),
  fontSize: $("font-size"),
  sizeVal: $("size-val"),
};

let state = null;
let toastTimer = null;

/* ---------- 工具 ---------- */
function toast(msg, isErr = false) {
  els.toast.textContent = msg;
  els.toast.classList.toggle("err", isErr);
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 3000);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* ---------- 主题 ---------- */
const media = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme() {
  const prefer = localStorage.getItem("pe-theme") || "system";
  const effective = prefer === "system" ? (media.matches ? "dark" : "light") : prefer;
  document.documentElement.dataset.theme = effective;
  document.body.dataset.theme = effective;
  document.querySelectorAll("#theme-seg .seg").forEach((b) => {
    b.classList.toggle("active", b.dataset.themeVal === prefer);
  });
}

els.themeSeg.addEventListener("click", async (e) => {
  const btn = e.target.closest(".seg");
  if (!btn) return;
  const theme = btn.dataset.themeVal;
  localStorage.setItem("pe-theme", theme);
  applyTheme();
  try {
    await invoke("set_theme", { theme });
  } catch (err) { /* 忽略 */ }
});

media.addEventListener("change", applyTheme);

/* ---------- 外观（字体/字号） ---------- */
function applyFont() {
  const font = els.fontSelect.value;
  const size = parseInt(els.fontSize.value, 10) || 13;
  const root = document.documentElement.style;
  if (font) root.setProperty("--font-ui", `"${font}"`);
  else root.removeProperty("--font-ui");
  root.setProperty("--fs", size + "px");
  els.sizeVal.textContent = size + " px";
  els.fontSize.style.setProperty("--fill", ((size - 11) / (18 - 11)) * 100 + "%");
  // 字体下拉自身的选项文字跟随所选字体
  els.fontSelect.style.fontFamily = font || "inherit";
}

els.fontSelect.addEventListener("change", async () => {
  applyFont();
  try {
    await invoke("set_font", { font: els.fontSelect.value, font_size: parseInt(els.fontSize.value, 10) || 0 });
  } catch (e) { toast("保存字体失败：" + e, true); }
});

els.fontSize.addEventListener("input", applyFont);
els.fontSize.addEventListener("change", async () => {
  try {
    await invoke("set_font", { font: els.fontSelect.value, font_size: parseInt(els.fontSize.value, 10) || 0 });
  } catch (e) { toast("保存字号失败：" + e, true); }
});

/* ---------- 设置弹窗 ---------- */
function openModal() {
  els.modal.classList.remove("hidden");
  // 不自动聚焦关闭按钮，避免显示焦点环
  els.modal.focus({ preventScroll: true });
}
function closeModal() {
  els.modal.classList.add("hidden");
}

els.btnSettings.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  openModal();
});
els.modalClose.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  closeModal();
});
els.modal.addEventListener("pointerdown", (e) => {
  if (e.target === els.modal) closeModal(); // 点击遮罩关闭
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.modal.classList.contains("hidden")) closeModal();
});

// Tab 切换
els.modalTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.modalTabs.forEach((t) => t.classList.toggle("active", t === tab));
    const paneId = "tab-" + tab.dataset.tab;
    document.querySelectorAll(".modal-body .tab-pane").forEach((p) => {
      p.classList.toggle("hidden", p.id !== paneId);
    });
  });
});

/* ---------- 标题栏 ---------- */
const tbLeft = $("tb-left");
tbLeft.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if (e.target.closest(".tb-btn")) return;
  try {
    win && win.startDragging();
  } catch (err) {
    toast("拖拽失败：" + String(err), true);
  }
});
els.btnMin.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try { win && win.minimize(); } catch (err) { toast("最小化失败：" + String(err), true); }
});
els.btnClose.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try { win && win.hide(); } catch (err) { toast("关闭失败：" + String(err), true); }
});

/* ---------- 协议类型 ---------- */
const PROTO_INFO = {
  HTTP: ["http", "将写入 HTTP_PROXY 与 HTTPS_PROXY"],
  HTTPS: ["http", "目标走加密通道，同 HTTP_PROXY"],
  SOCKS4: ["socks4", "将写入 ALL_PROXY"],
  SOCKS4a: ["socks4a", "将写入 ALL_PROXY"],
  SOCKS5: ["socks5", "将写入 ALL_PROXY"],
  SOCKS5h: ["socks5h", "将写入 ALL_PROXY（远程 DNS，防泄漏）"],
};

// 协议与分段按钮映射（非三段类型回退到相近段）
const SEG_FALLBACK = { HTTPS: "HTTP", SOCKS4: "SOCKS5", SOCKS4a: "SOCKS5" };

function selectedProto() {
  const seg = els.protoSeg.querySelector(".seg.active");
  return seg ? seg.dataset.type : "HTTP";
}

els.protoSeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg");
  if (!btn) return;
  els.protoSeg.querySelectorAll(".seg").forEach((s) => s.classList.toggle("active", s === btn));
  updatePreview();
});

function renderProtoHint() {
  const t = selectedProto();
  els.protoHint.textContent = PROTO_INFO[t] ? PROTO_INFO[t][1] : "";
}

function setProto(type) {
  const target = SEG_FALLBACK[type] || type;
  let matched = false;
  els.protoSeg.querySelectorAll(".seg").forEach((s) => {
    const on = s.dataset.type === target;
    s.classList.toggle("active", on);
    if (on) matched = true;
  });
  if (!matched) els.protoSeg.querySelector(".seg").classList.add("active");
  renderProtoHint();
}

/* ---------- 数据收集 ---------- */
function collectSettings() {
  return {
    proxy_type: selectedProto(),
    host: els.host.value.trim(),
    port: parseInt(els.port.value, 10) || 7890,
    username: els.username.value.trim(),
    password: els.password.value.trim(),
    no_proxy: els.noProxy.value.trim(),
    advanced: {
      http_proxy: els.advHttp.value.trim(),
      https_proxy: els.advHttps.value.trim(),
      all_proxy: els.advAll.value.trim(),
      no_proxy: els.advNoProxy.value.trim(),
    },
    use_advanced: els.useAdvanced.checked,
    autostart: els.autostart.checked,
    theme: localStorage.getItem("pe-theme") || "system",
    font: els.fontSelect.value,
    font_size: parseInt(els.fontSize.value, 10) || 0,
  };
}

function fillForm(s) {
  if (!s) return;
  els.host.value = s.host || "";
  els.port.value = s.port || 7890;
  els.username.value = s.username || "";
  els.password.value = s.password || "";
  els.noProxy.value = s.no_proxy || "localhost,127.0.0.1,::1";
  els.useAdvanced.checked = !!s.use_advanced;
  const a = s.advanced || {};
  els.advHttp.value = a.http_proxy || "";
  els.advHttps.value = a.https_proxy || "";
  els.advAll.value = a.all_proxy || "";
  els.advNoProxy.value = a.no_proxy || "";
  els.autostart.checked = !!s.autostart;
  setProto(s.proxy_type || "HTTP");
  // 外观
  if (s.font && els.fontSelect.value !== s.font) els.fontSelect.value = s.font;
  if (s.font_size > 0) els.fontSize.value = s.font_size;
}

/* ---------- 变量预告 ---------- */
function updatePreview() {
  if (els.useAdvanced.checked) {
    const adv = collectSettings().advanced;
    els.protoHint.textContent = "高级模式已启用，将按下方变量写入";
    const active = [adv.http_proxy, adv.https_proxy, adv.all_proxy, adv.no_proxy]
      .some((v) => v.trim());
    if (!active) els.protoHint.textContent = "高级模式已启用（未填变量，将以表单为准）";
    return;
  }
  renderProtoHint();
}

/* ---------- 状态渲染 ---------- */
function renderState(env) {
  // 强制状态条纵向布局（inline 优先，不受样式表/缓存影响）
  const strip = els.stateStrip;
  strip.style.display = "flex";
  strip.style.flexDirection = "column";
  strip.style.gap = "5px";
  strip.style.alignItems = "stretch";

  const items = [
    ["HTTP_PROXY", env.http_proxy],
    ["HTTPS_PROXY", env.https_proxy],
    ["ALL_PROXY", env.all_proxy],
    ["NO_PROXY", env.no_proxy],
  ];
  const setCount = items.filter(([, v]) => !!v).length;
  els.stateStrip.innerHTML = setCount
    ? items
        .map(([name, val]) =>
          `<div class="ss-item"><span class="ss-dot ${val ? "set" : "unset"}"></span>` +
          `<span class="ss-name">${name}</span>` +
          (val
            ? `<span class="ss-val" title="${escapeHtml(val)}">${escapeHtml(val.length > 42 ? val.slice(0, 42) + "…" : val)}</span>`
            : `<span class="ss-val ss-empty">未设置</span>`)
        ).join("")
    : '<div class="ss-noenv">当前未设置任何代理环境变量</div>';

  els.badge.textContent = env.active ? "已启用" : "未启用";
  els.badge.className = "badge " + (env.active ? "on" : "off");
  els.master.classList.toggle("off", !env.active);
  els.masterText.textContent = env.active ? "停用代理" : "启用代理";
  // 图标表示动作：启用态 = 勾，停用态 = ×
  const path = els.master.querySelector(".master-icon svg path");
  if (path) {
    path.setAttribute(
      "d",
      env.active
        ? "M6.5 6.5l11 11M17.5 6.5l-11 11" // ×
        : "M5 12.5l4.5 4.5L19 7.5" // 勾
    );
  }
}

/* ---------- 核心操作 ---------- */
async function refresh() {
  try {
    state = await invoke("get_state");
    fillForm(state.settings);
    renderState(state.env);
    updatePreview();
    applyFont();
  } catch (e) {
    toast("读取状态失败：" + e, true);
  }
}

async function doClear() {
  try {
    const r = await invoke("clear_proxy");
    state = r;
    renderState(r.env);
    toast("已清除所有代理环境变量");
  } catch (e) {
    toast(String(e), true);
  }
}

async function doTest() {
  els.testResult.classList.add("hidden");
  els.testBtn.textContent = "测试中…";
  try {
    const r = await invoke("test_proxy", { settings: collectSettings() });
    els.testResult.classList.remove("hidden");
    if (r.ok) {
      els.testResult.className = "test-result ok";
      els.testResult.textContent = `连接成功 · 延迟 ${r.latency_ms} ms`;
    } else {
      els.testResult.className = "test-result fail";
      els.testResult.textContent = `连接失败：${r.error || "未知错误"}`;
    }
  } catch (e) {
    els.testResult.className = "test-result fail";
    els.testResult.textContent = "测试出错：" + e;
    els.testResult.classList.remove("hidden");
  } finally {
    els.testBtn.textContent = "测试连通性";
  }
}

/* ---------- 事件绑定 ---------- */
els.master.addEventListener("pointerdown", async (e) => {
  e.preventDefault();
  const isActive = !!(state && state.env.active);
  if (isActive) {
    try {
      const r = await invoke("clear_proxy");
      state = r; // 同步内部状态，确保图标/文案/颜色立即刷新
      renderState(r.env);
      toast("已停用代理，环境变量已清除");
    } catch (err) {
      toast(String(err), true);
    }
    return;
  }
  const host = els.host.value.trim();
  if (!host && !els.useAdvanced.checked) {
    toast("请先填写代理地址（如 127.0.0.1）", true);
    els.host.focus();
    return;
  }
  try {
    const r = await invoke("apply_proxy", { settings: collectSettings() });
    state = r;
    renderState(r.env);
    toast("代理已启用，新终端立即生效");
  } catch (err) {
    toast(String(err), true);
  }
});

els.clearBtn.addEventListener("pointerdown", async (e) => {
  e.preventDefault();
  if (state && !state.env.active) {
    toast("当前未启用代理，无需清除");
    return;
  }
  await doClear();
});

els.testBtn.addEventListener("click", doTest);
els.host.addEventListener("input", updatePreview);
els.port.addEventListener("input", updatePreview);
els.useAdvanced.addEventListener("change", updatePreview);

els.advToggle.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  els.advBody.classList.toggle("hidden");
  els.advChevron.classList.toggle("open");
  els.advToggle.setAttribute("aria-expanded", !els.advBody.classList.contains("hidden"));
});

els.autostart.addEventListener("change", async () => {
  try {
    const ok = await invoke("set_autostart", { enabled: els.autostart.checked });
    els.autostart.checked = ok;
    toast(ok ? "已加入开机自启" : "已关闭开机自启");
  } catch (e) {
    els.autostart.checked = !els.autostart.checked;
    toast("设置开机自启失败：" + e, true);
  }
});

/* 托盘动作回推 */
listen("proxyenv://env-changed", () => refresh());
listen("proxyenv://tray-error", (e) => toast(String(e.payload), true));
listen("proxyenv://tray-test-result", (e) => {
  const r = e.payload;
  els.testResult.classList.remove("hidden");
  if (r.ok) {
    els.testResult.className = "test-result ok";
    els.testResult.textContent = `托盘测试 · 连接成功，延迟 ${r.latency_ms} ms`;
  } else {
    els.testResult.className = "test-result fail";
    els.testResult.textContent = `托盘测试失败：${r.error || "未知错误"}`;
  }
});

/* ---------- 启动 ---------- */
applyTheme();
refresh();
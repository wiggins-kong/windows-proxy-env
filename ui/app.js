/* ProxyEnv 前端逻辑 · HTTP(S) / SOCKS 双通道 */
const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;
const { listen } = window.__TAURI__.event;

/* 错误面罩：任何 JS 错误都显示到状态徽标，便于快速定位 */
window.addEventListener("error", (e) => {
  const badge = document.getElementById("statusBadge");
  if (badge) badge.textContent = "JS错误:" + String(e.message || e).slice(0, 24);
});
window.addEventListener("unhandledrejection", (e) => {
  const badge = document.getElementById("statusBadge");
  if (badge) badge.textContent = "JS异常:" + String(e.reason || "").slice(0, 24);
});

let win = null;
try {
  win = getCurrentWindow();
} catch (e) {
  const badge = document.getElementById("statusBadge");
  if (badge) badge.textContent = "API失败:" + String(e).slice(0, 24);
}

const $ = (id) => document.getElementById(id);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const root = document.documentElement;
const mediaDark = window.matchMedia("(prefers-color-scheme: dark)");

const DEFAULT_NO_PROXY = "localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16";
const DEFAULT_FONT_SIZE = 14;

const elements = {
  // 标题栏
  dragRegion: $("dragRegion"),
  btnMin: $("btnMin"),
  btnClose: $("btnClose"),
  // 设置
  settingsButton: $("settingsButton"),
  settingsModal: $("settingsModal"),
  settingsClose: $("settingsClose"),
  autostartToggle: $("autostartToggle"),
  autostartLabel: $("autostartLabel"),
  silentStartupRow: $("silentStartupRow"),
  silentStartupToggle: $("silentStartupToggle"),
  silentStartupLabel: $("silentStartupLabel"),
  fontSize: $("fontSize"),
  sizeVal: $("sizeVal"),
  // 页面
  statusBadge: $("statusBadge"),
  dirtyBanner: $("dirtyBanner"),
  bannerApplyButton: $("bannerApplyButton"),
  httpChannel: $("httpChannel"),
  httpToggle: $("httpToggle"),
  httpSwitchLabel: $("httpSwitchLabel"),
  httpBody: $("httpBody"),
  httpHost: $("httpHost"),
  httpPort: $("httpPort"),
  httpUser: $("httpUser"),
  httpPassword: $("httpPassword"),
  httpHostError: $("httpHostError"),
  httpPortError: $("httpPortError"),
  httpAuthError: $("httpAuthError"),
  socksChannel: $("socksChannel"),
  socksToggle: $("socksToggle"),
  socksSwitchLabel: $("socksSwitchLabel"),
  socksBody: $("socksBody"),
  socksVariant: $("socksVariant"),
  socksHint: $("socksHint"),
  socksReuse: $("socksReuse"),
  socksReuseHint: $("socksReuseHint"),
  socksHost: $("socksHost"),
  socksPort: $("socksPort"),
  socksUser: $("socksUser"),
  socksPassword: $("socksPassword"),
  socksHostError: $("socksHostError"),
  socksPortError: $("socksPortError"),
  socksAuthError: $("socksAuthError"),
  noProxy: $("noProxy"),
  previewList: $("previewList"),
  previewSummaryText: $("previewSummaryText"),
  previewMode: $("previewMode"),
  advancedCard: $("advancedCard"),
  advancedToggle: $("advancedToggle"),
  advancedSwitchLabel: $("advancedSwitchLabel"),
  advHttp: $("advHttp"),
  advHttps: $("advHttps"),
  advAll: $("advAll"),
  advNoProxy: $("advNoProxy"),
  advHttpError: $("advHttpError"),
  advHttpsError: $("advHttpsError"),
  advAllError: $("advAllError"),
  actionSummary: $("actionSummary"),
  clearButton: $("clearButton"),
  testButton: $("testButton"),
  masterButton: $("masterButton"),
  testPanel: $("testPanel"),
  httpResult: $("httpResult"),
  socksResult: $("socksResult"),
  envList: $("envList"),
  toast: $("toast"),
};

const state = {
  httpEnabled: false,
  socksEnabled: false,
  socksScheme: "socks5h",
  socksReuseHttp: true,
  advancedEnabled: false,
  envActive: false,
  envVars: {},
  testing: false,
  busy: false,
  autostart: false,
  silentStartup: false,
  fontSize: 0,
};

const variableOrder = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"];
const variableMeta = {
  HTTP_PROXY: { tag: "优先", detail: "HTTP 请求" },
  HTTPS_PROXY: { tag: "优先", detail: "HTTPS 请求" },
  ALL_PROXY: { tag: "兜底", detail: "其他协议" },
  NO_PROXY: { tag: "豁免", detail: "不走代理" },
};

let toastTimer = 0;
let lastFocusedElement = null;

/* ---------- 基础工具 ---------- */
function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

function applyTheme() {
  root.dataset.theme = mediaDark.matches ? "dark" : "light";
}

/* ---------- 外观（字号；界面字体固定微软雅黑，由 CSS --font-ui 提供） ---------- */
function applyFontSize() {
  const size = state.fontSize > 0 ? state.fontSize : DEFAULT_FONT_SIZE;
  root.style.setProperty("--fs", size + "px");
  elements.fontSize.value = String(size);
  elements.sizeVal.textContent = size + " px";
  elements.fontSize.style.setProperty("--fill", ((size - 11) / (18 - 11)) * 100 + "%");
}

/* ---------- 设置弹窗 ---------- */
function renderSettings() {
  elements.silentStartupRow.hidden = !state.autostart;
  setSwitch(elements.autostartToggle, elements.autostartLabel, state.autostart);
  setSwitch(elements.silentStartupToggle, elements.silentStartupLabel, state.silentStartup);
}

function openSettings() {
  lastFocusedElement = document.activeElement;
  renderSettings();
  elements.settingsModal.hidden = false;
  elements.settingsClose.focus();
}

function closeSettings() {
  elements.settingsModal.hidden = true;
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function trapModalFocus(event) {
  if (event.key !== "Tab" || elements.settingsModal.hidden) return;
  const focusable = qsa(
    "#settingsModal button, #settingsModal input, #settingsModal select, #settingsModal [tabindex]:not([tabindex='-1'])"
  ).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ---------- 单选组（SOCKS5 / SOCKS5h） ---------- */
function syncRadioGroup(container, dataKey, selectedValue) {
  qsa(`[data-${dataKey}]`, container).forEach((button) => {
    const selected = button.dataset[dataKey] === selectedValue;
    button.setAttribute("aria-checked", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}

function handleRadioGroupKeydown(event, container, dataKey) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const buttons = qsa(`[data-${dataKey}]`, container);
  const currentIndex = buttons.indexOf(event.target.closest(`[data-${dataKey}]`));
  if (currentIndex < 0) return;
  const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
  event.preventDefault();
  buttons[nextIndex].focus();
  buttons[nextIndex].click();
}

/* ---------- 代理 URL 构建（与 Rust proxy_rules 对齐） ---------- */
function encodeUserInfo(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => {
    return "%" + character.charCodeAt(0).toString(16).toUpperCase();
  });
}

function buildProxyUrl({ scheme, host, port, username, password }) {
  let url = scheme + "://";
  if (username) {
    url += encodeUserInfo(username);
    if (password) {
      url += ":" + encodeUserInfo(password);
    }
    url += "@";
  }
  return url + String(host).trim() + ":" + String(port).trim();
}

function maskedProxyUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = parsed.username ? "user" : "";
      parsed.password = parsed.password ? "••••••" : "";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/:\/\/([^:@/]+):([^@/]+)@/, "://$1:••••••@");
  }
}

function isReusingHttp() {
  return state.socksEnabled && state.httpEnabled && state.socksReuseHttp;
}

function getAutoVars() {
  const vars = {};

  if (state.httpEnabled) {
    const value = buildProxyUrl({
      scheme: "http",
      host: elements.httpHost.value,
      port: elements.httpPort.value,
      username: elements.httpUser.value.trim(),
      password: elements.httpPassword.value,
    });
    vars.HTTP_PROXY = value;
    vars.HTTPS_PROXY = value;
  }

  if (state.socksEnabled) {
    const reuse = isReusingHttp();
    vars.ALL_PROXY = buildProxyUrl({
      scheme: state.socksScheme,
      host: reuse ? elements.httpHost.value : elements.socksHost.value,
      port: reuse ? elements.httpPort.value : elements.socksPort.value,
      username: reuse ? elements.httpUser.value.trim() : elements.socksUser.value.trim(),
      password: reuse ? elements.httpPassword.value : elements.socksPassword.value,
    });
  }

  if ((state.httpEnabled || state.socksEnabled) && elements.noProxy.value.trim()) {
    vars.NO_PROXY = elements.noProxy.value.trim();
  }

  return vars;
}

function getAdvancedVars() {
  const vars = {};
  const values = {
    HTTP_PROXY: elements.advHttp.value.trim(),
    HTTPS_PROXY: elements.advHttps.value.trim(),
    ALL_PROXY: elements.advAll.value.trim(),
    NO_PROXY: elements.advNoProxy.value.trim(),
  };
  variableOrder.forEach((name) => {
    if (values[name]) vars[name] = values[name];
  });
  return vars;
}

function getPreviewVars() {
  return state.advancedEnabled ? getAdvancedVars() : getAutoVars();
}

function varsEqual(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] || "") !== (right[key] || "")) return false;
  }
  return true;
}

/* ---------- 渲染 ---------- */
function renderPreview() {
  const vars = getPreviewVars();
  elements.previewList.replaceChildren();

  const activeNames = variableOrder.filter((name) => vars[name]);
  elements.previewMode.textContent = state.advancedEnabled ? "高级覆盖" : "普通模式";

  if (!activeNames.length) {
    const empty = document.createElement("div");
    empty.className = "empty-vars";
    empty.textContent = state.advancedEnabled
      ? "高级模式已开启，但四个变量均为空。"
      : "开启 HTTP(S) 或 SOCKS 后，这里会生成实际写入值。";
    elements.previewList.appendChild(empty);
    elements.previewSummaryText.textContent = state.advancedEnabled
      ? "高级模式未生成变量"
      : "尚未启用任何通道";
    return;
  }

  activeNames.forEach((name) => {
    const row = document.createElement("div");
    row.className = "preview-row";

    const nameWrap = document.createElement("div");
    nameWrap.className = "preview-name";
    const nameText = document.createElement("span");
    nameText.textContent = name;
    nameWrap.appendChild(nameText);

    const meta = variableMeta[name];
    if (meta) {
      const tag = document.createElement("span");
      tag.className = "preview-tag";
      tag.textContent = meta.tag;
      nameWrap.appendChild(tag);
    }

    const value = document.createElement("div");
    value.className = "preview-value";
    value.title = vars[name];
    value.textContent = name === "NO_PROXY" ? vars[name] : maskedProxyUrl(vars[name]);

    row.append(nameWrap, value);
    elements.previewList.appendChild(row);
  });

  const channelCount = [state.httpEnabled, state.socksEnabled].filter(Boolean).length;
  if (state.advancedEnabled) {
    elements.previewSummaryText.textContent = `将由 ${activeNames.length} 个手动变量覆盖普通配置`;
  } else {
    elements.previewSummaryText.textContent =
      channelCount === 2
        ? "HTTP(S) 与 SOCKS 将同时写入，按变量优先级生效"
        : `已启用 ${channelCount} 个通道，将写入 ${activeNames.length} 个变量`;
  }
}

function renderEnvironment() {
  elements.envList.replaceChildren();
  const vars = state.envActive ? state.envVars : {};

  variableOrder.forEach((name) => {
    const row = document.createElement("div");
    row.className = "env-row" + (vars[name] ? " set" : "");

    const dot = document.createElement("span");
    dot.className = "env-dot";

    const nameElement = document.createElement("span");
    nameElement.className = "env-name";
    nameElement.textContent = name;

    const value = document.createElement("span");
    value.className = "env-value" + (vars[name] ? "" : " unset");
    value.textContent = vars[name] ? maskedProxyUrl(vars[name]) : "未设置";
    value.title = vars[name] || "未设置";

    row.append(dot, nameElement, value);
    elements.envList.appendChild(row);
  });
}

function setSwitch(button, label, checked) {
  button.setAttribute("aria-checked", String(checked));
  label.textContent = checked ? "已启用" : "未启用";
}

function setFieldDisabled(input, disabled) {
  input.disabled = disabled;
}

function setResultRow(row, stateName, detail) {
  row.classList.remove("ok", "fail", "running");
  row.classList.add(stateName);
  const detailElement = row.querySelector(".result-detail");
  const stateElement = row.querySelector(".result-state");
  if (stateName === "ok") {
    detailElement.textContent = detail;
    stateElement.textContent = "成功";
  } else if (stateName === "fail") {
    detailElement.textContent = detail;
    stateElement.textContent = "失败";
  } else if (stateName === "running") {
    detailElement.textContent = detail;
    stateElement.textContent = "测试中";
  } else {
    detailElement.textContent = detail || "等待测试";
    stateElement.textContent = "未启用";
  }
}

function channelAvailability(channel) {
  if (state.advancedEnabled) {
    return channel === "socks"
      ? Boolean(elements.advAll.value.trim())
      : Boolean(elements.advHttp.value.trim() || elements.advHttps.value.trim());
  }
  return channel === "socks" ? state.socksEnabled : state.httpEnabled;
}

function renderTestAvailability() {
  const httpAvailable = channelAvailability("http");
  const socksAvailable = channelAvailability("socks");

  if (!httpAvailable && !elements.testPanel.dataset.started) {
    setResultRow(elements.httpResult, "idle", "等待测试");
  }
  if (!socksAvailable && !elements.testPanel.dataset.started) {
    setResultRow(elements.socksResult, "idle", "等待测试");
  }

  elements.testButton.disabled = state.testing || (!httpAvailable && !socksAvailable);
}

function updateChannelVisibility() {
  setSwitch(elements.httpToggle, elements.httpSwitchLabel, state.httpEnabled);
  setSwitch(elements.socksToggle, elements.socksSwitchLabel, state.socksEnabled);
  setSwitch(elements.advancedToggle, elements.advancedSwitchLabel, state.advancedEnabled);

  elements.httpBody.hidden = !state.httpEnabled;
  elements.socksBody.hidden = !state.socksEnabled;

  elements.httpChannel.classList.toggle("enabled", state.httpEnabled);
  elements.socksChannel.classList.toggle("enabled", state.socksEnabled);
  elements.httpChannel.classList.toggle("overridden", state.advancedEnabled);
  elements.socksChannel.classList.toggle("overridden", state.advancedEnabled);

  const reuse = isReusingHttp();
  elements.socksReuse.disabled = !state.httpEnabled;
  elements.socksReuse.checked = state.httpEnabled && state.socksReuseHttp;
  elements.socksReuseHint.textContent = state.httpEnabled
    ? state.socksReuseHttp
      ? "沿用 HTTP(S) 的地址、端口和认证信息。"
      : "已关闭，使用下方独立的 SOCKS 地址。"
    : "HTTP(S) 未启用，SOCKS 将使用下方独立地址。";

  setFieldDisabled(elements.socksHost, reuse);
  setFieldDisabled(elements.socksPort, reuse);
  setFieldDisabled(elements.socksUser, reuse);
  setFieldDisabled(elements.socksPassword, reuse);

  elements.socksHint.textContent =
    state.socksScheme === "socks5"
      ? "SOCKS5：由本机解析域名，随后把目标 IP 交给代理。"
      : "SOCKS5h：由代理端解析域名，可减少本地 DNS 泄漏。";
  syncRadioGroup(elements.socksVariant, "scheme", state.socksScheme);

  [elements.advHttp, elements.advHttps, elements.advAll, elements.advNoProxy].forEach((input) => {
    input.disabled = !state.advancedEnabled;
  });
}

function previewCounts() {
  const vars = getPreviewVars();
  return {
    vars,
    count: Object.keys(vars).length,
    hasRoutes: Boolean(vars.HTTP_PROXY || vars.HTTPS_PROXY || vars.ALL_PROXY),
  };
}

function renderActions() {
  const { count, hasRoutes } = previewCounts();
  const dirty = state.envActive && !varsEqual(getPreviewVars(), state.envVars);
  const canApply = hasRoutes;

  elements.statusBadge.classList.toggle("active", state.envActive && !dirty);
  elements.statusBadge.classList.toggle("dirty", dirty);
  elements.statusBadge.textContent = dirty ? "有未应用更改" : state.envActive ? "已启用" : "未启用";

  elements.dirtyBanner.hidden = !dirty;

  if (state.envActive) {
    elements.masterButton.disabled = false;
    elements.masterButton.querySelector(".button-label").textContent = "停用代理";
    elements.actionSummary.textContent = "代理已写入当前用户环境变量；编辑后需应用更改。";
  } else {
    elements.masterButton.disabled = !canApply;
    elements.masterButton.querySelector(".button-label").textContent = "应用并启用";
    elements.actionSummary.textContent = canApply
      ? `当前配置将写入 ${count} 个环境变量。`
      : "开启至少一个通道后即可写入当前用户环境变量。";
  }

  elements.clearButton.disabled = !state.envActive && count === 0;
}

function render() {
  updateChannelVisibility();
  renderPreview();
  renderEnvironment();
  renderActions();
  renderTestAvailability();
}

/* ---------- 校验 ---------- */
function clearValidation(input, errorElement) {
  input.removeAttribute("aria-invalid");
  if (errorElement) errorElement.textContent = "";
}

function setValidation(input, errorElement, message) {
  input.setAttribute("aria-invalid", "true");
  if (errorElement) errorElement.textContent = message;
}

function validateHost(input, errorElement) {
  if (!input.disabled && !input.value.trim()) {
    setValidation(input, errorElement, "请填写服务器地址，例如 127.0.0.1。");
    return false;
  }
  clearValidation(input, errorElement);
  return true;
}

function validatePort(input, errorElement) {
  if (input.disabled) {
    clearValidation(input, errorElement);
    return true;
  }
  const port = Number(input.value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    setValidation(input, errorElement, "端口必须是 1 到 65535 之间的整数。");
    return false;
  }
  clearValidation(input, errorElement);
  return true;
}

function validateAuthPair(userInput, passwordInput, errorElement) {
  const hasUser = Boolean(userInput.value.trim());
  const hasPassword = Boolean(passwordInput.value);
  const active = !userInput.disabled && !passwordInput.disabled;
  if (active && hasUser !== hasPassword) {
    setValidation(hasUser ? passwordInput : userInput, errorElement, "用户名和密码需要同时填写。");
    return false;
  }
  clearValidation(userInput, errorElement);
  clearValidation(passwordInput, errorElement);
  return true;
}

function validateUrl(input, errorElement) {
  const value = input.value.trim();
  if (!input.disabled && value && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    setValidation(input, errorElement, "请输入完整 URL，例如 http://127.0.0.1:7890。");
    return false;
  }
  clearValidation(input, errorElement);
  return true;
}

function validateVisibleFields() {
  const checks = [];

  if (state.advancedEnabled) {
    checks.push(validateUrl(elements.advHttp, elements.advHttpError));
    checks.push(validateUrl(elements.advHttps, elements.advHttpsError));
    checks.push(validateUrl(elements.advAll, elements.advAllError));
    const firstInvalid = [elements.advHttp, elements.advHttps, elements.advAll].find(
      (input) => input.getAttribute("aria-invalid") === "true"
    );
    if (firstInvalid) firstInvalid.focus();
    return checks.every(Boolean);
  }

  if (state.httpEnabled) {
    checks.push(validateHost(elements.httpHost, elements.httpHostError));
    checks.push(validatePort(elements.httpPort, elements.httpPortError));
    checks.push(validateAuthPair(elements.httpUser, elements.httpPassword, elements.httpAuthError));
  }

  if (state.socksEnabled && !isReusingHttp()) {
    checks.push(validateHost(elements.socksHost, elements.socksHostError));
    checks.push(validatePort(elements.socksPort, elements.socksPortError));
    checks.push(validateAuthPair(elements.socksUser, elements.socksPassword, elements.socksAuthError));
  } else {
    clearValidation(elements.socksHost, elements.socksHostError);
    clearValidation(elements.socksPort, elements.socksPortError);
    clearValidation(elements.socksUser, elements.socksAuthError);
    clearValidation(elements.socksPassword, elements.socksAuthError);
  }

  const firstInvalid = [
    elements.httpHost,
    elements.httpPort,
    elements.httpUser,
    elements.httpPassword,
    elements.socksHost,
    elements.socksPort,
    elements.socksUser,
    elements.socksPassword,
  ].find((input) => input.getAttribute("aria-invalid") === "true" && !input.disabled);

  if (firstInvalid) firstInvalid.focus();
  return checks.every(Boolean);
}

/* ---------- 后端设置对象 ---------- */
function collectSettings() {
  return {
    http: {
      enabled: state.httpEnabled,
      host: elements.httpHost.value.trim(),
      port: Number(elements.httpPort.value) || 7890,
      username: elements.httpUser.value.trim(),
      password: elements.httpPassword.value,
    },
    socks: {
      enabled: state.socksEnabled,
      host: elements.socksHost.value.trim(),
      port: Number(elements.socksPort.value) || 7891,
      username: elements.socksUser.value.trim(),
      password: elements.socksPassword.value,
    },
    socks_scheme: state.socksScheme,
    socks_reuse_http: state.socksReuseHttp,
    no_proxy: elements.noProxy.value.trim(),
    advanced: {
      http_proxy: elements.advHttp.value.trim(),
      https_proxy: elements.advHttps.value.trim(),
      all_proxy: elements.advAll.value.trim(),
      no_proxy: elements.advNoProxy.value.trim(),
    },
    use_advanced: state.advancedEnabled,
    autostart: state.autostart,
    silent_startup: state.silentStartup,
    theme: "system",
    font_size: state.fontSize,
  };
}

function setEnvVars(env) {
  const vars = {};
  [
    ["HTTP_PROXY", "http_proxy"],
    ["HTTPS_PROXY", "https_proxy"],
    ["ALL_PROXY", "all_proxy"],
    ["NO_PROXY", "no_proxy"],
  ].forEach(([name, key]) => {
    if (env && env[key]) vars[name] = env[key];
  });
  state.envVars = vars;
  state.envActive = Boolean(env && env.active);
}

function applySnapshot(snapshot) {
  const s = snapshot.settings || {};
  const http = s.http || {};
  const socks = s.socks || {};
  const advanced = s.advanced || {};

  elements.httpHost.value = http.host || "";
  elements.httpPort.value = http.port || 7890;
  elements.httpUser.value = http.username || "";
  elements.httpPassword.value = http.password || "";
  elements.socksHost.value = socks.host || "";
  elements.socksPort.value = socks.port || 7891;
  elements.socksUser.value = socks.username || "";
  elements.socksPassword.value = socks.password || "";
  elements.noProxy.value = s.no_proxy || DEFAULT_NO_PROXY;
  elements.advHttp.value = advanced.http_proxy || "";
  elements.advHttps.value = advanced.https_proxy || "";
  elements.advAll.value = advanced.all_proxy || "";
  elements.advNoProxy.value = advanced.no_proxy || "";

  state.httpEnabled = Boolean(http.enabled);
  state.socksEnabled = Boolean(socks.enabled);
  state.socksScheme = s.socks_scheme === "socks5" ? "socks5" : "socks5h";
  state.socksReuseHttp = s.socks_reuse_http !== false;
  state.advancedEnabled = Boolean(s.use_advanced);
  state.autostart = Boolean(s.autostart);
  state.silentStartup = Boolean(s.silent_startup);
  state.fontSize = s.font_size || 0;

  setEnvVars(snapshot.env);
  applyFontSize();
  renderSettings();
  render();
}

async function refresh() {
  try {
    applySnapshot(await invoke("get_state"));
  } catch (e) {
    showToast("读取状态失败：" + e, true);
  }
}

/* ---------- 核心操作 ---------- */
async function applyConfiguration() {
  if (state.busy) return;
  if (!validateVisibleFields()) {
    showToast("请修正标红的配置项后再应用。", true);
    return;
  }
  const vars = getPreviewVars();
  if (!vars.HTTP_PROXY && !vars.HTTPS_PROXY && !vars.ALL_PROXY) {
    // 两个通道都关掉就是"停用"意图：清变量并把 enabled=false 写回配置，而不是报错。
    // （主按钮"停用代理"走 clear_proxy，只清变量、保留配置，方便一键重开。）
    if (state.envActive) {
      state.busy = true;
      try {
        applySnapshot(await invoke("disable_proxy"));
        resetTestResults();
        showToast("已停用代理，环境变量已清除。");
      } catch (e) {
        showToast(String(e), true);
      } finally {
        state.busy = false;
      }
      return;
    }
    showToast("当前没有启用的通道，无需应用。");
    return;
  }
  state.busy = true;
  try {
    applySnapshot(await invoke("apply_proxy", { settings: collectSettings() }));
    showToast("配置已应用。新打开的程序和终端会读取这些变量。");
  } catch (e) {
    showToast(String(e), true);
  } finally {
    state.busy = false;
  }
}

async function clearConfiguration(showMessage = true) {
  if (state.busy) return;
  state.busy = true;
  try {
    applySnapshot(await invoke("clear_proxy"));
    resetTestResults();
    if (showMessage) showToast("代理环境变量已清除。");
  } catch (e) {
    showToast(String(e), true);
  } finally {
    state.busy = false;
  }
}

/* ---------- 连通性测试 ---------- */
async function runChannelTest(channel) {
  const row = channel === "http" ? elements.httpResult : elements.socksResult;
  setResultRow(row, "running", "正在建立连接并读取响应…");
  try {
    const r = await invoke("test_channel", { settings: collectSettings(), channel });
    if (r.ok) {
      setResultRow(row, "ok", `代理握手成功，往返延迟 ${r.latency_ms} ms。`);
      return true;
    }
    setResultRow(row, "fail", `无法通过该通道连接：${r.error || "未知错误"}`);
    return false;
  } catch (e) {
    setResultRow(row, "fail", "测试出错：" + String(e));
    return false;
  }
}

async function testChannels() {
  if (!validateVisibleFields()) {
    showToast("请先修正配置项，再执行连通性测试。", true);
    return;
  }

  const httpAvailable = channelAvailability("http");
  const socksAvailable = channelAvailability("socks");
  if (!httpAvailable && !socksAvailable) {
    showToast("当前没有可测试的通道。", true);
    return;
  }

  state.testing = true;
  elements.testPanel.hidden = false;
  elements.testPanel.dataset.started = "true";
  elements.testButton.classList.add("is-loading");
  elements.testButton.querySelector(".button-label").textContent = "测试中";
  elements.testButton.disabled = true;

  const tasks = [];
  if (httpAvailable) {
    tasks.push(runChannelTest("http"));
  } else {
    setResultRow(elements.httpResult, "idle", "当前未启用 HTTP(S) 通道。");
  }
  if (socksAvailable) {
    tasks.push(runChannelTest("socks"));
  } else {
    setResultRow(elements.socksResult, "idle", "当前未启用 SOCKS 通道。");
  }

  const results = await Promise.all(tasks);

  state.testing = false;
  elements.testButton.classList.remove("is-loading");
  elements.testButton.querySelector(".button-label").textContent = "测试通道";
  renderTestAvailability();

  const successCount = results.filter(Boolean).length;
  showToast(
    successCount === results.length
      ? `测试完成，${successCount} 个通道连接成功。`
      : "测试完成，存在连接失败的通道。",
    successCount !== results.length
  );
}

function resetTestResults() {
  elements.testPanel.hidden = true;
  elements.testPanel.dataset.started = "";
  setResultRow(elements.httpResult, "idle", "等待测试");
  setResultRow(elements.socksResult, "idle", "等待测试");
  renderTestAvailability();
}

function resetTestResultsUnlessRunning() {
  if (!state.testing && elements.testPanel.dataset.started) {
    resetTestResults();
  }
}

/* ---------- 高级模式 ---------- */
function ensureAdvancedSeed() {
  const hasAnyAdvancedValue = [
    elements.advHttp,
    elements.advHttps,
    elements.advAll,
    elements.advNoProxy,
  ].some((input) => input.value.trim());
  if (hasAnyAdvancedValue) return;
  const vars = getAutoVars();
  elements.advHttp.value = vars.HTTP_PROXY || "";
  elements.advHttps.value = vars.HTTPS_PROXY || "";
  elements.advAll.value = vars.ALL_PROXY || "";
  elements.advNoProxy.value = vars.NO_PROXY || "";
}

/* ---------- 事件 ---------- */
function attachValidationEvents() {
  [
    [elements.httpHost, () => validateHost(elements.httpHost, elements.httpHostError)],
    [elements.httpPort, () => validatePort(elements.httpPort, elements.httpPortError)],
    [
      elements.httpUser,
      () => validateAuthPair(elements.httpUser, elements.httpPassword, elements.httpAuthError),
    ],
    [
      elements.httpPassword,
      () => validateAuthPair(elements.httpUser, elements.httpPassword, elements.httpAuthError),
    ],
    [elements.socksHost, () => validateHost(elements.socksHost, elements.socksHostError)],
    [elements.socksPort, () => validatePort(elements.socksPort, elements.socksPortError)],
    [
      elements.socksUser,
      () => validateAuthPair(elements.socksUser, elements.socksPassword, elements.socksAuthError),
    ],
    [
      elements.socksPassword,
      () => validateAuthPair(elements.socksUser, elements.socksPassword, elements.socksAuthError),
    ],
    [elements.advHttp, () => validateUrl(elements.advHttp, elements.advHttpError)],
    [elements.advHttps, () => validateUrl(elements.advHttps, elements.advHttpsError)],
    [elements.advAll, () => validateUrl(elements.advAll, elements.advAllError)],
  ].forEach(([input, handler]) => input.addEventListener("blur", handler));

  [
    elements.httpHost,
    elements.httpPort,
    elements.httpUser,
    elements.httpPassword,
    elements.socksHost,
    elements.socksPort,
    elements.socksUser,
    elements.socksPassword,
    elements.advHttp,
    elements.advHttps,
    elements.advAll,
  ].forEach((input) => {
    input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
  });
}

function attachFormEvents() {
  [
    elements.httpHost,
    elements.httpPort,
    elements.httpUser,
    elements.httpPassword,
    elements.socksHost,
    elements.socksPort,
    elements.socksUser,
    elements.socksPassword,
    elements.noProxy,
    elements.advHttp,
    elements.advHttps,
    elements.advAll,
    elements.advNoProxy,
  ].forEach((input) => {
    input.addEventListener("input", () => {
      resetTestResultsUnlessRunning();
      render();
    });
  });
}

elements.settingsButton.addEventListener("click", openSettings);
elements.settingsClose.addEventListener("click", closeSettings);
elements.settingsModal.addEventListener("click", (event) => {
  if (event.target === elements.settingsModal) closeSettings();
});

elements.autostartToggle.addEventListener("click", async () => {
  const next = !state.autostart;
  try {
    const ok = await invoke("set_autostart", { enabled: next });
    state.autostart = ok;
    if (!ok) state.silentStartup = false;
    showToast(ok ? "已加入开机自启" : "已关闭开机自启");
  } catch (e) {
    showToast("设置开机自启失败：" + e, true);
  }
  renderSettings();
});

elements.silentStartupToggle.addEventListener("click", async () => {
  const next = !state.silentStartup;
  setSwitch(elements.silentStartupToggle, elements.silentStartupLabel, next);
  try {
    state.silentStartup = await invoke("set_silent_startup", { enabled: next });
    showToast(state.silentStartup ? "已开启静默启动" : "已关闭静默启动");
  } catch (e) {
    showToast("设置静默启动失败：" + e, true);
  }
  renderSettings();
});

elements.fontSize.addEventListener("input", () => {
  state.fontSize = Number(elements.fontSize.value) || DEFAULT_FONT_SIZE;
  applyFontSize();
});
elements.fontSize.addEventListener("change", async () => {
  try {
    await invoke("set_font", { font_size: state.fontSize });
  } catch (e) {
    showToast("保存字号失败：" + e, true);
  }
});

elements.socksVariant.addEventListener("keydown", (event) => {
  handleRadioGroupKeydown(event, elements.socksVariant, "scheme");
});

elements.httpToggle.addEventListener("click", () => {
  state.httpEnabled = !state.httpEnabled;
  if (!state.httpEnabled) {
    state.socksReuseHttp = false;
  } else if (state.socksEnabled) {
    state.socksReuseHttp = true;
  }
  resetTestResults();
  render();
});

elements.socksToggle.addEventListener("click", () => {
  state.socksEnabled = !state.socksEnabled;
  if (state.socksEnabled && state.httpEnabled) {
    state.socksReuseHttp = true;
  }
  if (!state.socksEnabled) {
    state.socksReuseHttp = state.httpEnabled;
  }
  resetTestResults();
  render();
});

elements.socksVariant.addEventListener("click", (event) => {
  const button = event.target.closest(".variant-button");
  if (!button) return;
  state.socksScheme = button.dataset.scheme;
  resetTestResults();
  render();
});

elements.socksReuse.addEventListener("change", () => {
  if (!elements.socksReuse.disabled) {
    state.socksReuseHttp = elements.socksReuse.checked;
  }
  resetTestResults();
  render();
});

elements.advancedToggle.addEventListener("click", () => {
  state.advancedEnabled = !state.advancedEnabled;
  if (state.advancedEnabled) ensureAdvancedSeed();
  resetTestResults();
  render();
});

qsa(".password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.passwordInput);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute(
      "aria-label",
      `${show ? "隐藏" : "显示"} ${button.dataset.passwordInput.includes("socks") ? "SOCKS" : "HTTP"} 密码`
    );
    const use = button.querySelector("use");
    use.setAttribute("href", show ? "#i-eye-off" : "#i-eye");
  });
});

elements.masterButton.addEventListener("click", () => {
  if (state.envActive) clearConfiguration();
  else applyConfiguration();
});

elements.bannerApplyButton.addEventListener("click", applyConfiguration);

elements.clearButton.addEventListener("click", () => {
  if (!state.envActive && !Object.keys(getPreviewVars()).length) {
    showToast("当前没有可清除的代理变量。");
    return;
  }
  clearConfiguration();
});

elements.testButton.addEventListener("click", testChannels);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.settingsModal.hidden) {
    closeSettings();
    return;
  }
  trapModalFocus(event);
});

mediaDark.addEventListener("change", applyTheme);

/* 标题栏拖拽与窗口按钮 */
elements.dragRegion.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest("button")) return;
  try {
    win && win.startDragging();
  } catch (err) {
    showToast("拖拽失败：" + String(err), true);
  }
});
elements.btnMin.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  try {
    win && win.minimize();
  } catch (err) {
    showToast("最小化失败：" + String(err), true);
  }
});
elements.btnClose.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  try {
    win && win.hide();
  } catch (err) {
    showToast("关闭失败：" + String(err), true);
  }
});

/* 托盘动作回推 */
listen("proxyenv://env-changed", () => refresh());
listen("proxyenv://tray-error", (e) => showToast(String(e.payload), true));
listen("proxyenv://tray-test-result", (e) => {
  const results = Array.isArray(e.payload) ? e.payload : [];
  if (!results.length) {
    showToast("托盘测试：当前没有可测试的通道", true);
    return;
  }
  elements.testPanel.hidden = false;
  elements.testPanel.dataset.started = "true";
  const seen = [];
  results.forEach((r) => {
    const row = r.channel === "socks" ? elements.socksResult : elements.httpResult;
    seen.push(r.channel);
    if (r.ok) setResultRow(row, "ok", `托盘测试 · 往返延迟 ${r.latency_ms} ms。`);
    else setResultRow(row, "fail", `托盘测试失败：${r.error || "未知错误"}`);
  });
  ["http", "socks"].forEach((channel) => {
    if (!seen.includes(channel)) {
      const row = channel === "socks" ? elements.socksResult : elements.httpResult;
      setResultRow(row, "idle", "本次托盘测试未包含该通道。");
    }
  });
  renderTestAvailability();
});

/* ---------- 启动 ---------- */
applyTheme();
attachValidationEvents();
attachFormEvents();
render();
refresh();

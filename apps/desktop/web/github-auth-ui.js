(() => {
  "use strict";

  const invokeNative = window.__TAURI__?.core?.invoke ?? null;
  const isDesktop = typeof invokeNative === "function";
  const content = document.querySelector("#content");
  const pageTitle = document.querySelector("#page-title");
  const modalRoot = document.querySelector("#modal-root");
  const toastRoot = document.querySelector("#toast-root");

  if (!content || !pageTitle || !modalRoot || !toastRoot) return;

  let status = null;
  let loading = false;
  let renderVersion = 0;

  const browserStatus = {
    state: "missing",
    identity: null,
    hasSecret: false,
    scopes: [],
    billingCapability: "unknown",
    billingDetail:
      "读取个人账单前需要为本软件独立授权",
    detail: "浏览器试用：没有独立 GitHub 授权",
    validatedAt: null,
    recovery: null,
    cleanupWarning: null,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastRoot.append(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  function markChanged() {
    renderVersion += 1;
    ensurePanel();
  }

  function ensurePanel() {

    let panel = content.querySelector("#github-authorization-panel");
    if (!panel) return;
    if (panel.dataset.renderVersion === String(renderVersion)) return;
    panel.dataset.renderVersion = String(renderVersion);
    panel.innerHTML = renderPanel();
  }

  function renderPanel() {
    const value = status;
    const readOnly = value?.state === "readOnlyRecovery";
    const canRefresh = Boolean(value?.hasSecret) && !readOnly;
    const canClear = Boolean(value?.hasSecret || value?.identity) && !readOnly;
    const identity = value?.identity;
    const scopes = value?.scopes ?? [];

    return `
      <div class="github-auth-header">
        <div>
          <p class="eyebrow">本软件独立授权</p>
          <h2>GitHub 个人账单授权</h2>
          <p>独立于客户端登录。令牌保存在系统凭据库，界面不回读。</p>
        </div>
        <div class="github-auth-actions">
          <button class="button ghost small" data-github-auth-action="refresh" ${loading || !canRefresh ? "disabled" : ""}>${loading ? "检查中…" : "重新核验"}</button>
          <button class="button primary small" data-github-auth-action="authorize" ${loading || readOnly ? "disabled" : ""}>${value?.hasSecret ? "更换授权" : "授权本软件"}</button>
          <button class="button danger small" data-github-auth-action="clear" ${loading || !canClear ? "disabled" : ""}>清除</button>
        </div>
      </div>
      ${value?.recovery ? renderRecovery(value.recovery) : ""}
      ${value?.cleanupWarning ? renderCleanupWarning(value.cleanupWarning) : ""}
      ${loading && !value ? '<div class="github-auth-loading">读取独立授权中…</div>' : ""}
      ${!loading && !value ? '<div class="github-auth-loading">尚未读取授权状态，请刷新。</div>' : ""}
      ${value ? `
        <div class="github-auth-grid">
          <article class="github-auth-identity">
            <div class="github-auth-card-heading">
              <span>已核验身份</span>
              <span class="github-auth-state ${stateClass(value.state)}">${escapeHtml(stateLabel(value.state))}</span>
            </div>
            <strong>${identity ? `${escapeHtml(identity.login)} · ${escapeHtml(identity.host)}` : "未授权"}</strong>
            <p>${escapeHtml(value.detail)}</p>
            <div class="github-auth-meta">
              <span>${identity?.userId != null ? `GitHub 用户 ID ${escapeHtml(identity.userId)}` : "用户 ID 不可用"}</span>
              <span>${value.validatedAt ? `核验时间 ${escapeHtml(formatDateTime(value.validatedAt))}` : "尚未核验"}</span>
            </div>
          </article>
          <article class="github-auth-billing">
            <div class="github-auth-card-heading">
              <span>个人账单访问能力</span>
              <span class="github-auth-state ${billingClass(value.billingCapability)}">${escapeHtml(billingLabel(value.billingCapability))}</span>
            </div>
            <strong>${billingTitle(value.billingCapability)}</strong>
            <p>${escapeHtml(value.billingDetail)}</p>
            <div class="github-auth-permission">高级请求账单需要精细权限令牌，用户权限为 <strong>Plan · read</strong> 。</div>
          </article>
        </div>
        <div class="github-auth-scopes">
          <div><strong>返回的 OAuth 权限</strong><span>精细权限令牌可能不返回权限列表，以账单接口核验结果为准。</span></div>
          <div class="github-auth-scope-list">${scopes.length ? scopes.slice(0, 12).map((scope) => `<span>${escapeHtml(scope)}</span>`).join("") : '<span class="muted-scope">未提供</span>'}</div>
        </div>
      ` : ""}
      <div class="github-auth-boundary">
        <strong>安全边界</strong>
        <span>不读取客户端凭据。更换授权失败时保留原有效授权。</span>
      </div>
    `;
  }

  function renderRecovery(reason) {
    return `<div class="github-auth-warning danger"><strong>只读恢复</strong><span>${escapeHtml(reason)}</span></div>`;
  }

  function renderCleanupWarning(reason) {
    return `<div class="github-auth-warning"><strong>凭据清理需要核对</strong><span>${escapeHtml(reason)}</span></div>`;
  }

  async function invoke(command, args = {}) {
    if (isDesktop) return invokeNative(command, args);
    await new Promise((resolve) => setTimeout(resolve, 140));
    switch (command) {
      case "get_github_authorization_status":
        return structuredClone(browserStatus);
      case "authorize_github": {
        const token = String(args.token ?? "");
        if (!token || token.trim() !== token || /[\r\n\0]/.test(token)) {
          throw new Error("令牌须为单行，且首尾没有空格");
        }
        Object.assign(browserStatus, {
          state: "verified",
          identity: {
            host: "github.com",
            login: "preview-user",
            userId: 1001,
            avatarUrl: null,
          },
          hasSecret: true,
          scopes: [],
          billingCapability: "available",
          billingDetail:
            "浏览器试用：仅模拟个人高级请求账单访问",
          detail:
            "浏览器试用：仅模拟独立授权，令牌未保存",
          validatedAt: new Date().toISOString(),
          recovery: null,
          cleanupWarning: null,
        });
        return structuredClone(browserStatus);
      }
      case "refresh_github_authorization":
        if (!browserStatus.hasSecret) return structuredClone(browserStatus);
        browserStatus.validatedAt = new Date().toISOString();
        return structuredClone(browserStatus);
      case "clear_github_authorization":
        Object.assign(browserStatus, {
          state: "missing",
          identity: null,
          hasSecret: false,
          scopes: [],
          billingCapability: "unknown",
          billingDetail:
            "读取个人账单前需要为本软件独立授权",
          detail: "浏览器试用：没有独立 GitHub 授权",
          validatedAt: null,
          recovery: null,
          cleanupWarning: null,
        });
        return structuredClone(browserStatus);
      default:
        throw new Error(`不支持的 GitHub 授权试用操作：${command}`);
    }
  }

  async function refreshStatus({ quiet = false } = {}) {
    if (loading) return;
    loading = true;
    markChanged();
    try {
      const value = await invoke("get_github_authorization_status");
      validateStatus(value);
      status = value;
      document.dispatchEvent(new Event("pilotweave:refresh-setup"));
      if (!quiet) showToast("GitHub 授权状态已刷新");
    } catch (error) {
      showToast(error?.message ?? String(error), "error");
    } finally {
      loading = false;
      markChanged();
    }
  }

  function validateStatus(value) {
    if (!value || typeof value.state !== "string") {
      throw new Error("GitHub 授权响应格式不受支持");
    }
    if (!Array.isArray(value.scopes)) value.scopes = [];
  }

  function openAuthorizeModal() {
    modalRoot.innerHTML = `
      <div class="modal-backdrop github-auth-modal-backdrop" role="presentation">
        <section class="modal github-auth-modal" role="dialog" aria-modal="true" aria-label="独立 GitHub 授权">
          <header class="modal-header">
            <div><p class="eyebrow">独立授权</p><h2>授权本软件</h2></div>
            <button class="icon-button" data-github-auth-close aria-label="关闭">×</button>
          </header>
          <div class="modal-body">
            <div class="github-auth-modal-copy">
              使用你自己的精细权限令牌，授予 <strong>Plan · read</strong> 用户权限。先核验身份，再检查个人账单访问；令牌不写入 JSON。
            </div>
            <form id="github-auth-form" class="form-grid">
              <div class="form-field full">
                <label for="github-auth-token">GitHub 精细权限令牌</label>
                <input id="github-auth-token" name="token" type="password" autocomplete="new-password" required maxlength="65536" placeholder="github_pat_…" />
                <small>更换失败不会覆盖原有效令牌。</small>
              </div>
            </form>
          </div>
          <footer class="modal-footer">
            <button class="button ghost" data-github-auth-close>取消</button>
            <button class="button primary" data-github-auth-submit>核验并保存</button>
          </footer>
        </section>
      </div>`;

    modalRoot
      .querySelectorAll("[data-github-auth-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
    modalRoot
      .querySelector(".github-auth-modal-backdrop")
      ?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) closeModal();
      });
    modalRoot
      .querySelector("[data-github-auth-submit]")
      ?.addEventListener("click", submitAuthorization);
    modalRoot.querySelector("#github-auth-token")?.focus();
  }

  async function submitAuthorization() {
    const form = modalRoot.querySelector("#github-auth-form");
    if (!form?.reportValidity()) return;
    const tokenInput = form.querySelector("#github-auth-token");
    const token = tokenInput.value;
    const submit = modalRoot.querySelector("[data-github-auth-submit]");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "核验中…";
    }
    try {
      const value = await invoke("authorize_github", { token });
      tokenInput.value = "";
      validateStatus(value);
      status = value;
      document.dispatchEvent(new Event("pilotweave:refresh-setup"));
      closeModal();
      showToast(
        value.state === "verified"
          ? "独立 GitHub 授权已保存"
          : value.detail,
        value.state === "verified" ? "success" : "error",
      );
      markChanged();
    } catch (error) {
      tokenInput.value = "";
      showToast(error?.message ?? String(error), "error");
      if (submit) {
        submit.disabled = false;
        submit.textContent = "核验并保存";
      }
    }
  }

  function openClearModal() {
    modalRoot.innerHTML = `
      <div class="modal-backdrop github-auth-modal-backdrop" role="presentation">
        <section class="modal github-auth-modal" role="dialog" aria-modal="true" aria-label="清除 GitHub 授权">
          <header class="modal-header"><h2>清除独立 GitHub 授权</h2><button class="icon-button" data-github-auth-close aria-label="关闭">×</button></header>
          <div class="modal-body"><p class="github-auth-modal-copy">删除本软件的授权记录和专用凭据，不退出任何客户端账号。</p></div>
          <footer class="modal-footer"><button class="button ghost" data-github-auth-close>取消</button><button class="button danger" data-github-auth-confirm-clear>确认清除授权</button></footer>
        </section>
      </div>`;
    modalRoot
      .querySelectorAll("[data-github-auth-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
    modalRoot
      .querySelector("[data-github-auth-confirm-clear]")
      ?.addEventListener("click", clearAuthorization);
  }

  async function clearAuthorization() {
    const button = modalRoot.querySelector("[data-github-auth-confirm-clear]");
    if (button) button.disabled = true;
    try {
      const value = await invoke("clear_github_authorization");
      validateStatus(value);
      status = value;
      document.dispatchEvent(new Event("pilotweave:refresh-setup"));
      closeModal();
      showToast(
        value.cleanupWarning ?? "独立 GitHub 授权已清除",
        value.cleanupWarning ? "error" : "success",
      );
      markChanged();
    } catch (error) {
      showToast(error?.message ?? String(error), "error");
      if (button) button.disabled = false;
    }
  }

  async function revalidate() {
    if (loading) return;
    loading = true;
    markChanged();
    try {
      const value = await invoke("refresh_github_authorization");
      validateStatus(value);
      status = value;
      document.dispatchEvent(new Event("pilotweave:refresh-setup"));
      showToast(
        value.state === "verified" ? "授权已核验" : value.detail,
        value.state === "verified" ? "success" : "error",
      );
    } catch (error) {
      showToast(error?.message ?? String(error), "error");
    } finally {
      loading = false;
      markChanged();
    }
  }

  function closeModal() {
    const token = modalRoot.querySelector("#github-auth-token");
    if (token) token.value = "";
    modalRoot.innerHTML = "";
  }

  function stateLabel(value) {
    return {
      missing: "缺失",
      verified: "已验证",
      unauthorized: "授权失效",
      forbidden: "无权限",
      networkError: "网络错误",
      credentialUnavailable: "凭据库不可用",
      schemaError: "格式不受支持",
      conflict: "冲突",
      readOnlyRecovery: "只读恢复",
    }[value] ?? value;
  }

  function stateClass(value) {
    return {
      verified: "verified",
      missing: "neutral",
      unauthorized: "danger",
      forbidden: "danger",
      networkError: "warning",
      schemaError: "danger",
      conflict: "warning",
      readOnlyRecovery: "danger",
    }[value] ?? "neutral";
  }

  function billingLabel(value) {
    return {
      available: "可用",
      insufficientPermission: "需要授权",
      notCovered: "未覆盖",
      unavailable: "不可用",
      unknown: "未知",
    }[value] ?? value;
  }

  function billingClass(value) {
    return {
      available: "verified",
      insufficientPermission: "warning",
      notCovered: "neutral",
      unavailable: "danger",
      unknown: "neutral",
    }[value] ?? "neutral";
  }

  function billingTitle(value) {
    return {
      available: "可读取高级请求账单",
      insufficientPermission: "身份有效，但缺少 Plan read 权限",
      notCovered: "此账号未提供个人账单访问",
      unavailable: "账单能力核验未完成，请重试",
      unknown: "尚未核验账单能力",
    }[value] ?? "账单能力未知";
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间未知";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-github-auth-action]");
    if (!button) return;
    switch (button.dataset.githubAuthAction) {
      case "authorize":
        openAuthorizeModal();
        break;
      case "refresh":
        revalidate();
        break;
      case "clear":
        openClearModal();
        break;
    }
  });

  window.PilotWeaveGithubAuth = {
    hydrate(value) { status = value; renderVersion += 1; },
    mount: ensurePanel,
    previewStatus: () => structuredClone(browserStatus),
    preview: openAuthorizeModal,
    openAuthorize: openAuthorizeModal,
  };
})();

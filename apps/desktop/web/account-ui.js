(() => {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;

  const invokeNative = window.__TAURI__?.core?.invoke ?? null;
  const isDesktop = typeof invokeNative === "function";
  const content = document.querySelector("#content");
  const pageTitle = document.querySelector("#page-title");
  const modalRoot = document.querySelector("#modal-root");
  const toastRoot = document.querySelector("#toast-root");

  if (!content || !pageTitle || !modalRoot || !toastRoot) return;

  const surfaceOrder = [
    "vsCodeCopilot",
    "copilotCli",
    "githubCopilotApp",
    "jetBrainsCopilot",
  ];
  const selectableStates = new Set([
    "verified",
    "inferred",
    "actionRequired",
    "unknown",
    "conflict",
  ]);

  let accountStatus = null;
  let loading = false;
  let currentPlan = null;
  let renderVersion = 0;

  const browserIdentity = {
    host: "github.com",
    login: "preview-user",
    userId: 1001,
    avatarUrl: null,
  };
  const browserState = {
    anchor: {
      state: "verified",
      identity: browserIdentity,
      get evidence() { return tr("浏览器试用：模拟 GitHub API 身份"); },
      get detail() { return tr("仅为模拟数据；原生应用通过受限的 GitHub CLI 查询官方身份接口。"); },
      observedAt: new Date().toISOString(),
    },
    surfaces: [
      {
        surface: "vsCodeCopilot",
        state: "actionRequired",
        identity: null,
        get evidence() { return tr("浏览器试用：未检查 VS Code SecretStorage"); },
        get detail() { return tr("请在 VS Code 官方账号界面中选择 github.com。"); },
        observedAt: new Date().toISOString(),
      },
      {
        surface: "copilotCli",
        state: "inferred",
        identity: browserIdentity,
        get evidence() { return tr("浏览器试用：模拟 GitHub CLI 身份推断"); },
        get detail() { return tr("请在 Copilot CLI 内使用 /user 核对所选账号。"); },
        observedAt: new Date().toISOString(),
      },
      {
        surface: "githubCopilotApp",
        state: "notInstalled",
        identity: null,
        get evidence() { return tr("浏览器试用：模拟未安装状态"); },
        get detail() { return tr("请先安装 App，再完成官方登录。"); },
        observedAt: new Date().toISOString(),
      },
    ],
    observedAt: new Date().toISOString(),
    loginRuns: [],
    historyRecovery: null,
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

    let panel = content.querySelector("#account-panel");
    if (!panel) return;
    if (panel.dataset.renderVersion === String(renderVersion)) return;
    panel.dataset.renderVersion = String(renderVersion);
    panel.innerHTML = renderPanel();
  }

  function renderPanel() {
    const status = accountStatus;
    const surfaces = orderedSurfaces(status?.surfaces ?? []);
    const selectable = surfaces.filter((surface) =>
      selectableStates.has(surface.state),
    );
    const verifiedCount = surfaces.filter(
      (surface) => surface.state === "verified",
    ).length;
    const actionCount = surfaces.filter((surface) =>
      ["actionRequired", "unknown", "conflict", "inferred"].includes(
        surface.state,
      ),
    ).length;

    return `
      <div class="account-panel-header">
        <div>
          <p class="eyebrow">${tr("账号核对")}</p>
          <h2>${tr("通过官方流程登录")}</h2>
          <p class="account-copy">${tr("仅打开官方登录流程，不读取或复制客户端登录凭据。")}</p>
        </div>
        <div class="account-panel-actions">
          <button class="button ghost small" data-account-action="refresh" ${loading ? "disabled" : ""}>${loading ? tr("检查中…") : tr("刷新账号")}</button>
          <button class="button primary small" data-account-action="preview" ${loading || selectable.length === 0 || status?.historyRecovery ? "disabled" : ""}>${tr("查看官方登录步骤{0}", selectable.length ? ` (${selectable.length})` : "")}</button>
        </div>
      </div>
      ${status?.historyRecovery ? renderRecovery(status.historyRecovery) : ""}
      <div class="account-summary" aria-label="${tr("账号观察摘要")}">
        <span><strong>${surfaces.length ? verifiedCount : "—"}</strong> ${tr("已验证")}</span>
        <span><strong>${surfaces.length ? actionCount : "—"}</strong> ${tr("待核对")}</span>
        <span><strong>${surfaces.length ? surfaces.length : "—"}</strong> ${tr("个客户端")}</span>
        <span class="account-runtime">${isDesktop ? tr("本地账号观察与官方登录") : tr("浏览器试用，不打开真实登录")}</span>
      </div>
      ${loading && !status ? `<div class="account-loading">${tr("读取账号状态中…")}</div>` : ""}
      ${!loading && !status ? `<div class="account-loading">${tr("尚未读取账号状态，请刷新。")}</div>` : ""}
      ${status ? renderAnchor(status.anchor) : ""}
      ${surfaces.length ? `<div class="account-grid">${surfaces.map(renderSurface).join("")}</div>` : ""}
      ${status ? renderHistory(status.loginRuns ?? []) : ""}
    `;
  }

  function renderRecovery(reason) {
    return `
      <div class="account-recovery">
        <strong>${tr("登录历史处于只读恢复")}</strong>
        <span>${escapeHtml(reason)}</span>
      </div>`;
  }

  function renderAnchor(anchor) {
    const identity = anchor?.identity;
    return `
      <article class="account-anchor">
        <div class="account-anchor-heading">
          <div>
            <span class="account-kicker">${tr("目标账号")}</span>
            <h3>${identity ? `${escapeHtml(identity.login)} · ${escapeHtml(identity.host)}` : tr("尚无已验证的 github.com 账号")}</h3>
          </div>
          <span class="account-status ${stateClass(anchor?.state)}">${escapeHtml(stateLabel(anchor?.state))}</span>
        </div>
        <p>${escapeHtml(anchor?.detail ?? tr("目标账号尚不可核验，请检查官方登录。"))}</p>
        <div class="account-evidence"><strong>${tr("依据")}</strong><span>${escapeHtml(anchor?.evidence ?? tr("不可用"))}</span></div>
        <div class="account-meta">
          <span>${identity?.userId != null ? tr("GitHub 用户 ID {0}", escapeHtml(identity.userId)) : tr("用户 ID 不可用")}</span>
          <span>${tr("观察时间 {0}", escapeHtml(formatDateTime(anchor?.observedAt)))}</span>
        </div>
      </article>`;
  }

  function renderSurface(surface) {
    const identity = surface.identity;
    const selectable = selectableStates.has(surface.state);
    return `
      <article class="account-card">
        <div class="account-card-heading">
          <label class="account-surface-select">
            <input type="checkbox" name="account-surface" value="${escapeHtml(surface.surface)}" ${selectable ? "checked" : "disabled"} />
            <span class="account-surface-icon" aria-hidden="true">${escapeHtml(surfaceIcon(surface.surface))}</span>
          </label>
          <span class="account-status ${stateClass(surface.state)}">${escapeHtml(stateLabel(surface.state))}</span>
        </div>
        <h3>${escapeHtml(surfaceName(surface.surface))}</h3>
        <p class="account-identity">${identity ? `${escapeHtml(identity.login)} · ${escapeHtml(identity.host)}` : tr("身份尚未验证")}</p>
        <p>${escapeHtml(surface.detail)}</p>
        <div class="account-evidence"><strong>${tr("依据")}</strong><span>${escapeHtml(surface.evidence)}</span></div>
        <div class="account-meta"><span>${tr("观察时间 {0}", escapeHtml(formatDateTime(surface.observedAt)))}</span></div>
      </article>`;
  }

  function renderHistory(runs) {
    const recent = runs.slice(0, 5);
    return `
      <div class="account-history-heading">
        <div><h3>${tr("最近登录记录")}</h3><p>${tr("仅保存状态摘要，不保存登录凭据。")}</p></div>
      </div>
      ${recent.length ? `<div class="account-history">${recent.map(renderRun).join("")}</div>` : `<div class="account-history-empty">${tr("尚无登录记录。")}</div>`}
    `;
  }

  function renderRun(run) {
    const target = run.targetIdentity
      ? `${run.targetIdentity.login} · ${run.targetIdentity.host}`
      : tr("目标账号尚未验证");
    return `
      <div class="account-run">
        <span class="account-status ${runStatusClass(run.status)}">${escapeHtml(runStatusLabel(run.status))}</span>
        <div>
          <strong>${escapeHtml(target)}</strong>
          <p>${escapeHtml(run.summary)}</p>
          ${run.observedCliLogin ? `<p>${tr("观察到的 CLI 账号： {0} · github.com", escapeHtml(run.observedCliLogin))}</p>` : ""}
        </div>
        <div class="account-run-meta">
          <span>${escapeHtml(formatDateTime(run.finishedAt ?? run.startedAt))}</span>
          <span>${escapeHtml(run.requestedSurfaces?.map(surfaceName).join(", ") ?? tr("无客户端"))}</span>
          ${isDesktop && ["actionRequired", "partial", "conflict", "interrupted"].includes(run.status) ? `<div class="account-panel-actions"><button class="button ghost small" data-account-action="verify-run" data-run-id="${escapeHtml(run.id)}" ${loading ? "disabled" : ""}>${tr("核验官方账号")}</button><button class="button danger small" data-account-action="cancel-run" data-run-id="${escapeHtml(run.id)}">${tr("停止核验")}</button></div>` : ""}
        </div>
      </div>`;
  }

  async function invoke(command, args = {}) {
    if (isDesktop) return invokeNative(command, args);
    await new Promise((resolve) => setTimeout(resolve, 120));
    return invokeBrowserMock(command, args);
  }

  function invokeBrowserMock(command, args) {
    switch (command) {
      case "get_account_status":
        browserState.observedAt = new Date().toISOString();
        return structuredClone(browserState);
      case "preview_login": {
        const requested = args.surfaces?.length
          ? args.surfaces
          : surfaceOrder;
        const now = new Date();
        const operations = requested.map((surface) => {
          const observation = browserState.surfaces.find(
            (item) => item.surface === surface,
          );
          const supported = !["notInstalled", "unsupported"].includes(
            observation?.state,
          );
          return {
            surface,
            title: tr("打开 {0} 官方登录", surfaceName(surface)),
            description: supported
              ? tr("浏览器试用：仅模拟固定的官方登录入口")
              : tr("请先安装或修复此客户端，再完成官方登录"),
            supported,
          };
        });
        return {
          id: crypto.randomUUID(),
          targetIdentity: browserState.anchor.identity,
          requestedSurfaces: requested,
          operations,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        };
      }
      case "apply_login_plan": {
        const plan = currentPlan;
        if (!plan || plan.id !== args.planId) {
          throw new Error(tr("模拟登录计划缺失或已使用，请重新预览"));
        }
        const now = new Date().toISOString();
        const steps = plan.operations.map((operation) => ({
          surface: operation.surface,
          status: operation.supported
            ? "actionRequired"
            : "skippedNotInstalled",
          detail: operation.supported
            ? tr("浏览器试用：仅模拟打开入口，不证明真实登录；请在客户端完成后刷新")
            : operation.description,
        }));
        const launched = steps.filter(
          (step) => step.status === "actionRequired",
        ).length;
        const run = {
          id: crypto.randomUUID(),
          planId: plan.id,
          targetIdentity: plan.targetIdentity,
          requestedSurfaces: plan.requestedSurfaces,
          status: launched ? "actionRequired" : "failed",
          steps,
          summary: launched
            ? tr("仅模拟登录入口，未启动真实客户端")
            : tr("没有可用的登录入口"),
          startedAt: now,
          finishedAt: now,
        };
        browserState.loginRuns.unshift(run);
        browserState.loginRuns = browserState.loginRuns.slice(0, 100);
        currentPlan = null;
        return {
          run,
          accountStatus: structuredClone(browserState),
        };
      }
      default:
        throw new Error(tr("不支持的账号试用操作：{0}", command));
    }
  }

  async function refreshStatus({ quiet = false } = {}) {
    if (loading) return;
    loading = true;
    markChanged();
    try {
      const value = await invoke("get_account_status");
      validateStatus(value);
      accountStatus = value;
      if (!quiet) { showToast(tr("账号状态已刷新")); document.dispatchEvent(new Event("copilot-byok-manager:refresh-setup")); }
    } catch (error) {
      showToast(error?.message ?? String(error), "error");
    } finally {
      loading = false;
      markChanged();
    }
  }

  function validateStatus(value) {
    if (!value || !value.anchor || !Array.isArray(value.surfaces)) {
      throw new Error(tr("账号响应格式不受支持"));
    }
    if (!Array.isArray(value.loginRuns)) {
      value.loginRuns = [];
    }
  }

  async function previewLogin(requestedSurfaces) {
    if (loading || !accountStatus) return;
    if (accountStatus.historyRecovery) {
      showToast(
        tr("请先处理登录历史的只读恢复"),
        "error",
      );
      return;
    }
    const choices = content.querySelectorAll('input[name="account-surface"]');
    const surfaces = Array.isArray(requestedSurfaces) ? requestedSurfaces.filter(s => surfaceOrder.includes(s)) : choices.length ? Array.from(choices).filter((input) => input.checked).map((input) => input.value)
      : (accountStatus.surfaces ?? []).filter((s) => !["notInstalled", "unsupported"].includes(s.state)).map((s) => s.surface);
    if (!surfaces.length) {
      showToast(tr("请至少选择一个已安装的客户端"), "error");
      return;
    }

    loading = true;
    markChanged();
    try {
      const plan = await invoke("preview_login", { surfaces });
      currentPlan = plan;
      openPlanModal(plan);
    } catch (error) {
      showToast(error?.message ?? String(error), "error");
    } finally {
      loading = false;
      markChanged();
    }
  }

  function openPlanModal(plan) {
    if (!dialog().prepare()) return;
    currentPlan = plan;
    const target = plan.targetIdentity;
    const supportedCount = plan.operations.filter(
      (operation) => operation.supported,
    ).length;
    const needsManualTargetConfirmation = !target;
    modalRoot.innerHTML = `
      <div class="modal-backdrop account-modal-backdrop" role="presentation">
        <section class="modal wide account-modal" role="dialog" aria-modal="true" aria-label="${tr("核对官方登录计划")}">
          <header class="modal-header">
            <div><p class="eyebrow">${tr("官方登录计划")}</p><h2>${tr("核对登录步骤")}</h2></div>
            <button class="icon-button" data-account-modal-close aria-label="${tr("关闭")}">×</button>
          </header>
          <div class="modal-body">
            <div class="account-plan-security">
              ${tr("计划有效至 {0}，仅可使用一次；确认只提交原生计划 ID。", escapeHtml(formatDateTime(plan.expiresAt)))}
            </div>
            <div class="account-plan-target">
              <span>${tr("目标 github.com 账号")}</span>
              <strong>${target ? `${escapeHtml(target.login)} · ${escapeHtml(target.host)}` : tr("尚未验证")}</strong>
              <p>${target ? tr("请在每个客户端使用此账号。") : tr("尚未核验统一账号，请按下方步骤逐个确认。")}</p>
            </div>
            ${needsManualTargetConfirmation ? `
              <label class="account-confirmation">
                <input type="checkbox" data-account-target-confirm />
                <span>${tr("我会在所选客户端逐个确认同一 github.com 账号。")}</span>
              </label>` : ""}
            <div class="account-plan-list">
              ${plan.operations.map(renderPlanOperation).join("")}
            </div>
          </div>
          <footer class="modal-footer">
            <button class="button ghost" data-account-modal-close>${tr("取消")}</button>
            <button class="button primary" data-account-confirm ${supportedCount === 0 || needsManualTargetConfirmation ? "disabled" : ""}>${tr("继续官方登录")}</button>
          </footer>
        </section>
      </div>`;

    dialog().mount();
    modalRoot
      .querySelectorAll("[data-account-modal-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
    modalRoot
      .querySelector(".account-modal-backdrop")
      ?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) closeModal();
      });
    const confirm = modalRoot.querySelector("[data-account-confirm]");
    modalRoot
      .querySelector("[data-account-target-confirm]")
      ?.addEventListener("change", (event) => {
        if (confirm) confirm.disabled = !isDesktop || !event.target.checked || supportedCount === 0;
      });
    confirm?.addEventListener("click", () => applyPlan(plan));
  }

  function renderPlanOperation(operation) {
    return `
      <div class="account-plan-operation">
        <span class="account-status ${operation.supported || operation.surface === "jetBrainsCopilot" ? "action" : "unsupported"}">${operation.surface === "jetBrainsCopilot" ? tr("手动步骤") : operation.supported ? operation.surface === "vsCodeCopilot" ? tr("指令") : tr("将打开官方流程") : tr("不可用")}</span>
        <div>
          <strong>${escapeHtml(operation.title)}</strong>
          <p>${escapeHtml(operation.description)}</p>
        </div>
      </div>`;
  }

  async function applyPlan(plan) {
    if (!isDesktop) return;
    if (!currentPlan || currentPlan.id !== plan.id) return;
    currentPlan = null;
    const confirm = modalRoot.querySelector("[data-account-confirm]");
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = tr("准备中…");
    }
    try {
      const result = await invoke("apply_login_plan", { planId: plan.id });
      validateStatus(result.accountStatus);
      accountStatus = result.accountStatus;
      document.dispatchEvent(new Event("copilot-byok-manager:refresh-setup"));
      showResultModal(result.run);
      showToast(tr("登录步骤已准备，请逐个完成"));
      markChanged();
    } catch (error) {
    closeModal();
    showToast(
      tr("{0} 重试前请重新生成预览。", error?.message ?? String(error)),
      "error",
    );
  }

  }

  function showResultModal(run) {
    if (!dialog().prepare()) return;
    modalRoot.innerHTML = `
      <div class="modal-backdrop account-modal-backdrop" role="presentation">
        <section class="modal wide account-modal" role="dialog" aria-modal="true" aria-label="${tr("登录流程结果")}">
          <header class="modal-header">
            <div><p class="eyebrow">${tr("官方登录结果")}</p><h2>${escapeHtml(runStatusLabel(run.status))}</h2></div>
            <button class="icon-button" data-account-modal-close aria-label="${tr("关闭")}">×</button>
          </header>
          <div class="modal-body">
            <p class="account-result-summary">${escapeHtml(run.summary)}</p>
            <div class="account-result-list">
              ${run.steps.map(renderStep).join("")}
            </div>
          </div>
          <footer class="modal-footer">
            <button class="button ghost" data-account-modal-close>${tr("关闭")}</button>
            <button class="button primary" data-account-result-refresh>${tr("刷新账号状态")}</button>
          </footer>
        </section>
      </div>`;
    dialog().mount();
    modalRoot
      .querySelectorAll("[data-account-modal-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
    modalRoot
      .querySelector("[data-account-result-refresh]")
      ?.addEventListener("click", async () => {
        closeModal();
        await refreshStatus();
      });
  }

  function renderStep(step) {
    return `
      <div class="account-result-row">
        <span class="account-status ${stepStatusClass(step.status)}">${escapeHtml(stepStatusLabel(step.status))}</span>
        <div><strong>${escapeHtml(surfaceName(step.surface))}</strong><p>${escapeHtml(step.detail)}</p></div>
      </div>`;
  }

  let modalLifecycle;
  function dialog() { return modalLifecycle ??= window.CopilotBYOKManagerUI.modal({ root: modalRoot, background: document.querySelector(".app-shell"), cleanup() { modalRoot.replaceChildren(); currentPlan = null; } }); }
  function closeModal(event) {
    return event?.type ? dialog().requestClose() : dialog().close();
  }

  function orderedSurfaces(values) {
    return [...values].sort(
      (left, right) =>
        surfaceOrder.indexOf(left.surface) - surfaceOrder.indexOf(right.surface),
    );
  }

  function surfaceName(surface) {
    return {
      vsCodeCopilot: "VS Code Copilot",
      copilotCli: "GitHub Copilot CLI",
      githubCopilotApp: "GitHub Copilot app",
      jetBrainsCopilot: "JetBrains GitHub Copilot",
    }[surface] ?? surface;
  }

  function surfaceIcon(surface) {
    return {
      vsCodeCopilot: "VS",
      copilotCli: ">_",
      githubCopilotApp: "◆",
      jetBrainsCopilot: "JB",
    }[surface] ?? "◇";
  }

  function stateLabel(state) {
    return {
      verified: tr("已验证"),
      inferred: tr("推断，待确认"),
      actionRequired: tr("需要操作"),
      unknown: tr("未知"),
      unsupported: tr("不支持"),
      notInstalled: tr("未安装"),
      conflict: tr("冲突"),
    }[state] ?? state ?? tr("未知");
  }

  function stateClass(state) {
    return {
      verified: "verified",
      inferred: "inferred",
      actionRequired: "action",
      unknown: "unknown",
      unsupported: "unsupported",
      notInstalled: "not-installed",
      conflict: "conflict",
    }[state] ?? "unknown";
  }

  function runStatusLabel(status) {
    return {
      inProgress: tr("进行中"),
      actionRequired: tr("需要操作"),
      partial: tr("部分完成"),
      failed: tr("失败"),
      completed: tr("已完成"),
      interrupted: tr("已中断"),
      cancelled: tr("已停止后续核验"),
      timedOut: tr("核验已过期"),
      conflict: tr("账号冲突"),
    }[status] ?? status;
  }

  function runStatusClass(status) {
    return {
      inProgress: "inferred",
      actionRequired: "action",
      partial: "unknown",
      failed: "conflict",
      completed: "verified",
      interrupted: "unknown",
      cancelled: "unknown",
      timedOut: "action",
      conflict: "conflict",
    }[status] ?? "unknown";
  }

  function stepStatusLabel(status) {
    return {
      pending: tr("待处理"),
      launched: tr("已打开"),
      actionRequired: tr("需要操作"),
      skippedNotInstalled: tr("未安装"),
      unsupported: tr("不支持"),
      failed: tr("失败"),
      verified: tr("CLI 账号已验证"),
      conflict: tr("账号冲突"),
      cancelled: tr("已取消"),
      timedOut: tr("核验已过期"),
    }[status] ?? status;
  }

  function stepStatusClass(status) {
    return {
      pending: "unknown",
      launched: "inferred",
      actionRequired: "action",
      skippedNotInstalled: "not-installed",
      unsupported: "unsupported",
      failed: "conflict",
      verified: "verified",
      conflict: "conflict",
      cancelled: "unknown",
      timedOut: "action",
    }[status] ?? "unknown";
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return tr("时间未知");
    return new Intl.DateTimeFormat(i18n.locale(), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-account-action]");
    if (!button) return;
    if (["verify-run", "cancel-run"].includes(button.dataset.accountAction)) {
      followUpRun(button.dataset.runId, button.dataset.accountAction === "cancel-run");
      return;
    }
    if (button.dataset.accountAction === "refresh") {
      refreshStatus();
      return;
    }
    if (button.dataset.accountAction === "preview") {
      previewLogin();
    }
  });

  async function followUpRun(runId, cancel) {
    if (!isDesktop || (!cancel && loading)) return;
    loading = true; markChanged();
    try {
      const result = await invoke(cancel ? "cancel_login_run" : "verify_login_run", { runId });
      validateStatus(result.accountStatus);
      accountStatus = result.accountStatus;
      if (!cancel) showResultModal(result.run);
      showToast(cancel ? tr("已停止核验，不关闭客户端窗口") : result.run.summary, ["conflict", "failed"].includes(result.run.status) ? "error" : "success");
      document.dispatchEvent(new Event("copilot-byok-manager:refresh-setup"));
    } catch (error) { showToast(error?.message ?? String(error), "error"); }
    finally { loading = false; markChanged(); }
  }

  window.CopilotBYOKManagerAccount = {
    hydrate(value) { accountStatus = value; renderVersion += 1; },
    mount: ensurePanel,
    previewStatus: () => structuredClone(browserState),
    preview: previewLogin,
  };
})();

(() => {
  "use strict";

  const invokeNative = window.__TAURI__?.core?.invoke ?? null;
  const isDesktop = typeof invokeNative === "function";
  const content = document.querySelector("#content");
  const pageTitle = document.querySelector("#page-title");
  const modalRoot = document.querySelector("#modal-root");
  const toastRoot = document.querySelector("#toast-root");

  if (!content || !pageTitle || !modalRoot || !toastRoot) return;

  const componentOrder = [
    "vscode",
    "vscode-copilot-extension",
    "copilot-cli",
    "github-copilot-app",
  ];

  let observations = null;
  let loading = false;
  let lastResult = null;
  let lastRun = null;
  let renderVersion = 0;

  const browserObservations = [
    {
      id: "vscode",
      name: "Visual Studio Code",
      status: "ready",
      detail: "浏览器试用：模拟已安装组件",
      version: "preview",
    },
    {
      id: "vscode-copilot-extension",
      name: "GitHub Copilot 扩展",
      status: "ready",
      detail: "浏览器试用：模拟已安装扩展",
      version: "preview",
    },
    {
      id: "copilot-cli",
      name: "GitHub Copilot CLI",
      status: "missing",
      detail: "浏览器试用：模拟缺失组件",
      version: null,
    },
    {
      id: "github-copilot-app",
      name: "GitHub Copilot app",
      status: "missing",
      detail: "浏览器试用：模拟缺失组件",
      version: null,
    },
  ];

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

  function statusLabel(status) {
    return {
      ready: "已就绪",
      missing: "缺失",
      unsupported: "不支持",
      broken: "需要修复",
      unknown: "检测不可用",
      inProgress: "安装中",
      complete: "已结束，请核对各组件",
      partial: "部分完成",
      interrupted: "已中断",
      elevationDenied: "管理员确认被拒绝",
      completedAndVerified: "安装后已核验",
      processSucceededVerificationFailed: "安装后核验失败",
      skippedAlreadyReady: "已就绪，无需安装",
      skippedDependencyFailed: "依赖不可用",
      failed: "失败",
      cancelled: "已取消，需重新检测",
      timedOut: "已超时，需重新检测",
    }[status] ?? status;
  }

  function statusClass(status) {
    return {
      ready: "ready",
      completedAndVerified: "ready",
      skippedAlreadyReady: "ready",
      missing: "missing",
      broken: "broken",
      processSucceededVerificationFailed: "broken",
      failed: "broken",
      skippedDependencyFailed: "broken",
      unsupported: "unsupported",
    }[status] ?? "unsupported";
  }

  function ordered(values) {
    return [...values].sort(
      (left, right) =>
        componentOrder.indexOf(left.id) - componentOrder.indexOf(right.id),
    );
  }

  function markChanged() {
    renderVersion += 1;
    ensurePanel();
  }

  function ensurePanel() {

    let panel = content.querySelector("#installation-panel");
    if (!panel) return;
    if (panel.dataset.renderVersion === String(renderVersion)) return;
    panel.dataset.renderVersion = String(renderVersion);
    panel.innerHTML = renderPanel();
  }

  function renderPanel() {
    const values = observations ? ordered(observations) : [];
    const actionable = values.filter((item) =>
      ["missing", "broken"].includes(item.status),
    );
    const readyCount = values.filter((item) => item.status === "ready").length;
    const unsupportedCount = values.filter(
      (item) => item.status === "unsupported",
    ).length;

    return `
      <div class="install-panel-header">
        <div>
          <p class="eyebrow">环境安装</p>
          <h2>安装并核验客户端</h2>
          <p class="install-copy">先核对安装计划，再确认执行；安装来源由本地后端固定。</p>
        </div>
        <div class="install-panel-actions">
          <button class="button ghost small" data-install-action="refresh" ${loading ? "disabled" : ""}>${loading ? "检查中…" : "刷新状态"}</button>
          <button class="button primary small" data-install-action="install-all" ${loading || actionable.length === 0 ? "disabled" : ""}>安装缺失组件${actionable.length ? ` (${actionable.length})` : ""}</button>
        </div>
      </div>
      <div class="install-summary" aria-label="安装摘要">
        <span><strong>${values.length ? readyCount : "—"}</strong> 已就绪</span>
        <span><strong>${values.length ? actionable.length : "—"}</strong> 待处理</span>
        <span><strong>${values.length ? unsupportedCount : "—"}</strong> 不支持</span>
        <span class="install-runtime">${isDesktop ? "支持的 Windows 组件可审核安装" : "浏览器试用，不执行安装"}</span>
      </div>
      ${loading && values.length === 0 ? '<div class="install-loading">检测组件中…</div>' : ""}
      ${!loading && values.length === 0 ? '<div class="install-loading">尚未读取组件状态，请刷新。</div>' : ""}
      ${values.length ? `<div class="install-grid">${values.map(renderComponent).join("")}</div>` : ""}
      ${lastRun ? `<div class="install-result-summary"><div><strong>安装 ${escapeHtml(statusLabel(lastRun.status))}</strong><span>${escapeHtml(lastRun.detail)}</span></div>${lastRun.status === "running" ? `<button class="button danger small" data-install-action="cancel" data-run-id="${escapeHtml(lastRun.id)}">取消任务</button>` : ""}</div>` : ""}
      ${lastResult ? renderLastResult(lastResult) : ""}
    `;
  }

  function renderComponent(item) {
    const canInstall = ["missing", "broken"].includes(item.status);
    return `
      <article class="install-card">
        <div class="install-card-heading">
          <div class="install-component-icon" aria-hidden="true">${componentIcon(item.id)}</div>
          <span class="install-status ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.detail)}</p>
        <div class="install-card-footer">
          <span>${item.version ? `版本 ${escapeHtml(item.version)}` : "版本不可用"}</span>
          ${canInstall ? `<button class="button ghost small" data-install-action="install-one" data-component-id="${escapeHtml(item.id)}" ${loading ? "disabled" : ""}>${item.status === "broken" ? "修复" : "安装"}</button>` : ""}
        </div>
      </article>
    `;
  }

  function componentIcon(id) {
    return {
      vscode: "VS",
      "vscode-copilot-extension": "GH",
      "copilot-cli": ">_",
      "github-copilot-app": "◆",
    }[id] ?? "◇";
  }

  function renderLastResult(result) {
    const successes = result.results.filter((item) =>
      ["completedAndVerified", "skippedAlreadyReady"].includes(item.status),
    ).length;
    const failures = result.results.length - successes;
    return `
      <div class="install-result-summary">
        <div>
          <strong>上次安装</strong>
          <span>计划 ${escapeHtml(result.planId)}</span>
        </div>
        <div><strong>${successes}</strong> 完成 · <strong>${failures}</strong> 待核对</div>
      </div>
    `;
  }

  async function invoke(command, args = {}) {
    if (isDesktop) return invokeNative(command, args);
    await new Promise((resolve) => setTimeout(resolve, 120));
    return invokeBrowserMock(command, args);
  }

  function invokeBrowserMock(command, args) {
    switch (command) {
      case "get_installation_status":
        return structuredClone(browserObservations);
      case "preview_install": {
        const requested = args.componentIds?.length
          ? args.componentIds
          : browserObservations
              .filter((item) => ["missing", "broken"].includes(item.status))
              .map((item) => item.id);
        const operations = requested.map((id) => {
          const item = browserObservations.find((value) => value.id === id);
          return {
            id: crypto.randomUUID(),
            componentId: id,
            componentName: item?.name ?? id,
            strategy:
              id === "vscode-copilot-extension"
                ? "vsCodeExtension"
                : "wingetPackage",
            source:
              id === "github-copilot-app"
                ? "WinGet: GitHub.CopilotApp"
                : `模拟白名单：${id}`,
            requiresElevation: false,
            description:
              "浏览器试用仅模拟；真实安装命令及参数由原生后端生成",
          };
        });
        const now = new Date();
        return {
          id: crypto.randomUUID(),
          requestedComponentIds: requested,
          operations,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        };
      }
      case "apply_install_plan": {
        const requested = currentModalPlan?.requestedComponentIds ?? [];
        for (const id of requested) {
          const item = browserObservations.find((value) => value.id === id);
          if (item) {
            item.status = "ready";
            item.detail = "浏览器试用：模拟安装完成，未启动安装程序";
            item.version = "preview";
          }
        }
        return {
          planId: args.planId,
          results: requested.map((id) => ({
            componentId: id,
            status: "completedAndVerified",
            detail:
              "浏览器试用：仅模拟核验结果，未启动真实进程",
          })),
          observations: structuredClone(browserObservations),
        };
      }
      default:
        throw new Error(`不支持的安装试用操作：${command}`);
    }
  }

  async function refreshStatus({ quiet = false } = {}) {
    if (loading) return;
    loading = true;
    markChanged();
    try {
      observations = await invoke("get_installation_status");
      if (!Array.isArray(observations)) {
        throw new Error("安装检测响应格式不受支持");
      }
      if (!quiet) { showToast("安装状态已刷新"); document.dispatchEvent(new Event("pilotweave:refresh-setup")); }
    } catch (error) {
      showToast(error?.message ?? String(error), "error");
    } finally {
      loading = false;
      markChanged();
    }
  }

  let currentModalPlan = null;
  let modalLifecycle;
  function dialog() { return modalLifecycle ??= window.PilotWeaveUI.modal({ root: modalRoot, background: document.querySelector(".app-shell"), cleanup() { modalRoot.replaceChildren(); currentModalPlan = null; } }); }

  async function previewInstall(componentIds) {
    if (loading || componentIds.length === 0) return;
    loading = true;
    markChanged();
    try {
      const plan = await invoke("preview_install", { componentIds });
      currentModalPlan = plan;
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
    currentModalPlan = plan;
    const operationRows = plan.operations.length
      ? plan.operations
          .map(
            (operation) => `
              <div class="install-plan-operation">
                <div>
                  <strong>${escapeHtml(operation.componentName)}</strong>
                  <span>${escapeHtml(operation.description)}</span>
                </div>
                <div class="install-plan-meta">
                  <span>${escapeHtml(operation.source)}</span>
                  <span>${escapeHtml(operation.version ?? "当前兼容扩展")} · ${escapeHtml(operation.architecture ?? "Windows")}</span>
                  ${(operation.dependencies ?? []).map(dependency => `<span>${escapeHtml(dependency)}</span>`).join("")}
                  <span>${operation.requiresElevation ? "可能需要管理员确认" : "当前用户操作"}</span>
                </div>
              </div>`,
          )
          .join("")
      : '<div class="install-plan-empty">所选组件已就绪，不执行安装。</div>';

    modalRoot.innerHTML = `
      <div class="modal-backdrop install-modal-backdrop" role="presentation">
        <section class="modal wide install-modal" role="dialog" aria-modal="true" aria-label="核对安装计划">
          <header class="modal-header">
            <div><p class="eyebrow">核对变更</p><h2>核对安装计划</h2></div>
            <button class="icon-button" data-install-modal-close aria-label="关闭">×</button>
          </header>
          <div class="modal-body">
            <div class="install-plan-security"><details><summary>安全说明</summary>
              安装来源由原生后端固定。计划有效至 ${escapeHtml(formatDateTime(plan.expiresAt))}，仅可使用一次。</details>
            </div>
            <div class="install-plan-list">${operationRows}</div>
          </div>
          <footer class="modal-footer">
            <button class="button ghost" data-install-modal-close>取消</button>
            <button class="button primary" data-install-confirm ${!isDesktop || plan.operations.length === 0 ? "disabled" : ""}>确认安装并核验</button>
          </footer>
        </section>
      </div>`;

    dialog().mount();
    modalRoot
      .querySelectorAll("[data-install-modal-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
    modalRoot
      .querySelector(".install-modal-backdrop")
      ?.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) closeModal();
      });
    modalRoot
      .querySelector("[data-install-confirm]")
      ?.addEventListener("click", () => applyPlan(plan));
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间未知";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function closeModal(event) {
    return event?.type ? dialog().requestClose() : dialog().close();
  }

  async function applyPlan(plan) {
    if (!isDesktop) return;
    if (!currentModalPlan || currentModalPlan.id !== plan.id) return;
    currentModalPlan = null;
    const confirm = modalRoot.querySelector("[data-install-confirm]");
    if (confirm) {
      confirm.disabled = true;
      confirm.textContent = "安装中…";
    }
    let runId = null;
    let unlisten = null;
    let poll = null;
    let closed = false;
    const acceptProgress = (run) => {
      if (closed || run?.planId !== plan.id) return;
      runId = run.id; lastRun = run;
      const list = modalRoot.querySelector(".install-plan-list");
      if (list) list.innerHTML = `<p role="status">${escapeHtml(run.currentComponentId ? `正在处理 ${componentName(run.currentComponentId)}` : statusLabel(run.status))}</p><p>${escapeHtml(run.detail)}</p>${run.results.map((item) => `<p>${escapeHtml(componentName(item.componentId))}: ${escapeHtml(statusLabel(item.status))}</p>`).join("")}`;
      const cancel = modalRoot.querySelector("[data-install-cancel-run]");
      if (cancel) cancel.disabled = run.status !== "running";
      markChanged();
    };
    const cancel = document.createElement("button");
    cancel.className = "button danger"; cancel.textContent = "取消安装";
    cancel.dataset.installCancelRun = ""; cancel.disabled = true;
    modalRoot.querySelector(".modal-footer")?.append(cancel);
    cancel.addEventListener("click", async () => {
      if (!runId) return;
      cancel.disabled = true;
      try { await invoke("cancel_install_run", { runId }); cancel.textContent = "已请求取消，结束后将重新检测"; }
      catch (error) { showToast(error?.message ?? String(error), "error"); cancel.disabled = false; }
    });
    const observe = async () => {
      try { const runs = await invoke("get_install_runs"); const run = runs.find((value) => value.planId === plan.id); if (run) { acceptProgress(run); cancel.disabled = run.status !== "running"; } }
      catch { /* Final native result/history reports persistence errors explicitly. */ }
    };
    try {
      if (window.__TAURI__?.event?.listen) unlisten = await window.__TAURI__.event.listen("pilotweave:install-progress", (event) => {
        acceptProgress(event.payload); cancel.disabled = event.payload?.status !== "running";
      });
      poll = setInterval(observe, 2000);
      const result = await invoke("apply_install_plan", { planId: plan.id });
      lastResult = result;
      observations = result.observations;
      document.dispatchEvent(new Event("pilotweave:refresh-setup"));
      currentModalPlan = null;
      showResultModal(result);
      const attention = result.results.some((item) => !["completedAndVerified", "skippedAlreadyReady"].includes(item.status));
      showToast(attention ? "安装已结束，仍有项目需要核对" : "所选组件已重新检测并确认就绪", attention ? "warning" : "success");
      markChanged();
    } catch (error) {
    closeModal();
    showToast(
      `${error?.message ?? String(error)} 重试前请重新生成预览。`,
      "error",
    );
    } finally { closed = true; if (poll) clearInterval(poll); unlisten?.(); }

  }

  function showResultModal(result) {
    if (!dialog().prepare()) return;
    modalRoot.innerHTML = `
      <div class="modal-backdrop install-modal-backdrop" role="presentation">
        <section class="modal wide install-modal" role="dialog" aria-modal="true" aria-label="安装结果">
          <header class="modal-header">
            <div><p class="eyebrow">安装后重新检测</p><h2>安装结果</h2></div>
            <button class="icon-button" data-install-modal-close aria-label="关闭">×</button>
          </header>
          <div class="modal-body">
            <div class="install-result-list">
              ${result.results
                .map(
                  (item) => `
                    <div class="install-result-row">
                      <span class="install-status ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
                      <div><strong>${escapeHtml(componentName(item.componentId))}</strong><p>${escapeHtml(item.detail)}</p></div>
                    </div>`,
                )
                .join("")}
            </div>
          </div>
          <footer class="modal-footer">
            <button class="button primary" data-install-modal-close>完成</button>
          </footer>
        </section>
      </div>`;
    dialog().mount();
    modalRoot
      .querySelectorAll("[data-install-modal-close]")
      .forEach((button) => button.addEventListener("click", closeModal));
  }

  function componentName(id) {
    return (
      observations?.find((item) => item.id === id)?.name ??
      browserObservations.find((item) => item.id === id)?.name ??
      id
    );
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-install-action]");
    if (!button) return;
    const action = button.dataset.installAction;
    if (action === "refresh") {
      refreshStatus();
      return;
    }
    if (action === "cancel") {
      button.disabled = true;
      invoke("cancel_install_run", { runId: button.dataset.runId }).then((accepted) => showToast(accepted ? "已请求取消，已完成的安装保留" : "此任务已经结束", "warning")).catch((error) => showToast(error?.message ?? String(error), "error")).finally(() => { button.disabled = false; });
      return;
    }
    if (action === "install-one") {
      previewInstall([button.dataset.componentId]);
      return;
    }
    if (action === "install-all") {
      const ids = (observations ?? [])
        .filter((item) => ["missing", "broken"].includes(item.status))
        .map((item) => item.id);
      previewInstall(ids);
    }
  });

  window.PilotWeaveInstaller = {
    hydrate(value, runs) { observations = value; if (Array.isArray(runs)) { lastRun = runs[0] ?? null; if (lastRun) lastResult = { planId: lastRun.planId, results: lastRun.results }; } renderVersion += 1; },
    mount: ensurePanel,
    previewStatus: () => structuredClone(browserObservations),
    preview: previewInstall,
  };
})();

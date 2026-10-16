(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CopilotBYOKManagerJetBrains = api;
})(globalThis, () => {
  "use strict";
  const i18n = typeof module === "object" && module.exports ? require("./i18n.js") : globalThis.CopilotBYOKManagerI18n;
  const tr = i18n.t;
  const e = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  function guide(connection, target, operation) {
    const automatic = Boolean(operation?.supported);
    return `<details><summary>${tr("目标观察与诊断")}</summary><p>${e(target.detail)}</p><p>${e(target.path ?? tr("仅检测标准 IDE 目录；自定义与便携路径需手动核对。"))}</p></details>
      ${automatic ? `<p><strong>${tr("可自动发布 BYOK。")}</strong>${tr("相同配置根路径的 IDE 共用")} <code>github-copilot/byok.json</code>${tr("，只写一次并保留其他供应商。")}</p>` : `<p>${tr("自动写入需要已审核插件版本、已保存密钥和兼容端点。请核对下方原因。")}</p>`}
      ${automatic ? `<ol class="manual-steps"><li>${tr("关闭使用同一配置根路径的 IDE。")}</li>
        <li>${tr("选择")}<strong>${tr("预览自动 BYOK")}</strong>${tr("，核对目标和模型，再确认发布。")}</li>
        <li>${tr("本软件自动写入密钥、端点和模型配置，无需在 Manage Models 中重新输入。")}</li>
        <li>${tr("重新打开 IDE，在")} <strong>Copilot Chat → model picker</strong> ${tr("中选用模型，再验证请求。")}</li></ol>` : `<ol class="manual-steps"><li>${tr("在")} <strong>Settings / Preferences → Plugins → Marketplace</strong> ${tr("中安装或启用 GitHub 发布的")} <strong>GitHub Copilot</strong>。</li>
        <li>${tr("通过")} <strong>Tools → GitHub Copilot → Login to GitHub</strong> ${tr("完成官方登录，逐个核对 IDE 账号。")}</li>
        <li>${tr("打开")} <strong>GitHub Copilot Chat → model picker → Manage Models → Add Models</strong>${tr("，添加供应商或 OpenAI 兼容端点；密钥只在客户端中输入。")}</li>
        <li>${tr("保存并启用模型，在 Chat 中选用后验证请求。")}</li></ol>`}
      <p>${tr("每个 IDE 的分组、显示名称和模型启用偏好保存在独立 XML 中，本软件不改写它们。组织策略或已有偏好可能影响模型可见性。")}</p>
      ${connection ? `<h3>${tr("连接：{0}", e(connection.name))}</h3><p>${tr("端点：")}<code>${e(connection.baseUrl)}</code> ${tr("· 协议：")}<code>${e(connection.protocol)}</code></p>
        <ul>${connection.models.filter(m => m.enabled).map(m => `<li>${tr("模型：")}<code>${e(m.modelId)}</code></li>`).join("")}</ul>
        ${connection.headers && Object.keys(connection.headers).length ? `<p>${tr("不显示请求头值；{0}", automatic ? tr("确认发布后仅在原生 BYOK 配置中写入。") : tr("请仅在 IDE 中配置其界面支持的字段。"))}</p>` : ""}` : `<p>${tr("请先添加连接，再核对端点和模型。")}</p>`}
      ${operation ? `<details><summary>${tr("原生写入明细 · {0}", automatic ? tr("支持自动发布") : tr("不支持自动写入"))}</summary><p>${e(operation.description)}</p><ul>${operation.changes.map(c => `<li>${e(c)}</li>`).join("")}</ul></details>` : ""}
      <details><summary>${tr("安全边界与登录")}</summary><p>${tr("查看指引不写入配置、不显示密钥。支持的自动部署在确认发布后，会在专用 BYOK 文件和私有回滚数据中保存供应商密钥。")}</p><p>${tr("请在每个 IDE 中通过 Tools > GitHub Copilot > Login to GitHub 登录并核对账号。")}</p></details>
      <p><a href="https://plugins.jetbrains.com/plugin/17718-github-copilot" target="_blank" rel="noreferrer">${tr("官方插件")}</a> · <a href="https://github.blog/changelog/2026-07-14-github-copilot-for-jetbrains-expands-byok-capabilities/" target="_blank" rel="noreferrer">${tr("官方自定义端点说明")}</a></p>`;
  }
  return { guide };
});

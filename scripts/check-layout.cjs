// Isolated browser layout regression. Fictional providers, no keys, no native IPC.
// --capture-only preserves a baseline without applying the new layout assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.COPILOT_BYOK_MANAGER_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '../apps/desktop/web');
const output = path.resolve(process.env.COPILOT_BYOK_MANAGER_CAPTURE_DIR || 'target/layout-review');
const captureOnly = process.argv.includes('--capture-only');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});

function seedPreview() {
  const now = '2026-10-16T00:00:00Z';
  const model = (name, index) => ({ id: `example-${index}`, modelId: `example-${index}`, name, enabled: true, capabilities: { toolCalling: true, vision: null, reasoning: null, contextWindow: null, maxOutputTokens: null } });
  const provider = (id, name, models, enabled = true) => ({ id, name, enabled, baseUrl: `https://${id}.example.com/v1`, providerKind: 'openai', protocol: 'chat-completions', headers: {}, models: models.map(model), secretRef: null, hasSecret: false, createdAt: now, updatedAt: now });
  sessionStorage.setItem('copilot-byok-manager-demo', JSON.stringify({ version: 2, statePath: 'Browser preview — simulated data only', stateRecovery: null,
    usageDb: { state: 'unavailable', detail: 'Preview only', path: null, schemaVersion: null },
    connections: [
      provider('northstar', 'Northstar', ['Example Code', 'Example Chat']),
      provider('team', 'Team Gateway · Development & Research', ['Example Reasoning Extended', 'Example Code', 'Example Vision', 'Example Chat']),
      provider('local', 'Local Lab', ['Local Code']),
      provider('archive', 'Archive Sandbox', ['Example Chat'], false),
    ],
    clients: [
      { id: 'vscode:stable:default', kind: 'vs-code-copilot', name: 'VS Code · Default', detail: 'Example workspace profile. Other provider groups are preserved when publishing this configuration.', path: 'Example VS Code profile', detected: true, supportsWrite: true, status: 'available' },
      { id: 'copilot-cli:user-environment', kind: 'copilot-cli', name: 'GitHub Copilot CLI', detail: 'Example single environment route.', path: 'Example CLI environment', detected: true, supportsWrite: true, status: 'available' },
      { id: 'github-copilot-app:local', kind: 'github-copilot-app', name: 'GitHub Copilot App', detail: 'Example installation. Provider setup is manual; no private application stores are accessed.', path: 'Example App installation', detected: true, supportsWrite: false, status: 'read-only' },
      { id: 'jetbrains:example', kind: 'jetbrains-copilot', name: 'JetBrains · Example Profile', detail: 'Example unavailable profile.', path: 'No real IDE is used in this preview', detected: false, supportsWrite: false, status: 'not-installed' },
    ], deployments: [], publishedSources: [],
  }));
}

async function visit(page, route) {
  await page.locator(`#primary-nav [data-route="${route}"]`).click();
  await page.locator(`#content[data-route="${route}"]`).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function checkLayout(page, context) {
  const failures = await page.evaluate(() => {
    const errors = [];
    const box = node => node.getBoundingClientRect();
    const near = (a, b) => Math.abs(a - b) <= 1;
    if (document.documentElement.scrollWidth > innerWidth) errors.push('horizontal page overflow');
    const header = ['.brand', '#primary-nav', '.sidebar-footer'].map(selector => box(document.querySelector(selector)));
    header.forEach((rect, index) => {
      if (rect.x < 0 || rect.right > innerWidth) errors.push('header outside viewport');
      if (index && header[index - 1].right > rect.x) errors.push('header overlap');
    });
    const controls = [...document.querySelectorAll('.topbar-actions select, .topbar-actions > .button')].filter(node => !node.hidden && box(node).width);
    if (controls.some(node => !near(box(node).bottom, box(controls[0]).bottom))) errors.push('toolbar controls not bottom-aligned');
    if (controls.some(node => !near(box(node).height, box(controls[0]).height))) errors.push('toolbar control heights differ');
    const title = box(document.querySelector('.topbar > div:first-child'));
    if (title.right > box(document.querySelector('.topbar-actions')).left) errors.push('page title overlaps toolbar');
    const left = box(document.querySelector('.content')).left + parseFloat(getComputedStyle(document.querySelector('.content')).paddingLeft);
    if (!near(left, header[0].left) || !near(left, title.left)) errors.push('header and content gutters differ');
    for (const node of document.querySelectorAll('.app-configuration')) {
      const select = node.querySelector('select'), button = node.querySelector('button');
      if (select && button && (!near(box(select).height, box(button).height) || !near(box(select).bottom, box(button).bottom))) errors.push('app selector and action not aligned');
    }
    for (const selector of ['.card-grid > .manager-connection', '.client-grid > .client-card']) {
      const cards = [...document.querySelectorAll(selector)];
      for (let index = 1; index < cards.length; index++) {
        const previous = cards[index - 1], card = cards[index];
        if (!near(box(previous).top, box(card).top)) continue;
        if (!near(box(previous).bottom, box(card).bottom)) errors.push(`${selector}: card heights differ`);
        const action = card.querySelector('[data-action="deploy-connection"], [data-action="deploy-client"]');
        const priorAction = previous.querySelector('[data-action="deploy-connection"], [data-action="deploy-client"]');
        if (action && priorAction && !near(box(action).bottom, box(priorAction).bottom)) errors.push(`${selector}: primary actions not aligned`);
        const select = card.querySelector('.app-provider-select'), priorSelect = previous.querySelector('.app-provider-select');
        if (select && priorSelect && !near(box(select).bottom, box(priorSelect).bottom)) errors.push('app selectors not aligned');
      }
    }
    for (const node of document.querySelectorAll('.manager-connection, .client-card, .core-about, .manager-inline-preview, .modal')) {
      if (node.scrollWidth > node.clientWidth + 1) errors.push(`${node.className}: internal horizontal overflow`);
    }
    return errors;
  });
  assert.deepEqual(failures, [], context);
}

async function checkEditor(page, locale) {
  await visit(page, 'connections');
  await page.locator('[data-action="edit-connection"]').first().click();
  const draft = 'Example Provider · A long fictional team name for layout regression';
  await page.locator('#connection-name').fill(draft);
  for (const theme of ['light', 'dark']) {
    // The background is inert while editing. Change appearance via the same CSS-only
    // controller, never by bypassing a disabled native operation.
    await page.evaluate(theme => window.CopilotBYOKManagerAppearance.set(theme), theme);
    for (const width of [960, 1180]) {
      await page.setViewportSize({ width, height: width === 960 ? 640 : 860 });
      await page.locator('.connection-advanced').evaluate(node => { node.open = true; });
      await page.locator('#headers').focus();
      const geometry = await page.locator('.modal').evaluate(modal => {
        const box = node => node.getBoundingClientRect();
        const header = box(modal.querySelector('.modal-header')), footer = box(modal.querySelector('.modal-footer'));
        const body = box(modal.querySelector('.modal-body')), field = box(modal.querySelector('#headers'));
        return { visible: header.top >= 0 && footer.bottom <= innerHeight && body.top >= header.bottom && body.bottom <= footer.top,
          fieldVisible: field.top >= body.top - 1 && field.bottom <= body.bottom + 1,
          overflow: modal.scrollWidth > modal.clientWidth || modal.querySelector('.modal-body').scrollWidth > modal.querySelector('.modal-body').clientWidth };
      });
      assert.deepEqual(geometry, { visible: true, fieldVisible: true, overflow: false }, `${locale}/${theme}/${width}/editor`);
      assert.equal(await page.locator('#connection-name').inputValue(), draft);
      assert.equal(await page.locator('#api-key').inputValue(), '');
    }
  }
  await page.keyboard.press('Escape');
  await page.locator('[data-keep-editing]').click();
  assert.equal(await page.locator('#connection-name').inputValue(), draft);
  await page.locator('#save-connection').click();
  await page.locator('.modal').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.manager-connection[data-connection-id="northstar"] h3').textContent(), draft);
  await page.setViewportSize({ width: 960, height: 640 });
  await checkLayout(page, `${locale}/saved-long-name`);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.COPILOT_BYOK_MANAGER_BROWSER });
  fs.mkdirSync(output, { recursive: true });
  const errors = [];
  let checks = 0;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const locale of ['zh-CN', 'en']) {
      const context = await browser.newContext({ locale, viewport: { width: 1180, height: 860 }, colorScheme: 'light', timezoneId: 'UTC' });
      await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(seedPreview);
      await page.goto(origin); await page.locator('.preview-banner').waitFor();
      await page.locator('#interface-language').selectOption(locale);
      assert.equal(await page.evaluate(() => Boolean(window.__TAURI__)), false);
      for (const theme of ['light', 'dark']) {
        await page.locator('#interface-theme').selectOption(theme);
        for (const route of ['overview', 'connections', 'clients', 'about']) {
          await visit(page, route);
          await page.screenshot({ path: path.join(output, `${route}-${locale}-${theme}.png`), animations: 'disabled' });
          if (!captureOnly) {
            for (const width of [960, 1180, 1440]) {
              await page.setViewportSize({ width, height: width === 960 ? 640 : 860 });
              await checkLayout(page, `${locale}/${theme}/${route}/${width}`); checks++;
            }
            await page.setViewportSize({ width: 1180, height: 860 });
          }
        }
      }
      await page.locator('#interface-theme').selectOption('light');
      await visit(page, 'connections');
      await page.locator('[data-action="edit-connection"]').first().click();
      assert.equal(await page.locator('#api-key').inputValue(), '');
      await page.screenshot({ path: path.join(output, `editor-${locale}.png`), animations: 'disabled' });
      await page.keyboard.press('Escape');
      await visit(page, 'clients');
      await page.locator('.app-provider-select').first().selectOption('northstar');
      await page.locator('[data-action="deploy-client"]').first().click();
      await page.locator('#preview-deployment').click();
      await page.locator('#deployment-preview .manager-operation').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('#apply-deployment').disabled);
      await page.locator('#inline-deployment').screenshot({ path: path.join(output, `publication-${locale}.png`), animations: 'disabled' });
      // Preview only. Never Apply, contact providers, install clients or use native IPC.
      if (!captureOnly) await checkLayout(page, `${locale}/publication`);
      if (!captureOnly) {
        await checkEditor(page, locale);
        await visit(page, 'about');
        // Render the native-only About fields from synthetic observations, without
        // registering a native bridge or reading the machine's window preferences.
        await page.evaluate(() => {
          document.querySelector('#content').innerHTML = window.CopilotBYOKManagerCore.about(
            { statePath: 'Example local state', version: 2 },
            { windowBehavior: { preferencesAvailable: true, trayAvailable: true, closeToTray: true, closeAction: 'tray' } },
            true, { manual: '#', 'manual-zh': '#', issues: '#' });
        });
        await checkLayout(page, `${locale}/synthetic-window-preferences`);
        assert.equal(await page.locator('[data-close-action]').isEnabled(), true);
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(`Captured 20 screenshots with fictional, key-free data. ${captureOnly ? 'Baseline only; layout assertions not run.' : `${checks} page/locale/theme/viewport checks plus editor, long-name, preview and synthetic window-preference checks passed.`}`);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });

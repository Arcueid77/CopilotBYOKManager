// Reproducible documentation capture of the CURRENT browser fallback, not native
// client acceptance. A new browser context and fake, key-free session data only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.COPILOT_BYOK_MANAGER_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '../apps/desktop/web');
const output = path.resolve(__dirname, '../docs/images');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
function seedPreview() {
  const now = '2026-11-03T00:00:00Z';
  const model = (id, name) => ({ id, modelId: id, name, enabled: true, capabilities: { toolCalling: true, vision: null, reasoning: null, contextWindow: null, maxOutputTokens: null } });
  sessionStorage.setItem('copilot-byok-manager-demo', JSON.stringify({ version: 2, statePath: 'Browser preview — simulated data only', stateRecovery: null,
    usageDb: { state: 'unavailable', detail: 'Preview only', path: null, schemaVersion: null },
    connections: [{ id: 'example-provider', name: 'Example Provider', enabled: true, baseUrl: 'https://api.example.com/v1', providerKind: 'openai', protocol: 'chat-completions', headers: {}, models: [model('example-code', 'Example Code'), model('example-chat', 'Example Chat')], secretRef: null, hasSecret: false, createdAt: now, updatedAt: now }],
    clients: [
      { id: 'vscode:stable:default', kind: 'vs-code-copilot', name: 'VS Code · Default', detail: 'Simulated profile', path: 'Example VS Code profile', detected: true, supportsWrite: true, status: 'available' },
      { id: 'copilot-cli:user-environment', kind: 'copilot-cli', name: 'GitHub Copilot CLI', detail: 'Simulated multi-provider registry', path: '~/.copilot/providers.json', detected: true, supportsWrite: true, status: 'available' },
      { id: 'github-copilot-app:local', kind: 'github-copilot-app', name: 'GitHub Copilot App', detail: 'Manual guidance only', path: 'Example App installation', detected: true, supportsWrite: false, status: 'read-only' },
      { id: 'jetbrains:local', kind: 'jetbrains-copilot', name: 'JetBrains GitHub Copilot', detail: 'Synthetic missing profile', path: null, detected: false, supportsWrite: false, status: 'not-installed' },
    ], deployments: [], clientConfigurations: [
      { targetId: 'vscode:stable:default', state: 'available', sources: [{ connectionId: 'example-provider', name: 'Example Provider', modelCount: 2 }] },
      { targetId: 'copilot-cli:user-environment', state: 'available', sources: [{ connectionId: 'example-provider', name: 'Example Provider', modelCount: 2 }] },
    ],
  }));
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.COPILOT_BYOK_MANAGER_BROWSER });
  const errors = [];
  fs.mkdirSync(output, { recursive: true });
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const locale of ['en', 'zh-CN']) {
      const context = await browser.newContext({ locale, viewport: { width: 1440, height: 1024 }, colorScheme: 'light' });
      await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(seedPreview);
      const visit = async route => {
        await page.locator(`#primary-nav [data-route="${route}"]`).click();
        await page.locator(`#content[data-route="${route}"]`).waitFor();
      };
      const theme = async value => { await visit('about'); await page.locator(`[data-theme-value][data-value="${value}"]`).click(); await visit('overview'); };
      await page.goto(origin); await page.locator('.preview-banner').waitFor();
      await visit('about'); await page.locator('[data-interface-language]').selectOption(locale);
      await theme('light');
      await page.locator('.app-status-list .status-row').first().waitFor();
      assert.equal(await page.evaluate(() => Boolean(window.__TAURI__)), false);
      await page.locator('.brand-mark').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.brand-mark').evaluate(image => image.complete && image.naturalWidth === 256), true);
      for (const mode of ['light', 'dark', 'system']) {
        await theme(mode);
        for (const width of [960, 1180, 1440]) {
          await page.setViewportSize({ width, height: 1024 });
          const boxes = await Promise.all(['.brand', '#primary-nav', '.sidebar-footer'].map(selector => page.locator(selector).boundingBox()));
          assert.ok(boxes.every(Boolean), `${locale}/${mode}/${width}: sidebar elements must remain visible`);
          for (let index = 0; index < boxes.length; index++) {
            assert.ok(boxes[index].x >= 0 && boxes[index].x + boxes[index].width <= width, `${locale}/${mode}/${width}: sidebar overflow`);
            if (index > 0) assert.ok(boxes[index - 1].y + boxes[index - 1].height <= boxes[index].y, `${locale}/${mode}/${width}: sidebar overlap`);
          }
        }
      }
      await page.setViewportSize({ width: 1440, height: 1024 }); await theme('light');
      await page.screenshot({ path: path.join(output, `overview-${locale}.png`) });
      await page.locator('#primary-nav [data-route="connections"]').click();
      await page.locator('.provider-detail-header [data-action="edit-connection"]').click();
      assert.equal(await page.locator('#api-key').inputValue(), '');
      assert.equal(await page.locator('#connection-name').inputValue(), 'Example Provider');
      await page.screenshot({ path: path.join(output, `provider-${locale}.png`), fullPage: false });
      await page.keyboard.press('Escape');
      await theme('dark'); await visit('connections');
      await page.locator('.provider-detail [data-action="deploy-connection"]').click();
      await page.locator('#preview-deployment').click();
      await page.locator('#deployment-preview .manager-operation').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('#apply-deployment').disabled);
      await page.locator('#deployment-preview summary').first().click();
      await page.locator('#inline-deployment').scrollIntoViewIfNeeded();
      await page.locator('.modal').screenshot({ path: path.join(output, `publication-${locale}.png`) });
      // Do not press Apply: screenshots demonstrate review, never request success.
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('Verified the icon/header in 18 locale/theme/width combinations; captured six current-browser preview screenshots with synthetic providers and no keys.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });

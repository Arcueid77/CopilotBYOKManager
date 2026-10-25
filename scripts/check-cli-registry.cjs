// Optional upstream contract smoke. Explicit pinned Windows CLI, loopback only,
// empty synthetic home/environment, fake keys, no client auth or installations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const binary = process.env.COPILOT_BYOK_MANAGER_CLI_TEST_BINARY;
const digest = '76326203b73b12b5ef02d1061110dc27df52b24fa349f2af4380062fc4f5401b';
assert.equal(process.platform, 'win32', 'This pinned artifact is Windows x64');
assert.ok(binary && path.isAbsolute(binary), 'Set COPILOT_BYOK_MANAGER_CLI_TEST_BINARY to the isolated official 1.0.101 copilot.exe');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex'), digest, 'Pinned official binary digest');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-byok-manager-registry-'));
const requests = [];
const server = http.createServer((req, res) => {
  let size = 0, body = '';
  req.on('data', data => { size += data.length; if (size > 1024 * 1024) req.destroy(); else body += data; });
  req.on('end', () => {
    if (req.url !== '/v1/chat/completions') { res.writeHead(404).end(); return; }
    try {
      const value = JSON.parse(body);
      requests.push({ model: value.model, provider: req.headers['x-fixture'], key: req.headers.authorization === 'Bearer fixture-only' });
    } catch { res.writeHead(400).end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end('data: {"id":"fixture","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"OK"},"finish_reason":null}]}\n\ndata: {"id":"fixture","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\ndata: [DONE]\n\n');
  });
});
async function run(name, config, selected, expected) {
  const home = path.join(root, name); fs.mkdirSync(home);
  fs.writeFileSync(path.join(home, 'providers.json'), JSON.stringify(config));
  const env = { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, TEMP: home, TMP: home,
    USERPROFILE: home, HOME: home, APPDATA: home, LOCALAPPDATA: home,
    COPILOT_HOME: home, COPILOT_CACHE_HOME: home, COPILOT_OFFLINE: 'true', COPILOT_AUTO_UPDATE: 'false', DO_NOT_TRACK: '1', NO_COLOR: '1' };
  const offset = requests.length;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(binary, ['--no-auto-update', '--model', selected, '--prompt', 'Reply OK', '--disable-builtin-mcps', '--no-custom-instructions', '--silent'], { env, cwd: home, windowsHide: true });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Isolated CLI timed out')); }, 30000);
    const collect = data => { if (output.length < 65536) output += data; };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, output }); });
  });
  if (expected) {
    assert.equal(result.code, 0, `${name}: expected successful CLI exit`);
    assert.match(result.output, /OK/);
    assert.deepEqual(requests.slice(offset), [expected]);
  } else {
    assert.notEqual(result.code, 0);
    assert.match(result.output, /`providers` is not an array/);
    assert.equal(requests.length, offset);
  }
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const provider = name => ({ name, type: 'openai', wireApi: 'completions', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, apiKey: 'fixture-only', headers: { 'X-Fixture': name } });
    const model = (provider, id, wireModel) => ({ id, provider, modelId: id, wireModel, name: `${provider} · ${id}`, maxContextWindowTokens: 128000, maxOutputTokens: 8192, capabilities: { supports: { vision: false, toolCalls: true } } });
    const config = { providers: [provider('alpha'), provider('beta')], models: [model('alpha', 'shared-model', 'alpha-wire'), model('alpha', 'org/code:latest', 'alpha-colon-wire'), model('beta', 'shared-model', 'beta-wire')] };
    await run('alpha-shared', config, 'alpha/shared-model', { model: 'alpha-wire', provider: 'alpha', key: true });
    await run('alpha-qualified', config, 'alpha/org/code:latest', { model: 'alpha-colon-wire', provider: 'alpha', key: true });
    await run('beta-shared', config, 'beta/shared-model', { model: 'beta-wire', provider: 'beta', key: true });
    await run('invalid-map', { providers: { alpha: provider('alpha') }, models: [] }, 'alpha/shared-model', null);
    console.log(JSON.stringify({ status: 'passed', cli: '1.0.101', sha256: digest, syntheticRequests: requests.length, cases: 4, output: root }));
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });

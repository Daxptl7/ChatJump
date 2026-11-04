import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'vite';
import { chromium } from 'playwright';

// Compile a test-only adapter harness separately. It can never enter the WXT output.
const temporary = mkdtempSync(resolve(tmpdir(), 'chatjump-phase2-'));
await build({ configFile: false, logLevel: 'error', build: {
  outDir: resolve(temporary, 'bundle'), minify: false,
  lib: { entry: resolve('tests/browser/adapter-entry.ts'), name: 'ChatJumpPhase2Test', formats: ['iife'], fileName: () => 'adapter.js' },
  rollupOptions: { output: { footer: 'globalThis.ChatJumpPhase2Test = ChatJumpPhase2Test;' } },
} });
const code = readFileSync(resolve(temporary, 'bundle/adapter.js'), 'utf8');
const context = await chromium.launchPersistentContext(resolve(temporary, 'profile'), { channel: 'chromium', headless: true });
try {
  // A synthetic URL supplies routing context; no account, remote API, or private traffic exists.
  await context.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><main><section data-test-conversation data-test-key="synthetic-one"><div data-test-list style="height:120px;overflow-y:auto"><article data-test-message style="height:80px"><p>Synthetic body not collected</p><time datetime="2026-11-04"></time></article><article data-test-message style="height:80px"><time datetime="2026-10-15"></time></article></div></section></main>' }));
  const tab = context.pages()[0]; await tab.goto('https://www.instagram.com/direct/t/synthetic-phase2/');
  const cdp = await context.newCDPSession(tab);
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'chatjump-phase2-synthetic-test' });
  async function evaluate(expression) {
    const response = await cdp.send('Runtime.evaluate', { expression, contextId: executionContextId, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error('Isolated test adapter evaluation failed');
    return response.result.value;
  }
  await evaluate(code);
  await evaluate('globalThis.adapter = ChatJumpPhase2Test.create(); globalThis.stop = adapter.observeMessages(() => {});');
  const initial = await evaluate('adapter.getSnapshot()');
  assert.equal(initial.renderedMessageCount, 2); assert.equal(initial.datedMessageCount, 2); assert.equal(initial.earliestRenderedDate, '2026-10-15'); assert.equal(initial.scrollable, true); assert.equal(initial.olderDirection, 'unknown');
  const scrollBefore = await tab.locator('[data-test-list]').evaluate((element) => element.scrollTop);
  await tab.locator('[data-test-list]').evaluate((list) => {
    const article = document.createElement('article'); article.setAttribute('data-test-message', ''); article.innerHTML = '<time datetime="2026-01-01"></time>'; list.append(article);
  });
  await tab.waitForFunction(() => document.querySelectorAll('[data-test-message]').length === 3);
  // Wait for the real MutationObserver's bounded 100ms coalescing interval.
  await evaluate('new Promise(resolve => setTimeout(resolve, 160))');
  assert.equal(await evaluate('adapter.getSnapshot().earliestRenderedDate'), '2026-01-01');
  await tab.locator('[data-test-message]').last().evaluate((element) => element.remove());
  await evaluate('new Promise(resolve => setTimeout(resolve, 160))');
  const removed = await evaluate('adapter.getSnapshot()'); assert.equal(removed.renderedMessageCount, 2); assert.equal(removed.virtualizationSuspected, true); assert.equal(removed.earliestRenderedDate, '2026-10-15');
  await tab.locator('[data-test-conversation]').evaluate((root) => { root.setAttribute('data-test-key', 'synthetic-two'); root.querySelector('time').setAttribute('datetime', '2026-02-01'); });
  const switched = await evaluate('adapter.getSnapshot()'); assert.equal(switched.virtualizationSuspected, false); assert.equal(switched.earliestRenderedDate, '2026-02-01');
  assert.equal(await tab.locator('[data-test-list]').evaluate((element) => element.scrollTop), scrollBefore);
  const diagnostics = await evaluate('adapter.getDiagnostics()');
  assert.equal(diagnostics.metrics.activeObservers, 1);
  assert.equal(/synthetic-one|synthetic-two|Synthetic body/.test(JSON.stringify([initial, removed, switched, diagnostics])), false);
  await evaluate('stop(); adapter.cleanup();'); assert.equal(await evaluate('adapter.getDiagnostics().metrics.activeObservers'), 0);
  const results = { browser: context.browser().version(), environment: 'Synthetic DOM in isolated world; no live Instagram account', initial, afterRemoval: removed, afterSwitch: switched, metrics: diagnostics.metrics, automaticScrolling: false, cleanupObservers: 0, liveInstagram: 'NOT TESTED' };
  mkdirSync('artifacts', { recursive: true }); writeFileSync('artifacts/phase2-browser-results.json', JSON.stringify(results, null, 2) + '\n'); console.info(JSON.stringify(results, null, 2));
} finally { await context.close(); }

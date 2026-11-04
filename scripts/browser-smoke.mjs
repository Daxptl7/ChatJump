import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { attachPopup } from './popup-session.mjs';

// A disposable profile and synthetic network fixtures; never a developer's logged-in profile.
const extensionPath = resolve('.output/chrome-mv3');
const manifest = JSON.parse(readFileSync(resolve(extensionPath, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['activeTab']);
assert.deepEqual(manifest.content_scripts.flatMap((script) => script.matches), ['https://www.instagram.com/*']);
assert.equal(manifest.background, undefined);
const profile = mkdtempSync(resolve(tmpdir(), 'chatjump-browser-'));
mkdirSync('artifacts', { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true,
  args: ['--enable-unsafe-extension-debugging'],
  ignoreDefaultArgs: ['--disable-extensions'],
  viewport: { width: 800, height: 700 },
});

const results = { browser: context.browser().version(), environment: 'isolated Chromium; synthetic fixture, not live Instagram', checks: [] };
try {
  // No private traffic exists in this new profile. Fulfill only test documents and block outside requests.
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === 'https://www.instagram.com/__chatjump_phase1_fixture__/' || url === 'https://www.instagram.com/direct/t/chatjump-phase2-fixture/' || url === 'https://example.test/chatjump-fixture/') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>ChatJump synthetic browser fixture</title><main><h1>Controlled fixture</h1><p>No account or chat data.</p></main>' });
    } else if (url.startsWith('chrome-extension:')) await route.continue();
    else await route.abort();
  });
  const cdp = await context.browser().newBrowserCDPSession();
  let { id } = await cdp.send('Extensions.loadUnpacked', { path: extensionPath });
  const tab = context.pages()[0] ?? await context.newPage();
  await tab.goto('https://www.instagram.com/__chatjump_phase1_fixture__/');
  const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
  assert.equal(targetInfos.length, 1, 'The isolated profile must contain exactly one test tab');
  const targetInfo = targetInfos[0];

  async function openPopup() {
    await tab.bringToFront();
    await cdp.send('Extensions.triggerAction', { id, targetId: targetInfo.targetId });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const { targetInfos: targets } = await cdp.send('Target.getTargets', { filter: [{}] });
      const target = targets.find((item) => item.type === 'page' && item.url === `chrome-extension://${id}/${manifest.action.default_popup}`);
      if (target) return attachPopup(cdp, target.targetId);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Chrome did not open the extension action popup');
  }
  const connected = (popup) => popup.until(() => document.querySelector('[role="status"]')?.textContent === 'Connected', 'content-script handshake');
  const setDate = (popup, date) => popup.evaluate((value) => {
    const input = document.querySelector('input[type="date"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, date);
  async function screenshot(popup, path) {
    const rect = await popup.evaluate(() => { const r = document.querySelector('.popup-shell').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 }; });
    const { data } = await popup.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: rect });
    writeFileSync(path, Buffer.from(data, 'base64'));
  }
  let popup = await openPopup(); await connected(popup);
  await popup.until(() => document.documentElement.clientWidth >= 360 && document.documentElement.scrollWidth <= document.documentElement.clientWidth, 'native popup sizing');
  results.checks.push('Actual toolbar popup opened; declarative content script and runtime handshake passed on synthetic Instagram-origin fixture');
  await popup.until(() => [...document.querySelectorAll('[role="status"]')].some((element) => element.textContent === 'No conversation selected'), 'non-DM conversation metadata');
  const summary = await popup.evaluate(async () => {
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return chrome.tabs.sendMessage(active.id, { type: 'GET_CONVERSATION_STATUS' }, { frameId: 0 });
  });
  assert.equal(summary.type, 'GET_CONVERSATION_STATUS'); assert.equal(summary.snapshot.status, 'not-open'); assert.equal(summary.snapshot.renderedMessageCount, undefined);
  assert.equal(await popup.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Search Messages').disabled), true);
  await popup.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Check Connection').click());
  await connected(popup);
  await setDate(popup, '2024-02-29');
  assert.equal(await popup.evaluate(() => document.querySelector('input').value), '2024-02-29');
  await screenshot(popup, 'artifacts/popup-connected.png');
  await setDate(popup, '9999-12-31');
  await popup.until(() => document.querySelector('[role="alert"]')?.textContent === 'Choose today or an earlier date.', 'future-date validation');
  results.checks.push('Native date selection, future-date rejection, connection recheck, and disabled historical search passed');
  const design = await popup.evaluate(() => ({
    squareButtons: [...document.querySelectorAll('button')].every((button) => getComputedStyle(button).borderRadius === '0px'),
    gradients: [...document.querySelectorAll('*')].some((element) => /gradient\(/i.test(getComputedStyle(element).backgroundImage)),
    width: document.querySelector('.popup-shell').getBoundingClientRect().width,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  assert.equal(design.squareButtons, true); assert.equal(design.gradients, false); assert.equal(design.width, 360); assert.equal(design.overflow, false);
  await popup.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Check Connection').focus());
  await popup.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await popup.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await popup.evaluate(() => document.activeElement === document.querySelector('input')), true);
  assert.equal(await popup.evaluate(() => getComputedStyle(document.querySelector('input')).outlineStyle), 'solid');
  results.checks.push('360px native popup layout, no horizontal overflow, zero-radius buttons, no gradients, keyboard focus, and visible focus outline passed');
  await popup.close();
  await tab.reload(); popup = await openPopup(); await connected(popup); await popup.close();
  results.checks.push('Connection re-established after fixture tab reload');
  await tab.goto('https://www.instagram.com/direct/t/chatjump-phase2-fixture/');
  popup = await openPopup(); await connected(popup);
  await popup.until(() => [...document.querySelectorAll('[role="status"]')].some((element) => element.textContent === 'Unsupported layout'), 'unverified DM selector safety');
  await screenshot(popup, 'artifacts/popup-phase2-unverified.png'); await popup.close();
  results.checks.push('Phase 2 summary requests work; non-DM and unverified DM layouts expose no fabricated message counts');
  await tab.goto('https://example.test/chatjump-fixture/');
  popup = await openPopup(); await popup.until(() => document.querySelector('[role="status"]')?.textContent === 'Not on Instagram', 'unsupported active site');
  await screenshot(popup, 'artifacts/popup-unsupported.png'); await popup.close();
  results.checks.push('Unsupported active site accurately reported after action invocation');
  await tab.goto('https://www.instagram.com/__chatjump_phase1_fixture__/');
  await cdp.send('Extensions.uninstall', { id });
  ({ id } = await cdp.send('Extensions.loadUnpacked', { path: extensionPath }));
  popup = await openPopup();
  await popup.until(() => document.querySelector('[role="status"]')?.textContent === 'Instagram tab detected but script unavailable', 'missing script after extension reinstall');
  await popup.close();
  await tab.reload(); popup = await openPopup(); await connected(popup); await popup.close();
  results.checks.push('Extension reinstall requires tab reload; unavailable state and recovery passed');
  // Native action popups do not support viewport emulation. Check 320px rendering
  // using the same built extension document in a regular extension tab instead.
  const narrow = await context.newPage();
  await narrow.setViewportSize({ width: 320, height: 700 });
  await narrow.goto(`chrome-extension://${id}/${manifest.action.default_popup}`);
  await narrow.waitForFunction(() => document.querySelector('.popup-shell')?.getBoundingClientRect().width === 320 && document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  await narrow.close();
  results.checks.push('Same popup document fits a 320px extension-tab viewport without horizontal overflow');
  results.liveInstagram = 'NOT TESTED';
  writeFileSync('artifacts/browser-results.json', JSON.stringify(results, null, 2) + '\n');
  console.info(JSON.stringify(results, null, 2));
} finally {
  await context.close();
}

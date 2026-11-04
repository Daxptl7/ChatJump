import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { attachPopup } from './popup-session.mjs';

// Requires the local WXT dev server. Never uses a personal browser profile.
const source = resolve('src/components/Header.tsx');
const original = readFileSync(source, 'utf8');
const edited = original.replace('ChatJump</h1>', 'ChatJump HMR check</h1>');
assert.notEqual(edited, original);
const context = await chromium.launchPersistentContext(mkdtempSync(resolve(tmpdir(), 'chatjump-hmr-')), {
  channel: 'chromium', headless: true, args: ['--enable-unsafe-extension-debugging'], ignoreDefaultArgs: ['--disable-extensions'],
});
let changed = false;
try {
  await context.route('https://www.instagram.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Synthetic HMR fixture</title>' }));
  const cdp = await context.browser().newBrowserCDPSession();
  const { id } = await cdp.send('Extensions.loadUnpacked', { path: resolve('.output/chrome-mv3-dev') });
  const tab = context.pages()[0]; await tab.goto('https://www.instagram.com/__chatjump_phase1_fixture__/');
  const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
  await cdp.send('Extensions.triggerAction', { id, targetId: targetInfos[0].targetId });
  let target;
  for (let attempt = 0; attempt < 100 && !target; attempt++) {
    target = (await cdp.send('Target.getTargets', { filter: [{}] })).targetInfos.find((item) => item.type === 'page' && item.url === `chrome-extension://${id}/popup.html`);
    if (!target) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(target);
  const popup = await attachPopup(cdp, target.targetId);
  await popup.until(() => document.querySelector('h1')?.textContent === 'ChatJump', 'development React render');
  writeFileSync(source, edited); changed = true;
  await popup.until(() => document.querySelector('h1')?.textContent === 'ChatJump HMR check', 'React hot reload');
  assert.equal(readFileSync(source, 'utf8'), edited, 'Source changed during the hot-reload test; do not overwrite it');
  writeFileSync(source, original); changed = false;
  await popup.until(() => document.querySelector('h1')?.textContent === 'ChatJump', 'restored source hot reload');
  await popup.close();
  console.info('Development popup rendered and React hot reload passed in Chromium; source restored.');
} finally {
  if (changed && readFileSync(source, 'utf8') === edited) writeFileSync(source, original);
  await context.close();
}

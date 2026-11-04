import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// Entirely synthetic: this URL supplies parsing context, not a network connection.
const dom = new JSDOM('<!doctype html><body><section data-thread="synthetic"><article><time datetime="2026-11-04"></time></article></section></body>', {
  url: 'https://www.instagram.com/direct/t/synthetic/',
  runScripts: 'outside-only',
});

try {
  dom.window.eval(readFileSync(new URL('../dist/chatjump-phase0.js', import.meta.url), 'utf8'));
  const api = dom.window.ChatJumpPhase0;
  assert.equal(typeof api.searchDate, 'function');
  const unverified = await api.searchDate('2026-11-04', { adapter: api.unverifiedAdapter, timeZone: 'UTC' });
  assert.equal(unverified.result.reason, 'adapter-unverified');
  let scrolled = false;
  dom.window.HTMLElement.prototype.scrollIntoView = () => { scrolled = true; };
  const adapter = api.createManualAttributeAdapter({
    verification: 'manual', conversationSelector: 'section[data-thread]', conversationKeyAttribute: 'data-thread',
    messageSelector: 'article', scrollSelector: ':scope', olderDirection: 'up', datetimeAssociationVerified: true,
  });
  const run = await api.searchDate('2026-11-04', { adapter, timeZone: 'UTC', doc: dom.window.document });
  assert.equal(run.result.status, 'found');
  assert.equal(run.result.scrollAttempts, 0);
  assert.equal(scrolled, true);
  assert.equal(run.benchmark.timestampsDetected, 1);
  const panel = api.mountDeveloperPanel({ adapter, timeZone: 'UTC', doc: dom.window.document });
  assert.ok(panel.element.shadowRoot.querySelector('#start'));
  panel.remove();
  assert.equal(panel.element.isConnected, false);
  console.info('Synthetic bundle smoke passed (jsdom; live Instagram NOT TESTED).');
} finally {
  dom.window.close();
}

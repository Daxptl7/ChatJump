import { searchDate } from './dateSearch';
import type { DateSearchOptions, SearchRun } from './dateSearch';
import { dateInZone } from './timestampDetector';

export interface DeveloperPanel { remove: () => void; element: HTMLElement }
const panels = new WeakMap<Document, DeveloperPanel>();

/** A narrow, movable panel in a ShadowRoot keeps host button styles out of this UI. */
export function mountDeveloperPanel(options: DateSearchOptions, onResult?: (run: SearchRun) => void): DeveloperPanel {
  const doc = options.doc ?? document;
  panels.get(doc)?.remove();
  const host = doc.createElement('aside');
  host.setAttribute('aria-label', 'ChatJump Phase 0 developer experiment');
  host.style.cssText = 'position:fixed;right:8px;bottom:8px;width:min(300px,calc(100vw - 16px));z-index:2147483647;color-scheme:light;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { color: #171717; font-family: Arial, sans-serif; font-size: 14px; }
      * { box-sizing: border-box; }
      .panel { background: #FFFFFF; color: #171717; border: 1px solid #E5E5E5; padding: 12px; max-height: calc(100vh - 16px); overflow-y: auto; }
      h2 { font-size: 16px; margin: 0 0 8px; }
      p { line-height: 1.4; margin: 8px 0; overflow-wrap: anywhere; }
      .muted { color: #666666; }
      label { display: block; margin-bottom: 6px; }
      input { width: 100%; border: 1px solid #E5E5E5; border-radius: 0; padding: 8px; background: #FFFFFF; color: #171717; font: inherit; }
      button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"] { border-radius: 0 !important; }
      button { background: #171717; color: #FFFFFF; border: 1px solid #171717; padding: 8px 10px; font: inherit; cursor: pointer; }
      button.secondary { background: #F5F5F5; color: #171717; border-color: #E5E5E5; }
      button:disabled { background: #F5F5F5; color: #666666; border-color: #E5E5E5; cursor: default; }
      button:focus-visible, input:focus-visible { outline: 2px solid #171717; outline-offset: 2px; }
      .controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .error { color: #B42318; } .success { color: #16703C; }
    </style>
    <section class="panel">
      <h2>ChatJump · Phase 0</h2>
      <p class="muted">Local developer experiment. Live support unverified.</p>
      <label for="target">Message date</label><input id="target" type="date" required>
      <p class="muted" id="zone"></p>
      <div class="controls"><button id="start" type="button">Start Search</button><button id="cancel" class="secondary" type="button" disabled>Cancel</button></div>
      <p id="status" role="status" aria-live="polite">Status: idle</p>
      <p id="metrics">Attempts: 0 · Elapsed: 0.0 s</p>
      <p id="result" aria-live="polite"></p>
      <div class="controls"><button id="move" class="secondary" type="button">Move left</button><button id="close" class="secondary" type="button">Close</button></div>
    </section>`;
  const get = <T extends HTMLElement>(id: string): T => shadow.getElementById(id) as T;
  const target = get<HTMLInputElement>('target');
  const start = get<HTMLButtonElement>('start');
  const cancel = get<HTMLButtonElement>('cancel');
  const status = get('status');
  const result = get('result');
  const metrics = get('metrics');
  get('zone').textContent = `Calendar time zone: ${options.timeZone}`;
  try { target.value = dateInZone(Date.now(), options.timeZone); } catch { result.textContent = 'Configure a valid IANA time zone.'; }
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let removed = false;
  let scrollAttempts = 0;
  let elapsed = 0;
  const uiListeners = new AbortController();
  const listen = (id: string, handler: () => void): void => get(id).addEventListener('click', handler, { signal: uiListeners.signal });
  const renderMetrics = (): void => { metrics.textContent = `Attempts: ${scrollAttempts} · Elapsed: ${(elapsed / 1000).toFixed(1)} s`; };
  listen('start', () => {
    if (!target.reportValidity() || controller) return;
    const thisController = new AbortController();
    controller = thisController;
    const externalSignal = options.scroll?.signal;
    const externalCancel = (): void => thisController.abort();
    externalSignal?.addEventListener('abort', externalCancel, { once: true });
    if (externalSignal?.aborted) thisController.abort();
    start.disabled = true; target.disabled = true; cancel.disabled = false;
    status.textContent = 'Status: searching'; result.textContent = ''; result.className = '';
    scrollAttempts = 0; elapsed = 0; renderMetrics();
    const began = performance.now();
    timer = setInterval(() => { elapsed = performance.now() - began; renderMetrics(); }, 100);
    void searchDate(target.value, { ...options, doc, scroll: { ...options.scroll, signal: thisController.signal }, onProgress: (progress) => {
      scrollAttempts = progress.scrollAttempts;
      options.onProgress?.(progress);
    } }).then((run) => {
      if (removed) return;
      status.textContent = `Status: ${run.result.status}`;
      elapsed = run.result.searchDurationMs; scrollAttempts = run.result.scrollAttempts; renderMetrics();
      result.textContent = run.result.reason ?? run.result.status;
      result.className = run.result.status === 'found' ? 'success' : run.result.status === 'error' ? 'error' : '';
      onResult?.(run);
    }).finally(() => {
      externalSignal?.removeEventListener('abort', externalCancel);
      clearInterval(timer); timer = undefined; controller = undefined;
      if (!removed) { start.disabled = false; target.disabled = false; cancel.disabled = true; }
    }).catch(() => { if (!removed) result.textContent = 'Panel callback failed.'; });
  });
  listen('cancel', () => controller?.abort());
  listen('move', () => {
    const left = host.style.left === '8px';
    host.style.left = left ? 'auto' : '8px'; host.style.right = left ? '8px' : 'auto';
    get('move').textContent = left ? 'Move left' : 'Move right';
  });
  const panel: DeveloperPanel = { element: host, remove: () => {
    if (removed) return;
    removed = true; controller?.abort(); clearInterval(timer); uiListeners.abort(); host.remove();
    if (panels.get(doc) === panel) panels.delete(doc);
  } };
  listen('close', panel.remove);
  panels.set(doc, panel);
  doc.body.append(host);
  return panel;
}

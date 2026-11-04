# ChatJump Phase 0

Local-only TypeScript proof of concept for date-based Instagram Web conversation navigation. This is a developer experiment, not an installable extension. No React, backend, manifest, private APIs, or account automation is included. Phase 1 has not started.

**Live feasibility decision: UNVERIFIED.** Automated synthetic tests demonstrate the algorithms and failure handling, not compatibility with Instagram. No Instagram DOM selector, conversation route, loading behavior, or timestamp representation has been confirmed live in this environment.

## Install, build, and test

Use Node **22.13+ within Node 22**, Node 24, or Node 26+ and npm. Validated with Node 22.20.0 and npm 10.9.3.

```sh
cd phase0
npm ci
npm run check
```

`npm run check` runs strict TypeScript compilation, builds the browser IIFE at `dist/chatjump-phase0.js`, runs Vitest with jsdom, and smoke-tests the actual bundle in a synthetic jsdom page. `npm test` runs tests; `npm run test:watch` watches them. The lockfile records exact dependency versions. Build output is generated and Git-ignored. No runtime network library or application server is needed.

## Load into your own Chrome session

1. Log into your **developer-owned Instagram account manually**, then open a conversation. Do not automate login or use another person's account.
2. Open Chrome DevTools → **Sources → Snippets → New snippet**. Copy the entire locally built `dist/chatjump-phase0.js` into it and run it with Ctrl+Enter / Cmd+Enter, in the top-frame execution context. This creates the `ChatJumpPhase0` namespace. No remote script, bookmarklet, extension permission, CSP change, or network interception is required.

   Before reinjecting a new build, close the existing panel and abort any programmatic search using its controller. Reinjecting does not dispose state held by an older bundle instance.
3. Before calibration, you can run the following safe panel. It will report `adapter-unverified` and will not scroll:

   ```js
   var chatJumpPanel = ChatJumpPhase0.mountDeveloperPanel({
     adapter: ChatJumpPhase0.unverifiedAdapter,
     timeZone: 'Asia/Kolkata',
   });
   // Close button or, equivalently:
   // chatJumpPanel.remove();
   ```

4. In **Elements**, select the actual active conversation root, then run `ChatJumpPhase0.printDiagnostics($0)` in Console. The output contains bounded structural counts, allowlisted roles/styles, and numeric scroll geometry. It does not contain text, labels, profile IDs, timestamps, or URLs. Do not log `$0`, message nodes, raw MutationRecords, `ConversationContext`, or adapter keys into saved reports.
5. Manually inspect the relationships listed below in DevTools. Keep any notes to selector patterns, role names, and structural descriptions without identifying values or private screenshots. Enter confirmed structural findings in the report.
6. Configure the adapter only after those observations, run the panel, and execute the three manual experiments below. Close the panel or cancel a search whenever you need control of the page.

Chrome may restrict snippet execution according to its own DevTools policies. Follow the browser's normal supported workflow; do not disable platform security protections. If you cannot run a snippet, keep validation marked NOT TESTED.

## Establish the adapter from actual observations

There are **no built-in Instagram selectors**. The default adapter is deliberately disabled. `createManualAttributeAdapter()` is a working optional helper for the specific case where inspection has confirmed all of the following:

- A selector identifies exactly one active conversation root, excluding sidebars, the inbox list, hidden roots, and the document body.
- An opaque root attribute identifies the conversation and changes when the same root is reused for another conversation. If no such attribute exists, implement `conversationKey()` using another verified identity relationship. A participant name or message body must never be used as a key.
- A selector scoped to that root identifies actual messages, excluding controls, headers, separators, and quoted-message dates.
- Descendant `time[datetime]` or other `[datetime]` elements actually date the owning message, including quoted/replied-message cases. Semantic markup alone is insufficient proof of association.
- A unique scroll element is inside the root (or is the root itself).
- Ordinary manual scrolling and before/after dates establish the physical direction that loads older history. CSS order or scroll position alone does not establish chronology.
- The route shape `/direct/t/<opaque-id>/` has been observed locally. This built-in candidate route is otherwise **UNVERIFIED**. Supply `routeMatches(url)` in a custom adapter if the observed supported route differs; HTTPS Instagram host checks remain mandatory.

Example configuration **template**; every angle-bracket value must be replaced with a manually confirmed structural selector/attribute. None is an Instagram selector:

```js
var chatJumpAdapter = ChatJumpPhase0.createManualAttributeAdapter({
  verification: 'manual',
  conversationSelector: '<confirmed unique active-root selector>',
  conversationKeyAttribute: '<confirmed opaque conversation-key attribute>',
  messageSelector: '<confirmed message selector scoped to root>',
  scrollSelector: ':scope', // ONLY if the active root itself scrolls; otherwise replace
  olderDirection: 'up', // ONLY after observing this direction; down is also supported
  datetimeAssociationVerified: true,
  // messageKeyAttribute: '<optional confirmed stable opaque message-key attribute>',
});

var chatJumpLastRun;
var chatJumpPanel = ChatJumpPhase0.mountDeveloperPanel({
  adapter: chatJumpAdapter,
  timeZone: 'Asia/Kolkata', // the timezone used by the Instagram calendar labels
  relativeLocale: 'en', // opt in only when English Today/Yesterday is observed
  scroll: { maxAttempts: 60, maxDurationMs: 60000, scrollStepPx: 500, delayMs: 1000 },
}, function (run) {
  chatJumpLastRun = run; // structured results and aggregate metrics only; stays in page memory
});
```

If these attribute relationships are absent, **do not force this helper to fit**. Implement `ConversationAdapter` from [src/types.ts](src/types.ts) in another local snippet. Its callbacks resolve the current root, return a switch-aware opaque key, enumerate verified messages, provide explicitly associated timestamp candidates, and return manually confirmed scroll evidence. `getTimestampCandidates(message, root)` may return a verified `aria-label`, relative label, or date separator. Read only a confirmed date node. A separator may date a message only after inspecting its group relationship; do not attach a nearby separator by proximity. Set `associationVerified: true` only for established relationships.

Unsupported dates fail safely. Supported parsers are strict ISO calendar days, ISO instants with explicit `Z` or numeric offset, full English month/day/year labels, and English Today/Yesterday with explicit locale opt-in. Numeric locale dates, yearless labels, naive local date-times, other languages, and phrases such as "2 days ago" are rejected. Calendar-only dates have no invented timestamp; instants are normalized using the chosen IANA timezone. Relative dates use a fixed reference instant for the search and calendar subtraction across DST/month/year boundaries.

## Run without the panel

```js
var chatJumpAbort = new AbortController();
var chatJumpPending = ChatJumpPhase0.searchDate('2026-10-28', {
  adapter: chatJumpAdapter,
  timeZone: 'Asia/Kolkata',
  relativeLocale: 'en',
  scroll: { signal: chatJumpAbort.signal },
});
// In another Console command while pending:
// chatJumpAbort.abort();
var chatJumpRun = await chatJumpPending;
console.info(chatJumpRun); // dates/counts/status only; no DOM nodes or opaque keys
```

Results distinguish a verified matching message (`found`), cancellation (`cancelled`), errors, and limited coverage (`incomplete`). `not-found` is permitted only when a manually supplied `allHistoryRendered(root)` verifies **all history, newest through oldest, currently rendered without gaps**, every message has a readable date, processing is complete, and virtualization is not suspected. This callback defaults to absent. A loading boundary, exhausted scroll range, or target outside a seen date range never proves complete history. Verified empty history is permitted. Traversing disjoint virtualized snapshots does not prove absence.

One search may run per document. Roots/keys/routes/container identity are rechecked at every step and at most 50 ms apart during waits. Switches cancel searches without scrolling the new conversation. Scrolls use ordinary `scrollTo`, never requests or private APIs. The default render wait is 1000 ms; allowed limits are 1–500 attempts, up to 300 seconds, steps of 1–2000 px, and waits of 250–10000 ms. A very short time limit can terminate before the first scroll. Three consecutive attempts without date-bearing changes or viewport movement stop as stalled. Layout-only mutations do not reset that counter.

Native `scrollTop` is not clamped to zero: verified reversed layouts can use negative values. No direction is inferred from `column-reverse`. The engine waits a bounded configurable interval rather than assuming every mutation is a complete history load. Increase the delay for slow manual experiments. A stalled result is incomplete, even if a batch arrives later. User-driven scrolling during a search is unsupported; cancel first.

## Manual live validation

The following experiments were **NOT TESTED** here. Use accessible dates in your own account; do not manufacture history or automate login. Record only metadata in [reports/feasibility-report.md](reports/feasibility-report.md):

| Scenario | Approximate history | Selected date | Accessible messages/count only | Scroll attempts | Elapsed time | New date ranges | Result | Limitations |
|---|---|---|---|---|---|---|---|---|
| Recent | 7 days | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Medium | 30 days | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Older | 6 months | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |

For each run:

1. Record Chrome/OS versions, date-label language, IANA timezone, adapter verification date, and nonidentifying selector/structure notes. Do not include account identifiers or private conversation URLs.
2. Manually identify the target day as ground truth; note whether content from that day actually exists without saving bodies or screenshots. If a scenario has no accessible history, mark unavailable rather than claiming absence.
3. Start from the recent end of the conversation. Check normal and reversed scroll geometry; watch inserted/removed message nodes and whether existing nodes are recycled. Confirm which direction yields older dates.
4. Start a bounded search, and record result/benchmark from `chatJumpLastRun`. Available ranges are cumulative **observations**, not continuous coverage. The panel shows elapsed time and attempts; Move left/Move right keeps controls accessible.
5. Independently verify that the located element is a message on the chosen day. Record detection precision/coverage against the manually checked messages; do not equate a parse rate with accuracy.
6. Repeat with cancellation, a conversation switch, a missing-date case, and slow/unavailable loading. Confirm cleanup and `incomplete` reporting. Check that no diagnostic contains private content.
7. After all accessible scenarios, update the report and choose GO / CONDITIONAL GO / NO-GO / UNVERIFIED based on live evidence. Do not proceed to Phase 1 automatically.

## Interpreting metrics and limits

`performance.now()` measures duration and each configured render-wait window. `loadingDelaysMs` are **observed wait durations**, not verified network latency or time to a complete batch. `mutationEvents` counts MutationRecords; it is neither callback count nor message count. Added/removed elements count distinct directly reported element roots, not all descendants. A removed known message or subtree is evidence of possible virtualization, not proof.

`messageElementsObserved` and `timestampsDetected` count DOM elements observed/dated at least once; recycled elements can represent multiple messages. `timestampDetectionSuccessRate` is the final scan's dated-message count divided by its scanned-message count, omitted for empty scans; it is not measured live accuracy. `historyBatchesObserved` counts attempts with newly observed/changed date-bearing elements, a batch proxy. `uniqueMessagesObserved` is included only with a manually verified stable opaque key for every observed message. Keys stay in memory and are discarded at completion. No fallback hashes of text, names, or URLs are used.

Scans are capped at 2000 messages and 20 date candidates per message. Diagnostics traverse at most 2000 elements by default; observer processing is bounded and flags truncation. A unique-key cap prevents unbounded key retention. Truncated processing cannot establish complete-history absence. DOM work and trusted synchronous adapter callbacks cannot be preempted by JavaScript timers, so keep custom callbacks cheap and bounded. MutationObserver observes only the current conversation, never the whole document; pending records are flushed before metrics are finalized, and it disconnects on every exit path.

## Files

`src/` contains the shared types, isolated adapter, conversation detector, sanitized inspector, timestamp detector, scroll detector, mutation tracker, bounded scroll engine, date search, benchmark, panel, and browser exports. `tests/` contains synthetic fixtures and tests for those boundaries. `scripts/build.mjs` creates a dependency-free browser bundle. The feasibility report includes all live fields as NOT TESTED.

## Privacy and interface constraints

Runtime code uses native DOM APIs, MutationObserver, Intl, and the Performance API. It does not fetch, open sockets, intercept requests, read credentials/tokens, automate login, persist chats, or send data anywhere. The website itself still performs its own normal loading when you scroll. Private date metadata stays in memory unless you intentionally copy sanitized results. Do not persist opaque keys or custom adapter errors.

The temporary panel uses a ShadowRoot, solid approved palette colors, square rectangular buttons with `border-radius: 0 !important`, native date input, visible focus indicators, and live text status. It has no gradients, shadow/blur effects, rounded buttons, animation, dashboard, or popup application. Close aborts searches and removes UI listeners, timers, and the host; search cleanup releases observers. No highlight changes are made to private message nodes. Move controls let you place the narrow panel on either side of the window. Native Chrome date-picker internals are browser-owned.

Technical references: [MDN scrollTop, including negative values](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop), [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), and [Vitest documentation](https://vitest.dev/guide/). These document browser/tool behavior, not Instagram's private DOM contract.

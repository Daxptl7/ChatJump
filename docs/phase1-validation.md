# Phase 1 validation — 2026-11-04

## Result and scope

The Chrome extension foundation is implemented and validated with automated tests and actual Chromium extension execution against synthetic fixtures. **Live Instagram date navigation remains UNVERIFIED.** No Phase 2 functionality is enabled, and Search Messages is always disabled with an explanation.

Phase 0 remains unchanged from commit `38ec5e439d77a5ca9cceb4ae27251ab1b404a74d`. That phase's live feasibility decision is still UNVERIFIED. Only its pure date validator is reused; conversation detection, message parsing, scrolling, and indexing are not wired into Phase 1.

## Actual verification

| Check | Result |
|---|---|
| Strict WXT/TypeScript compilation | PASS |
| ESLint, including React lifecycle rules | PASS |
| Phase 1 Vitest/React Testing Library | **56 tests passed, 5 files** |
| Phase 0 regression checks | **123 tests passed, 9 files; bundle smoke passed** |
| Chrome MV3 production build | PASS; `.output/chrome-mv3` |
| Production manifest | Only `activeTab`; Instagram-only declarative script; no background worker |
| Runtime dependency audit | **0 vulnerabilities** with `npm audit --omit=dev` |
| Actual extension browser | Chromium **156.0.8078.4**, isolated disposable profile |
| WXT development server | PASS; verified at `http://localhost:3097` |
| Development build | PASS; `.output/chrome-mv3-dev` |
| React hot reload in actual development popup | PASS; temporary header edit rendered and original source restored |
| Logged-in developer-owned Instagram account | **NOT TESTED** |
| Real historical date navigation | **NOT TESTED; disabled** |

Toolchain: Node 22.20.0, npm 10.9.3, WXT 0.21.5, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.4, Vite 8.3.5, Vitest 5.1.0, jsdom 29.1.1, Playwright 1.64.1. Phase 0 keeps its own package and lockfile.

The full development dependency audit reported 18 tooling advisories (1 low, 17 moderate) after installing the browser runner. The runtime audit is clean. No forced dependency downgrade or unverified major override was applied. Development dependencies and the runner are not shipped in the extension bundle.

## Actual browser scenarios

`npm run test:browser` loads the built unpacked extension using Chrome's developer tooling, invokes its action, attaches to the actual popup target, and exercises real runtime messaging. The page is a synthetic document served inside the test profile at a deliberately non-conversation Instagram-origin path. There is no logged-in account, real conversation, participant identity, or private traffic. Non-fixture external requests are blocked.

| Scenario | Actual result |
|---|---|
| Open toolbar popup | PASS; actual built React UI rendered |
| Connection check | PASS; declarative content script returned the validated schema |
| Conversation metadata | `conversationDetected: null`; no invented DOM result |
| Check Connection button | PASS; rechecks and returns Connected after a valid reply |
| Date selection | PASS; native input accepted a past leap-day date |
| Future date | PASS; validation error displayed |
| Search | PASS; remains disabled; no fake results |
| Reload the synthetic Instagram tab | PASS; connection re-established |
| Unsupported active site | PASS; Not on Instagram after action invocation |
| Reinstall extension without reloading tab | PASS; missing content-script state shown |
| Reload after reinstall | PASS; connection recovered |
| Native popup width | PASS; 360px without horizontal overflow |
| Narrow viewport | PASS; same popup document at 320px in a normal extension tab |
| Buttons | PASS; computed zero corner radius |
| Gradients | PASS; none in computed element backgrounds or shipped UI source |
| Keyboard focus | PASS; Tab moves from connection check to date input; visible solid outline |
| Text contrast | PASS; tested actual text/background tokens meet at least 4.5:1 |

The browser test identified a native-popup sizing defect caused by viewport-dependent initial width. The resulting fix sets an intrinsic body width and supports narrower 280–359px viewports through CSS. This was verified after correction; an earlier failed rendering is not presented as the final screenshot.

Screenshots:

- [Connected actual popup, synthetic fixture](images/popup-connected.png)
- [Unsupported-site actual popup](images/popup-unsupported.png)

Raw repeatable browser results are generated into `artifacts/browser-results.json`; generated artifacts are Git-ignored. Selected screenshots are versioned. Browser-native date-picker locale/appearance is outside ChatJump's injected styles.

## Implementation and permissions

The production extension uses native Chrome APIs directly between popup and content script. Requests and replies have runtime validation. Requests contain only PING or GET_CONNECTION_STATUS; no dates, chat text, names, URLs, or tokens are sent. Replies contain readiness and an explicitly unknown conversation flag.

Tab queries/messages each have a 2-second deadline. Obsolete work is cancelled on tab events or popup unmount, and identity/URL is rechecked before accepting readiness. Raw browser errors never appear in the UI. The listener rejects unknown requests, foreign extension IDs, and requests originating from tabs.

The only production API permission is `activeTab`, used for temporary URL access after the action is invoked. The content script is declared only for `https://www.instagram.com/*`, in the top frame at document idle. Production has no `scripting`, broad host access, WhatsApp access, storage, cookies, network interception, or worker state.

WXT's generated development build separately adds `tabs`/`scripting`, Instagram/localhost hosts, a background worker, localhost CSP, and reload command for framework-managed HMR/injection. These are absent in production and must not be distributed.

## Remaining manual validation

These live scenarios must still be performed with a developer-owned account, without automating login:

1. Build and load `.output/chrome-mv3` through `chrome://extensions` → Load unpacked.
2. Open the supported `https://www.instagram.com/` origin, reload the tab, invoke ChatJump, and confirm Connected follows a response. It must not claim a conversation is detected.
3. Open an unrelated site and confirm a clear unsupported state. On restricted Chrome pages, a URL-permission error is valid.
4. Reload Instagram and reopen ChatJump. Reload the extension while Instagram stays open; verify the message tells you to reload the tab when its listener is unavailable.
5. Select past/today/future dates, navigate controls by keyboard, and confirm the search button remains unavailable and the interface does not clip.
6. Record the actual Chrome version and outcomes without private URLs, screenshots of conversations, participant identifiers, or message contents.

The synthetic test results do not establish compatibility with Instagram's current live DOM, logged-in loading behavior, region-specific security constraints, or historical message accessibility. Manual login and live message tests are not claimed.

## Phase 2 readiness

**Foundation ready; live navigation gate remains UNVERIFIED.** Phase 1's extension/UI/messaging infrastructure is available for a later implementation phase. Before enabling historical search, complete the Phase 0 live protocol and document confirmed selectors, switch-aware conversation identity, timestamp relationships, older-history direction, virtualized loading, and real benchmarks. No Phase 2 code was started.

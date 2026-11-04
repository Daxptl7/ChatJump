# ChatJump — Phase 0 feasibility report

Report date: **2026-11-04 (Asia/Kolkata)**

Recommendation: **UNVERIFIED**

Scope: technical feasibility code, synthetic tests, injection bundle, and manual experiment protocol. Phase 1 has not started.

## 1. Executive summary

A functioning local-only TypeScript proof of concept is implemented. It detects conversations through a manually verified adapter, inspects sanitized DOM structure, parses associated dates, detects scoped scroll containers, tracks mutations, performs bounded historical navigation, finds verified message dates, produces aggregate benchmark metadata, and exposes a minimal developer panel.

Strict TypeScript compilation and the browser bundle build passed. **123 synthetic tests passed across 9 test files.** A separate smoke test evaluated the built bundle in jsdom, verified its global namespace, safe unconfigured behavior, configured date matching, and panel removal. These results establish algorithm and packaging behavior in a synthetic environment. They do not establish live Instagram compatibility, reliable history coverage, or practical six-month navigation performance.

No connected authenticated browser session was available for live inspection. No account login was automated or requested. All live experiments and measurements below are explicitly **NOT TESTED**. A GO decision cannot be justified from the evidence available.

## 2. Environment details

| Item | Verified environment / status |
|---|---|
| Operating system | macOS 26.0, build 25A354 |
| Node | 22.20.0 |
| npm | 10.9.3 |
| TypeScript | 7.0.2, strict configuration |
| Vitest | 5.1.0 |
| jsdom | 29.1.1 |
| esbuild | 0.28.2 |
| Bundle target | Chrome 120+ (build target, not a tested minimum version) |
| Automated command | `cd phase0 && npm run check` |
| Browser execution tests | Synthetic jsdom only; native Chrome NOT TESTED |
| Live Chrome version | NOT TESTED |
| Instagram UI version / language | NOT TESTED |
| Live calendar timezone | NOT TESTED; supplied explicitly by the developer |
| Logged-in developer-owned session | NOT TESTED |

The lockfile is included for reproducible installation with `npm ci`. Runtime output has no application dependencies, server, request interception, storage layer, or credential handling. Tool installation reported zero vulnerabilities; this is not an independent security audit.

## 3. Confirmed DOM findings

**There are no confirmed live Instagram DOM findings.** No obfuscated classes or invented Instagram selectors were encoded.

| Relationship | Live status | Implemented handling |
|---|---|---|
| Instagram HTTPS origin | Live session NOT TESTED | Exact allowlist of `instagram.com` / `www.instagram.com`; lookalike hosts rejected |
| `/direct/t/<opaque-id>/` route | UNVERIFIED route candidate | Replaceable route predicate; route alone cannot enable search |
| Active conversation root | NOT TESTED | Manual resolver, connected/visible root check; body/document root rejected |
| Conversation identity / switching | NOT TESTED | Opaque adapter key, root identity, and route checks |
| Message / group structure | NOT TESTED | Adapter-scoped message enumeration, no global text scan |
| `time` / `datetime` message dates | NOT TESTED | Optional semantic helper only after explicit association verification |
| Date separator relationships | NOT TESTED | Each message relationship must be explicitly verified by adapter |
| Accessible date labels | NOT TESTED | Exact verified date labels only; arbitrary labels are not scanned |
| History scroll container | NOT TESTED | Scoped candidate inspection; manually supplied evidence |

The inspector reports bounded counts, allowlisted roles, datetime/label presence counts, and numeric scroll geometry. It never prints message text, accessible label values, IDs, token values, profile names, or conversation URLs. SVG nodes count toward traversal limits.

## 4. Timestamp detection accuracy

**Live accuracy, precision, and recall: NOT TESTED.** No percentage for real Instagram messages can be reported.

Synthetic tests validate same-day calendar values, month/year boundaries, leap dates, invalid dates/instants, explicit timezone conversion, DST/calendar subtraction, missing timestamps, relative Today/Yesterday with locale opt-in, verified separator relationships, ambiguous locale dates, conflicting dates, visible versus rendered ranges, and scan limits.

Strict parsing accepts ISO calendar days, ISO instants with explicit timezone offsets, and explicitly enabled full English date/relative labels. Calendar dates retain uncertainty about the exact time; no midnight timestamp is manufactured. Instants carry a timestamp and high confidence. Date-only labels carry medium confidence. Association is established separately from parse confidence. Unsupported languages/yearless dates/local time-only labels require future observed-format support; no date is guessed from message bodies.

The benchmark's timestamp detection rate is the final snapshot's number of dated messages divided by the number of scanned messages. It measures readable coverage, not correctness against human ground truth. Even 100% parsing on a fixture cannot establish live accuracy.

## 5. Scroll behavior

**Live loading direction, timing, pagination, and oldest-history boundary: NOT TESTED.**

The engine refuses automatic scrolling without manually verified direction. Physical up decreases `scrollTop`, including negative values in reversed layouts; physical down increases it. CSS `column-reverse` does not by itself establish older-history direction. Synthetic tests validate normal/reversed coordinates and down-directed history.

Ordinary DOM `scrollTo()` triggers page-managed loading. The engine uses configurable bounded render waits, checks identity/cancellation during waits, recalculates dates, and stops on matches, deadlines, attempt limits, unreadable dates, or three consecutive stalls. Layout-only changes do not prove loading progress. A scroll boundary or stalled loader produces `incomplete`, never proof of absence. Native Chrome behavior still requires manual verification.

## 6. MutationObserver findings

**Live mutation patterns: NOT TESTED.** Synthetic fixtures validate insertion/removal records, timestamp changes, stable-key counting, ignored outside mutations, height changes, pending-record flushes, and disconnect behavior.

Observation is scoped to the active root. Record counts, distinct reported added/removed element roots, observed message elements, and optional stable unique keys are separate metrics. DOM mutation counts never stand in for unique messages. Processing is bounded and truncation is flagged; private bodies and raw MutationRecords are not retained in benchmark output. Observers disconnect in `finally` after every search outcome, including cancellation and errors.

## 7. Virtualization behavior

**Instagram virtualization, node recycling, and retained history: NOT TESTED.**

Removing known message elements/subtrees triggers a conservative virtualization suspicion. Adapters may also provide a manually observed suspicion. Changed dates or stable message keys on reused elements can indicate progress; observed element counts do not become unique message counts. A same-day recycled node without an observable stable key may cause an early incomplete result. Removal can also represent ordinary deletion, so this signal is not proof of virtualization.

The engine does not reconstruct a continuous archived history. Cumulative observed date ranges can span gaps. It rejects complete-rendering absence claims when virtualization or processing truncation is suspected.

## 8. Benchmark and automated results

Final verification run on the report date:

| Check | Actual result |
|---|---|
| `tsc --noEmit` | PASS |
| esbuild IIFE output | PASS; `dist/chatjump-phase0.js` |
| `vitest run` | **9 files passed; 123 tests passed** |
| Vitest suite duration | **2.39 seconds** in this run; tooling duration, not navigation latency |
| Built-bundle synthetic smoke | PASS; namespace, unverified safety, rendered-date match, panel removal |
| Source design/privacy scan | Square-button rules present; no gradient functions, runtime network calls, or storage APIs found |
| Real Chrome / real Instagram benchmarks | **NOT TESTED** |

The smoke test caught and corrected a namespace-export problem: the bundle now explicitly assigns `globalThis.ChatJumpPhase0`, including when evaluated by a snippet. The synthetic historical-search test inserts a timestamp-bearing batch after a mocked scroll and validates its discovery. Neither test connects to Instagram.

| Live scenario | Selected date | Accessible messages/count only | Attempts | Elapsed | Newly loaded date ranges | Result | Failure/limitation |
|---|---|---|---|---|---|---|---|---|
| Recent, approximately 7 days | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | No connected authenticated session |
| Medium, approximately 30 days | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | No connected authenticated session |
| Older, approximately 6 months | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | No connected authenticated session |

For live runs, record `durationMs`, attempts, mutation records, dated/observed element counts, optional verified unique-message counts, rendered and visible date ranges, loading wait windows, stalls, batch proxies, and outcome. `loadingDelaysMs` measures configured wait duration, not verified network latency or batch completion. Manual ground truth is needed to assess accuracy and accessibility.

## 9. Reliability limitations

- Adapter selectors, identity keys, dates, and chronology require actual inspection before use. The default adapter is disabled. A developer's verification assertion cannot be independently proven by the library.
- A same-route, same-root conversation switch requires a truly switch-aware adapter key. Route changes and root replacements are checked independently.
- Dates absent from DOM, ambiguous labels, unsupported locales, quoted message timestamps, slow history loading, or inaccessible older history can prevent reliable navigation.
- Viewport movement and new date-bearing elements are progress signals; they are not a guarantee of complete pagination. Virtualized or same-day reused nodes can obscure progress.
- Fixed render waits are bounded and conservative. A batch arriving after the stalled threshold can require a later manual retry with a longer wait.
- Main-thread DOM work and synchronous trusted callbacks cannot be interrupted by a timer. Scans are capped, and callbacks must stay cheap and scoped.
- No full-history completeness proof is inferred. `not-found` requires explicit all-history-currently-rendered evidence, complete readable dates, and no suspected virtualization/truncation. Otherwise the result is `incomplete`.
- User scrolling during a search is unsupported. Cancel before taking over scrolling. Unavailability is not evidence of no messages.

## 10. Security and privacy observations

Runtime code is local-first and uses only ordinary DOM/browser APIs. It does not read passwords, cookies, tokens, request headers, or authentication storage; automate login; intercept requests; contact external services; or persist private content. Ordinary Instagram scrolling can trigger Instagram's own normal loading, which is not intercepted.

Conversation and optional message keys are transient in-memory identifiers used only for identity/counting and never included in result logs. Arbitrary adapter exceptions are replaced with fixed reason codes. Outputs contain aggregate counts and dates, which are still private metadata and should be copied only intentionally. The inspector never logs DOM nodes or message bodies. Avoid saving private screenshots, raw labels, keys, URLs, or timestamps copied from individual messages.

The panel uses an isolated ShadowRoot, approved solid colors, rectangular buttons with a mandatory zero radius, a labeled date input, keyboard focus outlines, live status, and no gradients, blur, shadows, or animations. Move/close controls keep it small and removable. Closing aborts an active search, clears UI listeners/timers, and removes the panel; search cleanup releases observers. Browser-owned native date-picker internals are outside injected CSS control.

## 11. Recommended architecture

Keep the framework-independent modules and adapter contract. A future WXT content-script layer can own verified selectors, locale/format support, identity resolution, and platform-specific loading evidence while the search engine remains native TypeScript. Preserve safe defaults and explicit confidence/completeness handling. Never use private APIs or request interception to compensate for a weak DOM contract.

Before Phase 1, a developer must execute the protocol in [../README.md](../README.md): manually authenticate, inject the local bundle through DevTools Sources → Snippets, inspect the active DOM, establish a verified adapter, run accessible 7-day/30-day/6-month scenarios, manually check message dates, and record cancellation/switching/slow-load failures. If a stable DOM contract cannot be established, investigate a separate local exported-message search approach rather than claiming reliable live navigation.

## 12. Phase 1 readiness decision

**UNVERIFIED — do not infer readiness for Phase 1.**

| Decision | Evidence required | Current assessment |
|---|---|---|
| GO | Live core navigation validated with dependable date associations, direction, and measured outcomes | Not established |
| CONDITIONAL GO | Live viability demonstrated, with documented manageable technical gaps | Not established |
| NO-GO | Live evidence shows DOM navigation is insufficiently reliable | Not established |
| **UNVERIFIED** | Implementation and synthetic tests exist; live validation incomplete | **Applies** |

Phase 0 engineering deliverables are complete: all requested modules, minimal panel, strict compilation, automated tests, build/injection instructions, privacy controls, manual experiment protocol, and this report. The live-validation gate remains open and explicitly unverified. Do not present synthetic pass counts as proof that ChatJump works on real Instagram conversations.

References: [MDN scrollTop](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop), [MDN MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [Vitest guide](https://vitest.dev/guide/). These support implementation choices; they provide no evidence about Instagram's current DOM.

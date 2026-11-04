# Phase 2 implementation and verification

Validation date: 2026-11-04. Scope: currently rendered conversation metadata only.

## Status and confirmed findings

The configurable Instagram adapter, timestamp/grouping pipeline, scoped observation, typed messaging, and popup integration are implemented. Strict TypeScript, lint, 126 extension tests, 123 preserved Phase 0 tests, production build, and two native Chromium harnesses pass.

**Live Instagram account validation: NOT TESTED. Live DOM compatibility: UNVERIFIED.** Phase 0's feasibility report contains no confirmed production selectors. No authenticated browser session was available for this work. The production selector profile therefore remains `{ verification: 'unverified' }`. A DM URL alone produces `unsupported-layout / UNVERIFIED_SELECTORS`; counts and ranges are absent. A home/inbox URL produces `not-open`. Synthetic selectors exist only in tests and are never shipped as Instagram findings.

The native extension screenshot in [images/popup-phase2-unverified.png](images/popup-phase2-unverified.png) shows that fallback. The page behind the actual toolbar popup was synthetic. Search remains disabled, and Phase 3 has not started.

## Architecture and Phase 1 integration

```text
WXT isolated content script
  -> initializeInstagramRuntime (one session per Document)
  -> InstagramAdapter implementing ChatAdapter
     -> conversation detection + configured selectors
     -> scoped message detection + timestamp parsing + date groups
     -> read-only scroll-container detection
     -> compact current snapshot + one scoped DOM observer
  -> existing same-extension messaging listener
  -> strict serializable snapshot response
  -> popup useConversationSnapshot -> ConversationStatus
```

The complete updated source tree and created/modified file inventory are in [architecture.md](architecture.md). React never receives DOM nodes or Instagram selectors. `ChatAdapter` exposes page/conversation detection, current messages, scroll container, snapshots, observation, and cleanup, allowing future platforms to implement the same boundary. No additional platform is implemented.

The existing Phase 1 `PING` and `GET_CONNECTION_STATUS` schema is unchanged, including `conversationDetected: null`. New discriminated requests `GET_CONVERSATION_STATUS` and `GET_RENDERED_MESSAGE_SUMMARY` return fresh validated snapshots. Content-script initialization and runtime listener failures become fixed errors. No production background worker is necessary.

`useConversationSnapshot` starts only after a validated connection. It requests another summary one second after the previous operation finishes, enforces the existing two-second deadline per browser operation, rechecks the active tab after replies, and aborts on tab changes/unmount. Data for an old active-tab object is hidden immediately while reconnecting. Equal snapshots do not trigger another state update. Reopening the popup reads current DOM rather than a cached prior conversation.

## Conversation and selector strategy

`conversationDetector.ts` validates the exact supported origin and DM route, then requires a manually verified profile with a unique visible conversation root, an opaque identity attribute, and a unique visible message list. Home and inbox routes are not conversations. Body/html roots, multiple roots, missing identities/lists, hidden structures, malformed selectors, and unsupported layouts fail safely.

All layout assumptions live in `selectors.ts`. A manual profile supports ordered primary/fallback root selectors, semantic/accessibility selectors, message and list selectors, explicit timestamp rules, optional contained/sibling date groups, an optional narrow transition region, scroll selector, independently verified timezone, and optional independently verified older-history direction. A fallback is subject to the same verification requirements as a primary selector. Ambiguous matches are rejected rather than selected arbitrarily.

The identity is the tuple of route, root node, list node, and configured opaque key. It remains internal. A change disconnects old observation and scroll listeners, cancels queued work, clears weak message references/keys and virtualization state, and advances the snapshot revision even if the new counts match the old counts.

### Manual selector calibration

1. Use your own logged-in Instagram account and Chrome DevTools. Log in manually; do not give credentials or session data to ChatJump or a test script.
2. Inspect the active root and message list across multiple conversations, empty chats, text/media rows, and sidebar/header/composer UI. Establish a stable opaque identity and uniqueness. Do not copy private HTML, bodies, names, or conversation URLs into fixtures or reports.
3. Identify date-specific nodes/attributes and independently verify their association with messages. A generic accessible label or arbitrary message text is not a date source. Confirm Instagram's displayed calendar timezone and locale separately from the popup/browser timezone.
4. Inspect group boundaries and actual DOM order while manually scrolling. Decide whether a separator governs a containing group or direct siblings in a verified direction. Missing or unclear relationships must remain unknown.
5. Verify the containing scroll element and how older history is reached, including reverse layouts and possible negative scroll offsets. Leave `olderDirection` unknown until observed.
6. Update only `instagramSelectorProfile` with the observed `VerifiedSelectorProfile`; use the TypeScript interface as its schema. Set verification flags only for observed relationships. No guessed production selector example is supplied here.
7. Add equivalent anonymous synthetic regression fixtures, run the commands below, and execute scenarios A–F on the actual page. Record sanitized outcomes, layout/locale/timezone conditions, and unresolved failures. Rebuild and reload the extension after changing the profile.

Changing the profile is a source-code calibration step; there is no runtime selector editor, browser storage, or network configuration service.

## Message detection and current-range semantics

The message detector queries only the verified list, rejects the list itself, removes nested duplicate matches, and excludes disconnected or structurally hidden containers. Text and media wrappers follow the same structural rules; bodies, image/video/audio data, and participant labels are not read. Viewport intersection determines the separate visible count; offscreen rendered nodes still contribute to the rendered count.

Each reference has a WeakMap-backed ephemeral local key and a DOM node, used solely inside the content script. These are not stable Instagram message IDs. The detector returns an unreliable empty result on limits; the adapter publishes an unsupported snapshot with omitted counts, rather than presenting that empty result as a reliable zero.

Each refresh replaces the message set and recomputes min/max from currently dated nodes. Removed messages no longer contribute. There is no accumulation of historical ranges or message content. Zero is shown only for a reliably detected empty rendered list. Removed known nodes flag possible virtualization; this is a suspicion, not proof that Instagram virtualizes the layout.

## Timestamp normalization

`timestampParser.ts` reuses Phase 0's strict timestamp/calendar helpers; Phase 0 source is unchanged. It reads only configured, association-verified date nodes: `datetime`, date-specific `aria-label`, or leaf text explicitly verified as a date. Whole-message text is never a fallback.

- Strict calendar dates normalize to `YYYY-MM-DD` without inventing an instant.
- ISO instants with explicit offsets preserve `timestampMs` and convert the calendar date to the independently verified configured timezone. One instant can fall on different dates in different zones.
- Full month-name calendar formats use the configured locale through `Intl`; tests include English, French, and German. This does not claim support for every locale's grammar or abbreviations.
- Today/Yesterday-style calendar labels use the configured zone and current date. Explicit relative dictionaries cover English, French, Spanish, and German; only tested formats are accepted. Tests fix `now` for reproducibility.
- Numeric localized dates require an explicit verified DMY/MDY/YMD setting. Missing years, ambiguous formats, impossible dates, unverified zones, and invalid timezones return structured failures.
- Conflicting calendar dates remain unknown. Different exact instants that agree on one calendar date downgrade to date-only precision, rather than selecting an arbitrary time.

No year is inferred from a month/day label. No clock time is inferred from a date separator. Unknown formats remain unknown. Month/year boundary, leap-date, offset, and timezone-conversion behavior is tested.

## Date grouping

Contained groups require a verified group wrapper with exactly one verified separator. Sibling groups require explicitly verified DOM ordering and direct sibling membership; forward and backward order are supported. Unknown intervening nodes reset the association, and a missing/removed separator leaves the associated messages unknown. Visual proximity is never used. Ambiguous separator parses propagate uncertainty. Group dates have calendar-date precision even if the separator exposes an instant; its clock time is not attributed to each message.

Direct and grouped dates must agree when both exist. Conflict does not silently override one source with another.

## Scroll identification and observation lifecycle

The scroll detector reads geometry, overflow, hierarchy, and the relationship to the verified list. An explicitly verified scroll selector takes priority; otherwise only a unique structural candidate is accepted. Unrelated page scrollers are excluded. `scrollTop` is read, never written. Older-history direction remains `unknown` unless separately verified; zero or negative scroll offsets are not treated as chronological proof.

The observer watches only the active root with child/subtree changes, relevant date text changes, and a narrow attribute filter (`datetime`, `aria-label`, visibility attributes, and the configured identity attribute). It keeps compact counts and a removed-known-message flag, discards raw MutationRecords, and coalesces changes over 100ms. One root has at most one observer even with multiple subscribers. Relevant mutations rebuild the current scoped message snapshot once per batch.

A 500ms identity-only check catches route navigation and root/list replacement even when the old root can no longer observe its own removal. It does not scan messages. Without a configured narrow transition region, root selector queries necessarily start at the document; message scans and mutation observation remain scoped. No global MutationObserver, History patch, or main-world injection is used.

Passive scroll events coalesce viewport-metadata refreshes over 100ms. Native scrolling is not initiated or modified. Changing roots unsubscribes old listeners. Removing the last subscriber stops monitoring. WXT context invalidation and repeated initialization release observers, timers, subscriptions, root/list references, weak maps, and runtime listeners. A disposed adapter cannot restart.

## Snapshot, privacy, and errors

`ConversationSnapshot` is the sole adapter model permitted across runtime messaging. It contains:

| Fields | Meaning |
|---|---|
| `status`, `confidence`, `verification`, optional `reason` | Detection and fixed diagnostic states |
| Optional rendered/visible/dated counts, `datesDetected` | Current confirmed nodes and distinct normalized dates |
| Optional earliest/latest rendered dates and calendar timezone | Current dated subset only |
| `timestampCoverage` | Complete/partial/unknown coverage of rendered nodes |
| `lastUpdatedAt`, `revision` | Metadata-change time and revision, not message timestamps |
| `scrollable`, `olderDirection`, `virtualizationSuspected` | Read-only structural metadata |

Unavailable states omit counts and dates. The strict whitelist validator rejects unexpected keys, malformed enums/dates/zones, invalid numbers, inconsistent counts/ranges/coverage, and nonserializable/private additions. Both the listener and popup validate the result. Snapshots contain no DOM elements, local keys, conversation identity/URL, raw HTML, bodies, participants, media, credentials, or auth data. No persistence or external transport is added.

Structured states cover unsupported origin/layout, no selection, missing containers/messages/timestamps, ambiguity, scan limits, observer/provider failure, and invalidated context. Raw browser or DOM exception details are not shown. Diagnostics are opt-in internal sanitized structure and timing counters, not content dumps or normal console logs. Phase 0's sanitized inspector is reused only within an already confirmed root.

The popup adds only conversation status, rendered count, date bounds, timestamp coverage, and available calendar zone. It explains current-subset coverage. Existing connection/date controls, colors, focus behavior, flat backgrounds, rectangular controls, and disabled Search are preserved.

## Actual automated results

| Check | Result |
|---|---|
| `npm run typecheck` | PASS, strict TypeScript |
| `npm run lint` | PASS |
| `npm test` | PASS, 126 tests / 13 files: 56 existing + 70 new |
| `npm run build` | PASS, WXT Chrome MV3 production build |
| `npm run test:phase0` | PASS, 123 tests / 9 files and bundle smoke test |
| `npm run test:browser` | PASS, actual production extension popup/runtime in Chromium 156.0.8078.4 |
| `npm run test:browser:phase2` | PASS, configured synthetic adapter in Chromium's isolated world |
| Developer-owned logged-in Instagram session | NOT TESTED |

The production output is `.output/chrome-mv3`, approximately 276.87kB in WXT's build listing: content script 27.39kB, popup JS 238.32kB. The generated manifest still requests only `activeTab`, with the existing `https://www.instagram.com/*` declarative match. There are no new dependencies, production host permissions, background entrypoints, or Phase 0 modifications.

New tests cover conversation/home/inbox/missing/ambiguous layouts and switching; nested/media/hidden/removed/empty/limited messages; strict dates, locales and zones; contained and reversed groups, missing/virtualized/ambiguous boundaries; coalescing, insertion/removal/date updates/root replacement/SPA/cleanup; strict DTOs, provider errors, repeat initialization, stale popup replies, compatible Phase 1 handshake, and no automatic scrolling.

The production browser harness tests genuine toolbar popup/runtime messaging, unverified and non-DM summaries without invented counts, reload/reinstall recovery, date input, disabled search, focus/keyboard navigation, square controls, no gradients, 360px native layout, and 320px extension-tab layout. The configured adapter harness separately verifies actual native DOM mutation delivery, current-range updates, identity switching, no private fields in snapshots/diagnostics, unchanged scroll position, and observer cleanup. Test fixtures fulfill synthetic pages only within the browser harness; the production extension never intercepts network traffic. Phase 1 development HMR evidence remains historical and was not rerun for Phase 2.

### Measured synthetic sample

The final native adapter run writes `artifacts/phase2-browser-results.json` (Git-ignored, reproducible with the command above). It started with two dated rendered messages, observed insertion/removal, shrank the current range after removal, and reset virtualization suspicion on an identity switch. After cleanup the active observer count was zero. Automatic scrolling was false.

| Metric | Final sampled value |
|---|---|
| Conversation detection | 0ms at available timer resolution |
| Message detection, including date work | Approximately 0.20ms |
| Timestamp parsing subset | Approximately 0.10ms |
| Mutation-record processing | 0ms at available timer resolution |
| Mutation records processed (cumulative) | 2 |
| Snapshot metadata revisions observed | 4 |
| Active observer before / after cleanup | 1 / 0 |

These are single final samples on a tiny synthetic layout, not averages, live measurements, or large-chat benchmarks. A recorded zero is below timer resolution, not proof of zero work. Message timing includes timestamp timing; they must not be added. Update policy is coalesced to one refresh per 100ms mutation/scroll batch, plus on-demand reads and changed identity checks; it is not a fixed production update-rate claim.

## Manual Chrome validation

Build, load `.output/chrome-mv3` through `chrome://extensions`, reload the Instagram tab, and use your own session. Follow the calibration steps first for positive detection scenarios. Do not automate login, export chat HTML, or record personal data in reports. Every live scenario below is **NOT TESTED** in this implementation session.

| Scenario | Procedure and expected observation |
|---|---|
| A — Home / inbox | Open home then inbox without a selected chat. Connected is independent of selection; conversation is not open, counts/ranges unavailable. |
| B — Active conversation | Open a chat with the calibrated layout. Verify the unique root/list and compare currently rendered wrappers/date associations to the popup. Unknown timestamps remain unknown. Counts are never total history. With the shipped unverified profile, expect unsupported layout instead. |
| C — Different conversation | Switch without reloading; also inspect same-root identity reuse if present. The next requested snapshot must describe the new chat; old dates/keys/virtualization state must not survive. Check only one observer is active. |
| D — Manual scrolling | Scroll yourself in both directions. Rendered dates should reflect inserted/removed nodes; missing virtualized separators must not assign guessed dates. Observe that the extension never moves scroll position. Verify older-history direction separately. |
| E — Reload | Reload Instagram, reopen popup, and check fresh initialization and a current summary. Repeat after extension reload; any old-tab missing-listener error should resolve after reloading the page. |
| F — Unsupported layout | In DevTools temporarily remove/change a required structural attribute or test a nonmatching layout. Expect structured unsupported/unavailable metadata without false message counts or crashes. Restore the page afterward. |

Synthetic equivalents of these transitions have automated coverage, but do not establish live compatibility. The complete root/profile/locale/timezone/layout combinations need actual inspection before recording B–D as passed.

## Limits and Phase 3 recommendation

- Production root/message/date/group selectors, opaque identity, calendar timezone, DOM ordering, and older-history direction remain unverified. Production intentionally cannot report positive conversation detection until calibrated.
- Only currently rendered nodes are available. Full history completeness is unknown. Removed known nodes suggest virtualization but do not distinguish all removal causes. Browser viewport visibility does not account for every overlay/occlusion.
- Parsing supports strict tested formats, not arbitrary localized prose, yearless dates, or every relative expression. Safe uncertainty can reduce date coverage.
- Processing is bounded to 2,000 messages, 4,000 candidate elements, eight timestamp rules and a small date-node budget. Native selector queries still materialize their matches before bounded processing. Very large/unsupported layouts return unavailable metadata and need measured investigation.
- The identity check can take up to its 500ms interval when no popup request is made. Popup summary requests perform a fresh detection synchronously. Class/style-only visibility changes are not observer attributes; on-demand summary reads re-evaluate computed visibility.
- Runtime uses one current snapshot, no indexing/storage/network/backend, no auto scrolling, search, scraping of older history, WhatsApp, export processing, or AI.

**Recommendation:** keep Phase 3 gated on developer-owned live inspection and successful A–F validation with a calibrated profile. Confirm identity reuse, timestamp associations/timezone, both grouping orders as applicable, scroll geometry/direction, virtualization, and real-page performance. The modular implementation and synthetic regression suite are ready for that calibration; a verified live scrolling foundation has not yet been established.

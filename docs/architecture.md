# ChatJump architecture and complete file inventory

Current implementation: Phase 1 extension foundation plus Phase 2 configurable DOM adapter. Live Instagram compatibility remains **UNVERIFIED**; the shipped selector profile does not claim positive detection. Search is disabled. See [Phase 2 implementation and actual validation](phase2-implementation.md) for selector calibration, lifecycle decisions, snapshot semantics, measurements, manual scenarios, and Phase 3 prerequisites. [Phase 1 validation](phase1-validation.md) remains the historical foundation report.

## Runtime boundaries

| Boundary | Responsibility |
|---|---|
| `entrypoints/popup/` | React popup, existing date and connection controls, conversation metadata |
| `entrypoints/instagram.content.ts` | Declarative isolated-world WXT entrypoint; invalidation cleanup |
| `src/core/` | Shared adapter, internal message types, serializable snapshot and strict validator |
| `src/adapters/instagram/selectors.ts` | Centralized manually verified layout configuration; production defaults to unverified |
| Instagram detectors and parser | Unique root/list/identity, scoped deduplicated messages, strict dates, validated groups, read-only scroll geometry |
| `InstagramAdapter.ts`, `domObserver.ts`, `runtime.ts` | Current snapshot, identity invalidation, one scoped observer, timers/listeners/session cleanup |
| `layoutDiagnostics.ts` | Sanitized internal structure and actual timing/counter diagnostics |
| `src/messaging/` | Same-extension UI requests, compatible Phase 1 handshake, strict fresh Phase 2 snapshots |
| `src/hooks/` | Active-tab validation and bounded sequential snapshot requests; stale response rejection |
| `src/components/` | Platform-neutral minimal presentation and accessible controls |
| `src/services/`, `src/types/`, `src/utils/` | Narrow browser API boundary, platform routing, date-input validation, fixed errors |
| `phase0/` | Preserved feasibility prototype; only pure timestamp/date/range helpers and sanitized DOM inspector reused |
| `tests/instagram/`, `tests/browser/` | Anonymous synthetic fixtures and test-only adapter configuration |
| `scripts/` | Actual extension popup, development HMR, and native isolated-world adapter harnesses |

The popup communicates directly with the content script; production needs no background worker or persistence. Internal nodes/opaque identities never cross messaging. Snapshot fields contain only detection metadata; unreliable counts are omitted. All date coverage describes current rendered nodes, not full conversation history. Root switching clears previous message references. WXT invalidation disposes the complete runtime.

## Complete source tree

Generated dependency/build/artifact directories are excluded. This lists every source/configuration/documentation/asset file, including the preserved Phase 0 project.

```text
Chatjump/
├── docs/
│   ├── images/
│   │   ├── popup-connected.png
│   │   ├── popup-phase2-unverified.png
│   │   └── popup-unsupported.png
│   ├── architecture.md
│   ├── phase1-validation.md
│   └── phase2-implementation.md
├── entrypoints/
│   ├── popup/
│   │   ├── App.tsx
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── style.css
│   └── instagram.content.ts
├── phase0/
│   ├── reports/
│   │   └── feasibility-report.md
│   ├── scripts/
│   │   ├── build.mjs
│   │   └── bundle-smoke.mjs
│   ├── src/
│   │   ├── adapter.ts
│   │   ├── benchmark.ts
│   │   ├── conversationDetector.ts
│   │   ├── dateSearch.ts
│   │   ├── developerPanel.ts
│   │   ├── domInspector.ts
│   │   ├── index.ts
│   │   ├── mutationTracker.ts
│   │   ├── scrollDetector.ts
│   │   ├── scrollEngine.ts
│   │   ├── timestampDetector.ts
│   │   └── types.ts
│   ├── tests/
│   │   ├── adapter.test.ts
│   │   ├── benchmark.test.ts
│   │   ├── conversationDetector.test.ts
│   │   ├── dateSearch.test.ts
│   │   ├── developerPanel.test.ts
│   │   ├── domInspector.test.ts
│   │   ├── fixtures.ts
│   │   ├── mutationTracker.test.ts
│   │   ├── scrollEngine.test.ts
│   │   ├── setup.ts
│   │   └── timestampDetector.test.ts
│   ├── README.md
│   ├── package-lock.json
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── public/
│   └── icon/
│       ├── 128.png
│       ├── 16.png
│       ├── 32.png
│       ├── 48.png
│       └── icon.svg
├── scripts/
│   ├── browser-smoke.mjs
│   ├── dev-smoke.mjs
│   ├── generate-icons.mjs
│   ├── phase2-browser-smoke.mjs
│   └── popup-session.mjs
├── src/
│   ├── adapters/
│   │   └── instagram/
│   │       ├── InstagramAdapter.ts
│   │       ├── conversationDetector.ts
│   │       ├── dateGroupDetector.ts
│   │       ├── domObserver.ts
│   │       ├── index.ts
│   │       ├── layoutDiagnostics.ts
│   │       ├── messageDetector.ts
│   │       ├── runtime.ts
│   │       ├── scrollContainerDetector.ts
│   │       ├── selectors.ts
│   │       └── timestampParser.ts
│   ├── components/
│   │   ├── ActionButton.tsx
│   │   ├── ConnectionStatus.tsx
│   │   ├── ConversationStatus.tsx
│   │   ├── DateSelector.tsx
│   │   ├── Header.tsx
│   │   └── StatusMessage.tsx
│   ├── core/
│   │   ├── ChatAdapter.ts
│   │   ├── messageTypes.ts
│   │   └── snapshot.ts
│   ├── hooks/
│   │   ├── useActiveTab.ts
│   │   └── useConversationSnapshot.ts
│   ├── messaging/
│   │   ├── contentListener.ts
│   │   ├── messages.ts
│   │   └── messagingService.ts
│   ├── services/
│   │   ├── browserClient.ts
│   │   └── platformDetection.ts
│   ├── styles/
│   │   └── theme.css
│   ├── types/
│   │   ├── extension.ts
│   │   └── platform.ts
│   └── utils/
│       ├── date.ts
│       └── errors.ts
├── tests/
│   ├── browser/
│   │   └── adapter-entry.ts
│   ├── instagram/
│   │   ├── conversationDetector.test.ts
│   │   ├── dateGroupDetector.test.ts
│   │   ├── domObserver.test.ts
│   │   ├── fixtures.ts
│   │   ├── integration.test.ts
│   │   ├── messageDetector.test.ts
│   │   ├── popup.test.tsx
│   │   ├── scrollContainerDetector.test.ts
│   │   └── timestampParser.test.ts
│   ├── date.test.ts
│   ├── design.test.ts
│   ├── fixtures.ts
│   ├── messaging.test.ts
│   ├── platformDetection.test.ts
│   ├── popup.test.tsx
│   └── setup.ts
├── .gitignore
├── README.md
├── eslint.config.mjs
├── package-lock.json
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── wxt.config.ts
```

Generated and Git-ignored: `node_modules/`, `phase0/node_modules/`, `.wxt/`, `.output/`, `phase0/dist/`, coverage and `artifacts/`. Production `.output/chrome-mv3` contains `manifest.json`, `popup.html`, hashed popup assets, the Instagram content script, and local icons. `.output/chrome-mv3-dev` additionally contains WXT development tooling; distribute only the production build.

## Phase 2 files created

The following files are newly added relative to the published Phase 1 baseline:

- `docs/images/popup-phase2-unverified.png`
- `docs/phase2-implementation.md`
- `scripts/phase2-browser-smoke.mjs`
- `src/adapters/instagram/InstagramAdapter.ts`
- `src/adapters/instagram/conversationDetector.ts`
- `src/adapters/instagram/dateGroupDetector.ts`
- `src/adapters/instagram/domObserver.ts`
- `src/adapters/instagram/layoutDiagnostics.ts`
- `src/adapters/instagram/messageDetector.ts`
- `src/adapters/instagram/runtime.ts`
- `src/adapters/instagram/scrollContainerDetector.ts`
- `src/adapters/instagram/selectors.ts`
- `src/adapters/instagram/timestampParser.ts`
- `src/components/ConversationStatus.tsx`
- `src/core/ChatAdapter.ts`
- `src/core/messageTypes.ts`
- `src/core/snapshot.ts`
- `src/hooks/useConversationSnapshot.ts`
- `tests/browser/adapter-entry.ts`
- `tests/instagram/conversationDetector.test.ts`
- `tests/instagram/dateGroupDetector.test.ts`
- `tests/instagram/domObserver.test.ts`
- `tests/instagram/fixtures.ts`
- `tests/instagram/integration.test.ts`
- `tests/instagram/messageDetector.test.ts`
- `tests/instagram/popup.test.tsx`
- `tests/instagram/scrollContainerDetector.test.ts`
- `tests/instagram/timestampParser.test.ts`

## Phase 2 files modified

- `README.md`
- `docs/architecture.md`
- `entrypoints/instagram.content.ts`
- `entrypoints/popup/App.tsx`
- `package.json`
- `scripts/browser-smoke.mjs`
- `src/hooks/useActiveTab.ts`
- `src/messaging/contentListener.ts`
- `src/messaging/messages.ts`
- `src/messaging/messagingService.ts`
- `tests/fixtures.ts`
- `tests/setup.ts`
- `vitest.config.ts`

No Phase 0 source, tests, reports, package files, root dependency lockfile, production permissions, or Git history were changed. Phase 1 handshake and existing test coverage are preserved. Phase 2 work is recorded here as implementation scope; this inventory makes no commit or publication claim.

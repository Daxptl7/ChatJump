# Architecture and file inventory

Phase 1 keeps browser APIs behind a client boundary, validates runtime messages, and isolates future platform DOM work from the React popup. Phase 0 remains its own independently installed project.

| Boundary | Responsibility |
|---|---|
| `entrypoints/popup/` | React popup bootstrap and layout |
| `entrypoints/instagram.content.ts` | Declarative Instagram-only listener lifecycle |
| `src/components/` | Semantic UI components and explanatory states |
| `src/hooks/useActiveTab.ts` | Bounded tab/message lifecycle, subscriptions, stale-response rejection |
| `src/messaging/` | Runtime request/response validators, deadlines, trusted listener |
| `src/services/` | Native Chrome API boundary and URL-only platform detection |
| `src/adapters/instagram/` | Readiness metadata; conversation detection deliberately unknown |
| `src/types/`, `src/utils/` | Shared types, fixed error messages, calendar selection |
| `src/styles/theme.css` | Solid palette, rectangular controls, focus, intrinsic popup sizing |
| `tests/` | Platform, messaging, date, UI lifecycle, and design/contrast tests |
| `scripts/` | Original icon rasterization and actual browser/HMR smoke checks |
| `public/icon/` | Original local SVG and generated PNG extension icons |
| `docs/` | Validation evidence, actual screenshots, architecture |
| `phase0/` | Preserved feasibility implementation and live-validation protocol |

There is no production background entrypoint. WXT generates its own development worker for reload tooling. Only Phase 0's pure date validator is imported into the extension; its unverified DOM/search engine is not imported.

## Complete source inventory

The tree lists every project file, including the preserved Phase 0 files. Generated dependency/build/runtime folders are listed separately below.

```text
Chatjump/
├── docs/
│   ├── images/
│   │   ├── popup-connected.png
│   │   └── popup-unsupported.png
│   ├── architecture.md
│   └── phase1-validation.md
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
│   └── popup-session.mjs
├── src/
│   ├── adapters/
│   │   └── instagram/
│   │       └── index.ts
│   ├── components/
│   │   ├── ActionButton.tsx
│   │   ├── ConnectionStatus.tsx
│   │   ├── DateSelector.tsx
│   │   ├── Header.tsx
│   │   └── StatusMessage.tsx
│   ├── hooks/
│   │   └── useActiveTab.ts
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

Generated and Git-ignored: `node_modules/`, `phase0/node_modules/`, `.wxt/`, `.output/chrome-mv3/`, `.output/chrome-mv3-dev/`, `phase0/dist/`, and `artifacts/`. Production output contains the generated manifest, `popup.html`, hashed popup JS/CSS assets, Instagram content script, and local icons.

## Creation and modification scope

Phase 1 creates the root package/configuration files, `entrypoints/`, `src/`, `tests/`, `public/`, `scripts/`, and `docs/`. It updates only the existing root `README.md` and `.gitignore`. No file inside `phase0/` is modified. Git history keeps the Phase 0 detection, controlled search, and developer-panel/report sessions as separate commits, followed by separate Phase 1 foundation, popup, and browser-validation/documentation commits.

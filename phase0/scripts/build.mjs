import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/chatjump-phase0.js',
  bundle: true,
  format: 'iife',
  globalName: 'ChatJumpPhase0',
  footer: { js: 'globalThis.ChatJumpPhase0 = ChatJumpPhase0;' },
  target: ['chrome120'],
  sourcemap: false,
  legalComments: 'none',
});

import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  webExt: { disabled: process.env.CHATJUMP_NO_BROWSER === '1' },
  manifestVersion: 3,
  manifest: {
    name: 'ChatJump',
    description: 'Navigate your conversations by date.',
    version: '0.1.0',
    permissions: ['activeTab'],
    action: { default_title: 'ChatJump', default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' } },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});

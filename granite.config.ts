import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'sugeun-jibguhagi',
  brand: {
    displayName: '수근수근 집구하기',
    primaryColor: '#D64A3A',
    icon: 'https://raw.githubusercontent.com/yijun-wade/sugeun-jibguhagi/main/public/icon.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});

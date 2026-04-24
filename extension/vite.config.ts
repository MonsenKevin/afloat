import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Plugin to copy manifest.json and background script into dist/
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      // Copy manifest.json to dist root
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      );

      // Copy background script if it exists (compiled separately)
      const bgSrc = resolve(__dirname, 'src/background/background.ts');
      const bgOutDir = resolve(__dirname, 'dist/src/background');
      if (!existsSync(bgOutDir)) mkdirSync(bgOutDir, { recursive: true });

      // Write a compiled JS version of the background script
      const bgContent = `
// Afloat background service worker
chrome.alarms.create('checkin-reminder', { periodInMinutes: 20160 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkin-reminder') {
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  }
  if (alarm.name === 'checkin-followup') {
    chrome.storage.local.get(['afloat_followup_flag'], (result) => {
      if (!result.afloat_followup_flag) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
        chrome.storage.local.set({ afloat_followup_flag: true });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'CLEAR_BADGE') {
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.remove(['afloat_followup_flag']);
  }
  if (msg.type === 'SET_FOLLOWUP_ALARM') {
    chrome.alarms.create('checkin-followup', { delayInMinutes: 2880 });
  }
});
`.trim();

      const { writeFileSync } = require('fs');
      writeFileSync(join(bgOutDir, 'background.js'), bgContent);

      console.log('✓ Copied manifest.json and background.js to dist/');
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

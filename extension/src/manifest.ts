import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AI Read Map',
  version: '0.1.0',
  description: 'Turn long webpages into a clickable map of key sections.',
  // no static content_scripts: the background worker injects the content
  // script on demand via chrome.scripting (activeTab) — see service-worker.ts
  permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
  // requested at runtime from the Generate click (see sidepanel/panel.ts):
  // activeTab expires on every navigation/tab switch, and the panel outlives
  // both, so durable host access needs a one-time Chrome-mediated consent.
  // No install warning; revocable in chrome://extensions.
  optional_host_permissions: ['http://*/*', 'https://*/*'],
  host_permissions: ['http://localhost:8787/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  action: {},
})

import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AI Read Map',
  version: '0.1.0',
  description: 'Turn long webpages into a clickable map of key sections.',
  permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
  host_permissions: ['http://localhost:8787/*'],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  // ponytail: broad host match here (not just activeTab) so the content
  // script's message listener is always present; the script itself stays
  // passive until EXTRACT_PAGE arrives (see src/content/index.ts), so this
  // doesn't violate the manual-trigger constraint. Spec §18 explicitly
  // sanctions broader permissions for the early/private-test phase this
  // MVP targets ("production should keep permissions as narrow as
  // possible"). Narrow to activeTab + chrome.scripting.executeScript
  // on-demand injection before a public/store release.
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  action: {},
})

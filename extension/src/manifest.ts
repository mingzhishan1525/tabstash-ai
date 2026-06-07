import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "TabStash AI",
  version: "0.1.0",
  description: "Close tabs without losing ideas. Save now. Organize later.",
  action: {
    default_title: "Open TabStash AI"
  },
  icons: {
    "128": "icon.svg"
  },
  background: {
    service_worker: "src/background.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/contentScript.ts"],
      run_at: "document_idle"
    }
  ],
  side_panel: {
    default_path: "sidepanel.html"
  },
  permissions: ["sidePanel", "tabs", "scripting", "storage", "activeTab", "downloads"],
  host_permissions: ["<all_urls>"]
};

export default manifest;

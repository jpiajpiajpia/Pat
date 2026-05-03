// Type declarations for the Electron preload bridge.
// `window.nexus` exists only when running inside the Nexus desktop app —
// in dev mode (browser) it is undefined, and code must fall back gracefully.

export {};

declare global {
  interface Window {
    nexus?: {
      /** Open a native folder picker. Returns the absolute path or null if cancelled. */
      pickFolder: () => Promise<string | null>;
      /** Open a file/folder in the default app. Returns "" on success or an error string. */
      openPath: (absPath: string) => Promise<string>;
    };
  }
}

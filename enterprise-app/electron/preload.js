const { contextBridge, ipcRenderer } = require("electron");

// Expose a tightly-scoped bridge to the renderer.
// The renderer uses these to ask the main process for native OS capabilities
// (file dialogs, etc.) that the web sandbox can't access directly.
contextBridge.exposeInMainWorld("nexus", {
  /**
   * Open a native folder picker. Returns the chosen absolute path, or null if
   * the user cancelled.
   */
  pickFolder: () => ipcRenderer.invoke("nexus:pick-folder"),
  /**
   * Open a file or folder in the user's default app via macOS LaunchServices
   * (Preview for PDFs, Keynote for .pptx, TextEdit for plain text, etc.).
   * Returns "" on success or an error string.
   */
  openPath: (absPath) => ipcRenderer.invoke("nexus:open-path", absPath),
});

const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const http = require("http");
const net = require("net");
const fs = require("fs");

// Dynamically discovered at boot — see findFreePort() below
let PORT = 0;
let nextProcess = null;
let mainWindow = null;
let bootError = null;

/**
 * Ask the OS for an unused TCP port. Avoids hard-coding 3000, which collides
 * with dev servers and any other Pat instance.
 *
 * Probes by binding to the IPv6 wildcard (`::`), which is what Next.js does
 * — binding to `127.0.0.1` would falsely report "free" when something else
 * holds `:::3000` because IPv4-specific and IPv6-wildcard bindings can coexist.
 */
function findFreePort(preferred = 3000) {
  const probe = (host, p) =>
    new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on("error", () => resolve(null));
      server.listen(p, host, () => {
        const actual = server.address().port;
        server.close(() => resolve(actual));
      });
    });

  return (async () => {
    // Try preferred port on IPv6 wildcard (matches Next.js binding behavior)
    let port = await probe("::", preferred);
    if (port) return port;
    // Try IPv4 wildcard in case of IPv6 disabled
    port = await probe("0.0.0.0", preferred);
    if (port) return port;
    // Let the OS pick anything available
    port = await probe("::", 0);
    if (port) return port;
    return await probe("0.0.0.0", 0);
  })();
}

function getAppRoot() {
  // App is in asar; use this for things resolved via require()
  if (!app.isPackaged) return path.join(__dirname, "..");
  return path.join(process.resourcesPath, "app.asar");
}

function getUnpackedRoot() {
  // Native binaries and JS scripts that get spawned live here (asarUnpack)
  if (!app.isPackaged) return path.join(__dirname, "..");
  return path.join(process.resourcesPath, "app.asar.unpacked");
}

function getDbPath() {
  return path.join(app.getPath("userData"), "nexus.db");
}

function logBoot(msg) {
  const logPath = path.join(app.getPath("userData"), "boot.log");
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  console.log(msg);
}

function ensureDb() {
  const dbPath = getDbPath();
  const appRoot = getAppRoot();
  const unpackedRoot = getUnpackedRoot();

  // Ensure userData dir exists before Prisma tries to create the SQLite file
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Prisma is asar-unpacked so its native engines can be loaded
  const prismaScript = path.join(unpackedRoot, "node_modules", "prisma", "build", "index.js");
  const schemaPath = path.join(unpackedRoot, "prisma", "schema.prisma");

  if (!fs.existsSync(prismaScript)) {
    logBoot(`Prisma not found at ${prismaScript}`);
    return;
  }
  if (!fs.existsSync(schemaPath)) {
    logBoot(`Schema not found at ${schemaPath}`);
    return;
  }

  try {
    // Use Electron-as-Node to run Prisma's CLI script
    const out = execFileSync(
      process.execPath,
      [prismaScript, "db", "push", "--skip-generate", `--schema=${schemaPath}`],
      {
        cwd: unpackedRoot,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          DATABASE_URL: `file:${dbPath}`,
        },
        stdio: "pipe",
      }
    );
    logBoot(`Prisma db push OK: ${out.toString().split("\n").slice(-2).join(" ")}`);
  } catch (err) {
    logBoot(`Prisma db push failed: ${err.message}`);
  }
}

function waitForServer(retries = 80, delay = 500) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      const req = http.get(`http://localhost:${PORT}/api/user`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (n <= 0) return reject(new Error("Server did not start in time"));
        setTimeout(() => attempt(n - 1), delay);
      });
      req.setTimeout(500, () => {
        req.destroy();
        if (n <= 0) return reject(new Error("Server did not start in time"));
        setTimeout(() => attempt(n - 1), delay);
      });
    }
    attempt(retries);
  });
}

function startNextServer() {
  const appRoot = getAppRoot();
  const unpackedRoot = getUnpackedRoot();
  const dbPath = getDbPath();

  // The Next.js CLI script lives in asar.unpacked so it (and its workers) can be spawned
  const nextScript = path.join(unpackedRoot, "node_modules", "next", "dist", "bin", "next");

  if (!fs.existsSync(nextScript)) {
    bootError = `Next.js binary not found at ${nextScript}`;
    logBoot(bootError);
    return;
  }

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",            // run Electron's bundled node
    PORT: String(PORT),
    NODE_ENV: "production",
    DATABASE_URL: `file:${dbPath}`,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  };

  logBoot(`Starting Next.js: ${process.execPath} ${nextScript} start --port ${PORT}`);
  logBoot(`cwd=${unpackedRoot}  db=${dbPath}`);

  nextProcess = spawn(process.execPath, [nextScript, "start", "--port", String(PORT)], {
    cwd: unpackedRoot,
    env,
    stdio: "pipe",
  });

  nextProcess.stdout.on("data", (d) => logBoot(`[next] ${d.toString().trim()}`));
  nextProcess.stderr.on("data", (d) => logBoot(`[next:err] ${d.toString().trim()}`));
  nextProcess.on("error", (err) => logBoot(`Next.js process error: ${err.message}`));
  nextProcess.on("exit", (code, sig) => logBoot(`Next.js exited code=${code} sig=${sig}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#09090b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "icons", "icon.png"),
  });

  if (bootError) {
    mainWindow.loadURL(
      `data:text/html,<html><body style="background:#141210;color:#EDE8E0;font-family:-apple-system;padding:40px;"><h2 style="color:#C8A96E;">Pat failed to start</h2><pre style="color:#f87171;background:#1c1a17;padding:16px;border-radius:8px;overflow:auto;">${encodeURIComponent(bootError)}</pre><p style="color:#7A7060;">Boot log: ${app.getPath("userData")}/boot.log</p></body></html>`
    );
  } else {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC: open a path in the user's default app (Preview for PDF, Keynote for PPTX, etc.)
ipcMain.handle("nexus:open-path", async (_e, absPath) => {
  if (typeof absPath !== "string" || !absPath) return "Invalid path";
  return shell.openPath(absPath);
});

// IPC: native folder picker for the Code workspace
ipcMain.handle("nexus:pick-folder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose workspace folder",
    properties: ["openDirectory", "createDirectory"],
    buttonLabel: "Use this folder",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  // Reset boot log on each launch
  try { fs.writeFileSync(path.join(app.getPath("userData"), "boot.log"), ""); } catch {}

  if (app.isPackaged) {
    ensureDb();
  }

  // Pick a free port. Try 3000 first; if busy (dev server, another Pat, etc.),
  // fall back to whatever the OS hands out. This eliminates the EADDRINUSE
  // crash that has haunted us across builds.
  PORT = await findFreePort(3000);
  logBoot(`Using port ${PORT}`);

  startNextServer();

  try {
    await waitForServer();
    logBoot("Server is ready");
  } catch (e) {
    bootError = `Server failed to start: ${e.message}`;
    logBoot(bootError);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess) {
    nextProcess.kill("SIGTERM");
    nextProcess = null;
  }
});

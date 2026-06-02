const { app, BrowserWindow } = require("electron");
const { fork } = require("child_process");
const path = require("path");

let serverProcess;

function createWindow() {
  const win = new BrowserWindow({
    show: false,
    minWidth: 1000,
    minHeight: 700,
  });

  win.loadURL("http://localhost:3001");

  win.maximize();
  win.show();
}

app.whenReady().then(() => {
  serverProcess = fork(
    path.join(__dirname, "../server/src/server.cjs")
  );

  setTimeout(() => {
    createWindow();
  }, 2000);
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }

  app.quit();
});
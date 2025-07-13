const chokidar = require("chokidar");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");

const WATCH_FOLDER = "C:\\PCSX2\\memcards";
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const DEBOUNCE_DELAY = 5000;

let changeQueue = new Set();
let batchTimeout = null;
let isPushing = false;
let retryCount = 0;

function getLocalizedTimestamp() {
  const now = new Date();
  const localizedDateTime = now.toLocaleString();
  return localizedDateTime;
}

function checkInternetConnection(callback) {
  https
    .get("https://www.google.com", (res) => {
      callback(true);
    })
    .on("error", (e) => {
      console.error(`Internet connection check failed: ${e.message}`);
      callback(false);
    });
}

async function executeCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Executing command: "${command}" in "${cwd}"`);
    exec(command, { cwd: cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Command failed: ${command}`);
        console.error(`Error message: ${error.message}`);
        error.code = error.code || 1;
        if (stdout) console.error(`Stdout (on error): ${stdout}`);
        if (stderr) console.error(`Stderr (on error): ${stderr}`);
        return reject(error);
      }
      if (stdout) {
        console.log(`Stdout: ${stdout.trim()}`);
      }
      if (stderr && !stderr.toLowerCase().includes("warning")) {
        console.warn(`Stderr (non-warning): ${stderr.trim()}`);
      } else if (stderr) {
        console.log(`Stderr (warning/info): ${stderr.trim()}`);
      }
      resolve(stdout);
    });
  });
}

async function lightweightGitCleanup() {
  console.log("🧹 Performing lightweight Git cleanup...");
  const lockFile = path.join(WATCH_FOLDER, ".git", "index.lock");

  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.log(`✅ Git lock file removed.`);
    } catch (e) {
      console.error(`❌ Failed to remove lock file: ${e.message}`);
    }
  }

  try {
    await executeCommand("git pull origin main", WATCH_FOLDER);
    console.log("✅ Git updated from remote");
  } catch (error) {
    console.warn(`⚠️ Git pull failed: ${error.message}`);
  }
}

async function verifyFileExists(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile();
  } catch (error) {
    return false;
  }
}

async function waitForFileRelease(filePath, maxWaitTime = 10000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const fd = await fs.promises.open(filePath, "r+");
      await fd.close();
      return true;
    } catch (error) {
      if (error.code === "EBUSY" || error.code === "ENOENT") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      return true;
    }
  }

  console.warn(`⚠️ File may still be locked: ${filePath}`);
  return false;
}

async function gitPush() {
  if (changeQueue.size === 0 || isPushing) {
    console.log(
      "Skipping push: No changes to commit or another push operation is active."
    );
    return;
  }

  isPushing = true;
  const filesToPush = Array.from(changeQueue);
  changeQueue.clear();

  console.log(
    `🔄 Processing ${filesToPush.length} file(s): ${filesToPush.join(", ")}`
  );

  try {
    await lightweightGitCleanup();

    const existingFiles = [];
    for (const file of filesToPush) {
      const fullPath = path.join(WATCH_FOLDER, file);
      if (await verifyFileExists(fullPath)) {
        await waitForFileRelease(fullPath);
        existingFiles.push(file);
      } else {
        console.log(`⚠️ File not found, skipping: ${file}`);
      }
    }

    if (existingFiles.length === 0) {
      console.log("ℹ️ No valid files to push");
      return;
    }

    for (const file of existingFiles) {
      try {
        const fullPath = path.join(WATCH_FOLDER, file);
        console.log(`➕ Adding: ${file}`);
        await executeCommand(`git add "${fullPath}"`, WATCH_FOLDER);
      } catch (addError) {
        console.warn(`⚠️ Failed to add ${file}: ${addError.message}`);
      }
    }

    try {
      const statusOutput = await executeCommand(
        "git status --porcelain",
        WATCH_FOLDER
      );
      if (!statusOutput.trim()) {
        console.log("ℹ️ Git reports no changes, but forcing commit anyway...");
        for (const file of existingFiles) {
          const fullPath = path.join(WATCH_FOLDER, file);
          await executeCommand(`git add -f "${fullPath}"`, WATCH_FOLDER);
        }
      }
    } catch (statusError) {
      console.error(`❌ Error checking Git status: ${statusError.message}`);
    }

    const localTimestamp = getLocalizedTimestamp();
    const commitMessage = `Update saves: ${existingFiles.join(
      ", "
    )} - ${localTimestamp}`;
    console.log(`📝 Force committing with message: "${commitMessage}"`);

    await executeCommand(
      `git commit --allow-empty -m "${commitMessage}"`,
      WATCH_FOLDER
    );

    console.log("🚀 Pushing to origin/main...");
    await executeCommand("git push origin main", WATCH_FOLDER);
    console.log(`✅ Push complete for: ${existingFiles.join(", ")}`);

    retryCount = 0;
  } catch (error) {
    console.error(`❌ Error during push: ${error.message}`);

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(
        `🔄 Retrying in ${RETRY_DELAY}ms (attempt ${retryCount}/${MAX_RETRIES})`
      );

      setTimeout(async () => {
        filesToPush.forEach((file) => changeQueue.add(file));
        isPushing = false;
        await gitPush();
      }, RETRY_DELAY);
      return;
    } else {
      console.error(`❌ Max retries exceeded. Resetting retry counter.`);
      retryCount = 0;
    }
  } finally {
    isPushing = false;
  }
}

function queueFile(filePath) {
  const fileName = path.basename(filePath);
  if (!fileName.endsWith(".ps2")) {
    console.log(`Skipping non-.ps2 file: ${fileName}`);
    return;
  }

  console.log(`📝 Queuing file: ${fileName}`);
  changeQueue.add(fileName);

  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }

  batchTimeout = setTimeout(() => {
    console.log(`⏰ Debounce period ended, processing queued files...`);
    gitPush();
  }, DEBOUNCE_DELAY);
}

function startWatcher() {
  console.log(`📁 Initializing file watcher for PCSX2 saves...`);
  const watcher = chokidar.watch(WATCH_FOLDER, {
    persistent: true,
    usePolling: true,
    interval: 3000,
    ignoreInitial: true,
    ignored: ["**/.git/**", "**/.*", "**/tmp_*"],
    awaitWriteFinish: {
      stabilityThreshold: 5000,
      pollInterval: 500,
    },
  });

  watcher
    .on("change", queueFile)
    .on("add", queueFile)
    .on("ready", () => console.log(`✅ Monitoring: ${WATCH_FOLDER}`))
    .on("error", (error) =>
      console.error(`❌ Watcher error: ${error.message}`)
    );

  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    watcher.close();

    if (changeQueue.size > 0) {
      console.log(
        "⏳ Pending changes detected. Attempting final push before exiting..."
      );
      gitPush()
        .then(() => {
          setTimeout(() => process.exit(0), 2000);
        })
        .catch(() => {
          setTimeout(() => process.exit(1), 2000);
        });
    } else {
      process.exit(0);
    }
  });

  console.log(`Starting PCSX2 save auto-push service.`);
}

checkInternetConnection((isConnected) => {
  if (!isConnected) {
    console.error(
      "❌ No internet connection detected. Script terminated. Please check your network."
    );
    process.exit(1);
  } else {
    console.log("🌐 Internet connected. Proceeding to start the script...");
    startWatcher();
  }
});
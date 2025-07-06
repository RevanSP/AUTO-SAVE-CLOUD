# 🕹️ PCSX2 Memory Card Auto Git Push

Automatically back up your PCSX2 memory card (`.ps2`) files to a remote Git repository whenever they change. This script monitors your PCSX2 memory card folder and automatically commits and pushes save file changes to your Git repository with intelligent batching and retry mechanisms.

---

## ✨ Features

* 🔄 **Automatic Detection:** Watches for changes and additions to `.ps2` files in your memory card folder
* 📝 **Smart Filtering:** Only `.ps2` files are processed, ignoring Git files and temporary files
* ⏱️ **Intelligent Batching:** Groups multiple rapid changes into single commits using a 5-second debounce delay
* 🔄 **Retry Mechanism:** Automatically retries failed pushes up to 3 times with 2-second delays
* 🔒 **Git Lock Handling:** Automatically removes Git lock files and performs lightweight cleanup
* 🌐 **Internet Check:** Verifies internet connection before starting
* 📁 **File Validation:** Ensures files exist and are not locked before processing
* 🛑 **Graceful Shutdown:** On exit (`Ctrl+C`), attempts to push any pending changes
* 🚀 **Force Commit:** Uses `--allow-empty` to ensure commits are created even when Git thinks there are no changes

---

## 📦 Installation

1. **Prerequisites**
   - Node.js installed on your system
   - Git configured with proper credentials for your repository
   - PCSX2 memory card folder already set up

2. **Install Dependencies**
   ```bash
   npm install chokidar
   ```

3. **Place the Script**
   Save the script file (e.g., `script.js`) in a convenient location (doesn't need to be in the memory card folder)

---

## ⚙️ Configuration

1. **Set the Watch Folder**
   Update the path in the script to match your PCSX2 memory card folder:
   ```js
   const WATCH_FOLDER = "C:\\PCSX2\\memcards";
   ```

2. **Initialize Git Repository**
   If not already done, initialize a Git repo in your memory card folder:
   ```bash
   cd "C:\PCSX2\memcards"
   git init
   git remote add origin https://github.com/yourusername/your-repo.git
   git branch -M main
   git add .
   git commit -m "Initial save upload"
   git push -u origin main
   ```

3. **Configure Git Identity**
   Set your Git username and email if not already configured:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

---

## ▶️ Running the Script

Start the watcher using Node.js:
```bash
node script.js
```

### Example Output:

**On Startup:**
```
🌐 Internet connected. Proceeding to start the script...
📁 Initializing file watcher for PCSX2 saves...
✅ Monitoring: C:\PCSX2\memcards
Starting PCSX2 save auto-push service.
```

**When Files Change:**
```
📝 Queuing file: Mcd001.ps2
⏰ Debounce period ended, processing queued files...
🔄 Processing 1 file(s): Mcd001.ps2
🧹 Performing lightweight Git cleanup...
✅ Git updated from remote
➕ Adding: Mcd001.ps2
📝 Force committing with message: "Update saves: Mcd001.ps2 - 2025-07-06T10:30:00.000Z"
🚀 Pushing to origin/main...
✅ Push complete for: Mcd001.ps2
```

To stop the script, press `Ctrl+C`. Any pending changes will be processed before shutdown.

---

## 🔍 How It Works

1. **Internet Connectivity Check**
   The script first verifies internet connection by attempting to reach Google. If offline, it exits immediately.

2. **File System Monitoring**
   Uses [`chokidar`](https://www.npmjs.com/package/chokidar) with polling mode to reliably detect changes to `.ps2` files. The watcher:
   - Ignores hidden files, Git files, and temporary files
   - Uses a 5-second stability threshold to ensure files are fully written
   - Polls every 3 seconds for changes

3. **Change Queue System**
   When changes are detected:
   - Files are added to a queue (`changeQueue`)
   - A 5-second debounce timer starts/resets
   - When the timer expires, all queued files are processed together

4. **Git Operations**
   For each batch of files:
   - Performs lightweight Git cleanup (removes lock files, pulls latest changes)
   - Validates each file exists and waits for file locks to release
   - Adds files to Git staging area
   - Creates a commit with timestamp and file list
   - Pushes to `origin/main`

5. **Error Handling & Retries**
   - Failed operations are retried up to 3 times with 2-second delays
   - Git lock files are automatically removed
   - Missing files are skipped with warnings
   - Detailed error logging for troubleshooting

6. **Graceful Shutdown**
   On `Ctrl+C`, the script processes any remaining queued files before exiting.

---

## 🛠 Customization Options

### Timing Configuration
```js
const MAX_RETRIES = 3;           // Number of retry attempts
const RETRY_DELAY = 2000;        // Delay between retries (ms)
const DEBOUNCE_DELAY = 5000;     // Batching delay (ms)
```

### File Type Filtering
Change the file extension check in `queueFile()`:
```js
if (!fileName.endsWith(".ps2")) {
  // Add other extensions: .sav, .mcr, etc.
  return;
}
```

### Commit Message Format
Modify the commit message in `gitPush()`:
```js
const commitMessage = `Update saves: ${existingFiles.join(", ")} - ${new Date().toISOString()}`;
```

### Watcher Options
Adjust the `chokidar` configuration:
```js
const watcher = chokidar.watch(WATCH_FOLDER, {
  persistent: true,
  usePolling: true,
  interval: 3000,                    // Polling interval
  ignoreInitial: true,
  ignored: ["**/.git/**", "**/.*", "**/tmp_*"],
  awaitWriteFinish: {
    stabilityThreshold: 5000,        // Wait time for file stability
    pollInterval: 500,
  },
});
```

---

## ❗ Troubleshooting

### Common Issues

**"No internet connection detected"**
- Ensure you have an active internet connection
- Check if firewall is blocking the script
- Try running as administrator

**"Git lock file removed" messages**
- This is normal - the script automatically handles Git lock files
- If persistent, ensure no other Git operations are running

**"File not found, skipping"**
- PCSX2 might be using temporary files during save operations
- The script waits for file stability before processing

**Authentication errors**
- Configure Git credentials: `git config --global credential.helper store`
- Or use SSH keys for authentication
- Ensure your repository remote URL is correct

**Permission denied errors**
- Run the script as administrator
- Check folder permissions for the memory card directory

### Debug Information
The script provides detailed logging for troubleshooting:
- File queue operations
- Git command execution
- Error messages with context
- Retry attempts and status

---

## 📊 Performance Notes

- **Polling Mode:** Uses file system polling for reliability across different systems
- **Debounce Batching:** Groups rapid changes to avoid excessive commits
- **File Lock Detection:** Waits for files to be fully written before processing
- **Lightweight Operations:** Minimal Git operations to reduce overhead

---

## 📝 License

This project is free and open-source. You're welcome to use, modify, and distribute it as needed.
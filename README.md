# 🕹️ PCSX2 Memory Card Auto Git Push

Automatically back up your PCSX2 memory card (`.ps2`) files to a remote Git repository whenever they change. This script monitors your PCSX2 memory card folder and automatically commits and pushes save file changes to your Git repository.

---

## ✨ Features

* 🔄 **Automatic Detection:** Watches for changes and additions to `.ps2` files in your memory card folder.
* 📝 **Smart Filtering:** Only `.ps2` files are processed.
* 🚀 **Auto Commit & Push:** Automatically commits and pushes changes to your remote repository.
* 🔒 **Lock File Handling:** Removes Git lock files if present to prevent push failures.
* 🌐 **Internet Check:** Verifies internet connection before starting.
* 🛑 **Graceful Shutdown:** On exit (`Ctrl+C`), attempts to push any pending changes.

---

## 📦 Installation

1. **Place the Script**

   Save the script file (e.g., `script.js`) in your PCSX2 memory card folder (e.g., `C:\PCSX2\memcards`).

2. **Install Bun**

   If you don't already have Bun installed, you can install it via the official installer:

   ```sh
   curl -fsSL https://bun.sh/install | bash
   ```

3. **Install Dependencies**

   Inside the project folder, run:

   ```sh
   bun install
   ```

   This installs the `chokidar` dependency as listed in the `package.json`.

---

## ⚙️ Configuration

1. **Set the Watch Folder**

   By default, the script watches this path:

   ```js
   const WATCH_FOLDER = 'C:\\PCSX2\\memcards';
   ```

   If your memory card folder is different, update the value accordingly.

2. **Initialize a Git Repository**

   If not already done, initialize a Git repo in the memory card folder:

   ```sh
   cd "C:\PCSX2\memcards"
   git init
   git remote add origin https://github.com/yourusername/your-repo.git
   git branch -M main
   git add .
   git commit -m "Initial save upload"
   git push -u origin main
   ```

3. **Set Git Identity**

   Configure your Git username and email (if not already done):

   ```sh
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

---

## ▶️ Running the Script

Start the watcher using Bun:

```sh
bun script.js
```

### Example Output:

```
🌐 Internet connected. Proceeding to start the script...
📁 Initializing file watcher for PCSX2 saves...
✅ Monitoring: C:\PCSX2\memcards
Starting PCSX2 save auto-push service.
```

When a `.ps2` file is changed or added:

```
📝 Queuing and forcing re-push: Mcd001.ps2
🔄 Forcing re-push of 1 file(s): Mcd001.ps2
🗑️ Running: git rm --cached "C:\PCSX2\memcards\Mcd001.ps2"
➕ Re-adding: git add "C:\PCSX2\memcards\Mcd001.ps2"
📝 Committing with message: "Force re-upload saves: Mcd001.ps2"
🚀 Pushing to origin/main...
✅ Force push complete for: Mcd001.ps2
```

To stop the script, press `Ctrl+C`. If any changes are pending, it will attempt a final push before exiting.

---

## 🔍 How It Works (Detailed)

1. **Internet Check**
   Before starting, the script checks for an active internet connection by pinging `https://www.google.com`. If not connected, it exits.

2. **File Watching**
   Uses [`chokidar`](https://www.npmjs.com/package/chokidar) to monitor the folder for `.ps2` file changes or additions. Ignores hidden and Git files.

3. **Change Queue**
   When a change is detected, the filename is added to a queue (`changeQueue`). The script immediately triggers a Git push operation (no batching/delays).

4. **Git Operations**
   For each file:

   * Run `git rm --cached` to untrack the file.
   * Run `git add` to re-track it.
   * Commit with a message like: `Force re-upload saves: Mcd001.ps2`
   * Push to `origin/main`.

   If `.git/index.lock` exists, it’s deleted to unblock the process.

5. **Graceful Shutdown**
   On `Ctrl+C`, if files are queued for push, the script completes one final push before exiting.

6. **Error Handling**

   * Git command errors are caught and logged.
   * If `.git/index.lock` can’t be deleted, the push is skipped to prevent corruption.

---

## 🛠 Customization

* **Monitor Other File Types:**
  Change the file extension check in `queueFile()`:

  ```js
  if (!fileName.endsWith('.ps2')) return;
  ```

* **Add Batching (Optional):**
  Implement a debounce or timeout before `gitPush()` to group multiple quick changes into one commit.

* **Edit Commit Messages:**
  Change the format in the `gitPush()` function:

  ```js
  const commitMessage = `Force re-upload saves: ${filesToPush.join(', ')}`;
  ```

---

## ❗ Troubleshooting

* **Authentication Issues:**
  Ensure Git credentials are configured properly. Use SSH keys or a credential helper for HTTPS.

* **Permission Errors:**
  Run the script as administrator if accessing protected folders.

* **No Internet Detected:**
  The script won’t run if offline. Ensure you're connected to the internet.

* **Git Lock File Exists:**
  The script will attempt to auto-remove it. If it fails, remove `.git/index.lock` manually.

---

## 📝 License

This project is free and open-source. You’re welcome to use, modify, and distribute it as needed.
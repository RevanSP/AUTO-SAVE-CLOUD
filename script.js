const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const WATCH_FOLDER = 'C:\\PCSX2\\memcards';

let changeQueue = new Set();
let batchTimeout = null;
let isPushing = false;

function checkInternetConnection(callback) {
    https.get('https://www.google.com', (res) => {
        callback(true);
    }).on('error', (e) => {
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
            if (stderr && !stderr.toLowerCase().includes('warning')) {
                console.warn(`Stderr (non-warning): ${stderr.trim()}`);
            } else if (stderr) {
                console.log(`Stderr (warning/info): ${stderr.trim()}`);
            }
            resolve(stdout);
        });
    });
}

async function gitPush() {
    if (changeQueue.size === 0 || isPushing) {
        console.log("Skipping push: No changes to commit or another push operation is active.");
        return;
    }

    isPushing = true;
    const filesToPush = Array.from(changeQueue);
    changeQueue.clear();

    console.log(`🔄 Forcing re-push of ${filesToPush.length} file(s): ${filesToPush.join(', ')}`);

    const lockFile = path.join(WATCH_FOLDER, '.git', 'index.lock');
    if (fs.existsSync(lockFile)) {
        try {
            fs.unlinkSync(lockFile);
            console.log(`✅ Git lock file removed.`);
        } catch (e) {
            console.error(`❌ Failed to remove lock file: ${e.message}`);
            isPushing = false;
            return;
        }
    }

    try {
        for (const file of filesToPush) {
            const fullPath = path.join(WATCH_FOLDER, file);

            console.log(`🗑️ Running: git rm --cached "${fullPath}"`);
            await executeCommand(`git rm --cached "${fullPath}"`, WATCH_FOLDER);

            console.log(`➕ Re-adding: git add "${fullPath}"`);
            await executeCommand(`git add "${fullPath}"`, WATCH_FOLDER);
        }

        const commitMessage = `Force re-upload saves: ${filesToPush.join(', ')}`;
        console.log(`📝 Committing with message: "${commitMessage}"`);
        await executeCommand(`git commit -m "${commitMessage}"`, WATCH_FOLDER);

        console.log('🚀 Pushing to origin/main...');
        await executeCommand('git push origin main', WATCH_FOLDER);
        console.log(`✅ Force push complete for: ${filesToPush.join(', ')}`);
    } catch (error) {
        console.error(`❌ Error during forced push: ${error.message}`);
    } finally {
        isPushing = false;
    }
}

function queueFile(filePath) {
    const fileName = path.basename(filePath);
    if (!fileName.endsWith('.ps2')) {
        console.log(`Skipping non-.ps2 file: ${fileName}`);
        return;
    }

    console.log(`📝 Queuing and forcing re-push: ${fileName}`);
    changeQueue.add(fileName);
    gitPush();
}

function startWatcher() {
    console.log(`📁 Initializing file watcher for PCSX2 saves...`);
    const watcher = chokidar.watch(WATCH_FOLDER, {
        persistent: true,
        usePolling: true,
        interval: 2000,
        ignoreInitial: true,
        ignored: ['**/.git/**', '**/.*'],
        awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 100 }
    });

    watcher
        .on('change', queueFile)
        .on('add', queueFile)
        .on('ready', () => console.log(`✅ Monitoring: ${WATCH_FOLDER}`));

    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        if (changeQueue.size > 0) {
            console.log('⏳ Pending changes detected. Attempting final push before exiting...');
            gitPush().then(() => {
                setTimeout(() => process.exit(0), 1000);
            }).catch(() => {
                setTimeout(() => process.exit(1), 1000);
            });
        } else {
            process.exit(0);
        }
    });

    console.log(`Starting PCSX2 save auto-push service.`);
}

checkInternetConnection((isConnected) => {
    if (!isConnected) {
        console.error('❌ No internet connection detected. Script terminated. Please check your network.');
        process.exit(1);
    } else {
        console.log('🌐 Internet connected. Proceeding to start the script...');
        startWatcher();
    }
});
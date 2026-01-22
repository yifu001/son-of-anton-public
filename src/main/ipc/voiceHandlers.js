/**
 * Voice IPC Handlers
 * Bridge between renderer audio capture and main process voice processing
 */

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables from project root .env file
require('dotenv').config({ path: path.join(__dirname, '../../..', '.env') });

const { WakeWordDetector } = require('../voice/wakeWordDetector');
const { WhisperClient } = require('../voice/whisperClient');

let wakeWordDetector = null;
let whisperClient = null;
let mainWindow = null;

/**
 * Get the path to the wake word model file
 * Handles both development and packaged app scenarios
 */
function getModelPath() {
  // In development: project_root/resources/wake-word/son-of-anton.ppn
  // In packaged app: app.asar/../resources/wake-word/son-of-anton.ppn
  const devPath = path.join(__dirname, '../../..', 'resources/wake-word/son-of-anton.ppn');
  if (fs.existsSync(devPath)) {
    return devPath;
  }

  // Fallback for packaged app (resources unpacked)
  const { app } = require('electron');
  const resourcesPath = process.resourcesPath || path.dirname(app.getAppPath());
  const packagedPath = path.join(resourcesPath, 'resources/wake-word/son-of-anton.ppn');
  return packagedPath;
}

/**
 * Setup voice IPC handlers
 * @param {BrowserWindow} window - Main Electron window
 */
function setupVoiceIPC(window) {
  mainWindow = window;

  // Check voice availability
  ipcMain.handle('voice:check-availability', () => {
    const accessKey = process.env.PICOVOICE_ACCESS_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const modelPath = getModelPath();
    const modelExists = fs.existsSync(modelPath);

    console.log('[VoiceIPC] Checking availability:');
    console.log('[VoiceIPC]   - PICOVOICE_ACCESS_KEY:', accessKey ? 'set' : 'not set');
    console.log('[VoiceIPC]   - OPENAI_API_KEY:', openaiKey ? 'set' : 'not set');
    console.log('[VoiceIPC]   - Model path:', modelPath);
    console.log('[VoiceIPC]   - Model exists:', modelExists);

    return {
      available: !!(accessKey && openaiKey && modelExists),
      hasAccessKey: !!accessKey,
      hasOpenAIKey: !!openaiKey,
      hasModel: modelExists,
      modelPath: modelExists ? modelPath : null,
    };
  });

  // Initialize voice services
  ipcMain.handle('voice:initialize', async () => {
    try {
      const accessKey = process.env.PICOVOICE_ACCESS_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!accessKey) {
        throw new Error('PICOVOICE_ACCESS_KEY not configured in .env file');
      }
      if (!openaiKey) {
        throw new Error('OPENAI_API_KEY not configured in .env file');
      }

      // Determine model path
      const modelPath = getModelPath();
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Wake word model not found at: ${modelPath}`);
      }

      wakeWordDetector = new WakeWordDetector(accessKey, modelPath);
      whisperClient = new WhisperClient(openaiKey);

      const audioReqs = wakeWordDetector.initialize();
      console.log('[VoiceIPC] Voice services initialized');

      return {
        success: true,
        ...audioReqs,
      };
    } catch (error) {
      console.error('[VoiceIPC] Initialization failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Process audio frame for wake word detection
  ipcMain.on('voice:audio-frame', (event, frameData) => {
    if (!wakeWordDetector) return;

    // Convert from regular array to Int16Array if needed
    const frame = frameData instanceof Int16Array
      ? frameData
      : new Int16Array(frameData);

    const detected = wakeWordDetector.processFrame(frame);
    if (detected) {
      event.sender.send('voice:wake-word-detected');
    }
  });

  // Transcribe audio with Whisper
  ipcMain.handle('voice:transcribe', async (event, audioData) => {
    if (!whisperClient) {
      return { success: false, error: 'Whisper client not initialized' };
    }

    try {
      // Convert from regular array to Buffer if needed
      const audioBuffer = Buffer.isBuffer(audioData)
        ? audioData
        : Buffer.from(audioData);

      const text = await whisperClient.transcribe(audioBuffer);
      return { success: true, text };
    } catch (error) {
      console.error('[VoiceIPC] Transcription failed:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Release voice services
  ipcMain.on('voice:release', () => {
    if (wakeWordDetector) {
      wakeWordDetector.release();
      wakeWordDetector = null;
    }
    whisperClient = null;
    console.log('[VoiceIPC] Voice services released');
  });
}

/**
 * Cleanup voice IPC handlers
 */
function cleanupVoiceIPC() {
  if (wakeWordDetector) {
    wakeWordDetector.release();
    wakeWordDetector = null;
  }
  whisperClient = null;
}

module.exports = { setupVoiceIPC, cleanupVoiceIPC };

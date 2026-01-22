---
phase: 09-voice-foundation
plan: 01
subsystem: voice
tags: [porcupine, whisper, wake-word, speech-to-text, ipc]
dependency-graph:
  requires: []
  provides: [wake-word-detection, speech-transcription, voice-ipc]
  affects: [09-02, 10-01, 10-02]
tech-stack:
  added: ["@picovoice/porcupine-node@4.0.1", "openai@4.10.0", "dotenv@17.2.3"]
  patterns: [ipc-handlers, singleton-modules, factory-pattern]
key-files:
  created:
    - src/main/voice/wakeWordDetector.js
    - src/main/voice/whisperClient.js
    - src/main/ipc/voiceHandlers.js
  modified:
    - src/package.json
    - src/package-lock.json
decisions:
  - id: porcupine-node-sdk
    decision: Use @picovoice/porcupine-node for wake word detection
    rationale: Native Node.js bindings more stable than WASM in Electron main process
  - id: openai-4.10.0-pinned
    decision: Pin openai package to 4.10.0
    rationale: Last version compatible with Node 16 (Electron 12 constraint)
  - id: dotenv-for-config
    decision: Use dotenv for loading API keys from .env file
    rationale: Standard pattern, keeps secrets out of code
  - id: main-process-voice
    decision: Run Porcupine and Whisper in main process
    rationale: CPU-intensive work offloaded from renderer, consistent with ClaudeStateManager pattern
metrics:
  duration: 5m15s
  completed: 2026-01-22
---

# Phase 9 Plan 01: Voice Infrastructure Setup Summary

**One-liner:** Porcupine wake word detector and Whisper transcription client with IPC bridge for renderer communication.

## Objective Achieved

Created standalone voice infrastructure modules that Plan 02 will wire into the application. The modules are:
- **WakeWordDetector** - Processes 16kHz Int16Array audio frames, returns boolean on "Son of Anton" detection
- **WhisperClient** - Sends audio buffers to OpenAI Whisper API, returns transcription text
- **voiceHandlers** - IPC bridge exposing voice functionality to renderer process

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 0 | User Setup - Picovoice Account and Model | N/A (user) | Complete |
| 1 | Install Dependencies | 716f530 | Complete |
| 2 | Create Wake Word Detector and Whisper Client | 56cbe78 | Complete |
| 3 | Create Voice IPC Handlers | a9ddc24 | Complete |

## Key Deliverables

### WakeWordDetector (`src/main/voice/wakeWordDetector.js`)
- Wraps Picovoice Porcupine SDK
- Sensitivity: 0.5 (balanced false positive/negative)
- Frame requirements: 512 samples, 16kHz, Int16Array
- Methods: `initialize()`, `processFrame(frame)`, `release()`

### WhisperClient (`src/main/voice/whisperClient.js`)
- Wraps OpenAI SDK for Whisper API
- Accepts WebM/Opus audio buffers
- Writes to temp file (API requirement) with cleanup
- Methods: `transcribe(audioBuffer)`

### Voice IPC Handlers (`src/main/ipc/voiceHandlers.js`)
| Channel | Type | Purpose |
|---------|------|---------|
| voice:check-availability | handle | Check API keys and model file |
| voice:initialize | handle | Initialize Porcupine and Whisper |
| voice:audio-frame | on | Process audio frame for wake word |
| voice:transcribe | handle | Send audio to Whisper API |
| voice:release | on | Cleanup voice resources |

## Dependencies Added

```json
{
  "@picovoice/porcupine-node": "^4.0.1",
  "openai": "^4.10.0",
  "dotenv": "^17.2.3"
}
```

## Files Created

- `src/main/voice/wakeWordDetector.js` (80 lines)
- `src/main/voice/whisperClient.js` (58 lines)
- `src/main/ipc/voiceHandlers.js` (153 lines)
- `resources/wake-word/son-of-anton.ppn` (user-provided, 3.4KB)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added dotenv for environment variable loading**
- **Found during:** Task 3
- **Issue:** Plan did not specify how to load PICOVOICE_ACCESS_KEY and OPENAI_API_KEY from .env file
- **Fix:** Installed dotenv package, added config loading at module startup
- **Files modified:** src/package.json, src/main/ipc/voiceHandlers.js
- **Commit:** a9ddc24

**2. [Rule 3 - Blocking] Added getModelPath() for dev/packaged path resolution**
- **Found during:** Task 3
- **Issue:** Wake word model path differs between development and packaged app
- **Fix:** Created helper function that tries development path first, falls back to packaged resources
- **Files modified:** src/main/ipc/voiceHandlers.js
- **Commit:** a9ddc24

## Verification Results

| Check | Result |
|-------|--------|
| Dependencies installed | PASS |
| wakeWordDetector.js loads | PASS |
| whisperClient.js loads | PASS |
| voiceHandlers.js loads | PASS |
| IPC handlers defined (5) | PASS |
| Wake word model exists | PASS |

## Next Phase Readiness

**Ready for Plan 02:** Yes

Plan 02 (Boot Integration) can proceed to:
1. Wire `setupVoiceIPC()` into `_boot.js`
2. Create renderer preload for voice channels
3. Build AudioCapture class for microphone access

**Blockers:** None

**Prerequisites verified:**
- Picovoice account created (user checkpoint passed)
- Wake word model trained and downloaded
- API keys configured in .env file

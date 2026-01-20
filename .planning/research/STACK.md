# Technology Stack

**Project:** Son of Anton - Voice Command & Claude Code Integration
**Researched:** 2026-01-20
**Platform:** Electron 12.1.0 / Node.js 16.x (strict requirement)

---

## Executive Summary

Adding voice recognition with wake word detection and Claude Code state parsing to an Electron 12 app requires careful library selection due to Node.js 16 constraints. The recommended stack uses:

- **Picovoice Porcupine** for wake word detection (Node 16 compatible)
- **OpenAI Whisper API** via older SDK or direct HTTP for speech-to-text
- **Chokidar 3.x** for file watching (Node 8.16+ compatible)
- **Native Web Audio API** for microphone capture in renderer process

---

## Recommended Stack

### Wake Word Detection

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @picovoice/porcupine-node | ^3.0.6 | "Son of Anton" wake word detection | Node 16+ compatible, custom wake words, on-device processing, <4% CPU on RPi |

**Rationale:**
- Picovoice Porcupine explicitly supports Node.js 16+ ([npm](https://www.npmjs.com/package/@picovoice/porcupine-node))
- Custom wake word training via Picovoice Console (free tier available)
- On-device processing - no cloud dependency for wake detection
- 97%+ accuracy, <1 false alarm/hour
- Supports Windows, macOS, Linux

**Alternative Considered:**

| Alternative | Why Not |
|-------------|---------|
| Snowboy | Abandoned (4+ years without updates), low accuracy |
| openWakeWord | Python-based, no official Node.js binding |
| Web Speech API | Deprecated in Electron, requires internet |

**Custom Wake Word Setup:**
1. Sign up at [Picovoice Console](https://console.picovoice.ai/)
2. Navigate to Porcupine > Create Wake Word
3. Enter "Son of Anton" as wake phrase
4. Select platform: Windows (x86_64)
5. Download `.ppn` model file
6. Use with `@picovoice/porcupine-node`

**Confidence:** HIGH (verified via official npm documentation)

---

### Speech-to-Text (Whisper API)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| openai | ^4.10.0 | Whisper API client | Last version with Node 16 support before breaking change |
| axios | ^1.6.0 | HTTP client (fallback) | Direct API calls if SDK issues arise |
| form-data | ^4.0.0 | Multipart form encoding | Required for audio file upload |

**Rationale:**
- OpenAI SDK v4.0.0 through ~v4.11 supports Node.js 16 ([GitHub Issue #225](https://github.com/openai/openai-node/issues/225))
- v4.12+ raised minimum to Node 18, v5+ requires Node 20
- Whisper API: ~$0.006/minute, supports mp3, wav, webm up to 25MB
- Alternative: Direct HTTP with axios/form-data if SDK compatibility issues

**Version Constraints (CRITICAL):**
```
openai@4.10.0  -> Node 16 OK
openai@4.12.0+ -> Node 18+ required (BREAKS)
openai@5.0.0+  -> Node 20+ required (BREAKS)
```

**Implementation Pattern:**
```javascript
// Option 1: SDK (preferred)
const { OpenAI } = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const transcription = await client.audio.transcriptions.create({
  file: fs.createReadStream('audio.wav'),
  model: 'whisper-1'
});

// Option 2: Direct HTTP (fallback)
const FormData = require('form-data');
const axios = require('axios');

const form = new FormData();
form.append('model', 'whisper-1');
form.append('file', audioBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });

const response = await axios.post(
  'https://api.openai.com/v1/audio/transcriptions',
  form,
  { headers: { 'Authorization': `Bearer ${apiKey}`, ...form.getHeaders() } }
);
```

**Confidence:** MEDIUM (v4.10 Node 16 support confirmed; exact cutoff version needs validation)

---

### Audio Capture (Electron)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Web Audio API | Built-in | Microphone capture in renderer | Standard Chromium API, no extra deps |
| navigator.mediaDevices.getUserMedia | Built-in | Get microphone stream | HTML5 standard, works in Electron 12 |

**Rationale:**
- Electron 12's Chromium (89) fully supports `getUserMedia` for microphone
- No need for native Node modules like `node-mic` or `sox`
- Audio processing happens in renderer process
- WebAudioAPI provides raw PCM data for Porcupine

**Implementation Pattern:**
```javascript
// In renderer process
async function startAudioCapture() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,      // Porcupine/Whisper requirement
      channelCount: 1,        // Mono
      echoCancellation: true,
      noiseSuppression: true
    }
  });

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(512, 1, 1);

  processor.onaudioprocess = (e) => {
    const pcmData = e.inputBuffer.getChannelData(0);
    // Send to Porcupine for wake word detection
    // Buffer for Whisper when wake word detected
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
}
```

**Platform Notes:**
- Windows: Works out of the box
- macOS: System audio capture requires signed kernel extension (mic capture OK)
- Linux: May need PulseAudio/ALSA configuration

**Confidence:** HIGH (standard Web API, well documented)

---

### File Watching (Claude Code State)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| chokidar | ^3.5.3 | Watch Claude Code state files | Node 8.16+ compatible, cross-platform, battle-tested |

**Rationale:**
- Chokidar 3.x requires Node.js 8.16+ (Node 16 fully compatible)
- v4.0 requires Node 14+, v5.0 requires Node 20+ (both work but 3.x is safest)
- Used in ~30 million repositories
- Handles Windows file system quirks well

**Version Constraints:**
```
chokidar@3.5.3 -> Node 8.16+ (RECOMMENDED for Node 16)
chokidar@4.0.0 -> Node 14+ (OK but newer, less tested)
chokidar@5.0.0 -> Node 20+ (BREAKS on Node 16)
```

**Claude Code State File Locations (Windows):**

| File/Directory | Purpose | Watch Priority |
|----------------|---------|----------------|
| `%USERPROFILE%\.claude\settings.json` | User settings | LOW |
| `%USERPROFILE%\.claude\agents\` | Custom subagents | MEDIUM |
| `.claude\settings.json` | Project settings | MEDIUM |
| `.claude\reports\_registry.md` | Report registry | HIGH |
| `.claude\reports\handoff\` | Agent coordination | HIGH |
| `.claude\reports\impl\` | Implementation details | MEDIUM |

**Implementation Pattern:**
```javascript
const chokidar = require('chokidar');
const path = require('path');
const os = require('os');

const claudeDir = path.join(os.homedir(), '.claude');
const projectClaudeDir = path.join(process.cwd(), '.claude');

const watcher = chokidar.watch([
  path.join(claudeDir, 'settings.json'),
  path.join(claudeDir, 'agents', '*.md'),
  path.join(projectClaudeDir, 'reports', '**', '*.md')
], {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100
  }
});

watcher
  .on('add', path => console.log(`File added: ${path}`))
  .on('change', path => console.log(`File changed: ${path}`))
  .on('unlink', path => console.log(`File removed: ${path}`));
```

**Confidence:** HIGH (verified Node 16 compatibility)

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | ^16.0.0 | Environment variables | Store API keys securely |
| nanoid | ^3.3.4 | Unique IDs | Session/request tracking (already in project) |
| debounce | ^1.2.1 | Rate limiting | Prevent duplicate wake word triggers |
| eventemitter3 | ^5.0.0 | Event bus | Cross-component communication |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Wake Word | Porcupine | Snowboy | Abandoned, low accuracy |
| Wake Word | Porcupine | Vosk | Heavier, less accurate for wake words |
| STT | Whisper API | Local Whisper | GPU required, complex setup |
| STT | Whisper API | Vosk | Lower accuracy for English |
| STT | Whisper API | Google Speech | Privacy, requires internet for wake |
| File Watch | Chokidar | fs.watch | Platform inconsistencies |
| File Watch | Chokidar | node-watch | Less mature, fewer features |
| Audio | Web Audio API | node-mic | Requires sox, adds native deps |
| Audio | Web Audio API | electron-audio-loopback | Requires Electron 31+ |

---

## Installation

```bash
# Core dependencies (in src/ directory)
cd src
npm install @picovoice/porcupine-node@^3.0.6
npm install openai@4.10.0
npm install chokidar@^3.5.3
npm install dotenv@^16.0.0

# Optional fallback for Whisper API
npm install axios@^1.6.0
npm install form-data@^4.0.0

# For event handling
npm install eventemitter3@^5.0.0
npm install debounce@^1.2.1
```

**package.json additions:**
```json
{
  "dependencies": {
    "@picovoice/porcupine-node": "^3.0.6",
    "openai": "4.10.0",
    "chokidar": "^3.5.3",
    "dotenv": "^16.0.0",
    "axios": "^1.6.0",
    "form-data": "^4.0.0",
    "eventemitter3": "^5.0.0",
    "debounce": "^1.2.1"
  }
}
```

---

## Configuration Requirements

### Environment Variables (.env)

```env
# Picovoice (required for wake word)
PICOVOICE_ACCESS_KEY=your_picovoice_access_key

# OpenAI (required for Whisper STT)
OPENAI_API_KEY=your_openai_api_key

# Optional
VOICE_SENSITIVITY=0.5
VOICE_TIMEOUT_MS=5000
```

### Picovoice Console Setup

1. Create account at https://console.picovoice.ai/
2. Get AccessKey from dashboard
3. Create custom wake word "Son of Anton"
4. Download `.ppn` file for Windows
5. Place in `src/assets/voice/son_of_anton_windows.ppn`

---

## Architecture Implications

### Process Model

```
Main Process (Node.js)
├── File Watcher (chokidar)
│   └── Claude Code state monitoring
└── IPC Bridge

Renderer Process (Chromium)
├── Audio Capture (Web Audio API)
├── Wake Word Detection (Porcupine Web or via IPC to Main)
├── Audio Buffer Management
└── UI Components
```

### Data Flow

```
Microphone → Web Audio API → PCM Buffer → Porcupine
                                              │
                            Wake detected? ───┤
                                              │
                            YES → Record → WAV → Whisper API → Text → Command Parser
                            NO  → Continue listening
```

### IPC Considerations

- Porcupine Node.js binding runs in main process
- Audio capture happens in renderer process
- Need to stream audio from renderer to main via IPC
- Alternative: Use `@picovoice/porcupine-web` in renderer (WebAssembly)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenAI SDK breaks on Node 16 | MEDIUM | HIGH | Pin to 4.10.0, have axios fallback |
| Porcupine licensing cost | LOW | MEDIUM | Free tier: 3 wake words, 3 platforms |
| Audio latency in IPC | MEDIUM | LOW | Use Web version of Porcupine in renderer |
| Claude Code file format changes | MEDIUM | MEDIUM | Abstract parser, version detection |
| Windows audio permissions | LOW | MEDIUM | Document permission requirements |

---

## Sources

### Wake Word Detection
- [Picovoice Porcupine npm](https://www.npmjs.com/package/@picovoice/porcupine-node)
- [Porcupine Node.js Quick Start](https://picovoice.ai/docs/quick-start/porcupine-nodejs/)
- [Custom Wake Word Training](https://picovoice.ai/blog/console-tutorial-custom-wake-word/)
- [GitHub - Picovoice/porcupine](https://github.com/Picovoice/porcupine)

### Speech-to-Text
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [OpenAI SDK Node 16 Support Issue #225](https://github.com/openai/openai-node/issues/225)
- [Whisper API Documentation](https://platform.openai.com/docs/api-reference/audio)
- [Using Whisper with Node.js](https://www.sitepoint.com/speech-to-text-whisper-react-node/)

### File Watching
- [Chokidar GitHub](https://github.com/paulmillr/chokidar)
- [Chokidar Releases](https://github.com/paulmillr/chokidar/releases)

### Audio Capture
- [Electron Audio/Video Capturing](https://www.tutorialspoint.com/electron/electron_audio_and_video_capturing.htm)
- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

### Claude Code
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)

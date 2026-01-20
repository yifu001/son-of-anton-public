# Domain Pitfalls

**Domain:** Voice-controlled Claude Code command center (Electron)
**Researched:** 2026-01-20
**Confidence:** MEDIUM (mixed sources, some verified via official docs)

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Wake Word Detection Engine Mismatch

**What goes wrong:** Choosing a wake word engine that cannot run in Electron's renderer process, requiring a Python backend or WASM porting effort that delays the project by weeks.

**Why it happens:**
- openWakeWord (popular, open-source) has no official JavaScript/browser support — ONNX runtime exists for JS but "much of the other functionality required for openWakeWord models would need to be ported" ([GitHub - openWakeWord](https://github.com/dscripka/openWakeWord))
- Picovoice Porcupine has separate packages: `@picovoice/porcupine-node` (Node.js only, won't work in browser) vs `@picovoice/porcupine-web` (browser/WASM) ([Picovoice Docs](https://picovoice.ai/docs/quick-start/porcupine-web/))
- Developers assume "JavaScript support" means unified package

**Consequences:**
- Forced architecture change (add Python backend via WebSocket)
- Or significant porting effort (openWakeWord → browser took one developer "through integration hell")
- Porcupine requires AccessKey and has usage limits on free tier

**Prevention:**
1. Use `@picovoice/porcupine-web` for browser/renderer process (verified: works with WASM)
2. Train custom "Son of Anton" wake word via Picovoice Console (generates `.ppn` file)
3. OR run wake word detection in main process with `@picovoice/porcupine-node` and IPC to renderer

**Detection (warning signs):**
- Using `require('@picovoice/porcupine-node')` in renderer process → will fail
- Seeing "ONNX runtime" errors in console
- Python dependencies appearing in package.json

**Phase to address:** Phase 1 (Voice Control foundation)

---

### Pitfall 2: Claude Code State File Parsing Brittleness

**What goes wrong:** Parsing Claude Code internal state files that change format between versions, causing the app to break silently or display stale/wrong data after Claude Code updates.

**Why it happens:**
- Claude Code internal state files are **undocumented** — no stability guarantee
- Breaking changes happen between versions (e.g., "structured content now prioritized over TextContent" between v2.0.10-2.0.22) ([GitHub Issue #9962](https://github.com/anthropics/claude-code/issues/9962))
- State file location may vary by platform and Claude Code version
- Users update Claude Code independently of this app

**Consequences:**
- App shows incorrect agent status, todo lists, context usage
- Silent failures (JSON parse succeeds but schema changed)
- User loses trust in accuracy of displayed information

**Prevention:**
1. **Defensive parsing:** Validate all expected fields exist before accessing
2. **Version detection:** Check Claude Code version at startup, warn if untested
3. **Graceful degradation:** Display "Unable to read Claude state" rather than crash/show garbage
4. **Schema versioning:** Track known Claude Code versions and their state formats
5. **Regular testing:** Test against Claude Code updates in staging before user deployment

**Detection (warning signs):**
- `undefined` appearing in UI where agent names/status should be
- JSON parse errors in console after Claude Code update
- State showing "0 agents" when terminals are clearly active

**Phase to address:** Phase 2 (Context/Agent tracking) — needs research spike

---

### Pitfall 3: File Watcher Race Conditions on Windows

**What goes wrong:** File watcher fires before file write completes, reading truncated or empty content. Common with Claude Code state files that update frequently.

**Why it happens:**
- Windows NTFS triggers watcher event when write **begins**, not when it completes ([GitHub - Deno Issue #13035](https://github.com/denoland/deno/issues/13035))
- Claude Code may write state files frequently during active sessions
- Some editors use atomic writes (rename pattern), others don't
- Multiple rapid writes can interleave with reads

**Consequences:**
- Empty or partial JSON → parse failure
- Stale data displayed (read old file before new write finished)
- Intermittent failures that are hard to reproduce

**Prevention:**
1. **Debounce file watcher events:** Wait 100-200ms after change event before reading
2. **Retry with backoff:** If parse fails, wait and retry (file may still be writing)
3. **Checksum validation:** Compare file hash before/after read to detect mid-write
4. **Lock file detection:** Some tools create `.lock` files during writes — watch for these
5. **Use chokidar with `awaitWriteFinish` option:**
   ```javascript
   chokidar.watch(path, {
     awaitWriteFinish: {
       stabilityThreshold: 200,
       pollInterval: 50
     }
   });
   ```

**Detection (warning signs):**
- Intermittent "Unexpected end of JSON" errors
- Data flickering between valid and empty states
- Issues appear more on Windows than macOS/Linux

**Phase to address:** Phase 2 (Context/Agent tracking)

---

### Pitfall 4: Electron Microphone Permission Denial Loop

**What goes wrong:** `navigator.mediaDevices.getUserMedia()` fails silently or hangs, preventing voice input entirely. User has no clear path to fix.

**Why it happens:**
- macOS: Apps denied by default, need `NSMicrophoneUsageDescription` in Info.plist and entitlements ([Electron Docs](https://www.electronjs.org/docs/latest/api/system-preferences))
- Windows: May require app to be in Settings > Privacy > Microphone allowed apps list
- Once denied, changing requires OS settings change + app restart
- Electron groups webcam/microphone as single "media" permission ([Doyensec Blog](https://blog.doyensec.com/2022/09/27/electron-api-default-permissions.html))
- `getUserMedia()` Promise may never resolve in some edge cases ([Electron Issue #23281](https://github.com/electron/electron/issues/23281))

**Consequences:**
- Voice feature completely broken with no error message
- User stuck in denial state without clear instructions
- Different failure modes per platform

**Prevention:**
1. **Check permission before requesting:**
   ```javascript
   const status = await navigator.permissions.query({name: 'microphone'});
   if (status.state === 'denied') {
     // Show instructions to enable in OS settings
   }
   ```
2. **Implement permission handler in main process:**
   ```javascript
   session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
     if (permission === 'media') callback(true);
   });
   ```
3. **Add timeout to getUserMedia:** Don't hang forever — fail after 10s with helpful message
4. **Platform-specific instructions:** Show different "how to enable" for Windows vs macOS
5. **For macOS builds:** Configure electron-builder to include entitlements:
   ```json
   "mac": {
     "entitlements": "entitlements.plist",
     "entitlementsInherit": "entitlements.plist"
   }
   ```

**Detection (warning signs):**
- Voice button click does nothing
- Console shows `NotAllowedError` or `PermissionDeniedError`
- Works in development but fails in packaged app (missing entitlements)

**Phase to address:** Phase 1 (Voice Control foundation)

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 5: node-pty Thread Safety with Multiple Terminals

**What goes wrong:** Running 5 concurrent terminal sessions with node-pty causes memory corruption, crashes, or garbled output.

**Why it happens:**
- "node-pty is not thread safe so running it across multiple worker threads in node.js could cause issues" ([node-pty README](https://github.com/microsoft/node-pty))
- Current architecture uses cluster workers for systeminformation — could accidentally share node-pty state

**Consequences:**
- Random crashes under load
- Terminal output appearing in wrong terminal
- Memory leaks over long sessions

**Prevention:**
1. Keep all node-pty operations in main process, never in workers
2. Use single-threaded queue for PTY operations if needed
3. Each terminal gets isolated PTY instance (current design is correct)

**Detection (warning signs):**
- Crashes correlate with opening multiple terminals
- Output from one terminal appearing in another
- Memory usage growing unbounded

**Phase to address:** Existing architecture (verify in code review)

---

### Pitfall 6: chokidar v5 ESM-Only Breaking Change

**What goes wrong:** Upgrading chokidar for file watching breaks the build because v5 is ESM-only.

**Why it happens:**
- chokidar v5 (Nov 2025) requires `import` syntax, no `require()` ([chokidar npm](https://www.npmjs.com/package/chokidar))
- eDEX-UI codebase uses CommonJS (`require`) throughout
- Minimum Node.js requirement jumped to v20.19 in v5
- Current project requires Node 16.x for Electron 12 ABI compatibility

**Consequences:**
- Module not found errors if blindly upgrade
- Cannot use latest chokidar without major refactor or staying on v4

**Prevention:**
1. Pin chokidar to v4.x: `"chokidar": "^4.0.0"` (not v5)
2. If glob patterns needed, implement manually (v4 removed built-in glob support)
3. Document version constraint in package.json comments

**Detection (warning signs):**
- `ERR_REQUIRE_ESM` errors
- "Cannot use import statement outside a module"

**Phase to address:** Phase 2 (File watching implementation)

---

### Pitfall 7: Wake Word Sensitivity Tuning

**What goes wrong:** Wake word triggers too often (false accepts) or misses real invocations (false rejects), making voice control frustrating.

**Why it happens:**
- Default sensitivity settings optimized for general use, not specific environments
- "Any engine can achieve 100% accuracy with high FARs" — vendors may oversell ([Picovoice Blog](https://picovoice.ai/blog/complete-guide-to-wake-word/))
- Background speech/music triggers false activations
- "Son of Anton" may not have distinctive enough phonemes

**Consequences:**
- User says wake word, nothing happens → gives up on feature
- Random activations → annoyance, accidental commands
- Trust erosion in voice feature

**Prevention:**
1. Implement configurable sensitivity (0.0-1.0 range): Start conservative (0.5), let users tune
2. Add visual feedback when listening (so user knows wake word was heard)
3. Require confirmation for destructive voice commands
4. Consider wake word + confirmation phrase: "Son of Anton, execute"
5. Train with diverse voices if using custom model

**Detection (warning signs):**
- User complaints about "doesn't work" or "keeps activating"
- Analytics showing low wake word success rate

**Phase to address:** Phase 1 (Voice Control), tuning in Phase 3

---

### Pitfall 8: Audio Buffer Underruns Causing Choppy Wake Word Detection

**What goes wrong:** Wake word detection misses triggers because audio buffers aren't being processed in time.

**Why it happens:**
- Web Audio API latency varies by platform and hardware ([MDN - AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency))
- Heavy UI rendering (5 terminals, globe visualization) starves audio processing
- Default buffer sizes may be too small for reliable processing
- "Lower numbers for bufferSize will result in lower latency... Higher numbers will be necessary to avoid audio breakup" ([Web Audio API Spec](https://www.w3.org/TR/webaudio-1.1/))

**Consequences:**
- Wake word missed during heavy UI activity
- Choppy/glitchy audio feedback
- Inconsistent behavior ("worked yesterday, not today")

**Prevention:**
1. Use larger audio buffer (4096 or 8192 samples) for wake word detection — latency less critical than reliability
2. Process wake word in dedicated AudioWorklet to avoid main thread blocking
3. Profile audio processing separately from UI
4. Add audio processing performance metrics to diagnostics

**Detection (warning signs):**
- Wake word works better when globe/network displays are disabled
- Works in small test app but not in full UI
- Platform-specific failures (worse on slower machines)

**Phase to address:** Phase 1 (Voice Control)

---

### Pitfall 9: node-pty ASAR Packaging Failure

**What goes wrong:** Packaged app fails to find `conpty.node` or `pty.node` native modules.

**Why it happens:**
- ASAR packaging puts node_modules in archive, but native .node files must be unpacked ([node-pty Issue #372](https://github.com/microsoft/node-pty/issues/372))
- electron-builder's `asarUnpack` must explicitly include node-pty
- Windows requires `conpty.dll` alongside the .node file

**Consequences:**
- "Module not found: Can't resolve '../build/Debug/conpty.node'"
- App works in development, fails when packaged
- Terminal feature completely broken in production

**Prevention:**
1. Configure electron-builder asarUnpack:
   ```json
   "build": {
     "asarUnpack": [
       "node_modules/node-pty/**/*"
     ]
   }
   ```
2. Test packaged app on clean machine before release
3. Include Windows Spectre-mitigated libs if building on Windows

**Detection (warning signs):**
- Works with `npm start`, fails after `npm run build`
- Errors mentioning `.asar` and `.node` in same message

**Phase to address:** Existing (verify current electron-builder config)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 10: Whisper API Latency for Real-Time Input

**What goes wrong:** Voice-to-text via Cloud Whisper API takes 2-5 seconds, making voice interaction feel sluggish.

**Why it happens:**
- Network round-trip to OpenAI API
- Audio upload time depends on recording length
- API processing time
- User expects near-instant response

**Prevention:**
1. Show "Processing..." indicator immediately after wake word
2. Keep voice recordings short (5-10 second max)
3. Consider local Whisper model for v2 (adds GPU dependency)
4. Implement streaming response if/when API supports it

**Detection (warning signs):**
- User interrupts by typing before voice response arrives
- User complaints about "slowness"

**Phase to address:** Phase 1 (Voice Control) — latency accepted in v1

---

### Pitfall 11: Multiple Claude Code Installations

**What goes wrong:** App monitors wrong Claude Code installation, shows stale/wrong data.

**Why it happens:**
- User may have multiple Claude Code versions (stable, beta)
- State files in different locations
- App assumes single canonical location

**Prevention:**
1. Allow user to configure Claude Code path in settings
2. Auto-detect by scanning common locations
3. Verify state files are being updated (timestamp check)

**Detection (warning signs):**
- User reports "shows 0 agents but I have Claude running"
- State file timestamps not updating

**Phase to address:** Phase 2 (Configuration)

---

### Pitfall 12: Voice Command Ambiguity

**What goes wrong:** User says something the app interprets as wrong command.

**Why it happens:**
- Speech-to-text transcription errors ("clear" vs "near")
- Similar-sounding commands
- No confirmation step

**Prevention:**
1. Require explicit command vocabulary ("Anton, clear terminal" not just "clear")
2. Echo interpreted command before execution
3. Undo capability for reversible commands
4. Log all voice commands for debugging

**Detection (warning signs):**
- Wrong terminal cleared
- Unexpected actions after voice command

**Phase to address:** Phase 3 (Voice command vocabulary)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Wake word engine selection | Wrong package (Node vs Web) | Use `@picovoice/porcupine-web` for renderer |
| Claude Code state parsing | Version brittleness | Defensive parsing + version detection |
| File watching | Race conditions on Windows | Debounce + awaitWriteFinish option |
| Microphone access | Permission denial loop | Check before request + platform instructions |
| Audio processing | Buffer underruns | Larger buffers, AudioWorklet |
| Packaging | node-pty ASAR failure | Configure asarUnpack correctly |
| Voice commands | Latency expectations | Show processing indicator immediately |
| Multi-terminal | node-pty thread safety | Keep PTY in main process only |
| chokidar upgrade | ESM-only v5 | Pin to v4.x |
| Wake word accuracy | Sensitivity tuning | Configurable + feedback UI |

---

## Sources

**Verified (HIGH confidence):**
- [Picovoice Porcupine Documentation](https://picovoice.ai/docs/quick-start/porcupine-web/)
- [node-pty GitHub](https://github.com/microsoft/node-pty)
- [chokidar npm](https://www.npmjs.com/package/chokidar)
- [Electron systemPreferences API](https://www.electronjs.org/docs/latest/api/system-preferences)
- [MDN MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency)

**WebSearch (MEDIUM confidence):**
- [Picovoice Wake Word Guide 2025](https://picovoice.ai/blog/complete-guide-to-wake-word/)
- [Electron, chokidar integration story](https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell)
- [Doyensec Electron Permissions Blog](https://blog.doyensec.com/2022/09/27/electron-api-default-permissions.html)
- [openWakeWord GitHub](https://github.com/dscripka/openWakeWord)
- [Deep Core Labs - openWakeWord Web](https://deepcorelabs.com/open-wake-word-on-the-web/)

**GitHub Issues (MEDIUM confidence):**
- [Claude Code Issue #9962 - MCP breaking change](https://github.com/anthropics/claude-code/issues/9962)
- [node-pty Issue #372 - ASAR compatibility](https://github.com/microsoft/node-pty/issues/372)
- [Electron Issue #23281 - getUserMedia hanging](https://github.com/electron/electron/issues/23281)
- [Deno Issue #13035 - file watcher race condition](https://github.com/denoland/deno/issues/13035)

---

*Pitfalls analysis: 2026-01-20*

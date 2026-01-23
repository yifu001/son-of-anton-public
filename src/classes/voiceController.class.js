/**
 * Voice Controller
 * Orchestrates wake word detection, recording, and transcription
 *
 * Context decisions implemented:
 * - 60 second maximum recording duration
 * - Space key cancels listening mode
 * - Wake word ignored during recording (re-triggering disabled)
 */

const { AudioCapture } = require('./audioCapture.class');

// Voice states
const VoiceState = {
  DISABLED: 'disabled',   // Voice not available or not initialized
  IDLE: 'idle',           // Ready but not listening
  LISTENING: 'listening', // Listening for wake word
  RECORDING: 'recording', // Recording audio after wake word
  PROCESSING: 'processing', // Whisper API processing
  ERROR: 'error',         // Error state
};

class VoiceController {
  constructor(options = {}) {
    // Max duration: 60 seconds (from CONTEXT.md)
    this.maxRecordingMs = options.maxRecordingMs || 60000;
    this.silenceTimeoutMs = options.silenceTimeoutMs || 2000;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onTranscription = options.onTranscription || (() => {});
    this.onError = options.onError || (() => {});
    this.onWakeDetected = options.onWakeDetected || (() => {});
    this.onAudioLevel = options.onAudioLevel || (() => {}); // For waveform viz
    this.onInterimTranscription = options.onInterimTranscription || (() => {}); // For interim results

    this.audioCapture = new AudioCapture();

    this.state = VoiceState.DISABLED;
    this.silenceTimer = null;
    this.maxDurationTimer = null;
    this.audioLevelInterval = null;
    this.isInitialized = false;
    this.isEnabled = false; // Voice toggle state

    // Bind space key handler
    this._boundKeyHandler = this._handleKeyDown.bind(this);
  }

  /**
   * Initialize voice controller
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    try {
      // Check voice availability via IPC
      const availability = await window.ipc.invoke('voice:check-availability');
      if (!availability.available) {
        console.warn('[VoiceController] Voice not available:', availability);
        this._setState(VoiceState.DISABLED);
        return false;
      }

      // Request microphone permission
      const hasPermission = await this.audioCapture.requestPermission();
      if (!hasPermission) {
        this.onError('Microphone permission denied');
        this._setState(VoiceState.ERROR);
        return false;
      }

      // Initialize voice services in main process
      const result = await window.ipc.invoke('voice:initialize');
      if (!result.success) {
        this.onError(result.error || 'Voice initialization failed');
        this._setState(VoiceState.ERROR);
        return false;
      }

      // Setup wake word detection listener
      window.ipc.on('voice:wake-word-detected', () => {
        this._onWakeWordDetected();
      });

      // Add global key handler for space key cancel
      document.addEventListener('keydown', this._boundKeyHandler);

      this.isInitialized = true;
      this._setState(VoiceState.IDLE);
      console.log('[VoiceController] Initialized');
      return true;
    } catch (error) {
      console.error('[VoiceController] Initialization failed:', error.message);
      this.onError(error.message);
      this._setState(VoiceState.ERROR);
      return false;
    }
  }

  /**
   * Handle keydown events - Space cancels recording
   * @private
   */
  _handleKeyDown(event) {
    // Space key cancels listening/recording mode
    if (event.code === 'Space' && (this.state === VoiceState.LISTENING || this.state === VoiceState.RECORDING)) {
      event.preventDefault();
      console.log('[VoiceController] Space key pressed - cancelling');
      this.cancelRecording();
    }
  }

  /**
   * Enable voice listening (toggle on)
   */
  enable() {
    if (!this.isInitialized) {
      console.warn('[VoiceController] Not initialized, cannot enable');
      return false;
    }
    this.isEnabled = true;
    return this.startListening();
  }

  /**
   * Disable voice listening (toggle off)
   */
  disable() {
    this.isEnabled = false;
    this.stopListening();
    this._setState(VoiceState.IDLE);
  }

  /**
   * Toggle voice on/off
   * @returns {boolean} New enabled state
   */
  toggle() {
    if (this.isEnabled) {
      this.disable();
    } else {
      this.enable();
    }
    return this.isEnabled;
  }

  /**
   * Start listening for wake word
   */
  startListening() {
    if (!this.isInitialized) {
      console.warn('[VoiceController] Not initialized');
      return false;
    }

    if (!this.isEnabled) {
      console.warn('[VoiceController] Voice is disabled');
      return false;
    }

    if (this.state === VoiceState.RECORDING || this.state === VoiceState.PROCESSING) {
      console.warn('[VoiceController] Cannot start listening from state:', this.state);
      return false;
    }

    // Start sending audio frames to main process for wake word detection
    this.audioCapture.startFrameCapture((frame) => {
      // Convert Int16Array to regular array for IPC
      window.ipc.send('voice:audio-frame', Array.from(frame));
    });

    this._setState(VoiceState.LISTENING);
    console.log('[VoiceController] Listening for wake word...');
    return true;
  }

  /**
   * Stop listening (but don't disable)
   */
  stopListening() {
    this._clearTimers();
    this._stopAudioLevelPolling();
    this.audioCapture.stopFrameCapture();

    if (this.state === VoiceState.RECORDING) {
      this.audioCapture.stopRecording();
    }

    if (this.isEnabled && this.isInitialized) {
      this._setState(VoiceState.LISTENING);
      // Restart listening for wake word
      this.audioCapture.startFrameCapture((frame) => {
        window.ipc.send('voice:audio-frame', Array.from(frame));
      });
    } else {
      this._setState(VoiceState.IDLE);
    }

    console.log('[VoiceController] Stopped listening');
  }

  /**
   * Cancel current recording without transcribing
   */
  cancelRecording() {
    console.log('[VoiceController] Recording cancelled');
    this._clearTimers();
    this._stopAudioLevelPolling();

    if (this.state === VoiceState.RECORDING) {
      this.audioCapture.stopRecording(); // Discard audio
    }

    // Return to listening if enabled
    if (this.isEnabled) {
      this._setState(VoiceState.LISTENING);
      this.audioCapture.startFrameCapture((frame) => {
        window.ipc.send('voice:audio-frame', Array.from(frame));
      });
    } else {
      this._setState(VoiceState.IDLE);
    }
  }

  /**
   * Handle wake word detection
   * @private
   */
  _onWakeWordDetected() {
    // Ignore wake word during recording (per CONTEXT.md)
    if (this.state !== VoiceState.LISTENING) {
      return;
    }

    console.log('[VoiceController] Wake word detected!');

    // Notify listeners (for audio feedback)
    this.onWakeDetected();

    // Start recording for transcription
    this._setState(VoiceState.RECORDING);
    this.audioCapture.startRecording();

    // Setup analyser for waveform visualization
    this.audioCapture.setupAnalyser();
    this._startAudioLevelPolling();

    // Start silence timeout (user can still speak)
    this._startSilenceTimer();

    // Start max duration timer (60 seconds per CONTEXT.md)
    this._startMaxDurationTimer();
  }

  /**
   * Start polling audio levels for waveform visualization
   * @private
   */
  _startAudioLevelPolling() {
    this._stopAudioLevelPolling();
    this.audioLevelInterval = setInterval(() => {
      const level = this.audioCapture.getAudioLevel();
      this.onAudioLevel(level);
    }, 50); // 20fps
  }

  /**
   * Stop audio level polling
   * @private
   */
  _stopAudioLevelPolling() {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
  }

  /**
   * Start silence timeout
   * @private
   */
  _startSilenceTimer() {
    this._clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      this._onSilenceTimeout();
    }, this.silenceTimeoutMs);
  }

  /**
   * Clear silence timeout
   * @private
   */
  _clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Start max duration timer (60 seconds)
   * @private
   */
  _startMaxDurationTimer() {
    this._clearMaxDurationTimer();
    this.maxDurationTimer = setTimeout(() => {
      console.log('[VoiceController] Max duration reached (60s)');
      this._onSilenceTimeout(); // Same behavior as silence timeout
    }, this.maxRecordingMs);
  }

  /**
   * Clear max duration timer
   * @private
   */
  _clearMaxDurationTimer() {
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  /**
   * Clear all timers
   * @private
   */
  _clearTimers() {
    this._clearSilenceTimer();
    this._clearMaxDurationTimer();
  }

  /**
   * Handle silence/max duration timeout - stop recording and transcribe
   * @private
   */
  async _onSilenceTimeout() {
    if (this.state !== VoiceState.RECORDING) {
      return;
    }

    console.log('[VoiceController] Timeout, processing...');
    this._clearTimers();
    this._stopAudioLevelPolling();
    this._setState(VoiceState.PROCESSING);

    try {
      // Stop recording and get audio
      const audioBlob = await this.audioCapture.stopRecording();

      if (audioBlob.size === 0) {
        console.warn('[VoiceController] No audio captured');
        this.onError('No audio captured');
        this._returnToListening();
        return;
      }

      // Convert blob to array buffer for IPC
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioData = Array.from(new Uint8Array(arrayBuffer));

      // Send to Whisper for transcription
      const result = await window.ipc.invoke('voice:transcribe', audioData);

      if (result.success && result.text) {
        console.log('[VoiceController] Transcription:', result.text);
        this.onTranscription(result.text, true); // true = success
      } else {
        console.warn('[VoiceController] Transcription failed:', result.error);
        this.onTranscription(null, false); // false = failure
        this.onError(result.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('[VoiceController] Processing error:', error.message);
      this.onTranscription(null, false);
      this.onError(error.message);
    }

    this._returnToListening();
  }

  /**
   * Return to listening state if enabled
   * @private
   */
  _returnToListening() {
    if (this.isEnabled) {
      this._setState(VoiceState.LISTENING);
      this.audioCapture.startFrameCapture((frame) => {
        window.ipc.send('voice:audio-frame', Array.from(frame));
      });
    } else {
      this._setState(VoiceState.IDLE);
    }
  }

  /**
   * Update state and notify listeners
   * @private
   */
  _setState(newState) {
    const oldState = this.state;
    this.state = newState;
    if (oldState !== newState) {
      console.log('[VoiceController] State:', oldState, '->', newState);
      this.onStateChange(newState, oldState);
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if voice is enabled
   */
  getEnabled() {
    return this.isEnabled;
  }

  /**
   * Release all resources
   */
  release() {
    this._clearTimers();
    this._stopAudioLevelPolling();
    document.removeEventListener('keydown', this._boundKeyHandler);
    this.audioCapture.release();
    window.ipc.send('voice:release');
    this._setState(VoiceState.DISABLED);
    this.isInitialized = false;
    this.isEnabled = false;
    console.log('[VoiceController] Released');
  }
}

module.exports = { VoiceController, VoiceState };

/**
 * Whisper API Client for speech-to-text
 * Runs in Electron main process
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

class WhisperClient {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - Audio data (WebM/Opus format)
   * @returns {Promise<string>} Transcription text
   */
  async transcribe(audioBuffer) {
    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn('[Whisper] Empty audio buffer received');
      return '';
    }

    // Write to temp file (Whisper API requires file upload)
    const tempPath = path.join(os.tmpdir(), `voice-${Date.now()}.webm`);

    try {
      fs.writeFileSync(tempPath, audioBuffer);
      console.log('[Whisper] Transcribing audio:', audioBuffer.length, 'bytes');

      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'en',
      });

      console.log('[Whisper] Transcription:', transcription.text);
      return transcription.text;
    } catch (error) {
      console.error('[Whisper] Transcription failed:', error.message);
      throw error;
    } finally {
      // Cleanup temp file
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupError) {
        console.warn('[Whisper] Temp file cleanup failed:', cleanupError.message);
      }
    }
  }
}

module.exports = { WhisperClient };

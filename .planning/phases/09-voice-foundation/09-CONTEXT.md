# Phase 9: Voice Foundation - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Wake word detection and speech-to-text pipeline operational. Users can say "Son of Anton" to trigger listening mode, hear audio feedback, speak a prompt, and see transcription. Sending transcription to terminal is Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Wake word behavior
- Sensitivity: Balanced (default) — standard sensitivity, occasional false positives acceptable
- False positive handling: Auto-timeout on silence — if user doesn't speak, listening mode ends
- Re-triggering: Ignore wake word during listening — disabled while capturing audio
- Global toggle: UI button on right side of screen to enable/disable voice listening

### Audio feedback design
- Wake detection chime: Voice response "Yes sir" when wake word detected
- Completion sounds: Distinct audio for success vs failure
- Volume: Fixed, follows system audio — no separate volume control
- Visual sync: Audio and visual indicator appear together (synchronized)

### Listening mode UX
- Maximum duration: 60 seconds before auto-timeout
- Visual indicator: Waveform visualization showing audio input levels in real-time
- Waveform position: Bottom of active terminal
- Cancel gesture: Space key cancels listening mode immediately

### Transcription display
- Location: Directly in terminal input line where voice input will be sent
- Interim results: Yes, show partial transcription in real-time as user speaks
- Error display: Inline error message where transcription would go
- Visual style: No distinction — transcribed text looks identical to typed text

### Claude's Discretion
- Waveform visualization implementation details
- Audio file format for voice responses
- Exact error message wording
- Interim transcription update frequency

</decisions>

<specifics>
## Specific Ideas

- Voice response should say "Yes sir" — matching the assistant's interaction style
- Waveform should feel like a sci-fi terminal audio visualizer
- Space key for cancel mirrors common audio recording conventions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-voice-foundation*
*Context gathered: 2026-01-21*

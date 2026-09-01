/**
 * audioEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Continuous looping alarm engine for incoming order alerts.
 * Behaves like Uber/DoorDash — loud, repeating, mute-override on iOS.
 *
 * Usage:
 *   import { setupAudioMode, startAlarm, stopAlarm } from '../lib/audioEngine';
 *
 *   await setupAudioMode();   // call once at app start (in _layout.tsx)
 *   await startAlarm();       // on incoming order INSERT
 *   await stopAlarm();        // on accept / decline / dismiss / timeout
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Audio } from 'expo-av';

// Module-level singleton — lives outside React so it survives re-renders
let _sound: Audio.Sound | null = null;
let _isPlaying = false;

/**
 * Configure audio session for high-priority alarms.
 * MUST be called once during app startup (in _layout.tsx).
 * - iOS: overrides silent/mute switch.
 * - Both platforms: stays active in background.
 */
export async function setupAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,      // Override mute/silent switch on iOS
      staysActiveInBackground: true,   // Keep alarm playing if app is backgrounded
      shouldDuckAndroid: true,         // Lower other audio on Android when alarm starts
      allowsRecordingIOS: false,
    });
    console.log('[AudioEngine] ✅ Audio mode configured (mute-override active)');
  } catch (e) {
    console.error('[AudioEngine] setAudioModeAsync failed:', e);
  }
}

/**
 * Start continuous looping alarm.
 * Loads the local WAV asset and plays it in a loop at maximum volume.
 * Idempotent — safe to call even if already playing.
 */
export async function startAlarm(): Promise<void> {
  if (_isPlaying) {
    console.log('[AudioEngine] Alarm already playing — skipping duplicate start.');
    return;
  }

  try {
    // Always tear down any stale sound instance first
    await _cleanupSound();

    const { sound } = await Audio.Sound.createAsync(
      // Local MP3 asset — works offline, no CDN dependency
      require('../assets/sounds/order_alarm.mp3'),
      {
        shouldPlay: true,
        isLooping: true,   // Loops until explicitly stopped
        volume: 1.0,       // Maximum volume
        isMuted: false,
        rate: 1.0,
      }
    );

    _sound = sound;
    _isPlaying = true;

    // Failsafe: clean up if playback somehow ends despite isLooping
    _sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish && !status.isLooping) {
        console.log('[AudioEngine] Playback ended unexpectedly, cleaning up.');
        _cleanupSound();
      }
    });

    console.log('[AudioEngine] 🔔 Alarm started — looping at full volume');
  } catch (e) {
    console.error('[AudioEngine] startAlarm() failed:', e);
    _isPlaying = false;
  }
}

/**
 * Stop and unload the alarm immediately.
 * Call on: Accept, Decline, Cancel-with-reason, timer expiry, or any modal close.
 */
export const stopAlarm = async () => {
  try {
    if (_sound) {
      const currentSound = _sound;
      _sound = null; // Clear reference immediately to avoid double calls
      _isPlaying = false;
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      console.log('[AudioEngine] 🔊 Audio alarm stopped successfully');
    }
  } catch (error) {
    console.error('[AudioEngine] Failed to stop sound:', error);
    _sound = null;
    _isPlaying = false;
  }
};

// ─── Internal ────────────────────────────────────────────────────────────────

async function _cleanupSound(): Promise<void> {
  // Use stopAlarm for consistent cleanup behavior
  await stopAlarm();
}

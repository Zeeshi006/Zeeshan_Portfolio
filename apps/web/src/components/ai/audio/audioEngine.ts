// audioEngine.ts — Microphone capture + real-time amplitude analysis
// No external dependencies; uses Web Audio API exclusively.

export interface AudioData {
  amplitude: number; // 0–1 normalised RMS
  speaking: boolean; // true when amplitude crosses VAD threshold
}

const SPEAKING_THRESHOLD = 0.012; // ~-38 dBFS — tune if needed
const FFT_SIZE = 256;
const SAMPLE_INTERVAL_MS = 50; // how often onData fires (~20 Hz)

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private dataBuffer: Float32Array | null = null;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async start(onData: (d: AudioData) => void): Promise<void> {
    // Guard: stop any existing session before starting a new one.
    this.stop();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      throw new Error(
        `AudioEngine: getUserMedia failed — ${err instanceof Error ? err.message : String(err)}`
      );
    }

    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0.6;

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);

    // Cast needed because AnalyserNode.getFloatTimeDomainData expects Float32Array<ArrayBuffer>
    this.dataBuffer = new Float32Array(this.analyser.fftSize);
    const buf = this.dataBuffer;

    this.intervalId = setInterval(() => {
      if (!this.analyser || !this.dataBuffer) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.analyser as any).getFloatTimeDomainData(this.dataBuffer);

      // Compute RMS amplitude
      let sumSq = 0;
      for (let i = 0; i < this.dataBuffer.length; i++) {
        const s = this.dataBuffer[i] ?? 0;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / this.dataBuffer.length);

      // Clamp to [0, 1] — typical voice peaks around 0.05–0.3 RMS
      const amplitude = Math.min(1, rms * 5);

      onData({
        amplitude,
        speaking: rms > SPEAKING_THRESHOLD,
      });
    }, SAMPLE_INTERVAL_MS);
  }

  stop(): void {
    // Clear the polling interval first
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Disconnect audio graph
    if (this.source) {
      try { this.source.disconnect(); } catch { /* already disconnected */ }
      this.source = null;
    }

    this.analyser = null;
    this.dataBuffer = null;

    // Close AudioContext
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => { /* best-effort */ });
      this.audioCtx = null;
    }

    // Release microphone tracks
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

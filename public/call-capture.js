// AudioWorklet keeps capture/resampling off the UI thread; Google Live expects 16 kHz PCM.
class CallCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(640);
    this.length = 0;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.sum += sample;
      this.count++;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        this.buffer[this.length++] = this.sum / this.count;
        this.sum = 0;
        this.count = 0;
        if (this.length === this.buffer.length) {
          this.port.postMessage(this.buffer);
          this.buffer = new Float32Array(640);
          this.length = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('call-capture', CallCapture);

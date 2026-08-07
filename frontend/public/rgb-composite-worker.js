/**
 * RGB Composite Worker
 * Runs off the main thread to keep the display loop smooth.
 * 
 * Incoming messages:
 *   { type: 'reset' }
 *     → clears the frame history (called on video loop-back)
 *
 *   { type: 'frame', buffer, width, height, redDelay, greenDelay, blueDelay, sendToObs }
 *     → buffer: transferred ArrayBuffer of raw RGBA pixels (zero-copy)
 *     → composites channels, posts result back
 *
 * Outgoing messages:
 *   { output: Uint8ClampedArray, rgbBuffer: Uint8Array|null, width, height }
 *     → output: composited RGBA (for putImageData on main thread)
 *     → rgbBuffer: packed RGB for WebSocket send to OBS (only when sendToObs=true)
 */

const frameHistory = [];
const MAX_HISTORY = 60;

self.onmessage = (e) => {
  const { type } = e.data;

  if (type === 'reset') {
    frameHistory.length = 0;
    return;
  }

  if (type !== 'frame') return;

  const { buffer, width, height, redDelay, greenDelay, blueDelay, sendToObs } = e.data;

  // buffer was transferred (zero-copy) — wrap without copying
  const current = new Uint8ClampedArray(buffer);

  // Maintain frame history
  frameHistory.unshift(current);
  if (frameHistory.length > MAX_HISTORY) frameHistory.pop();

  const len = width * height * 4;
  const rFrame = frameHistory[Math.min(redDelay,   frameHistory.length - 1)];
  const gFrame = frameHistory[Math.min(greenDelay, frameHistory.length - 1)];
  const bFrame = frameHistory[Math.min(blueDelay,  frameHistory.length - 1)];

  // Composite RGBA output from the three delayed channels
  const output = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    output[i]     = rFrame[i];
    output[i + 1] = gFrame[i + 1];
    output[i + 2] = bFrame[i + 2];
    output[i + 3] = 255;
  }

  const transfers = [output.buffer];
  let rgbBuffer = null;

  if (sendToObs) {
    // Pack RGB (3 bytes/pixel) — avoids sending the redundant alpha byte over WS
    rgbBuffer = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < len; i += 4, j += 3) {
      rgbBuffer[j]     = output[i];
      rgbBuffer[j + 1] = output[i + 1];
      rgbBuffer[j + 2] = output[i + 2];
    }
    transfers.push(rgbBuffer.buffer);
  }

  self.postMessage({ output, rgbBuffer, width, height }, transfers);
};

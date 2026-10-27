// Synthesizes the 38 s score for the promo (no dependencies, no samples → no licensing).
// Usage: node promo-music.js [out.wav]   Timing cues match the scene times in promo.html.
const fs = require('fs');
const SR = 44100, DUR = 38, N = SR * DUR, TAU = Math.PI * 2;
const mk = () => [new Float32Array(N), new Float32Array(N)];
const dry = mk(), send = mk();
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// add an instrument voice (fn(t) → sample, t relative to start) with equal-power pan and reverb send
function voice(t0, dur, fn, gain, pan = 0, sendAmt = .4) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && i0 + i < N; i++) {
    const s = fn(i / SR);
    dry[0][i0 + i] += s * gl; dry[1][i0 + i] += s * gr;
    send[0][i0 + i] += s * gl * sendAmt; send[1][i0 + i] += s * gr * sendAmt;
  }
}

// instruments
const pad = (f, dur) => t => {
  const env = clamp(t / .9) * clamp((dur - t) / 1.4), ph = TAU * f * t;
  return env * (Math.sin(ph) + .5 * Math.sin(2 * ph + .3 * Math.sin(t * .7)) + .25 * Math.sin(3 * ph) + .35 * Math.sin(TAU * f * 1.004 * t)) * .25;
};
const pluck = f => t => clamp(t / .006) * Math.exp(-t * 4.2) * (Math.sin(TAU * f * t) + .4 * Math.sin(TAU * 2 * f * t) + .15 * Math.sin(TAU * 3 * f * t));
const bass = f => t => clamp(t / .03) * Math.exp(-t * 1.1) * (Math.sin(TAU * f * t) + .25 * Math.sin(TAU * 2 * f * t));
const kick = t => Math.exp(-t * 9) * Math.sin(TAU * (45 * t + 90 * (1 - Math.exp(-t * 25)) / 25));
const tap = t => Math.sin(TAU * 80 * t) * Math.exp(-t * 22) + .3 * Math.sin(TAU * 160 * t) * Math.exp(-t * 40);
const bell = f => t => Math.exp(-t * 2.2) * (Math.sin(TAU * f * t) + .5 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 2) + .25 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 4));

// harmony: Am – F – C – G, 3 s per bar (80 bpm), 12 bars then a final C
const BAR = 3, BEAT = BAR / 4;
const prog = [{ b: 45, c: [57, 60, 64] }, { b: 41, c: [53, 57, 60] }, { b: 48, c: [55, 60, 64] }, { b: 43, c: [55, 59, 62] }];
for (let bar = 0; bar < 13; bar++) {
  const ch = bar == 12 ? { b: 48, c: [55, 60, 64, 72] } : prog[bar % 4], t = bar * BAR;
  const pv = .5 + .5 * clamp(t / 12);                                   // pad swells over the first 12 s
  ch.c.forEach((m, k) => voice(t, BAR + 1.2, pad(mtof(m), BAR + 1.2), .5 * pv, (k - 1) * .25, .55));
  if (t >= 5.9 && bar < 12) voice(t, 2.8, bass(mtof(ch.b)), .45, 0, .1);
}

// plucked arpeggio from the shot-list scene (4.6 s); steps back during the haptic alert so the taps cut through
const idx = [0, 1, 2, 1, 0, 2, 1, 2];
for (let t = 4.5, s = 0; t < 36; t += .375, s++) {
  const ch = prog[Math.floor(t / BAR) % 4], note = ch.c[idx[s % 8]] + 12;
  const quiet = t > 17.8 && t < 22.2 ? .55 : 1;
  voice(t, 1.6, pluck(mtof(note)), (.12 + .12 * clamp((t - 4.5) / 20)) * quiet, s % 2 ? .35 : -.35, .6);
}

// soft kick from the Ironclad scene on
for (let t = 24; t < 36; t += BEAT) voice(t, .35, kick, .5, 0, 0);

// cues
[18, 18.6, 19.2].forEach(t => voice(t, .3, tap, .6, .4, .1));                                  // wrist taps
[76, 83].forEach(m => voice(22.2, 2.5, bell(mtof(m)), .2, 0, .5));                             // "Matched" ding
[79, 84, 88].forEach((m, k) => voice(29 + k * .25, 2.5, bell(mtof(m)), .18, (k - 1) * .4, .5)); // vault sealed
[48, 60, 64, 67, 72].forEach(m => voice(29, 4, pad(mtof(m), 4), .22, 0, .6));                   // seal swell
[0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31].forEach((o, k) =>                           // count-up sparkle (31.8–34.3 s)
  voice(31.8 + k * .19, 1.2, pluck(mtof(72 + o)), .13, ((k % 5) - 2) * .25, .6));
[72, 76, 79, 84].forEach((m, k) => voice(36.6 + k * .08, 2.5, bell(mtof(m)), .18, (k - 1.5) * .3, .5)); // end card

// reverb (6 damped combs + 3 allpasses per side) on the send bus
function reverb(inp, off) {
  const out = new Float32Array(N);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map(d => ({ d: d + off, buf: new Float32Array(d + off), i: 0, lp: 0 }));
  for (let n = 0; n < N; n++) {
    const x = inp[n] * .015; let s = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.lp = y * .8 + c.lp * .2; c.buf[c.i] = x + c.lp * .86; c.i = (c.i + 1) % c.d; s += y; }
    out[n] = s;
  }
  for (const d of [556 + off, 441 + off, 225 + off]) {
    const buf = new Float32Array(d); let i = 0;
    for (let n = 0; n < N; n++) { const b = buf[i]; const o = -out[n] + b; buf[i] = out[n] + b * .5; out[n] = o; i = (i + 1) % d; }
  }
  return out;
}
const wetL = reverb(send[0], 0), wetR = reverb(send[1], 23), WET = 3;

// master: mix, fade in/out, peak-normalize to -2 dB, write 16-bit stereo WAV
const out = [new Float32Array(N), new Float32Array(N)];
let peak = 0;
for (let n = 0; n < N; n++) {
  const t = n / SR, g = clamp(t / .5) * clamp((DUR - t) / 1.6);
  out[0][n] = (dry[0][n] + wetL[n] * WET) * g; out[1][n] = (dry[1][n] + wetR[n] * WET) * g;
  peak = Math.max(peak, Math.abs(out[0][n]), Math.abs(out[1][n]));
}
const k = .79 / peak, pcm = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) { pcm.writeInt16LE(Math.round(out[0][n] * k * 32767), n * 4); pcm.writeInt16LE(Math.round(out[1][n] * k * 32767), n * 4 + 2); }
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
const file = process.argv[2] || 'promo-music.wav';
fs.writeFileSync(file, Buffer.concat([h, pcm]));
console.log('wrote', file, DUR + ' s');

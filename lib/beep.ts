// Builds a short three-tone beep as a WAV blob. An <audio> element is used instead of Web Audio
// because iOS mutes Web Audio when the ringer switch is on, but still plays media elements.

function buildWav(): Blob {
  const rate = 22050;
  const pattern: [number, number][] = [
    [880, 0.18],
    [0, 0.1],
    [880, 0.18],
    [0, 0.1],
    [1175, 0.45],
  ];
  const total = Math.round(pattern.reduce((n, [, d]) => n + d, 0) * rate);
  const samples = new Int16Array(total);
  let offset = 0;
  for (const [freq, dur] of pattern) {
    const n = Math.round(dur * rate);
    for (let i = 0; i < n; i++) {
      if (freq > 0) {
        const fade = Math.min(1, i / 220, (n - i) / 220); // 10ms fades avoid clicks
        samples[offset + i] = Math.sin((2 * Math.PI * freq * i) / rate) * 0.6 * fade * 32767;
      }
    }
    offset += n;
  }

  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
  return new Blob([buf], { type: 'audio/wav' });
}

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    audio = new Audio(URL.createObjectURL(buildWav()));
    audio.preload = 'auto';
  }
  return audio;
}

// Browsers only let media play from a user gesture the first time. Call this from one.
export function unlockBeep() {
  if (unlocked) return;
  const a = getAudio();
  if (!a) return;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      unlocked = true;
    })
    .catch(() => {
      a.muted = false;
    });
}

export function playBeep() {
  const a = getAudio();
  if (!a) return;
  a.muted = false;
  a.currentTime = 0;
  a.play().catch(() => {
    // blocked: the visual cue and vibration still fire
  });
}

export function vibrate() {
  try {
    navigator.vibrate?.([300, 120, 300, 120, 500]);
  } catch {
    // unsupported (iOS Safari)
  }
}

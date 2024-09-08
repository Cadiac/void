const DEBUG = true;
const TOUCH = false;
const AUDIO = true;

const song = {
  songData: [
    {
      // Instrument 0
      i: [
        0, // OSC1_WAVEFORM
        192, // OSC1_VOL
        104, // OSC1_SEMI
        64, // OSC1_XENV
        0, // OSC2_WAVEFORM
        80, // OSC2_VOL
        99, // OSC2_SEMI
        0, // OSC2_DETUNE
        0, // OSC2_XENV
        0, // NOISE_VOL
        4, // ENV_ATTACK
        0, // ENV_SUSTAIN
        66, // ENV_RELEASE
        0, // ENV_EXP_DECAY
        0, // ARP_CHORD
        0, // ARP_SPEED
        3, // LFO_WAVEFORM
        0, // LFO_AMT
        0, // LFO_FREQ
        0, // LFO_FX_FREQ
        1, // FX_FILTER
        0, // FX_FREQ
        1, // FX_RESONANCE
        2, // FX_DIST
        32, // FX_DRIVE
        37, // FX_PAN_AMT
        4, // FX_PAN_FREQ
        0, // FX_DELAY_AMT
        0, // FX_DELAY_TIME
      ],
      // Patterns
      p: [1],
      // Columns
      c: [{ n: [135, 135], f: [] }],
    },
  ],
  rowLen: 6615, // In sample lengths
  patternLen: 16, // Rows per pattern
  endPattern: 0, // End pattern
  numChannels: 1, // Number of channels
};
let songGenerationCol = 0;
let songNumWords = song.rowLen * song.patternLen * (song.endPattern + 1) * 2;
let songMixBuf = new Int32Array(songNumWords);

// Modified player-small.js synth from Soundbox project. Original license:
/* Copyright (c) 2011-2013 Marcus Geelnard
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 * 1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 *
 * 3. This notice may not be removed or altered from any source
 *    distribution.
 *
 */
//--------------------------------------------------------------------------
// Private methods
//--------------------------------------------------------------------------

// Oscillators
function osc_sin(value) {
  return Math.sin(value * 6.283184);
}

function osc_saw(value) {
  return 2 * (value % 1) - 1;
}

function osc_square(value) {
  return value % 1 < 0.5 ? 1 : -1;
}

function osc_tri(value) {
  var v2 = (value % 1) * 4;
  if (v2 < 2) return v2 - 1;
  return 3 - v2;
}

function getnotefreq(n) {
  // 174.61.. / 44100 = 0.003959503758 (F3)
  return 0.003959503758 * 2 ** ((n - 128) / 12);
}

function createNote(instr, n, rowLen) {
  var osc1 = mOscillators[instr.i[0]],
    o1vol = instr.i[1],
    o1xenv = instr.i[3] / 32,
    osc2 = mOscillators[instr.i[4]],
    o2vol = instr.i[5],
    o2xenv = instr.i[8] / 32,
    noiseVol = instr.i[9],
    attack = instr.i[10] * instr.i[10] * 4,
    sustain = instr.i[11] * instr.i[11] * 4,
    release = instr.i[12] * instr.i[12] * 4,
    releaseInv = 1 / release,
    expDecay = -instr.i[13] / 16,
    arp = instr.i[14],
    arpInterval = rowLen * 2 ** (2 - instr.i[15]);

  var noteBuf = new Int32Array(attack + sustain + release);

  // Re-trig oscillators
  var c1 = 0,
    c2 = 0;

  // Local variables.
  var j, j2, e, rsample, o1t, o2t;

  // Generate one note (attack + sustain + release)
  for (j = 0, j2 = 0; j < attack + sustain + release; j++, j2++) {
    if (j2 >= 0) {
      // Switch arpeggio note.
      arp = (arp >> 8) | ((arp & 255) << 4);
      j2 -= arpInterval;

      // Calculate note frequencies for the oscillators
      o1t = getnotefreq(n + (arp & 15) + instr.i[2] - 128);
      o2t =
        getnotefreq(n + (arp & 15) + instr.i[6] - 128) *
        (1 + 0.0008 * instr.i[7]);
    }

    // Envelope
    e = 1;
    if (j < attack) {
      e = j / attack;
    } else if (j >= attack + sustain) {
      e = (j - attack - sustain) * releaseInv;
      e = (1 - e) * 3 ** (expDecay * e);
    }

    // Oscillator 1
    c1 += o1t * e ** o1xenv;
    rsample = osc1(c1) * o1vol;

    // Oscillator 2
    c2 += o2t * e ** o2xenv;
    rsample += osc2(c2) * o2vol;

    // Noise oscillator
    if (noiseVol) {
      rsample += (2 * Math.random() - 1) * noiseVol;
    }

    // Add to (mono) channel buffer
    noteBuf[j] = (80 * rsample * e) | 0;
  }

  return noteBuf;
}

//--------------------------------------------------------------------------
// Private members
//--------------------------------------------------------------------------

// Array of oscillator functions
const mOscillators = [osc_sin, osc_square, osc_saw, osc_tri];

//--------------------------------------------------------------------------
// Public methods
//--------------------------------------------------------------------------

// Generate audio data for a single track
function generate() {
  // Local variables
  var i, j, p, row, col, n, cp, k, t, rsample, rowStartSample, f;

  // Put performance critical items in local variables
  var chnBuf = new Int32Array(songNumWords),
    instr = song.songData[songGenerationCol],
    rowLen = song.rowLen,
    patternLen = song.patternLen;

  // Clear effect state
  var low = 0,
    band = 0,
    high;
  var lsample,
    filterActive = false;

  // Clear note cache.
  var noteCache = [];

  // Patterns
  for (p = 0; p <= song.endPattern; ++p) {
    cp = instr.p[p];

    // Pattern rows
    for (row = 0; row < patternLen; ++row) {
      // Execute effect command.
      var cmdNo = cp ? instr.c[cp - 1].f[row] : 0;
      if (cmdNo) {
        instr.i[cmdNo - 1] = instr.c[cp - 1].f[row + patternLen] || 0;

        // Clear the note cache since the instrument has changed.
        if (cmdNo < 17) {
          noteCache = [];
        }
      }

      // Put performance critical instrument properties in local variables
      var oscLFO = mOscillators[instr.i[16]],
        lfoAmt = instr.i[17] / 512,
        lfoFreq = 2 ** (instr.i[18] - 9) / rowLen,
        fxLFO = instr.i[19],
        fxFilter = instr.i[20],
        fxFreq = (instr.i[21] * 43.23529 * 3.141592) / 44100,
        q = 1 - instr.i[22] / 255,
        dist = instr.i[23] * 1e-5,
        drive = instr.i[24] / 32,
        panAmt = instr.i[25] / 512,
        panFreq = (6.283184 * 2 ** (instr.i[26] - 9)) / rowLen,
        dlyAmt = instr.i[27] / 255,
        dly = (instr.i[28] * rowLen) & ~1; // Must be an even number

      // Calculate start sample number for this row in the pattern
      rowStartSample = (p * patternLen + row) * rowLen;

      // Generate notes for this pattern row
      for (col = 0; col < 4; ++col) {
        n = cp ? instr.c[cp - 1].n[row + col * patternLen] : 0;
        if (n) {
          if (!noteCache[n]) {
            noteCache[n] = createNote(instr, n, rowLen);
          }

          // Copy note from the note cache
          var noteBuf = noteCache[n];
          for (j = 0, i = rowStartSample * 2; j < noteBuf.length; j++, i += 2) {
            chnBuf[i] += noteBuf[j];
          }
        }
      }

      // Perform effects for this pattern row
      for (j = 0; j < rowLen; j++) {
        // Dry mono-sample
        k = (rowStartSample + j) * 2;
        rsample = chnBuf[k];

        // We only do effects if we have some sound input
        if (rsample || filterActive) {
          // State variable filter
          f = fxFreq;
          if (fxLFO) {
            f *= oscLFO(lfoFreq * k) * lfoAmt + 0.5;
          }
          f = 1.5 * Math.sin(f);
          low += f * band;
          high = q * (rsample - band) - low;
          band += f * high;
          rsample = fxFilter == 3 ? band : fxFilter == 1 ? high : low;

          // Distortion
          if (dist) {
            rsample *= dist;
            rsample =
              rsample < 1 ? (rsample > -1 ? osc_sin(rsample * 0.25) : -1) : 1;
            rsample /= dist;
          }

          // Drive
          rsample *= drive;

          // Is the filter active (i.e. still audiable)?
          filterActive = rsample * rsample > 1e-5;

          // Panning
          t = Math.sin(panFreq * k) * panAmt + 0.5;
          lsample = rsample * (1 - t);
          rsample *= t;
        } else {
          lsample = 0;
        }

        // Delay is always done, since it does not need sound input
        if (k >= dly) {
          // Left channel = left + right[-p] * t
          lsample += chnBuf[k - dly + 1] * dlyAmt;

          // Right channel = right + left[-p] * t
          rsample += chnBuf[k - dly] * dlyAmt;
        }

        // Store in stereo channel buffer (needed for the delay effect)
        chnBuf[k] = lsample | 0;
        chnBuf[k + 1] = rsample | 0;

        // ...and add to stereo mix buffer
        songMixBuf[k] += lsample | 0;
        songMixBuf[k + 1] += rsample | 0;
      }
    }
  }

  // Next iteration. Return progress (1.0 == done!).
  songGenerationCol++;
  return songGenerationCol / song.numChannels;
}

// Loads the Soundbox synth module, and generates the music.
// This has to be called and it has to be finished before "setupAudio" is called.
export const loadAudio = (canvas, init) => {
  if (!AUDIO) {
    document.body.append(canvas);
    init();
    return;
  }

  if (DEBUG) {
    const t0 = new Date();

    while (generate() < 1);

    const t1 = new Date();

    console.debug(`Audio instantiated in ${t1 - t0} ms`);
  } else {
    while (generate() < 1);
  }

  document.body.innerHTML = "Click!";
  document.body.append(canvas);

  // Audio can't run without an user initiated event.
  if (TOUCH) {
    // Mobile support needs a touch handler.
    canvas.ontouchend = canvas.onclick = init;
  } else {
    canvas.onclick = init;
  }
};

export const startAudio = () => {
  if (!AUDIO) {
    const audioCtx = new AudioContext();
    const analyser = new AnalyserNode(audioCtx);

    return {
      audioCtx,
      analyser,
    };
  }

  const audioCtx = new AudioContext();
  const audio = audioCtx.createBufferSource();

  // Create a AudioBuffer from the generated audio data
  const buffer = audioCtx.createBuffer(2, songNumWords / 2, 44100);
  const channel0 = buffer.getChannelData(0);
  const channel1 = buffer.getChannelData(1);

  for (let i = 0; i < songNumWords / 2; i++) {
    channel0[i] = songMixBuf[i * 2] / 65536;
    channel1[i] = songMixBuf[i * 2 + 1] / 65536;
  }

  audio.buffer = buffer;

  const analyser = new AnalyserNode(audioCtx);
  analyser.connect(audioCtx.destination);
  audio.connect(analyser);

  audio.loop = true;
  audio.start();

  return { audioCtx, analyser };
};

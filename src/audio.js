const DEBUG = true;
const AUDIO = false;

let o;

// Loads the Sointu WebAssembly module,
// generates the music and stores the audio to "o".
// This has to be called and it has to be finished before "setupAudio" is called.
export const loadSointuWasm = async (canvas, init) => {
  if (!AUDIO) {
    document.body.append(canvas);
    init();
    return;
  }

  if (DEBUG) {
    const t0 = new Date();

    o = await WebAssembly.instantiateStreaming(
      fetch("tmp/song_optimized.wasm"),
      {
        m: Math,
      }
    );
    const t1 = new Date();

    console.debug(`Audio instantiated in ${t1 - t0} ms`);
  } else {
    o = await WebAssembly.instantiate(f[1], { m: Math });
  }

  document.body.innerHTML = "Ready, click!";
  document.body.append(canvas);
  canvas.ontouchend = canvas.onclick = init;
};

export const setupAudio = () => {
  if (!AUDIO) {
    const audioCtx = new AudioContext();
    const analyser = new AnalyserNode(audioCtx);

    return {
      audioCtx,
      analyser,
    };
  }

  const l = o.instance.exports.l / 8;
  const s = o.instance.exports.s / 4;

  const arr = new Float32Array(o.instance.exports.m.buffer);

  const audioCtx = new AudioContext();
  const audio = audioCtx.createBufferSource();
  const buffer = audioCtx.createBuffer(2, l, 44100);

  const channel0 = buffer.getChannelData(0);
  const channel1 = buffer.getChannelData(1);

  for (let i = 0; i < l; i++) {
    channel0[i] = arr[s + i * 2];
    channel1[i] = arr[s + i * 2 + 1];
  }

  audio.buffer = buffer;

  const analyser = new AnalyserNode(audioCtx);
  analyser.connect(audioCtx.destination);
  audio.connect(analyser);

  if (DEBUG) {
    audio.loop = true;
  }
  audio.start();

  return { audioCtx, analyser };
};

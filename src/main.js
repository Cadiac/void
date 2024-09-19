import debug from "./debug.js";
import fps from "./fps.js";

const DEBUG = true;
const FULLSCREEN = true;

var canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.left = canvas.style.top = 0;
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;

import { loadAudio, startAudio } from "./soundbox.js";

const state = {
  epoch: 0,
  now: 0,
  audio: {
    offset: 0,
    beat: 0,
  },
  ascii: {
    background: 1.0,
  },
};

loadAudio(canvas, main);

async function main() {
  if (state.now > 0) {
    return;
  }

  if (DEBUG) {
    if (!navigator.gpu) {
      alert("WebGPU support is required. Try running this with Google Chrome!");
    }
    debug.setup(state);
  }

  // Wait for a to let the browser to properly enter fullscreen.
  if (FULLSCREEN) {
    await document.documentElement.requestFullscreen();
    await new Promise((r) => setTimeout(r, 1000));
  }

  state.epoch = performance.now();

  const analyser = startAudio();
  analyser.fftSize = 1024;
  const fftDataArray = new Uint8Array(analyser.frequencyBinCount);

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");
  const format = "rgba8unorm";
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
  });

  const vertexShaderCode = DEBUG
    ? await fetch("src/shader/vertex.wgsl").then((res) => res.text())
    : MINIFIED_VERTEX_SHADER;

  var canvasWidth = (canvas.width = window.innerWidth);
  var canvasHeight = (canvas.height = window.innerHeight);

  // Textures

  const raymarchPassTexture = device.createTexture({
    format,
    size: [canvasWidth, canvasHeight],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const maskTexture = device.createTexture({
    format,
    size: [canvasWidth, canvasHeight],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sobelTexture = device.createTexture({
    format,
    size: [canvasWidth, canvasHeight],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
  });

  const asciiTexture = device.createTexture({
    format,
    size: [canvasWidth, canvasHeight],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // Buffers

  const raymarchUniformsBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const asciiUniformsBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Raymarch

  const raymarchShaderCode = DEBUG
    ? await fetch("src/shader/raymarch.wgsl").then((res) => res.text())
    : MINIFIED_RAYMARCH_SHADER;

  const vertexShaderModule = device.createShaderModule({
    code: vertexShaderCode,
  });

  const raymarchPassPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: vertexShaderModule,
    },
    fragment: {
      module: device.createShaderModule({
        code: raymarchShaderCode,
      }),
      targets: [{ format }],
    },
  });

  // Ascii filter

  const asciiShaderCode = DEBUG
    ? await fetch("src/shader/ascii.wgsl").then((res) => res.text())
    : MINIFIED_ASCII_SHADER;

  const asciiRenderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: vertexShaderModule,
    },
    fragment: {
      module: device.createShaderModule({
        code: asciiShaderCode,
      }),
      targets: [{ format: presentationFormat }],
    },
  });

  // Sobel Filter - Compute shader

  const sobelShaderCode = DEBUG
    ? await fetch("src/shader/sobel.wgsl").then((res) => res.text())
    : MINIFIED_SOBEL_SHADER;

  const sobelComputePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: sobelShaderCode,
      }),
    },
  });

  // Bind groups

  const raymarchPassBindGroup = device.createBindGroup({
    layout: raymarchPassPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: raymarchUniformsBuffer } }],
  });

  const sobelComputeBindGroup = device.createBindGroup({
    layout: sobelComputePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: raymarchPassTexture.createView() },
      { binding: 1, resource: sobelTexture.createView() },
      { binding: 2, resource: maskTexture.createView() },
    ],
  });

  const asciiBindGroup = device.createBindGroup({
    layout: asciiRenderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: raymarchPassTexture.createView() },
      { binding: 1, resource: sobelTexture.createView() },
      { binding: 2, resource: maskTexture.createView() },
      { binding: 3, resource: asciiTexture.createView() },
      { binding: 4, resource: { buffer: asciiUniformsBuffer } },
    ],
  });

  const maskTextureContext = document.createElement("canvas").getContext("2d");
  const asciiTextureContext = document.createElement("canvas").getContext("2d");

  maskTextureContext.canvas.width = canvasWidth;
  maskTextureContext.canvas.height = canvasHeight;

  // Inlined "ASCII" texture creation.
  // First ten characters are for the fill and the rest for edges.
  const characters = "  .:oX1O0■|/-\\";

  const width = 8 * characters.length;
  const height = 8;

  asciiTextureContext.fillStyle = "#000";
  asciiTextureContext.fillRect(
    0,
    0,
    (asciiTextureContext.canvas.width = width),
    (asciiTextureContext.canvas.height = height)
  );
  asciiTextureContext.fillStyle = "#fff";
  asciiTextureContext.font = "8px monospace";
  asciiTextureContext.textAlign = "center";

  const charWidth = width / characters.length;
  const halfCharWidth = charWidth / 2;

  for (let i = 0; i < characters.length; i++) {
    const x = i * charWidth + halfCharWidth;
    asciiTextureContext.fillText(characters[i], x, height / 2 + 3);
  }

  device.queue.copyExternalImageToTexture(
    { source: asciiTextureContext.canvas },
    { texture: asciiTexture },
    { width: width, height: height }
  );

  // Start the render loop
  render();

  function render() {
    // update();
    const now = performance.now() - state.epoch;

    if (DEBUG) {
      const dt = now - state.now;
      fps.update(dt);
    }

    state.now = now;

    maskTextureContext.fillStyle = "#fff";
    const margin = 32;
    maskTextureContext.fillRect(
      margin,
      margin,
      canvasWidth - margin * 2,
      canvasHeight - margin * 2
    );

    maskTextureContext.font = `${canvasWidth / 17}px monospace`;
    maskTextureContext.fillStyle = "#000";

    const messages = [
      "",
      ":~$ ./run.sh",
      "",
      "",
      "",
      ":~$ ./greetings",
      "(papu)  pumpuli opossumi",
      "BFlorry    ඞ    sampozki",
      "shiona   ninnnu  Pinqvin",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "  Cadiac @ Demohäsä 2024",
      "",
      "",
      ":~$ exit",
    ];

    const duration = 5000,
      i = Math.floor(state.now / duration),
      c = Math.floor((state.now - i * duration) / 100),
      txt =
        messages[i].slice(0, c) +
        (Math.floor(state.now / 625) % 2 === 0 ? "█" : ""),
      x = margin * 3,
      y =
        i > 1 ? (i == 18 ? canvasHeight / 2 : canvasHeight - margin * 4) : 200;

    maskTextureContext.fillText(txt, x, y);

    device.queue.copyExternalImageToTexture(
      { source: maskTextureContext.canvas },
      { texture: maskTexture },
      { width: canvasWidth, height: canvasHeight }
    );

    // updateFFT();
    analyser.getByteFrequencyData(fftDataArray);
    if (DEBUG) {
      state.audio.beat = fftDataArray[state.audio.offset];
      state.ascii.background = fftDataArray[state.audio.offset] / 255;
    }

    // updateUniforms();
    device.queue.writeBuffer(
      raymarchUniformsBuffer,
      0,
      new Float32Array([
        canvasWidth,
        canvasHeight,
        state.now / 10000,
        fftDataArray[state.audio.offset] / 255,
      ])
    );
    device.queue.writeBuffer(
      asciiUniformsBuffer,
      0,
      new Float32Array([fftDataArray[state.audio.offset] / 255])
    );

    var commandEncoder = device.createCommandEncoder();

    const raymarchRenderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: raymarchPassTexture.createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    raymarchRenderPassEncoder.setPipeline(raymarchPassPipeline);
    raymarchRenderPassEncoder.setBindGroup(0, raymarchPassBindGroup);
    raymarchRenderPassEncoder.draw(6, 1, 0, 0);
    raymarchRenderPassEncoder.end();

    const computePassEncoder = commandEncoder.beginComputePass();
    computePassEncoder.setPipeline(sobelComputePipeline);
    computePassEncoder.setBindGroup(0, sobelComputeBindGroup);
    computePassEncoder.dispatchWorkgroups(
      Math.ceil(canvasWidth / 8),
      Math.ceil(canvasHeight / 8)
    );
    computePassEncoder.end();

    const asciiRenderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    asciiRenderPassEncoder.setPipeline(asciiRenderPipeline);
    asciiRenderPassEncoder.setBindGroup(0, asciiBindGroup);
    asciiRenderPassEncoder.draw(6, 1, 0, 0);
    asciiRenderPassEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    window.requestAnimationFrame(render);
  }
}

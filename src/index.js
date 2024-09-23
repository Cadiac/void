import debug from "./debug.js";
import fps from "./fps.js";

const DEBUG = true;
const FULLSCREEN = false;

var canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.left = canvas.style.top = 0;

import { loadAudio, startAudio } from "./soundbox.js";

const state = {
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

  if (FULLSCREEN) {
    // Wait for a to let the browser to properly enter fullscreen.
    await document.documentElement.requestFullscreen();
    await new Promise((r) => setTimeout(r, 1000));
  }

  const renderWidth = 1600;
  const zoom = window.innerWidth / renderWidth;
  document.body.style.zoom = zoom;

  const canvasWidth = (canvas.width = renderWidth);
  const canvasHeight = (canvas.height = window.innerHeight / zoom + 1);
  const epoch = performance.now();

  const analyser = startAudio();
  const fftDataArray = new Uint8Array((analyser.fftSize = 1024));

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

  // Grouping similar code together saves quite a bit of space at the compression,
  // even more than wrapping these to a helper function.

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
    size: 2 * 4,
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

  function render() {
    // update();
    const now = performance.now() - epoch;

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

    maskTextureContext.font = "100px monospace";
    maskTextureContext.fillStyle = "#000";

    // prettier-ignore
    const messages = [
      "",                         // 00:00
      ":~$ ./void",               // 00:05
      "",                         // 00:15
      "",                         // 00:25
      ":~$ ./greetings",          // 00:35
      "papu  pumpuli opossumi",   // 00:45
      "BFlorry   ඞ   sampozki",   // 00:55
      "shiona ninnnu  Pinqvin",   // 01:05
      "",                         // 01:15
      "Cadiac @ Demohäsä 2024",   // 01:25
      "",                         // 01:35
      ":~$ exit",                 // 01:45
    ];

    // Draw messages one character at a time, like they were typed out
    const messageDuration = 10000;
    const i = Math.floor((state.now + 5000) / messageDuration);
    const character = Math.floor(
      (state.now + 5000 - i * messageDuration) / 100
    );

    const x = margin * 3;
    const y =
      i > 1 ? (i == 9 ? canvasHeight / 2 : canvasHeight - margin * 4) : 200;
    const message =
      messages[i].slice(0, character) +
      (Math.floor((state.now + 5000) / 625) % 2 === 0 ? "█" : "");

    maskTextureContext.fillText(message, x, y);

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
      new Float32Array([
        fftDataArray[state.audio.offset] / 255,
        state.now / 10000,
      ])
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

  render();
}

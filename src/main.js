import debug from "./debug.js";
import fps from "./fps.js";

const DEBUG = true;

var canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.left = canvas.style.top = 0;
var canvasWidth = (canvas.width = window.innerWidth);
var canvasHeight = (canvas.height = window.innerHeight);

// import { loadAudio, startAudio } from "./sointu.js";
import { loadAudio, startAudio } from "./soundbox.js";

const state = {
  halt: false,
  epoch: 0,
  now: 0,
  keyboard: {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
  },
  audio: {
    offset: 3,
    beat: 0,
  },
  ascii: {
    background: 1.0,
    // threshold: 0.2,
    fill: 0.5,
    edges: 1,
  },
  bloom: {
    threshold: 0.8,
    color: {
      red: 0.8,
      green: 0.8,
      blue: 0.8,
    },
    burn: 1,
    amplify: 0.5,
  },
  camera: {
    position: {
      x: 10,
      y: 0,
      z: 0,
    },
    target: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
};

loadAudio(canvas, main);

async function main() {
  if (state.now > 0) {
    return;
  }

  state.epoch = performance.now();

  if (DEBUG) {
    if (!navigator.gpu) {
      alert("WebGPU support is required. Try running this with Google Chrome!");
    }
    debug.setup(state);
  }

  const { analyser, audioCtx } = startAudio();
  analyser.fftSize = 256;
  const fftDataArray = new Uint8Array(analyser.frequencyBinCount);

  if (DEBUG) {
    setupKeyboardListener(audioCtx);
  }

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
    size: 2 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const asciiUniformsBuffer = device.createBuffer({
    size: 4 * 4,
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

  // Inlined ascii texture creation
  const characters = " .:coePO0■|/-\\";

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
    if (state.halt) {
      return;
    }

    // update();
    const now = performance.now() - state.epoch;

    if (DEBUG) {
      const dt = now - state.now;
      fps.update(dt);
      updateCamera(dt);
    }

    state.now = now;

    // updateMaskTexture(device, maskTexture, maskTextureContext);
    // const { width, height } = maskTextureContext.canvas;

    // maskTextureContext.fillStyle = "#000";
    // maskTextureContext.fillRect(0, 0, width, height);

    maskTextureContext.fillStyle = "#fff";
    const margin = 30;
    maskTextureContext.fillRect(
      margin,
      margin,
      canvasWidth - margin * 2,
      canvasHeight - margin * 2
    );

    maskTextureContext.font = "160px s";
    maskTextureContext.fillStyle = "#000";

    const message = [
      "LOREM",
      "IPSUM",
      "DOLOR",
      "SIT",
      "AMET,",
      "CONSECTETUR",
      "ADIPISCING",
      "ELIT",
    ].join("                                ");

    maskTextureContext.fillText(
      message,
      5000 - ((state.now / 2) % 20000),
      canvasHeight / 2
    );

    device.queue.copyExternalImageToTexture(
      { source: maskTextureContext.canvas },
      { texture: maskTexture },
      { width: canvasWidth, height: canvasHeight }
    );

    // updateFFT();
    analyser.getByteFrequencyData(fftDataArray);
    if (DEBUG) {
      state.audio.beat = fftDataArray[state.audio.offset];
    }
    state.ascii.background = fftDataArray[state.audio.offset] / 255;

    // updateUniforms();
    device.queue.writeBuffer(
      raymarchUniformsBuffer,
      0,
      new Float32Array([
        canvasWidth,
        canvasHeight,
        state.now / 10000,
        state.audio.beat / 255,
      ])
    );
    device.queue.writeBuffer(
      asciiUniformsBuffer,
      0,
      new Float32Array([
        state.ascii.background,
        state.ascii.fill,
        state.ascii.edges,
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

  function updateCamera(dt) {
    const direction = {
      x: state.camera.target.x - state.camera.position.x,
      y: state.camera.target.y - state.camera.position.y,
      z: state.camera.target.z - state.camera.position.z,
    };

    const magnitude = Math.hypot(direction.x, direction.y, direction.z);

    const normalized = {
      x: direction.x / magnitude,
      y: direction.y / magnitude,
      z: direction.z / magnitude,
    };

    const SPEED = 0.005;

    // matikka on kyl päin vittua, mutta mitä sitten
    if (state.keyboard.forward) {
      state.camera.position.x += normalized.x * dt * SPEED;
      state.camera.position.y += normalized.y * dt * SPEED;
      state.camera.position.z += normalized.z * dt * SPEED;
    }

    if (state.keyboard.back) {
      state.camera.position.x -= normalized.x * dt * SPEED;
      state.camera.position.y -= normalized.y * dt * SPEED;
      state.camera.position.z -= normalized.z * dt * SPEED;
    }

    if (state.keyboard.left) {
      state.camera.position.x += normalized.z * dt * SPEED;
      state.camera.position.y += normalized.y * dt * SPEED;
      state.camera.position.z += -normalized.x * dt * SPEED;
    }

    if (state.keyboard.right) {
      state.camera.position.x -= normalized.z * dt * SPEED;
      state.camera.position.y -= normalized.y * dt * SPEED;
      state.camera.position.z -= -normalized.x * dt * SPEED;
    }

    if (state.keyboard.up) {
      state.camera.position.x -= normalized.y * dt * SPEED;
      state.camera.position.y -= -normalized.x * dt * SPEED;
      state.camera.position.z -= normalized.z * dt * SPEED;
    }

    if (state.keyboard.down) {
      state.camera.position.x += normalized.y * dt * SPEED;
      state.camera.position.y += -normalized.x * dt * SPEED;
      state.camera.position.z += normalized.z * dt * SPEED;
    }
  }

  function setupKeyboardListener(audioCtx) {
    document.addEventListener(
      "keydown",
      (e) => {
        switch (e.key) {
          case "Escape":
            state.halt = !state.halt;
            audioCtx.close();
            break;
          case "Shift":
            state.keyboard.down = true;
            break;
          case " ":
            state.keyboard.up = true;
            break;
          case "w":
          case "W":
            state.keyboard.forward = true;
            break;
          case "s":
          case "S":
            state.keyboard.back = true;
            break;
          case "a":
          case "A":
            state.keyboard.left = true;
            break;
          case "d":
          case "D":
            state.keyboard.right = true;
            break;
        }
      },
      true
    );

    document.addEventListener(
      "keyup",
      (e) => {
        switch (e.key) {
          case "Shift":
            state.keyboard.down = false;
            break;
          case " ":
            state.keyboard.up = false;
            break;
          case "w":
          case "W":
            state.keyboard.forward = false;
            break;
          case "s":
          case "S":
            state.keyboard.back = false;
            break;
          case "a":
          case "A":
            state.keyboard.left = false;
            break;
          case "d":
          case "D":
            state.keyboard.right = false;
            break;
        }
      },
      true
    );
  }
}

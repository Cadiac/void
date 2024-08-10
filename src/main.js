import { loadSointuWasm, setupAudio } from "./audio.js";
import debug from "./debug.js";
import fps from "./fps.js";

const canvas = createMainCanvas();

const DEBUG = true;

const state = {
  halt: false,
  epoch: performance.now(),
  now: 0,
  dt: 0,
  lastRenderTime: 0,
  keyboard: {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
  },
  audio: {
    offset: 22,
    beat: 0,
  },
  ascii: {
    background: 1.0,
    threshold: 0.16,
    fill: 1.4,
    edges: 0.89,
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
      x: -20.9,
      y: 3.4,
      z: 14.4,
    },
    target: {
      x: 0,
      y: 4.5,
      z: 0,
    },
  },
  sun: {
    position: {
      x: 1,
      y: 2,
      z: 3,
    },
  },
};

// Mobile support needs a touch handler.
// Audio can't run without an user initiated event.
loadSointuWasm(canvas, main);

async function initialize(analyser, audioCtx) {
  setupKeyboardListener(audioCtx);

  const fftDataArray = new Uint8Array(analyser.frequencyBinCount);

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");
  const format = "rgba8unorm";
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: "opaque",
  });

  // Raymarch

  const raymarchPassTexture = device.createTexture({
    format,
    size: [canvas.width, canvas.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const raymarchUniformsBuffer = device.createBuffer({
    size: 5 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const raymarchShaderCode = DEBUG
    ? await fetch("src/shader/raymarch.wgsl").then((res) => res.text())
    : MINIFIED_RAYMARCH_SHADER;

  const raymarchPassPipeline = await createRenderPipeline(
    "raymarch",
    device,
    raymarchShaderCode,
    format
  );

  const raymarchPassBindGroup = device.createBindGroup({
    label: "uniforms bind group",
    layout: raymarchPassPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: raymarchUniformsBuffer },
      },
    ],
  });

  // Sobel Filter - Compute shader

  const sobelTexture = device.createTexture({
    size: { width: canvas.width, height: canvas.height },
    format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
  });

  const asciiUniformsBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const sobelShaderCode = DEBUG
    ? await fetch("src/shader/sobel.wgsl").then((res) => res.text())
    : MINIFIED_SOBEL_SHADER;

  const sobelComputePipeline = await createComputePipeline(
    "sobel filter compute",
    device,
    sobelShaderCode
  );

  const sobelComputeBindGroup = device.createBindGroup({
    label: "sobel filter compute bind group",
    layout: sobelComputePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: raymarchPassTexture.createView() },
      { binding: 1, resource: sobelTexture.createView() },
      { binding: 2, resource: { buffer: asciiUniformsBuffer } },
    ],
  });

  // Ascii filter render pass

  const asciiPassTexture = device.createTexture({
    label: "ascii pass texture",
    size: { width: canvas.width, height: canvas.height },
    format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const asciiShaderCode = DEBUG
    ? await fetch("src/shader/ascii.wgsl").then((res) => res.text())
    : MINIFIED_ASCII_SHADER;

  const asciiRenderPipeline = await createRenderPipeline(
    "ascii",
    device,
    asciiShaderCode,
    format
  );

  const fill = " .:coePO0■";
  const edges = " |-/\\";

  const asciiTextureContext = createAsciiTexture(fill + edges);
  const asciiTextureSource = asciiTextureContext.canvas;
  const asciiTexture = device.createTexture({
    label: "ascii texture",
    format,
    size: [asciiTextureSource.width, asciiTextureSource.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  copySourceToTexture(device, asciiTexture, asciiTextureSource);

  const maskTextureContext = updateMaskTexture(canvas.width, canvas.height, 0);
  const maskTextureSource = maskTextureContext.canvas;
  const maskTexture = device.createTexture({
    label: "mask texture",
    format,
    size: [maskTextureSource.width, maskTextureSource.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  copySourceToTexture(device, maskTexture, maskTextureSource);

  const asciiBindGroup = device.createBindGroup({
    label: "ascii effect bind group",
    layout: asciiRenderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: raymarchPassTexture.createView() },
      { binding: 1, resource: maskTexture.createView() },
      { binding: 2, resource: asciiTexture.createView() },
      { binding: 3, resource: sobelTexture.createView() },
      { binding: 4, resource: { buffer: asciiUniformsBuffer } },
    ],
  });

  // Bloom - brightness filter

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });

  const bloomUniformsBuffer = device.createBuffer({
    size: 2 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const brightnessShaderCode = DEBUG
    ? await fetch("src/shader/brightness.wgsl").then((res) => res.text())
    : MINIFIED_BRIGHTNESS_SHADER;

  const brightnessPassPipeline = await createRenderPipeline(
    "brightness filter pass",
    device,
    brightnessShaderCode,
    format
  );

  const brightnessPassTexture = device.createTexture({
    label: "brightness pass texture",
    size: { width: canvas.width, height: canvas.height },
    format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const brightnessPassBindGroup = device.createBindGroup({
    label: "brightness pass bind group",
    layout: brightnessPassPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: asciiPassTexture.createView() },
      { binding: 2, resource: { buffer: bloomUniformsBuffer } },
    ],
  });

  // Bloom - gaussian blur

  const blurShaderCode = DEBUG
    ? await fetch("src/shader/blur.wgsl").then((res) => res.text())
    : MINIFIED_BLUR_SHADER;

  const horizontalBlurPassPipeline = await createRenderPipeline(
    "horizontal blur",
    device,
    blurShaderCode,
    format,
    "horizontal_blur"
  );

  const horizontalBlurPassTexture = device.createTexture({
    label: "horizontal blur pass texture",
    size: { width: canvas.width, height: canvas.height },
    format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const horizontalBlurPassBindGroup = device.createBindGroup({
    label: "brightness pass bind group",
    layout: horizontalBlurPassPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: brightnessPassTexture.createView() },
    ],
  });

  // Bloom - vertical blur filter

  const verticalBlurPassPipeline = await createRenderPipeline(
    "vertical blur",
    device,
    blurShaderCode,
    format,
    "vertical_blur"
  );

  const verticalBlurPassTexture = device.createTexture({
    label: "vertical blur pass texture",
    size: { width: canvas.width, height: canvas.height },
    format,
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const verticalBlurPassBindGroup = device.createBindGroup({
    label: "brightness pass bind group",
    layout: verticalBlurPassPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: horizontalBlurPassTexture.createView() },
    ],
  });

  // Bloom - combine filter

  const bloomShaderCode = DEBUG
    ? await fetch("src/shader/bloom.wgsl").then((res) => res.text())
    : MINIFIED_BLOOM_SHADER;

  const bloomPassPipeline = await createRenderPipeline(
    "bloom",
    device,
    bloomShaderCode,
    presentationFormat
  );

  const bloomPassBindGroup = device.createBindGroup({
    label: "bloom pass bind group",
    layout: bloomPassPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: asciiPassTexture.createView() },
      { binding: 1, resource: verticalBlurPassTexture.createView() },
      { binding: 2, resource: sampler },
      { binding: 3, resource: { buffer: bloomUniformsBuffer } },
    ],
  });

  function update(dt) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (DEBUG) {
      fps.update(dt);
    }

    copySourceToTexture(
      device,
      maskTexture,
      updateMaskTexture(canvas.width, canvas.height, state.now).canvas
    );

    updateCamera(dt);
    updateFFT();
    updateUniforms();
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

    const SPEED = 5.0;

    // matikka on päin vittua, mutta mitä sitten
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

  function updateFFT() {
    analyser.getByteFrequencyData(fftDataArray);
    state.audio.beat = fftDataArray[state.audio.offset];
  }

  function updateUniforms() {
    device.queue.writeBuffer(
      raymarchUniformsBuffer,
      0,
      new Float32Array([
        state.camera.position.x,
        state.camera.position.y,
        state.camera.position.z,
        0,

        state.camera.target.x,
        state.camera.target.y,
        state.camera.target.z,
        0,

        canvas.width,
        canvas.height,
        0,
        0,

        state.sun.position.x,
        state.sun.position.y,
        state.sun.position.z,
        0,

        state.now,
        0,
        0,
        0,
      ])
    );
    device.queue.writeBuffer(
      asciiUniformsBuffer,
      0,
      new Float32Array([
        state.ascii.background,
        state.ascii.threshold,
        state.ascii.fill,
        state.ascii.edges,
      ])
    );
    device.queue.writeBuffer(
      bloomUniformsBuffer,
      0,
      new Float32Array([
        state.bloom.threshold,
        state.bloom.burn,
        state.bloom.amplify,
        0,
        state.bloom.color.red,
        state.bloom.color.green,
        state.bloom.color.blue,
        0,
      ])
    );
  }

  function render() {
    state.now = performance.now() - state.epoch;
    const dt = (state.now - state.lastRenderTime) / 1000;
    state.lastRenderTime = state.now;

    if (state.halt) {
      return;
    }

    update(dt);

    const commandEncoder = device.createCommandEncoder();

    dispatchRenderPass(
      commandEncoder,
      raymarchPassPipeline,
      raymarchPassBindGroup,
      {
        label: "raymarch pass",
        colorAttachments: [
          {
            view: raymarchPassTexture.createView(),
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      }
    );

    dispatchComputeShader(
      commandEncoder,
      sobelComputePipeline,
      sobelComputeBindGroup,
      canvas.width,
      canvas.height
    );

    dispatchRenderPass(commandEncoder, asciiRenderPipeline, asciiBindGroup, {
      label: "ascii filter pass",
      colorAttachments: [
        {
          view: asciiPassTexture.createView(),
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    dispatchRenderPass(
      commandEncoder,
      brightnessPassPipeline,
      brightnessPassBindGroup,
      {
        label: "brightness filter pass",
        colorAttachments: [
          {
            view: brightnessPassTexture.createView(),
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      }
    );

    dispatchRenderPass(
      commandEncoder,
      horizontalBlurPassPipeline,
      horizontalBlurPassBindGroup,
      {
        label: "horizontal blur filter pass",
        colorAttachments: [
          {
            view: horizontalBlurPassTexture.createView(),
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      }
    );

    dispatchRenderPass(
      commandEncoder,
      verticalBlurPassPipeline,
      verticalBlurPassBindGroup,
      {
        label: "gaussian blur filter pass",
        colorAttachments: [
          {
            view: verticalBlurPassTexture.createView(),
            clearValue: [0.3, 0.3, 0.3, 1],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      }
    );

    dispatchRenderPass(commandEncoder, bloomPassPipeline, bloomPassBindGroup, {
      label: "bloom filter pass",
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    device.queue.submit([commandEncoder.finish()]);

    window.requestAnimationFrame(render);
  }

  render();
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

async function createRenderPipeline(
  label,
  device,
  shaderCode,
  format,
  fsEntryPoint = "fs"
) {
  const vertexShaderCode = DEBUG
    ? await fetch("src/shader/vertex.wgsl").then((res) => res.text())
    : MINIFIED_VERTEX_SHADER;

  const vertexShaderModule = device.createShaderModule({
    label: `${label} vertex shader`,
    code: vertexShaderCode,
  });

  const shaderModule = device.createShaderModule({
    label: `${label} shader`,
    code: shaderCode,
  });

  return device.createRenderPipelineAsync({
    label: `${label} render pipeline`,
    layout: "auto",
    vertex: {
      module: vertexShaderModule,
      entryPoint: "vs",
    },
    fragment: {
      module: shaderModule,
      entryPoint: fsEntryPoint,
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-strip",
    },
  });
}

async function createComputePipeline(label, device, shaderCode) {
  const shaderModule = device.createShaderModule({
    label: `${label} shader`,
    code: shaderCode,
  });

  const pipeline = device.createComputePipeline({
    label: `${label} render pipeline`,
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  return pipeline;
}

function createMainCanvas() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.left = canvas.style.top = 0;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  return canvas;
}

function createAsciiTexture(characters) {
  const ctx = document.createElement("canvas").getContext("2d");

  const width = 8 * characters.length;
  const height = 8;
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.canvas.style["image-rendering"] = "pixelated";

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "white";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.imageSmoothingEnabled = false;

  const charWidth = width / characters.length;
  const halfCharWidth = charWidth / 2;

  for (let i = 0; i < characters.length; i++) {
    const x = i * charWidth + halfCharWidth;
    ctx.fillText(characters[i], x, height / 2 + 1);
  }

  return ctx;
}

function updateMaskTexture(width, height, time) {
  const ctx = document.createElement("canvas").getContext("2d");

  ctx.canvas.width = width;
  ctx.canvas.height = height;

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "black";
  ctx.font = "20em bold serif";

  if (time > 10000) {
    ctx.fillText("GREETINGS TO:", 100 + Math.min(time - 10000, 0), height / 4);
    ctx.fillText(
      "IMNEVERSORRY",
      100 + Math.min(time - 15000, 0),
      height / 4 + 160
    );
    ctx.fillText("PAPU", 100 + Math.min(time - 17000, 0), height / 4 + 160 * 2);
    ctx.fillText(
      "PUMPULI",
      100 + Math.min(time - 18000, 0),
      height / 4 + 160 * 3
    );
    ctx.fillText(
      "OPOSSUMI",
      100 + Math.min(time - 20000, 0),
      height / 4 + 160 * 4
    );
  }

  // ctx.fillRect(
  //   width / 4 + Math.sin(time / 1000) * 100,
  //   height / 4 + Math.cos(time / 1000) * 100,
  //   width / 2,
  //   height / 2
  // );

  return ctx;
}

function copySourceToTexture(device, texture, source, flipY = false) {
  device.queue.copyExternalImageToTexture(
    { source, flipY },
    { texture },
    { width: source.width, height: source.height }
  );
}

function dispatchRenderPass(
  commandEncoder,
  pipeline,
  bindGroup,
  passDescriptor
) {
  const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.draw(6, 1, 0, 0);
  passEncoder.end();
}

function dispatchComputeShader(
  commandEncoder,
  pipeline,
  bindGroup,
  width,
  height
) {
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  passEncoder.end();
}

async function loadImageBitmap(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return await createImageBitmap(blob, { colorSpaceConversion: "none" });
}

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

  const { analyser, audioCtx } = setupAudio();
  analyser.fftSize = 256;

  initialize(analyser, audioCtx);
}

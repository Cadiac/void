import { loadSointuWasm, setupAudio } from "./audio.js";
import debug from "./debug.js";
import fps from "./fps.js";

const canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.left = canvas.style.top = 0;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const AUDIO = true;
const DEBUG = true;

const state = {
  halt: false,
  epoch: performance.now(),
  now: 0,
  dt: 0,
  lastRenderTime: 0,
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

if (AUDIO) {
  // Mobile support needs a touch handler.
  // Audio can't run without an user initiated event.
  loadSointuWasm(canvas, main);
} else {
  window.onload = main;
}

document.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape") {
      state.halt = !state.halt;
      audioCtx.close();
    }
  },
  true
);

async function initialize(analyser) {
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

  const asciiTextureSource = await loadImageBitmap("src/textures/ascii.png");
  const asciiTexture = device.createTexture({
    label: "ascii texture",
    format,
    size: [asciiTextureSource.width, asciiTextureSource.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  device.queue.copyExternalImageToTexture(
    { source: asciiTextureSource, flipY: false },
    { texture: asciiTexture },
    { width: asciiTextureSource.width, height: asciiTextureSource.height }
  );

  const edgesTextureSource = await loadImageBitmap("src/textures/edges.png");
  const edgesTexture = device.createTexture({
    label: "edges texture",
    format,
    size: [edgesTextureSource.width, edgesTextureSource.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: edgesTextureSource, flipY: false },
    { texture: edgesTexture },
    { width: edgesTextureSource.width, height: edgesTextureSource.height }
  );

  const asciiBindGroup = device.createBindGroup({
    label: "ascii effect bind group",
    layout: asciiRenderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: raymarchPassTexture.createView() },
      { binding: 1, resource: asciiTexture.createView() },
      { binding: 2, resource: edgesTexture.createView() },
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

    updateFFT();
    updateUniforms();
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

async function createRenderPipeline(
  label,
  device,
  shaderCode,
  format,
  fsEntryPoint
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
  if (DEBUG) {
    if (!navigator.gpu) {
      alert("WebGPU support is required. Try running this with Google Chrome!");
    }
    debug.setup(state);
  }

  const { audioCtx, analyser } = setupAudio();
  analyser.fftSize = 256;

  initialize(analyser);
}

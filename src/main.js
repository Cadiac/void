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
    background: 0.5,
    threshold: 0.1,
    fill: 1.0,
    edges: 1.0,
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

async function initialize(
  mainShaderCode,
  effectShaderCode,
  computeShaderCode,
  analyser
) {
  const fftDataArray = new Uint8Array(analyser.frequencyBinCount);

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  const texture = device.createTexture({
    format,
    size: [canvas.width, canvas.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const uniformBuffer = device.createBuffer({
    size: 5 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const mainRenderPipeline = await createRenderPipeline(
    "main",
    device,
    mainShaderCode,
    format
  );

  const uniformBindGroup = device.createBindGroup({
    label: "uniforms bind group",
    layout: mainRenderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ],
  });

  const asciiUniformsBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const computePipeline = await createComputePipeline(
    "compute",
    device,
    computeShaderCode
  );

  const sobelTextureDescriptor = {
    size: { width: canvas.width, height: canvas.height },
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
  };
  const sobelTexture = device.createTexture(sobelTextureDescriptor);

  const computeBindGroup = device.createBindGroup({
    label: "compute bind group",
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: sobelTexture.createView() },
      { binding: 2, resource: { buffer: asciiUniformsBuffer } },
    ],
  });

  const effectRenderPipeline = await createRenderPipeline(
    "effect",
    device,
    effectShaderCode,
    format
  );

  const asciiTextureSource = await loadImageBitmap("src/textures/ascii.png");
  const asciiTexture = device.createTexture({
    label: "ascii texture",
    format: "rgba8unorm",
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
    format: "rgba8unorm",
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

  const textureBindGroup = device.createBindGroup({
    label: "texture bind group",
    layout: effectRenderPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: asciiTexture.createView() },
      { binding: 2, resource: edgesTexture.createView() },
      { binding: 3, resource: sobelTexture.createView() },
      { binding: 4, resource: { buffer: asciiUniformsBuffer } },
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
      uniformBuffer,
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

    const textureView = texture.createView();

    const mainPassDescriptor = {
      label: "main render renderPass",
      colorAttachments: [
        {
          view: textureView,
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };

    dispatchRenderPass(
      commandEncoder,
      mainRenderPipeline,
      uniformBindGroup,
      mainPassDescriptor
    );

    const presentationView = context.getCurrentTexture().createView();

    dispatchComputeShader(
      commandEncoder,
      computePipeline,
      computeBindGroup,
      canvas.width,
      canvas.height
    );

    const effectPassDescriptor = {
      label: "effect pass renderPass",
      colorAttachments: [
        {
          view: presentationView,
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };

    dispatchRenderPass(
      commandEncoder,
      effectRenderPipeline,
      textureBindGroup,
      effectPassDescriptor
    );

    device.queue.submit([commandEncoder.finish()]);

    window.requestAnimationFrame(render);
  }

  render();
}

async function createRenderPipeline(label, device, shaderCode, format) {
  const shaderModule = device.createShaderModule({
    label: `${label} shader`,
    code: shaderCode,
  });

  return device.createRenderPipelineAsync({
    label: `${label} render pipeline`,
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs",
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

  const mainShaderCode = DEBUG
    ? await fetch("src/shader/main.wgsl").then((res) => res.text())
    : MINIFIED_SHADER;

  const effectShaderCode = DEBUG
    ? await fetch("src/shader/effect.wgsl").then((res) => res.text())
    : MINIFIED_EFFECT_SHADER;

  const computeShaderCode = DEBUG
    ? await fetch("src/shader/compute.wgsl").then((res) => res.text())
    : MINIFIED_COMPUTE_SHADER;

  initialize(mainShaderCode, effectShaderCode, computeShaderCode, analyser);
}

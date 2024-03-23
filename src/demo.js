import debug from "./debug.js";
import fps from "./fps.js";
import { setupAudio } from "./audio.js";

const DEBUG = true;

let device;
let canvas;
let uniformBuffer;
let uniformBindGroup;
// let computePipeline;
let renderPipeline;
let renderPassDescriptor;
let context;
let audioCtx;
let analyser;
let fftDataArray;
let shaderCode;

const state = {
  halt: false,
  epoch: performance.now(),
  now: 0,
  dt: 0,
  lastRenderTime: 0,
  camera: {
    pos: {
      x: 0,
      y: 0,
      z: -5,
    },
    target: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  sun: {
    x: 0,
    y: 5,
    z: 100,
  },
  fog: {
    color: [255, 127, 255],
    intensity: 0.005,
  },
  sky: {
    color: [255, 255, 255],
  },
  audio: {
    offset: 22,
    beat: 0,
  },
};

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

async function createRenderPipeline(shaderModule, pipelineLayout) {
  return device.createRenderPipelineAsync({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vs",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs",
      targets: [{ format: "bgra8unorm" }],
    },
    primitive: { topology: "triangle-strip" },
  });
}

function encodeRenderPassAndSubmit(
  commandEncoder,
  pipeline,
  bindGroup,
  passDescriptor
) {
  const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.draw(4);
  passEncoder.end();
}

async function createRenderResources() {
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: "uniform",
        },
      },
    ],
  });

  uniformBuffer = device.createBuffer({
    size: (4 + 4 + 4 + 4) * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  uniformBindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  renderPassDescriptor = {
    colorAttachments: [
      {
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const shaderModule = device.createShaderModule({ code: shaderCode });
  // computePipeline = await createComputePipeline(shaderModule, pipelineLayout);
  renderPipeline = await createRenderPipeline(shaderModule, pipelineLayout);
}

function render(time) {
  state.now = performance.now() - state.epoch;
  const dt = (state.now - state.lastRenderTime) / 1000;
  state.lastRenderTime = state.now;

  if (state.halt) {
    return;
  }

  update(dt);

  const commandEncoder = device.createCommandEncoder();

  // Simulation
  //   encodeComputePassAndSubmit(
  //     commandEncoder,
  //     computePipeline,
  //     bindGroup[simulationIteration % 2]
  //   );

  // Uniforms
  // prettier-ignore
  const uniformsArray = new Float32Array([
    canvas.width,           canvas.height,          0.0,                    0.0,
    state.sun.x,            state.sun.y,            state.sun.z,            0.0,
    state.camera.pos.x,     state.camera.pos.y,     state.camera.pos.z,     0.0,
    state.camera.target.x,  state.camera.target.y,  state.camera.target.z,  0.0
  ]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformsArray.buffer);

  // Render
  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  encodeRenderPassAndSubmit(
    commandEncoder,
    renderPipeline,
    uniformBindGroup,
    renderPassDescriptor
  );

  device.queue.submit([commandEncoder.finish()]);

  requestAnimationFrame(render);
}

function update(dt) {
  if (DEBUG) {
    fps.update(dt);
  }
  analyser.getByteFrequencyData(fftDataArray);
  state.audio.beat = fftDataArray[state.audio.offset];
}

export const run = async (cnvs) => {
  if (DEBUG) {
    if (!navigator.gpu) {
      alert("WebGPU support is required. Try running this with Google Chrome!");
    }
    debug.setup(state);
  }

  canvas = cnvs;
  let a = setupAudio();

  shaderCode = DEBUG
    ? await fetch("src/shader/shader.wgsl").then((res) => res.text())
    : MINIFIED_SHADER;

  audioCtx = a.audioCtx;
  analyser = a.analyser;
  analyser.fftSize = 256;
  fftDataArray = new Uint8Array(analyser.frequencyBinCount);

  const gpuAdapter = await navigator.gpu.requestAdapter();
  device = await gpuAdapter.requestDevice();

  await createRenderResources();

  context = canvas.getContext("webgpu");
  context.configure({ device, format: "bgra8unorm", alphaMode: "opaque" });

  window.requestAnimationFrame(render);
};

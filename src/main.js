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

let device;
let storageBuffer;
let vertexBuffer;
let staticStorageBuffer;
let bindGroup;
let renderPipeline;
let renderPassDescriptor;
let context;
let audioCtx;
let analyser;
let fftDataArray;
let shaderCode;

// let computePipeline;

let particles = [];
const particleCount = 100;

const storageUnitSize =
  3 * 4 + // position, 3 x f32
  1 * 4; // pressure, 1 x f32
const storageBufferSize = storageUnitSize * particleCount;
const storageValues = new Float32Array(storageBufferSize / 4);

const positionOffset = 0;
const pressureOffset = 3;

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

// A random number between [min and max)
// With 1 argument it will be [0 to min)
// With no arguments it will be [0 to 1)
const rand = (min, max) => {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};

async function createRenderPipeline(shaderModule) {
  return device.createRenderPipelineAsync({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: (3 + 2) * 4, // xyz, uv
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3",
            },
            {
              shaderLocation: 1,
              offset: 3 * 4,
              format: "float32x2",
            },
          ],
        },
      ],
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
  passDescriptor,
  vertexBuffer
) {
  const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);

  passEncoder.setVertexBuffer(0, vertexBuffer);

  // Draw a quad
  passEncoder.draw(6, particleCount);
  passEncoder.end();
}

async function createRenderResources() {
  // prettier-ignore
  const quadVerticesWithUV = new Float32Array([
    -0.01, -0.01, 0.0,  0.0, 0.0, // Bottom left
     0.01, -0.01, 0.0,  1.0, 0.0, // Bottom right
    -0.01,  0.01, 0.0,  0.0, 1.0, // Top left
    //
     0.01, -0.01, 0.0,  1.0, 0.0, // Bottom right
     0.01,  0.01, 0.0,  1.0, 1.0, // Top right
    -0.01,  0.01, 0.0,  0.0, 1.0  // Top left
]);
  vertexBuffer = device.createBuffer({
    size: quadVerticesWithUV.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(quadVerticesWithUV);
  vertexBuffer.unmap();

  storageBuffer = device.createBuffer({
    size: storageBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({ code: shaderCode });
  // computePipeline = await createComputePipeline(shaderModule, pipelineLayout);
  renderPipeline = await createRenderPipeline(shaderModule);

  bindGroup = device.createBindGroup({
    label: "bind group for objects",
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: storageBuffer } }],
  });

  renderPassDescriptor = {
    label: "our basic canvas renderPass",
    colorAttachments: [
      {
        clearValue: [0.3, 0.3, 0.3, 1],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };
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

  // Simulation
  //   encodeComputePassAndSubmit(
  //     commandEncoder,
  //     computePipeline,
  //     bindGroup[simulationIteration % 2]
  //   );

  // Uniforms
  // const uniformsArray = new Float32Array([
  //   canvas.width,           canvas.height,          0.0,                    0.0,
  //   state.sun.x,            state.sun.y,            state.sun.z,            0.0,
  //   state.camera.pos.x,     state.camera.pos.y,     state.camera.pos.z,     0.0,
  //   state.camera.target.x,  state.camera.target.y,  state.camera.target.z,  0.0
  // ]);
  // device.queue.writeBuffer(uniformBuffer, 0, uniformsArray.buffer);

  for (let i = 0; i < particleCount; ++i) {
    const offset = i * (storageUnitSize / 4);
    storageValues.set(
      [rand(-1, 1), rand(-1, 1), rand(-1, 1)],
      offset + positionOffset
    );
    storageValues.set([rand()], offset + pressureOffset);
  }

  device.queue.writeBuffer(storageBuffer, 0, storageValues);

  // Render
  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();

  encodeRenderPassAndSubmit(
    commandEncoder,
    renderPipeline,
    bindGroup,
    renderPassDescriptor,
    vertexBuffer
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

async function main() {
  if (DEBUG) {
    if (!navigator.gpu) {
      alert("WebGPU support is required. Try running this with Google Chrome!");
    }
    debug.setup(state);
  }

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
}

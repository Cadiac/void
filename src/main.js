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
let bindGroup;
let renderPipeline;
let renderPassDescriptor;
let context;
let audioCtx;
let analyser;
let fftDataArray;
let shaderCode;

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

const particleCount = 100;

const storageUnitSize =
  3 * 4 + // position, 3 x f32
  1 * 4 + // density, 1 x f32,
  1 * 4; // pressure, 1 x f32,

const storageBufferSize = storageUnitSize * particleCount;
const storageValues = new Float32Array(storageBufferSize / 4);

const positionOffset = 0;
const densityOffset = positionOffset + 3;
const pressureOffset = densityOffset + 1;

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
  particles: {
    smoothingRadius: 0.2,
    positions: [...Array(particleCount)].map((_) => ({
      x: rand(-0.5, 0.5),
      y: rand(-0.5, 0.5),
      z: 0,
    })),
    densities: [...Array(particleCount)].map((_) => 0),
    pressures: [...Array(particleCount)].map((_) => 0),
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

function smoothingKernel(radius, distance) {
  const volume = (Math.PI * Math.pow(radius, 8)) / 4;
  const value = Math.max(0, radius * radius - distance * distance);
  return (value * value * value) / volume;
}

function calculateDensity(samplePoint, positions, smoothingRadius) {
  let density = 0;
  const mass = 1;

  for (const position of positions) {
    const distance = Math.hypot(
      position.x - samplePoint.x,
      position.y - samplePoint.y,
      position.z - samplePoint.z
    );
    const influence = smoothingKernel(smoothingRadius, distance);
    density += mass * influence;
  }

  return density;
}

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
  passEncoder.draw(6, particleCount);
  passEncoder.end();
}

async function createRenderResources() {
  // prettier-ignore
  const quadVerticesWithUV = new Float32Array([
    -0.1, -0.1, 0.0,  0.0, 0.0, // Bottom left
     0.1, -0.1, 0.0,  1.0, 0.0, // Bottom right
    -0.1,  0.1, 0.0,  0.0, 1.0, // Top left
    //
     0.1, -0.1, 0.0,  1.0, 0.0, // Bottom right
     0.1,  0.1, 0.0,  1.0, 1.0, // Top right
    -0.1,  0.1, 0.0,  0.0, 1.0  // Top left
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

  //   encodeComputePassAndSubmit(
  //     commandEncoder,
  //     computePipeline,
  //     bindGroup[simulationIteration % 2]
  //   );

  // Simulation
  for (let i = 0; i < particleCount; ++i) {
    const offset = i * (storageUnitSize / 4);

    storageValues.set(
      [
        state.particles.positions[i].x,
        state.particles.positions[i].y,
        state.particles.positions[i].z,
      ],
      offset + positionOffset
    );

    const density = calculateDensity(
      state.particles.positions[i],
      state.particles.positions,
      state.particles.smoothingRadius
    );

    storageValues.set([density], offset + densityOffset);
    storageValues.set([0.0], offset + pressureOffset);
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

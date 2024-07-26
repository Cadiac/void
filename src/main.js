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
  camera: {
    position: {
      x: 10,
      y: 10,
      z: 0,
    },
    target: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  sun: {
    position: {
      x: 0,
      y: 0,
      z: 0,
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

async function initialize(shaderCode, analyser) {
  const fftDataArray = new Uint8Array(analyser.frequencyBinCount);

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: format,
    alphaMode: "opaque",
  });

  // prettier-ignore
  const vertices = new Float32Array([
    -1.0, -1.0, // Bottom left
     1.0, -1.0, // Bottom right
    -1.0,  1.0, // Top left

    -1.0,  1.0, // Bottom right
     1.0, -1.0, // Top right
     1.0,  1.0, // Top left
  ]);

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
  vertexBuffer.unmap();

  // Uniform buffer setup
  const uniformBuffer = device.createBuffer({
    size: 64, // Enough for two vec4s and two vec3s
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({
    label: "main shader",
    code: shaderCode,
  });

  const renderPipeline = await createRenderPipeline(
    device,
    shaderModule,
    format
  );

  const bindGroup = device.createBindGroup({
    label: "uniforms bind group",
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
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
    const data = new Float32Array([
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
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, data);
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
    const textureView = context.getCurrentTexture().createView();
    const passDescriptor = {
      label: "main canvas renderPass",
      colorAttachments: [
        {
          view: textureView,
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };

    encodeRenderPassAndSubmit(
      commandEncoder,
      renderPipeline,
      bindGroup,
      passDescriptor,
      vertexBuffer
    );

    device.queue.submit([commandEncoder.finish()]);

    window.requestAnimationFrame(render);
  }

  render();
}

async function createRenderPipeline(device, shaderModule, format) {
  return device.createRenderPipelineAsync({
    label: "main render pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vs",
      buffers: [
        {
          arrayStride: 2 * 4, // uv
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x2",
            },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs",
      targets: [{ format: format }],
    },
    primitive: {
      topology: "triangle-strip",
    },
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
  passEncoder.draw(6, 1, 0, 0);
  passEncoder.end();
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

  const shaderCode = DEBUG
    ? await fetch("src/shader/shader.wgsl").then((res) => res.text())
    : MINIFIED_SHADER;

  initialize(shaderCode, analyser);
}

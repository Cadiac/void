import debug from "./debug.js";
import fps from "./fps.js";

const canvas = createMainCanvas();

const DEBUG = true;

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
    size: [canvas.width, canvas.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const maskTexture = device.createTexture({
    format,
    size: [canvas.width, canvas.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sobelTexture = device.createTexture({
    format,
    size: [canvas.width, canvas.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
  });

  const asciiTexture = device.createTexture({
    format,
    size: [canvas.width, canvas.height],
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // Buffers

  const raymarchUniformsBuffer = device.createBuffer({
    size: 3 * 4 * 4,
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

  const maskTextureContext = document.createElement("canvas").getContext("2d");
  maskTextureContext.canvas.width = canvas.width;
  maskTextureContext.canvas.height = canvas.height;

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

  // Inlined ascii texture creation
  const characters = " .:coePO0■|/-\\";

  const asciiTextureSource = document.createElement("canvas");
  const asciiTextureContext = asciiTextureSource.getContext("2d");

  const width = 8 * characters.length;
  const height = 8;

  asciiTextureContext.fillStyle = "#000";
  asciiTextureContext.fillRect(
    0,
    0,
    (asciiTextureSource.width = width),
    (asciiTextureSource.height = height)
  );
  asciiTextureContext.fillStyle = "#fff";
  asciiTextureContext.font = "8px monospace";
  asciiTextureContext.textAlign = "center";

  // asciiTextureContext.textBaseline = "middle";
  // asciiTextureSource.style["image-rendering"] = "pixelated";
  // asciiTextureContext.imageSmoothingEnabled = false;

  const charWidth = width / characters.length;
  const halfCharWidth = charWidth / 2;

  for (let i = 0; i < characters.length; i++) {
    const x = i * charWidth + halfCharWidth;
    asciiTextureContext.fillText(characters[i], x, height / 2 + 3);
  }

  // copySourceToTexture(device, asciiTexture, asciiTextureSource);

  device.queue.copyExternalImageToTexture(
    { source: asciiTextureSource },
    { texture: asciiTexture },
    { width: width, height: height }
  );

  // Bind groups

  const raymarchPassBindGroup = createBindGroup(
    raymarchPassPipeline,
    [{ buffer: raymarchUniformsBuffer }],
    "uniforms bind group"
  );

  const sobelComputeBindGroup = createBindGroup(
    sobelComputePipeline,
    [
      raymarchPassTexture.createView(),
      sobelTexture.createView(),
      maskTexture.createView(),
    ],
    "sobel filter compute bind group"
  );

  const asciiBindGroup = createBindGroup(
    asciiRenderPipeline,
    [
      raymarchPassTexture.createView(),
      maskTexture.createView(),
      asciiTexture.createView(),
      sobelTexture.createView(),
      { buffer: asciiUniformsBuffer },
    ],
    "ascii effect bind group"
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
    const { width, height } = maskTextureContext.canvas;

    // maskTextureContext.fillStyle = "#000";
    // maskTextureContext.fillRect(0, 0, width, height);

    maskTextureContext.fillStyle = "#fff";
    const margin = 30;
    maskTextureContext.fillRect(
      margin,
      margin,
      width - margin * 2,
      height - margin * 2
    );

    maskTextureContext.font = "160px s";
    // maskTextureContext.fillStyle = "#0F0";
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
      height - margin * 2 - 40
    );

    device.queue.copyExternalImageToTexture(
      { source: maskTextureContext.canvas },
      { texture: maskTexture },
      { width: canvas.width, height: canvas.height }
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
        state.now,
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

    const commandEncoder = device.createCommandEncoder();

    dispatchRenderPass(
      commandEncoder,
      raymarchPassPipeline,
      raymarchPassBindGroup,
      raymarchPassTexture,
      "raymarch pass"
    );

    dispatchComputeShader(
      commandEncoder,
      sobelComputePipeline,
      sobelComputeBindGroup,
      canvas
    );

    dispatchRenderPass(
      commandEncoder,
      asciiRenderPipeline,
      asciiBindGroup,
      context.getCurrentTexture(),
      "ascii filter pass"
    );

    device.queue.submit([commandEncoder.finish()]);

    window.requestAnimationFrame(render);
  }

  function createBindGroup(pipeline, resources, label) {
    if (DEBUG) {
      return device.createBindGroup({
        label,
        layout: pipeline.getBindGroupLayout(0),
        entries: resources.map((resource, index) => ({
          binding: index,
          resource,
        })),
      });
    }

    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: resources.map((resource, index) => ({
        binding: index,
        resource,
      })),
    });
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

  function dispatchRenderPass(
    commandEncoder,
    pipeline,
    bindGroup,
    texture,
    label
  ) {
    const passEncoder = commandEncoder.beginRenderPass(
      DEBUG
        ? {
            label,
            colorAttachments: [
              {
                view: texture.createView(),
                loadOp: "clear",
                storeOp: "store",
              },
            ],
          }
        : {
            colorAttachments: [
              {
                view: texture.createView(),
                loadOp: "clear",
                storeOp: "store",
              },
            ],
          }
    );
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.draw(6, 1, 0, 0);
    passEncoder.end();
  }

  function dispatchComputeShader(commandEncoder, pipeline, bindGroup, size) {
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(
      Math.ceil(size.width / 8),
      Math.ceil(size.height / 8)
    );
    passEncoder.end();
  }
}

function createMainCanvas() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.left = canvas.style.top = 0;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  return canvas;
}

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
  const fftDataArray = new Uint8Array(analyser.frequencyBinCount);

  if (DEBUG) {
    setupKeyboardListener(audioCtx);
  }

  const { device, format, presentationFormat, context } = await setupWebGPU();

  const vertexShaderCode = DEBUG
    ? await fetch("src/shader/vertex.wgsl").then((res) => res.text())
    : MINIFIED_VERTEX_SHADER;

  // Raymarch

  const raymarchPassTexture = createTexture(
    canvas,
    GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
    DEBUG ? "raymarch texture" : undefined
  );

  const raymarchUniformsBuffer = device.createBuffer({
    size: 5 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const raymarchShaderCode = DEBUG
    ? await fetch("src/shader/raymarch.wgsl").then((res) => res.text())
    : MINIFIED_RAYMARCH_SHADER;

  const raymarchPassPipeline = createRenderPipeline(
    raymarchShaderCode,
    format,
    "raymarch"
  );

  const raymarchPassBindGroup = createBindGroup(
    raymarchPassPipeline,
    [{ buffer: raymarchUniformsBuffer }],
    "uniforms bind group"
  );

  // Sobel Filter - Compute shader

  const maskTextureContext = document.createElement("canvas").getContext("2d");
  maskTextureContext.canvas.width = canvas.width;
  maskTextureContext.canvas.height = canvas.height;

  const maskTextureSource = maskTextureContext.canvas;

  const maskTexture = createTexture(
    maskTextureSource,
    GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
    DEBUG ? "mask texture" : undefined
  );

  const sobelTexture = createTexture(
    canvas,
    GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC,
    DEBUG ? "sobel texture" : undefined
  );

  const asciiUniformsBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const sobelShaderCode = DEBUG
    ? await fetch("src/shader/sobel.wgsl").then((res) => res.text())
    : MINIFIED_SOBEL_SHADER;

  const sobelComputePipeline = createComputePipeline(
    sobelShaderCode,
    "sobel filter compute"
  );

  const sobelComputeBindGroup = createBindGroup(
    sobelComputePipeline,
    [
      raymarchPassTexture.createView(),
      sobelTexture.createView(),
      maskTexture.createView(),
      { buffer: asciiUniformsBuffer },
    ],
    "sobel filter compute bind group"
  );

  // Ascii filter render pass

  const asciiPassTexture = createTexture(
    canvas,
    GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
    DEBUG ? "ascii pass texture" : undefined
  );

  const asciiShaderCode = DEBUG
    ? await fetch("src/shader/ascii.wgsl").then((res) => res.text())
    : MINIFIED_ASCII_SHADER;

  const asciiRenderPipeline = createRenderPipeline(
    asciiShaderCode,
    presentationFormat,
    "ascii"
  );

  const fill = " .:coePO0■";
  const edges = " |-/\\";

  const asciiTextureContext = createAsciiTexture(fill + edges);
  const asciiTextureSource = asciiTextureContext.canvas;

  const asciiTexture = createTexture(
    asciiTextureSource,
    GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
    DEBUG ? "ascii texture" : undefined
  );
  copySourceToTexture(device, asciiTexture, asciiTextureSource);

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

  // Bloom - brightness filter
  /*

  const bloomUniformsBuffer = device.createBuffer({
    size: 2 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const brightnessShaderCode = DEBUG
    ? await fetch("src/shader/brightness.wgsl").then((res) => res.text())
    : MINIFIED_BRIGHTNESS_SHADER;

  const brightnessPassPipeline = createRenderPipeline(
    brightnessShaderCode,
    format,
    "brightness filter pass"
  );

  const brightnessPassTexture = createTexture(
    canvas,
    GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
    DEBUG ? "brightness pass texture" : undefined
  );

  const brightnessPassBindGroup = createBindGroup(
    brightnessPassPipeline,
    [asciiPassTexture.createView(), { buffer: bloomUniformsBuffer }],
    "brightness pass bind group"
  );

  // Bloom - gaussian blur.
  // Done in one pass to save a bit of space instead of doing more efficient
  // separate horizontal and vertical passes

  const blurShaderCode = DEBUG
    ? await fetch("src/shader/blur.wgsl").then((res) => res.text())
    : MINIFIED_BLUR_SHADER;

  const blurPassPipeline = createRenderPipeline(blurShaderCode, format, "blur");

  const blurPassTexture = createTexture(
    canvas,
    GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
    DEBUG ? "horizontal blur pass texture" : undefined
  );

  const blurPassBindGroup = createBindGroup(
    blurPassPipeline,
    [brightnessPassTexture.createView()],
    "blur pass bind group"
  );

  // Bloom - combine filter

  const bloomShaderCode = DEBUG
    ? await fetch("src/shader/bloom.wgsl").then((res) => res.text())
    : MINIFIED_BLOOM_SHADER;

  const bloomPassPipeline = createRenderPipeline(
    bloomShaderCode,
    presentationFormat,
    "bloom"
  );

  const bloomPassBindGroup = createBindGroup(
    bloomPassPipeline,
    [
      asciiPassTexture.createView(),
      blurPassTexture.createView(),
      { buffer: bloomUniformsBuffer },
    ],
    "bloom pass bind group"
  );
  */

  // Start the render loop
  render();

  function update(dt) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (DEBUG) {
      fps.update(dt);
      updateCamera(dt);
    }

    updateMaskTexture(device, maskTexture, maskTextureContext, state.now);
    updateFFT();
    updateUniforms();
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

    // dispatchRenderPass(
    //   commandEncoder,
    //   brightnessPassPipeline,
    //   brightnessPassBindGroup,
    //   brightnessPassTexture,
    //   "brightness filter pass"
    // );

    // dispatchRenderPass(
    //   commandEncoder,
    //   blurPassPipeline,
    //   blurPassBindGroup,
    //   blurPassTexture,
    //   "gaussian blur filter pass"
    // );

    // dispatchRenderPass(
    //   commandEncoder,
    //   bloomPassPipeline,
    //   bloomPassBindGroup,
    //   context.getCurrentTexture(),
    //   "bloom filter pass"
    // );

    device.queue.submit([commandEncoder.finish()]);

    window.requestAnimationFrame(render);
  }

  async function setupWebGPU() {
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
    return { device, format, presentationFormat, context };
  }

  function createTexture(source, usage, label) {
    return device.createTexture(
      DEBUG
        ? {
            label,
            format,
            size: [source.width, source.height],
            usage,
          }
        : {
            format,
            size: [source.width, source.height],
            usage,
          }
    );
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

    const SPEED = 5.0;

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
        state.ascii.threshold,
        state.ascii.background,
        state.ascii.fill,
        state.ascii.edges,
      ])
    );
    // device.queue.writeBuffer(
    //   bloomUniformsBuffer,
    //   0,
    //   new Float32Array([
    //     state.bloom.threshold,
    //     state.bloom.burn,
    //     state.bloom.amplify,
    //     0,
    //     state.bloom.color.red,
    //     state.bloom.color.green,
    //     state.bloom.color.blue,
    //     0,
    //   ])
    // );
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

  function createRenderPipeline(shaderCode, format, label) {
    const vertexShaderModule = device.createShaderModule(
      DEBUG
        ? {
            label: `${label} vertex shader`,
            code: vertexShaderCode,
          }
        : {
            code: vertexShaderCode,
          }
    );

    const shaderModule = device.createShaderModule(
      DEBUG
        ? {
            label: `${label} shader`,
            code: shaderCode,
          }
        : {
            code: shaderCode,
          }
    );

    const pipeline = device.createRenderPipeline(
      DEBUG
        ? {
            label: `${label} render pipeline`,
            layout: "auto",
            vertex: {
              module: vertexShaderModule,
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
          }
        : {
            layout: "auto",
            vertex: {
              module: vertexShaderModule,
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
          }
    );

    return pipeline;
  }

  function createComputePipeline(shaderCode, label) {
    const shaderModule = device.createShaderModule(
      DEBUG
        ? {
            label: `${label} shader`,
            code: shaderCode,
          }
        : {
            code: shaderCode,
          }
    );

    const pipeline = device.createComputePipeline(
      DEBUG
        ? {
            label: `${label} render pipeline`,
            layout: "auto",
            compute: {
              module: shaderModule,
              entryPoint: "main",
            },
          }
        : {
            layout: "auto",
            compute: {
              module: shaderModule,
              entryPoint: "main",
            },
          }
    );

    return pipeline;
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

  function updateMaskTexture(device, maskTexture, ctx, time) {
    const { width, height } = ctx.canvas;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#000";

    ctx.fillRect(
      width / 4 + Math.sin(time / 1000) * 100,
      height / 4 + Math.cos(time / 1000) * 100,
      width / 2,
      height / 2
    );

    ctx.font = "20em bold serif";
    ctx.fillStyle = "#0f0";

    const messages = [
      "GREETINGS TO:",
      "LOREM",
      "IPSUM",
      "DOLOR",
      "SIT",
      "AMET",
    ];

    messages.forEach((message, i) => {
      ctx.fillText(
        message,
        100 + Math.sin((time + 1000 * i) / 5000) * 1000 - 500,
        height / 4 + 160 * (i - 1)
      );
    });

    copySourceToTexture(device, maskTexture, ctx.canvas);
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

  async function loadImageBitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return await createImageBitmap(blob, { colorSpaceConversion: "none" });
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

/**
 * @fileoverview Extern definitions for dat.GUI library and WebGPU usage.
 * @externs
 */

/** @const */
var dat = {};

/** @constructor */
dat.GUI = function () {};

/**
 * Adds a folder to the GUI.
 * @param {string} name The name of the folder.
 * @return {dat.GUI} The new folder.
 */
dat.GUI.prototype.addFolder = function (name) {};

/**
 * Adds a control for a property of an object.
 * @param {Object} object The object to be controlled.
 * @param {string} property The property to control.
 * @return {{listen: function(): void}} The controller for the added property.
 */
dat.GUI.prototype.add = function (object, property) {
  return {
    listen: function () {},
  };
};

/**
 * Adds a color controller to the GUI.
 * @param {Object} object The object containing the color property.
 * @param {string} property The color property to control.
 * @return {dat.GUI} The controller for the color property.
 */
dat.GUI.prototype.addColor = function (object, property) {};

// For sointu audio WebAssembly
const f = [];
const obj = {};
obj.exports = {};
obj.exports.m = {};
obj.exports.m.buffer;
obj.exports.s;
obj.exports.l;

// --- WebGPU support ---

/** @const */
const GPUTextureUsage = {
  COPY_SRC: 1 << 0,
  COPY_DST: 1 << 1,
  TEXTURE_BINDING: 1 << 2,
  STORAGE_BINDING: 1 << 3,
  RENDER_ATTACHMENT: 1 << 4,
};

/** @const */
const GPUBufferUsage = {
  MAP_READ: 1 << 0,
  MAP_WRITE: 1 << 1,
  COPY_SRC: 1 << 2,
  COPY_DST: 1 << 3,
  INDEX: 1 << 4,
  VERTEX: 1 << 5,
  UNIFORM: 1 << 6,
  STORAGE: 1 << 7,
  INDIRECT: 1 << 8,
  QUERY_RESOLVE: 1 << 9,
};

// --- GPUContextConfiguration ---

/** @record */
function GPUContextConfiguration() {}

/** @type {Object} */
GPUContextConfiguration.prototype.device;
/** @type {string} */
GPUContextConfiguration.prototype.format;
/** @type {string} */
GPUContextConfiguration.prototype.alphaMode;

// --- GPUQueue ---

/** @constructor */
var GPUQueue = function () {};

/**
 * Submits an array of command buffers to the queue.
 * @param {!Array<!GPUCommandBuffer>} commandBuffers An array of command buffers.
 */
GPUQueue.prototype.submit = function (commandBuffers) {};
/**
 * Writes data to a buffer.
 * @param {GPUBuffer} buffer The buffer to write to.
 * @param {number} bufferOffset The offset into the buffer at which to start writing.
 * @param {!Float32Array} data The data to write into the buffer.
 * @param {number=} dataOffset The offset into the data from which to start reading.
 * @param {number=} size The amount of data to write.
 */
GPUQueue.prototype.writeBuffer = function (
  buffer,
  bufferOffset,
  data,
  dataOffset,
  size
) {};
/**
 * Copies the external image to a texture.
 * @param {Object} source The external image source (e.g., HTMLVideoElement, HTMLCanvasElement, ImageBitmap).
 * @param {GPUImageCopyTextureTagged} destination The destination GPU texture.
 * @param {GPUExtent3DStrict} copySize The dimensions of the copy.
 */
GPUQueue.prototype.copyExternalImageToTexture = function (
  source,
  destination,
  copySize
) {};

// --- GPUImageCopyTextureTagged ---

var GPUImageCopyTextureTagged = function () {};

GPUImageCopyTextureTagged.prototype.texture;

// --- GPUCommandBuffer ---

/** @constructor */
var GPUCommandBuffer = function () {};

// --- GPUDevice ---

/** @constructor */
var GPUDevice = function () {};

/**
 * Returns the queue associated with the device.
 * @type {GPUQueue}
 */
GPUDevice.prototype.queue;
/** @type {function(!Object): !GPUTexture} */
GPUDevice.prototype.createTexture;
/** @type {function(!Object): !GPUBuffer} */
GPUDevice.prototype.createBuffer;
/** @type {function(!Object): !GPUSampler} */
GPUDevice.prototype.createSampler;
/** @type {function(!Object): !GPUQuerySet} */
GPUDevice.prototype.createQuerySet;
/**
 * Creates a bind group.
 * @param {GPUBindGroupDescriptor} bindGroupDescriptor The descriptor for the bind group.
 * @return {GPUBindGroup}
 */
GPUDevice.prototype.createBindGroup = function (bindGroupDescriptor) {};
/** @type {function(!Object): !GPUBindGroupLayout} */
GPUDevice.prototype.createBindGroupLayout;
/** @type {function(!Object): !GPUPipelineLayout} */
GPUDevice.prototype.createPipelineLayout;
/**
 * Creates a shader module.
 * @param {!Object} descriptor The descriptor for the shader module.
 * @return {GPUShaderModule}
 */
GPUDevice.prototype.createShaderModule = function (descriptor) {};
/**
 * Creates an asynchronous render pipeline.
 * @param {!GPURenderPipelineDescriptor} descriptor The descriptor for the render pipeline.
 * @return {GPURenderPipeline}
 */
GPUDevice.prototype.createRenderPipelineAsync = function (descriptor) {};
/**
 * Creates a render pipeline.
 * @param {!GPURenderPipelineDescriptor} descriptor The descriptor for the render pipeline.
 * @return {GPURenderPipeline}
 */
GPUDevice.prototype.createRenderPipeline = function (descriptor) {};
/**
 * Creates a compute pipeline.
 * @param {GPUComputePipelineDescriptor} descriptor The descriptor for the compute pipeline.
 * @return {GPUComputePipeline}
 */
GPUDevice.prototype.createComputePipeline = function (descriptor) {};
/**
 * Creates a command encoder.
 * @param {!Object=} descriptor Optional descriptor for the command encoder.
 * @return {GPUCommandEncoder}
 */
GPUDevice.prototype.createCommandEncoder = function (descriptor) {};

// --- GPUBindGroupDescriptor ---

/** @constructor */
var GPUBindGroupDescriptor = {};

/** @type {string} */
GPUBindGroupDescriptor.prototype.label;
/** @type {GPUBindGroupLayout} */
GPUBindGroupDescriptor.prototype.layout;
/** @type {!Array<!GPUBindGroupEntry>} */
GPUBindGroupDescriptor.prototype.entries;

// --- GPUBindGroupEntry ---

/** @constructor */
var GPUBindGroupEntry = function () {};

/** @type {number} */
GPUBindGroupEntry.prototype.binding;
/** @type {GPUResource} */
GPUBindGroupEntry.prototype.resource;

// --- GPUBufferBinding ---

/** @constructor */
var GPUBufferBinding = function () {};

/** @type {GPUBuffer} */
GPUBufferBinding.prototype.buffer;

// --- GPUComputePipelineDescriptor ---

/** @constructor */
var GPUComputePipelineDescriptor = function () {};

/** @type {string} */
GPUComputePipelineDescriptor.prototype.label;
/** @type {GPUPipelineLayout|string} */
GPUComputePipelineDescriptor.prototype.layout;
/** @type {GPUProgrammableStageDescriptor} */
GPUComputePipelineDescriptor.prototype.compute;

// --- GPURenderPipeline ---

/** @constructor */
var GPURenderPipeline = function () {};

/**
 * Retrieves a bind group layout.
 * @param {number} index The index of the bind group layout.
 * @return {GPUBindGroupLayout}
 */
GPURenderPipeline.prototype.getBindGroupLayout = function (index) {};

// --- GPURenderPipelineDescriptor ---

/** @constructor */
var GPURenderPipelineDescriptor = function () {};

/** @type {string} */
GPURenderPipelineDescriptor.prototype.label;
/** @type {GPUProgrammableStageDescriptor} */
GPURenderPipelineDescriptor.prototype.vertex;
/** @type {GPUProgrammableStageDescriptor} */
GPURenderPipelineDescriptor.prototype.fragment;
/** @type {GPUPipelineLayout} */
GPURenderPipelineDescriptor.prototype.layout;
/** @type {GPUPrimitiveState} */
GPURenderPipelineDescriptor.prototype.primitive;
/** @type {GPUDepthStencilState} */
GPURenderPipelineDescriptor.prototype.depthStencil;
/** @type {GPUMultisampleState} */
GPURenderPipelineDescriptor.prototype.multisample;
/** @type {GPURasterizationStateDescriptor} */
GPURenderPipelineDescriptor.prototype.rasterization;

// --- GPUProgrammableStageDescriptor ---

/** @constructor */
var GPUProgrammableStageDescriptor = function () {};

/** @type {GPUShaderModule} */
GPUProgrammableStageDescriptor.prototype.module;
/** @type {string} */
GPUProgrammableStageDescriptor.prototype.entryPoint;
/** @type {!Array<!GPURenderPipelineColorTargetState>} */
GPUProgrammableStageDescriptor.prototype.targets;

// --- GPURenderPipelineColorTargetState ---

/** @constructor */
var GPURenderPipelineColorTargetState = function () {};

/** @type {string} */
GPURenderPipelineColorTargetState.prototype.format;

// --- GPUPrimitiveState ---

/** @constructor */
var GPUPrimitiveState = function () {};

/** @type {string} */
GPUPrimitiveState.prototype.topology;

// --- GPUCommandEncoder ---

/** @constructor */
var GPUCommandEncoder = function () {};

/**
 * Begins a render pass.
 * @param {GPURenderPassDescriptor} renderPassDescriptor The descriptor for the render pass.
 * @return {GPURenderPassEncoder}
 */
GPUCommandEncoder.prototype.beginRenderPass = function (
  renderPassDescriptor
) {};
/**
 * Begins a compute pass.
 * @return {GPUComputePassEncoder}
 */
GPUCommandEncoder.prototype.beginComputePass = function () {};
/**
 * Finishes encoding the commands.
 * @param {!Object=} options Optional options for finishing the command buffer.
 * @return {GPUCommandBuffer}
 */
GPUCommandEncoder.prototype.finish = function (options) {};

// --- GPURenderPassDescriptor ---

/** @constructor */
var GPURenderPassDescriptor = function () {};

/** @type {string} */
GPURenderPassDescriptor.prototype.label;
/** @type {!Array<!GPURenderPassColorAttachmentDescriptor>} */
GPURenderPassDescriptor.prototype.colorAttachments;

// --- GPURenderPassColorAttachmentDescriptor ---

/** @constructor */
var GPURenderPassColorAttachmentDescriptor = function () {};

/** @type {GPUTextureView} */
GPURenderPassColorAttachmentDescriptor.prototype.view;
/** @type {!Array<number>} */
GPURenderPassColorAttachmentDescriptor.prototype.clearValue;
/** @type {string} */
GPURenderPassColorAttachmentDescriptor.prototype.loadOp;
/** @type {string} */
GPURenderPassColorAttachmentDescriptor.prototype.storeOp;

// ---f GPURenderPassEncoder ---

/** @constructor */
var GPURenderPassEncoder = function () {};

GPURenderPassEncoder.prototype.setPipeline = function (pipeline) {};
GPURenderPassEncoder.prototype.setBindGroup = function (id, bindGroup) {};
GPURenderPassEncoder.prototype.draw = function (a, b, c, d) {};
GPURenderPassEncoder.prototype.end = function () {};

// --- GPUComputePassEncoder ---

var GPUComputePassEncoder = function () {};

GPUComputePassEncoder.prototype.setPipeline = function (pipeline) {};
GPUComputePassEncoder.prototype.setBindGroup = function (id, bindGroup) {};
GPUComputePassEncoder.prototype.dispatchWorkgroups = function (a, b) {};
GPUComputePassEncoder.prototype.end = function () {};

// --- Miscallenous ---

/** @constructor */
var GPUBuffer = function () {};

/** @constructor */
var GPUBindGroup = function () {};

/** @typedef {GPUTextureView|GPUSampler|GPUBufferBinding} */
var GPUResource;

/** @constructor */
var GPUTextureView = function () {};

/** @constructor */
var GPUSampler = function () {};

/** @constructor */
var GPUComputePipeline = function () {};

/** @constructor */
var GPUBindGroupLayout = function () {};

/** @constructor */
var GPUPipelineLayout = function () {};

/** @constructor */
var GPUDepthStencilState = function () {};

/** @constructor */
var GPUMultisampleState = function () {};

/** @constructor */
var GPURasterizationStateDescriptor = function () {};

/** @constructor */
var GPUShaderModule = function () {};

/** @const */
var navigator = {};

/** @const */
navigator.gpu = {};

/**
 * @return {{
 *   requestDevice: function(): GPUDevice
 * }}
 */
navigator.gpu.requestAdapter = function () {
  return {
    /**
     * @return {GPUDevice}
     */
    requestDevice: function () {
      return new GPUDevice();
    },
  };
};

/** @return {string} */
navigator.gpu.getPreferredCanvasFormat = function () {};

/** @const */
var document = {};
document.createElement = () => ({
  getContext: (contextType) => ({
    configure: (/** GPUContextConfiguration */ configuration) => {},
    getCurrentTexture: () => ({
      createView: () => {},
    }),
  }),
  style: {
    position: "",
    left: 0,
    top: 0,
  },
  width: 0,
  height: 0,
});

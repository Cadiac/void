import replace from "@rollup/plugin-replace";

export default {
  input: "src/main.js",
  output: {
    file: "tmp/bundle.js",
    format: "es",
    strict: false,
  },
  plugins: [
    replace({
      DEBUG: process.env.DEBUG === "true",
      AUDIO: process.env.AUDIO === "true",
      TOUCH: process.env.TOUCH === "true",
      MINIFIED_VERTEX_SHADER: "`" + process.env.MINIFIED_VERTEX_SHADER + "`",
      MINIFIED_RAYMARCH_SHADER:
        "`" + process.env.MINIFIED_RAYMARCH_SHADER + "`",
      MINIFIED_SOBEL_SHADER: "`" + process.env.MINIFIED_SOBEL_SHADER + "`",
      MINIFIED_ASCII_SHADER: "`" + process.env.MINIFIED_ASCII_SHADER + "`",
      MINIFIED_BRIGHTNESS_SHADER:
        "`" + process.env.MINIFIED_BRIGHTNESS_SHADER + "`",
      MINIFIED_BLUR_SHADER: "`" + process.env.MINIFIED_BLUR_SHADER + "`",
      MINIFIED_BLOOM_SHADER: "`" + process.env.MINIFIED_BLOOM_SHADER + "`",

      // Texture usage flags
      "GPUTextureUsage.COPY_SRC": 1 << 0,
      "GPUTextureUsage.COPY_DST": 1 << 1,
      "GPUTextureUsage.TEXTURE_BINDING": 1 << 2,
      "GPUTextureUsage.STORAGE_BINDING": 1 << 3,
      "GPUTextureUsage.RENDER_ATTACHMENT": 1 << 4,

      // Buffer usage flags
      "GPUBufferUsage.MAP_READ": 1 << 0,
      "GPUBufferUsage.MAP_WRITE": 1 << 1,
      "GPUBufferUsage.COPY_SRC": 1 << 2,
      "GPUBufferUsage.COPY_DST": 1 << 3,
      "GPUBufferUsage.INDEX": 1 << 4,
      "GPUBufferUsage.VERTEX": 1 << 5,
      "GPUBufferUsage.UNIFORM": 1 << 6,
      "GPUBufferUsage.STORAGE": 1 << 7,
      "GPUBufferUsage.INDIRECT": 1 << 8,
      "GPUBufferUsage.QUERY_RESOLVE": 1 << 9,

      preventAssignment: true,
    }),
  ],
};

import replace from "@rollup/plugin-replace";

export default {
  input: "src/index.js",
  output: {
    file: "tmp/bundle.js",
    format: "es",
    strict: false,
  },
  plugins: [
    replace({
      // Feature flags. This plugin replacing these with booleans causes Google Closure Compiler to see
      // code like `if (true === false)` and eliminates those branches completely from the final build.
      DEBUG: process.env.DEBUG === "true",
      AUDIO: process.env.AUDIO === "true",
      TOUCH: process.env.TOUCH === "true",
      FULLSCREEN: process.env.FULLSCREEN === "true",

      // Minified wgsl shaders produced by wgslminify
      MINIFIED_VERTEX_SHADER: "`" + process.env.MINIFIED_VERTEX_SHADER + "`",
      MINIFIED_RAYMARCH_SHADER:
        "`" + process.env.MINIFIED_RAYMARCH_SHADER + "`",
      MINIFIED_SOBEL_SHADER: "`" + process.env.MINIFIED_SOBEL_SHADER + "`",
      MINIFIED_ASCII_SHADER: "`" + process.env.MINIFIED_ASCII_SHADER + "`",

      // Texture usage flags. Numeric values help Google Closure Compiler
      // to minify these further, but one day in future these might break if
      // the values these enums map to were to somehow change as the standard matures.
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

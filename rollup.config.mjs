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
      MINIFIED_VERTEX_SHADER: "`" + process.env.MINIFIED_VERTEX_SHADER + "`",
      MINIFIED_RAYMARCH_SHADER:
        "`" + process.env.MINIFIED_RAYMARCH_SHADER + "`",
      MINIFIED_SOBEL_SHADER: "`" + process.env.MINIFIED_SOBEL_SHADER + "`",
      MINIFIED_ASCII_SHADER: "`" + process.env.MINIFIED_ASCII_SHADER + "`",
      MINIFIED_BRIGHTNESS_SHADER:
        "`" + process.env.MINIFIED_BRIGHTNESS_SHADER + "`",
      MINIFIED_BLUR_SHADER: "`" + process.env.MINIFIED_BLUR_SHADER + "`",
      MINIFIED_BLOOM_SHADER: "`" + process.env.MINIFIED_BLOOM_SHADER + "`",
      preventAssignment: true,
    }),
  ],
};

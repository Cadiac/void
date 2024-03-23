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
      MINIFIED_SHADER: "`" + process.env.MINIFIED_SHADER + "`",
      preventAssignment: true,
    }),
  ],
};

import fps from "./fps.js";

function setup(state) {
  const gui = new dat.GUI();

  const generalFolder = gui.addFolder("General");
  generalFolder.add(state, "halt").listen();
  generalFolder.add(state, "now", 0, 100000, 1).listen();

  const beatFolder = gui.addFolder("Audio");
  beatFolder.add(state.audio, "beat", 0.0, 255, 1).listen();
  beatFolder.add(state.audio, "offset", 0, 127, 1).listen();

  fps.setup();
}

export default {
  setup,
};

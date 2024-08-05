import fps from "./fps.js";

function setup(state) {
  const gui = new dat.GUI();

  const generalFolder = gui.addFolder("General");
  generalFolder.add(state, "halt").listen();
  generalFolder.add(state, "now", 0, 100000, 1).listen();

  const beatFolder = gui.addFolder("Audio");
  beatFolder.add(state.audio, "beat", 0.0, 255, 1).listen();
  beatFolder.add(state.audio, "offset", 0, 127, 1).listen();

  const cameraFolder = gui.addFolder("Camera");
  cameraFolder.add(state.camera.position, "x", -50, 50, 0.1).listen();
  cameraFolder.add(state.camera.position, "y", -50, 50, 0.1).listen();
  cameraFolder.add(state.camera.position, "z", -50, 50, 0.1).listen();

  cameraFolder.add(state.camera.target, "x", -50, 50, 0.1).listen();
  cameraFolder.add(state.camera.target, "y", -50, 50, 0.1).listen();
  cameraFolder.add(state.camera.target, "z", -50, 50, 0.1).listen();

  const asciiFolder = gui.addFolder("Ascii");
  asciiFolder.add(state.ascii, "background", 0, 1, 0.01).listen();
  asciiFolder.add(state.ascii, "edges", 0, 1, 0.01).listen();

  fps.setup();
}

export default {
  setup,
};

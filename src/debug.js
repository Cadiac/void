import fps from "./fps.js";

function setup(state) {
  const gui = new dat.GUI();

  const generalFolder = gui.addFolder("General");
  generalFolder.add(state, "halt").listen();
  generalFolder.add(state, "now", 0, 100000, 1).listen();

  const cameraFolder = gui.addFolder("Camera");
  const cameraPositionFolder = cameraFolder.addFolder("Position");
  cameraPositionFolder.add(state.camera.pos, "x", -100, 100, 0.01).listen();
  cameraPositionFolder.add(state.camera.pos, "y", 0.5, 100, 0.01).listen();
  cameraPositionFolder.add(state.camera.pos, "z", -100, 100, 0.01).listen();
  const cameraTargetFolder = cameraFolder.addFolder("Target");
  cameraTargetFolder.add(state.camera.target, "x", -100, 100, 0.01).listen();
  cameraTargetFolder.add(state.camera.target, "y", -100, 100, 0.01).listen();
  cameraTargetFolder.add(state.camera.target, "z", -100, 100, 0.01).listen();

  const skyFolder = gui.addFolder("Sky");
  skyFolder.addColor(state.sky, "color");

  const fogFolder = skyFolder.addFolder("Fog");
  fogFolder.add(state.fog, "intensity", 0, 0.2, 0.001);
  fogFolder.addColor(state.fog, "color");

  const sunFolder = skyFolder.addFolder("Sun");
  sunFolder.add(state.sun, "x", -100, 100, 0.01).listen();
  sunFolder.add(state.sun, "y", -100, 100, 0.01).listen();
  sunFolder.add(state.sun, "z", -100, 100, 0.01).listen();

  const beatFolder = gui.addFolder("Audio");
  beatFolder.add(state.audio, "beat", 0.0, 255, 1).listen();
  beatFolder.add(state.audio, "offset", 0, 127, 1).listen();

  fps.setup();
}

export default {
  setup,
};

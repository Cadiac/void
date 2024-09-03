let fpsCounter;

function setup() {
  // FPS counter
  const element = document.createElement("span");
  element.style.position = "fixed";
  element.style.zIndex = 1;
  element.style.color = "white";
  element.style.fontFamily = "monospace";
  element.style.top = 0;
  element.style.left = 0;
  element.style.padding = "1em";

  document.body.appendChild(element);

  fpsCounter = {
    frames: [],
    cursor: 0,
    numFrames: 0,
    maxFrames: 20,
    total: 0,
    element,
  };
}

function update(dt) {
  const fps = 1000 / dt;

  fpsCounter.total += fps - (fpsCounter.frames[fpsCounter.cursor] || 0);
  fpsCounter.frames[fpsCounter.cursor++] = fps;
  fpsCounter.numFrames = Math.max(fpsCounter.numFrames, fpsCounter.cursor);
  fpsCounter.cursor %= fpsCounter.maxFrames;

  const averageFPS = fpsCounter.total / fpsCounter.numFrames;

  fpsCounter.element.textContent = `FPS: ${averageFPS.toFixed(1)}`;
}

export default {
  setup,
  update,
};

import { run } from "./demo.js";
import { loadSointuWasm } from "./audio.js";

const canvas = document.createElement("canvas");
canvas.style.position = "fixed";
canvas.style.left = canvas.style.top = 0;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const AUDIO = true;

function init(_event) {
  run(canvas);
}

if (AUDIO) {
  // Mobile support needs a touch handler.
  // Audio can't run without an user initiated event.
  loadSointuWasm(canvas, init);
} else {
  window.onload = init;
}

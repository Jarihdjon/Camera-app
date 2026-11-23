import * as THREE from "three";

/** A canvas texture with an emoji and/or a label, for signs above pads and gates. */
export function labelTexture(emoji: string, text = "", bg = "rgba(10,14,40,0.75)", fg = "#ffffff"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(8, 8, 496, 240, 60);
  g.fill();
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (text) {
    g.font = "120px system-ui, Apple Color Emoji, sans-serif";
    g.fillText(emoji, 256, 95);
    g.fillStyle = fg;
    g.font = "bold 54px Fredoka, Nunito, system-ui, sans-serif";
    g.fillText(text, 256, 200, 470);
  } else {
    g.font = "170px system-ui, Apple Color Emoji, sans-serif";
    g.fillText(emoji, 256, 135);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Vertical sky gradient for the scene background. */
export function skyTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

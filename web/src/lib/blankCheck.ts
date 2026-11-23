/**
 * The blank-page check. Runs entirely in the browser; the photo is never sent to any AI.
 * Looks for enough dark "ink-like" pixels on a light page, and rejects photos that are
 * almost all dark (lens covered, lights off).
 */
export interface BlankCheckResult {
  ok: boolean;
  reason?: "too-dark" | "looks-blank";
  inkRatio: number;
  meanBrightness: number;
}

export function analysePixels(rgba: Uint8ClampedArray): BlankCheckResult {
  let sum = 0;
  const n = rgba.length / 4;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
    lum[i] = l;
    sum += l;
  }
  const mean = sum / n;
  if (mean < 60) return { ok: false, reason: "too-dark", inkRatio: 0, meanBrightness: mean };
  // Ink is pixels clearly darker than the page around them.
  const threshold = mean * 0.6;
  let ink = 0;
  for (let i = 0; i < n; i++) if (lum[i]! < threshold) ink++;
  const inkRatio = ink / n;
  // Printed lines alone give a little ink; handwriting adds noticeably more. Tune in week one.
  return inkRatio < 0.015
    ? { ok: false, reason: "looks-blank", inkRatio, meanBrightness: mean }
    : { ok: true, inkRatio, meanBrightness: mean };
}

export async function checkPhoto(file: Blob): Promise<BlankCheckResult> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return analysePixels(ctx.getImageData(0, 0, w, h).data);
}

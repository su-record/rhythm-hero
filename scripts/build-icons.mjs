/* Render the Rhythm Hero brand mark into PWA icons without any image dependency.
   The mark is the Active 4 grid: four rounded squares, the second one rotated. */
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public", "assets", "icons");
const INK = "#111111";
const MARK_COLORS = ["#ff5d52", "#20d68a", "#5b70ff", "#ffd43b"];
const SAMPLES = 4;
const icons = [
  { file: "icon-192.png", size: 192, cornerRatio: 0.22, spanRatio: 0.68 },
  { file: "icon-512.png", size: 512, cornerRatio: 0.22, spanRatio: 0.68 },
  { file: "icon-maskable-512.png", size: 512, cornerRatio: 0, spanRatio: 0.52 },
  { file: "apple-touch-icon-180.png", size: 180, cornerRatio: 0, spanRatio: 0.68 },
];

function parseColor(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function insideRoundedSquare(x, y, shape) {
  const offsetX = x - shape.centerX;
  const offsetY = y - shape.centerY;
  const angle = -shape.rotation;
  const localX = offsetX * Math.cos(angle) - offsetY * Math.sin(angle);
  const localY = offsetX * Math.sin(angle) + offsetY * Math.cos(angle);
  const half = shape.size / 2;
  const cornerX = Math.abs(localX) - (half - shape.radius);
  const cornerY = Math.abs(localY) - (half - shape.radius);
  if (Math.abs(localX) > half || Math.abs(localY) > half) return false;
  if (cornerX <= 0 || cornerY <= 0) return true;
  return cornerX * cornerX + cornerY * cornerY <= shape.radius * shape.radius;
}

function buildShapes({ size, cornerRatio, spanRatio }) {
  const span = size * spanRatio;
  const gap = span * 0.08;
  const cell = (span - gap) / 2;
  const origin = (size - span) / 2 + cell / 2;
  const marks = MARK_COLORS.map((color, index) => ({
    color: parseColor(color),
    centerX: origin + (index % 2) * (cell + gap),
    centerY: origin + Math.floor(index / 2) * (cell + gap),
    size: index === 1 ? cell * 0.88 : cell,
    radius: cell * 0.26,
    rotation: index === 1 ? Math.PI / 4 : 0,
  }));
  const background = { color: parseColor(INK), centerX: size / 2, centerY: size / 2, size, radius: size * cornerRatio, rotation: 0 };
  return [background, ...marks];
}

function sampleColor(x, y, shapes) {
  for (let index = shapes.length - 1; index >= 0; index -= 1) {
    if (insideRoundedSquare(x, y, shapes[index])) return shapes[index].color;
  }
  return null;
}

function paint(size, shapes) {
  const pixels = new Uint8Array(size * size * 4);
  const step = 1 / SAMPLES;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const totals = [0, 0, 0, 0];
      for (let subY = 0; subY < SAMPLES; subY += 1) {
        for (let subX = 0; subX < SAMPLES; subX += 1) {
          const color = sampleColor(column + (subX + 0.5) * step, row + (subY + 0.5) * step, shapes);
          if (!color) continue;
          totals[0] += color[0]; totals[1] += color[1]; totals[2] += color[2]; totals[3] += 1;
        }
      }
      const offset = (row * size + column) * 4;
      if (!totals[3]) continue;
      pixels[offset] = Math.round(totals[0] / totals[3]);
      pixels[offset + 1] = Math.round(totals[1] / totals[3]);
      pixels[offset + 2] = Math.round(totals[2] / totals[3]);
      pixels[offset + 3] = Math.round((totals[3] / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return pixels;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let row = 0; row < size; row += 1) raw.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(output, { recursive: true });
for (const icon of icons) {
  await writeFile(resolve(output, icon.file), encodePng(icon.size, paint(icon.size, buildShapes(icon))));
}
console.log(`Rendered ${icons.length} Rhythm Hero icons into public/assets/icons.`);

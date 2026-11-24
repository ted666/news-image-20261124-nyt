// news-image-20261124-nyt: one front page, one program.
// The program finds entry.png next to this file, checks it against the
// competition's image gate (a PNG, at most 1 MiB, at most 1024 by 1024),
// then copies it to the output folder and verifies the copy matches.

import * as fs from "node:fs";
import * as path from "node:path";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 1024 * 1024;
const MAX_SIDE = 1024;

function fail(message: string): never {
  throw new Error(message);
}

function readEntry(): Buffer {
  const here = path.join(import.meta.dirname, "entry.png");
  if (!fs.existsSync(here)) fail(`entry.png is missing beside main.ts (${here})`);
  return fs.readFileSync(here);
}

function checkEntry(image: Buffer): { width: number; height: number } {
  if (image.length < 8 || !image.subarray(0, 8).equals(PNG_MAGIC)) {
    fail("entry.png is not a PNG file");
  }
  if (image.length > MAX_BYTES) {
    fail(`entry.png is ${image.length} bytes, over the 1 MiB limit`);
  }
  if (image.length < 24) fail("entry.png is too short to hold an IHDR chunk");
  if (image.readUInt32BE(8) !== 13 || image.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail("entry.png has no IHDR chunk");
  }
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  if (width === 0 || height === 0) fail("entry.png declares a zero side");
  if (width > MAX_SIDE || height > MAX_SIDE) {
    fail(`entry.png is ${width}x${height}, over the 1024x1024 limit`);
  }
  // A truncated PNG still opens in some viewers; require the IEND trailer.
  const trailer = image.subarray(image.length - 12);
  if (trailer.readUInt32BE(0) !== 0 || trailer.subarray(4, 8).toString("ascii") !== "IEND") {
    fail("entry.png has no IEND trailer chunk");
  }
  return { width, height };
}

function writeOutput(image: Buffer): string {
  const dir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "entry.png");
  fs.writeFileSync(target, image);
  if (!fs.readFileSync(target).equals(image)) {
    fail("the copy in the output folder differs from entry.png");
  }
  return target;
}

try {
  const image = readEntry();
  const size = checkEntry(image);
  const target = writeOutput(image);
  console.log(`wrote ${target} (${image.length} bytes, ${size.width}x${size.height})`);
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

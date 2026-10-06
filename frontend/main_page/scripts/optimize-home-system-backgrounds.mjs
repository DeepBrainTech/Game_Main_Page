import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const backgroundsDirectory = join(projectDirectory, "public", "home-system", "backgrounds");
const thumbnailsDirectory = join(backgroundsDirectory, "thumbnails");

await mkdir(thumbnailsDirectory, { recursive: true });
const originals = (await readdir(backgroundsDirectory)).filter((name) => name.endsWith(".png")).sort();
let originalBytes = 0;
let sceneBytes = 0;
let thumbnailBytes = 0;

for (const name of originals) {
  const input = join(backgroundsDirectory, name);
  const outputName = name.replace(/\.png$/, ".webp");
  const original = await stat(input);
  const scene = await sharp(input)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 100, effort: 6 })
    .toFile(join(backgroundsDirectory, outputName));
  const thumbnail = await sharp(input)
    .resize({ width: 320, withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 100, effort: 6 })
    .toFile(join(thumbnailsDirectory, outputName));

  originalBytes += original.size;
  sceneBytes += scene.size;
  thumbnailBytes += thumbnail.size;
  console.log(`${name}: scene ${scene.size} bytes, thumbnail ${thumbnail.size} bytes`);
}

console.log(JSON.stringify({ images: originals.length, originalBytes, sceneBytes, thumbnailBytes }));

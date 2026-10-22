// Supplied art -> web assets. crown.cjs makes the bare plate + crown cutout; this makes the
// regalia placards (crops of the untouched banner), the favicon and the og card.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SRC = "source-assets";
const OUT = "public/assets";
mkdirSync(OUT, { recursive: true });
execFileSync("node", ["scripts/crown.cjs"], { stdio: "inherit" });

const banner = `${SRC}/banner.png`; // 1500x500, two shiba pups on a warm seamless

const crops = {
  "regalia-crown": { left: 896, top: 92, width: 156, height: 110 },
  "regalia-sceptre": { left: 796, top: 172, width: 250, height: 328 },
  "regalia-hat": { left: 1012, top: 0, width: 220, height: 186 },
};
for (const [name, r] of Object.entries(crops)) {
  await sharp(banner)
    .extract(r)
    .resize({ width: r.width * 2, kernel: "lanczos3" })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(`${OUT}/${name}.jpg`);
}

await sharp(`${SRC}/avatar.png`).resize(64, 64).png().toFile(`${OUT}/favicon.png`);
await sharp(`${SRC}/avatar.png`).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`);
console.log("assets done");

// og: a real browser renders the card so the blackletter is the real webfont
execFileSync("node", ["scripts/og.mjs"], { stdio: "inherit" });

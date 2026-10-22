import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
mkdirSync("qa-shots", { recursive: true });
const PORT = 4431;
const srv = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { shell: true });
await new Promise((r) => setTimeout(r, 3500));
const b = await chromium.launch();
for (const [name, vp] of [["d", { width: 1440, height: 900 }], ["m", { width: 390, height: 844 }]]) {
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: name === "m" ? 2 : 1 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `qa-shots/${name}-1-hero.png` });
  const box = await p.locator("#hold").boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (const hold of [2600, 700]) {
    await p.mouse.down();
    await p.waitForTimeout(hold);
    if (hold > 1000) await p.screenshot({ path: `qa-shots/${name}-2-reign.png` });
    await p.mouse.up();
    await p.waitForTimeout(250);
    if (hold > 1000) await p.screenshot({ path: `qa-shots/${name}-3-falling.png` });
    await p.waitForTimeout(2200);
    if (hold > 1000) await p.screenshot({ path: `qa-shots/${name}-4-down.png` });
  }
  await p.mouse.down(); await p.waitForTimeout(6000); await p.mouse.up(); await p.waitForTimeout(2500);
  await p.screenshot({ path: `qa-shots/${name}-5-third.png` });
  console.log(name, "king:", await p.textContent("#king"), "| herald:", await p.textContent("#herald"));
  for (const sel of [".service", ".roll", ".regalia", ".proclaim"]) {
    await p.locator(sel).scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.screenshot({ path: `qa-shots/${name}-6${sel}.png` });
  }
  console.log(name, "overflow:", await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), "errors:", errs);
}
await b.close();
srv.kill();
process.exit(0);

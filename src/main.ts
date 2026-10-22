import "./style.css";
import { World, Vec2, PolygonShape, CircleShape, EdgeShape, type Body } from "planck";
import { CONFIG } from "../config.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const plate = $<HTMLDivElement>("plate");
const world = $<HTMLDivElement>("world");
const crownEl = $<HTMLImageElement>("crown");
const grip = $<HTMLSpanElement>("grip");
const kingEl = $<HTMLElement>("king");
const clockEl = $<HTMLSpanElement>("clock");
const epiEl = $<HTMLSpanElement>("epi");
const readout = kingEl.parentElement!;
const holdBtn = $<HTMLButtonElement>("hold");
const holdFill = $<HTMLSpanElement>("holdFill");
const herald = $<HTMLParagraphElement>("herald");
const sndBtn = $<HTMLButtonElement>("snd");
const toast = $<HTMLDivElement>("toast");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- the roll, kept on this device ----------
type King = { n: number; ms: number; cause: string; at: number };
type Store = { kings: King[]; falls: number; sound: boolean };
const KEY = "pumton:v1";
function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && Array.isArray(s.kings)) return { kings: s.kings, falls: s.falls || 0, sound: s.sound !== false };
  } catch {}
  return { kings: [], falls: 0, sound: true };
}
const store = load();
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {}
};

function roman(n: number): string {
  const t: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of t) while (n >= v) { out += s; n -= v; }
  return out;
}
const EPITHETS: [number, string][] = [
  [600, "the Blink"],
  [2000, "the Brief"],
  [5000, "the Hesitant"],
  [12000, "the Fair"],
  [30000, "the Steady"],
  [60000, "the Patient"],
  [180000, "the Great"],
  [Infinity, "the Unmoving"],
];
function epithet(ms: number) {
  let lo = 0;
  for (const [hi, name] of EPITHETS) {
    if (ms < hi) return { name, progress: hi === Infinity ? 1 : (ms - lo) / (hi - lo) };
    lo = hi;
  }
  return { name: "the Unmoving", progress: 1 };
}
const fmt = (ms: number) => {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
};
const secs = (ms: number) => (ms < 60000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`);

// ---------- plate geometry (banner pixels) ----------
const HOME = { x: 974, y: 146, a: 0 };
const PAW = { x: 1000, y: 98 };
let scale = 1;
let crop = { x: 780, y: 0, w: 540, h: 500 };
function layout() {
  const cs = getComputedStyle(plate);
  crop = {
    x: +cs.getPropertyValue("--cx") || 0,
    y: +cs.getPropertyValue("--cy") || 0,
    w: +cs.getPropertyValue("--cw") || 1500,
    h: +cs.getPropertyValue("--ch") || 500,
  };
  scale = plate.clientWidth / crop.w;
  world.style.transform = `scale(${scale}) translate(${-crop.x}px, ${-crop.y}px)`;
  grip.style.left = `${(PAW.x - crop.x) * scale}px`;
  grip.style.top = `${(PAW.y - crop.y) * scale - 8}px`;
}
const pose = { ...HOME };
function draw() {
  crownEl.style.transform = `translate(${pose.x - 56}px, ${pose.y - 38}px) rotate(${pose.a}rad)`;
}

// ---------- physics: the crown, the head, two dogs, a floor ----------
const S = 50; // banner px per metre
const pw = new World({ gravity: Vec2(0, 1900 / S) });
const v = (x: number, y: number) => Vec2(x / S, y / S);
const ground = pw.createBody();
ground.createFixture(new CircleShape(v(958, 262), 80 / S), { friction: 0.08 });
ground.createFixture(new PolygonShape([v(890, 268), v(1028, 268), v(1078, 486), v(818, 486)]), { friction: 0.6 });
ground.createFixture(new PolygonShape([v(1032, 150), v(1170, 70), v(1300, 486), v(1082, 486)]), { friction: 0.6 });
ground.createFixture(new EdgeShape(v(-2000, 486), v(3500, 486)), { friction: 0.7 });
let walls: Body | null = null;
let crownBody: Body | null = null;
let lastClink = 0;
pw.on("begin-contact", () => {
  if (!crownBody) return;
  const sp = crownBody.getLinearVelocity().length() * S;
  const now = performance.now();
  if (sp > 120 && now - lastClink > 70) {
    lastClink = now;
    clink(Math.min(1, sp / 1400));
  }
});

function dropCrown(dir: number) {
  if (walls) pw.destroyBody(walls);
  walls = pw.createBody();
  // desktop: the floor in front of him ends where the order of service begins
  const left = crop.w > 900 ? Math.max(crop.x, 690) : crop.x + 10;
  walls.createFixture(new EdgeShape(v(left, -400), v(left, 486)));
  walls.createFixture(new EdgeShape(v(crop.x + crop.w - 10, -400), v(crop.x + crop.w - 10, 486)));
  crownBody = pw.createBody({ type: "dynamic", position: v(pose.x, pose.y), angle: pose.a, bullet: true });
  crownBody.createFixture(
    new PolygonShape([v(-54, -28), v(54, -28), v(54, 16), v(42, 36), v(-44, 28), v(-54, 16)]),
    { density: 1, friction: 0.35, restitution: 0.38 },
  );
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  crownBody.setLinearVelocity(v(dir * r(120, 260), -r(140, 260)));
  crownBody.setAngularVelocity(dir * r(2.5, 5.5));
}

// ---------- the reign ----------
type Phase = "idle" | "lifting" | "reign" | "falling" | "down";
let phase: Phase = "idle";
let pressed = false;
let reignStart = 0;
let fallStart = 0;
let lift: { from: typeof pose; t0: number } | null = null;
let heraldTimer = 0;

function kingName(n: number) {
  const f = document.createDocumentFragment();
  const rn = document.createElement("span");
  rn.className = "rn";
  rn.textContent = roman(n);
  f.append("Pumton ", rn);
  return f;
}
let shownKing = 0;
function setKing(n: number | null, ms = 0) {
  readout.classList.toggle("idle", n === null);
  kingEl.classList.toggle("none", n === null);
  if (n === null) {
    shownKing = 0;
    kingEl.textContent = "nobody";
    epiEl.textContent = store.kings.length ? "the crown is on the floor" : "the throne is empty";
    clockEl.textContent = "00:00.00";
    return;
  }
  if (shownKing !== n) {
    shownKing = n;
    kingEl.textContent = "";
    kingEl.append(kingName(n));
  }
  const ep = epithet(ms).name;
  if (epiEl.textContent !== ep) epiEl.textContent = ep;
}

const holdT = holdBtn.querySelector(".hold-t")!;
function holdLabel() {
  holdT.textContent = pressed ? "keep holding" : store.kings.length ? `crown Pumton ${roman(store.kings.length + 1)}` : "hold the crown on";
}

function press() {
  if (pressed) return;
  pressed = true;
  audio();
  plate.classList.add("held");
  holdBtn.classList.add("on");
  holdLabel();
  herald.classList.remove("show");
  clearTimeout(heraldTimer);
  if (phase === "idle") beginReign();
  else if (phase === "falling" || phase === "down") {
    lift = { from: { ...pose }, t0: performance.now() };
    if (crownBody) { pw.destroyBody(crownBody); crownBody = null; }
    phase = "lifting";
  }
}

function beginReign() {
  phase = "reign";
  reignStart = performance.now();
  setKing(store.kings.length + 1, 0);
  fanfare();
}

function release(cause: string) {
  if (!pressed) return;
  pressed = false;
  plate.classList.remove("held");
  holdBtn.classList.remove("on");
  holdFill.style.transform = "scaleX(0)";
  holdLabel();
  if (phase === "lifting") {
    // let go before he was even crowned: no king, the crown just drops again
    phase = "falling";
    fallStart = performance.now();
    dropCrown(-1);
    return;
  }
  if (phase !== "reign") return;
  const ms = performance.now() - reignStart;
  const k: King = { n: store.kings.length + 1, ms, cause, at: Date.now() };
  store.kings.push(k);
  store.falls++;
  save();
  holdLabel();
  renderRoll(true);
  setKing(null);
  clockEl.textContent = fmt(ms);
  epiEl.textContent = `last: ${epithet(ms).name}`;
  phase = "falling";
  fallStart = performance.now();
  if (reduced) {
    pose.x = HOME.x - 150;
    pose.y = 450;
    pose.a = -0.4;
    phase = "down";
  } else dropCrown(k.n % 3 === 0 ? 1 : -1);
  heraldTimer = window.setTimeout(() => {
    const ep = epithet(ms).name;
    herald.innerHTML = "";
    const b = document.createElement("b");
    b.append(kingName(k.n), `, ${ep}`);
    herald.append("Here ends the reign of ", b, `. ${secs(ms)}. ${cause}. `);
    const tail = document.createElement("span");
    tail.textContent = `The crown is on the floor. Pumton ${roman(k.n + 1)} is waiting.`;
    herald.append(tail);
    herald.classList.add("show");
  }, 900);
}

// ---------- input ----------
plate.addEventListener("pointerdown", (e) => { e.preventDefault(); press(); });
holdBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); press(); });
for (const el of [plate, holdBtn]) {
  el.addEventListener("pointerleave", () => release("the hand slipped"));
  el.addEventListener("pointercancel", () => release("the hand slipped"));
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}
window.addEventListener("pointerup", () => release("let go"));
window.addEventListener("blur", () => release("looked away"));
document.addEventListener("visibilitychange", () => document.hidden && release("looked away"));
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && /INPUT|TEXTAREA/.test(t.tagName);
window.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || isTyping(e.target)) return;
  e.preventDefault();
  if (!e.repeat) press();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") release("let go");
});
holdBtn.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.repeat) { e.preventDefault(); press(); }
});
holdBtn.addEventListener("keyup", (e) => {
  if (e.key === "Enter") release("let go");
});

// ---------- loop ----------
let last = performance.now();
let acc = 0;
function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (phase === "reign") {
    const ms = now - reignStart;
    const t = ms / 1000;
    clockEl.textContent = fmt(ms);
    const ep = epithet(ms);
    setKing(store.kings.length + 1, ms);
    holdFill.style.transform = `scaleX(${ep.progress})`;
    // the kingmaker's paw gets tired
    const amp = reduced ? 0 : Math.min(0.11, 0.008 + t * 0.0022);
    pose.a = Math.sin(t * 6.3) * amp + Math.sin(t * 2.1) * amp * 0.7;
    pose.x = HOME.x + Math.sin(t * 3.7) * amp * 14;
    pose.y = HOME.y;
  } else if (phase === "lifting" && lift) {
    const k = Math.min(1, (now - lift.t0) / 420);
    const e = 1 - Math.pow(1 - k, 3);
    pose.x = lift.from.x + (HOME.x - lift.from.x) * e;
    pose.y = lift.from.y + (HOME.y - lift.from.y) * e - Math.sin(k * Math.PI) * 70;
    const turns = Math.round(lift.from.a / (Math.PI * 2)) * Math.PI * 2;
    pose.a = lift.from.a + (turns - lift.from.a) * e;
    if (k >= 1) {
      lift = null;
      Object.assign(pose, HOME);
      if (pressed) beginReign();
      else phase = "idle";
    }
  } else if (phase === "falling" && crownBody) {
    acc += dt;
    while (acc >= 1 / 120) {
      pw.step(1 / 120, 8, 3);
      acc -= 1 / 120;
    }
    const p = crownBody.getPosition();
    pose.x = p.x * S;
    pose.y = p.y * S;
    pose.a = crownBody.getAngle();
    const still = crownBody.getLinearVelocity().length() * S < 4 && Math.abs(crownBody.getAngularVelocity()) < 0.05;
    if (still && pose.y < 400 && now - fallStart < 8000) {
      // it came to rest on him with nobody holding it. that is not how this works
      crownBody.setLinearVelocity(v(-220, -160));
      crownBody.setAngularVelocity(-3);
    } else if ((still && now - fallStart > 800) || now - fallStart > 8000) phase = "down";
  }
  draw();
  requestAnimationFrame(tick);
}

// ---------- the roll ----------
const kingsEl = $<HTMLOListElement>("kings");
function renderRoll(fresh = false) {
  const ks = store.kings;
  $("empty").hidden = ks.length > 0;
  let best: King | null = null;
  let total = 0;
  for (const k of ks) {
    total += k.ms;
    if (!best || k.ms > best.ms) best = k;
  }
  $("tKings").textContent = String(ks.length);
  $("tLong").textContent = best ? `${secs(best.ms)}, ${roman(best.n)}` : "none yet";
  $("tTotal").textContent = secs(total);
  $("tFalls").textContent = String(store.falls);
  $("crownFalls").textContent = `dropped ${store.falls} ${store.falls === 1 ? "time" : "times"} on this device`;
  kingsEl.textContent = "";
  const shown = ks.slice(-40).reverse();
  shown.forEach((k, i) => {
    const li = document.createElement("li");
    if (best && k === best && ks.length > 1) li.classList.add("best");
    if (fresh && i === 0) li.classList.add("new");
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.append(kingName(k.n), " ");
    const ep = document.createElement("i");
    ep.textContent = epithet(k.ms).name;
    nm.append(ep);
    const dur = document.createElement("span");
    dur.className = "dur";
    dur.textContent = secs(k.ms);
    const end = document.createElement("span");
    end.className = "end";
    end.textContent = `reign ended: ${k.cause}`;
    li.append(nm, dur, end);
    kingsEl.append(li);
  });
  if (ks.length > 40) {
    const li = document.createElement("li");
    const end = document.createElement("span");
    end.className = "end";
    end.textContent = `and ${ks.length - 40} earlier Pumtons, all equally loved.`;
    li.append(end);
    kingsEl.append(li);
  }
}

// ---------- sound: synthesised brass and a little metal ----------
let ctx: AudioContext | null = null;
function audio() {
  if (!store.sound) return;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { ctx = null; }
  }
  ctx?.resume();
}
function horn(freq: number, t: number, dur: number, gain: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  const vib = ctx.createOscillator();
  const vg = ctx.createGain();
  o.type = "sawtooth";
  o2.type = "square";
  o.frequency.value = freq;
  o2.frequency.value = freq * 1.003;
  vib.frequency.value = 5.2;
  vg.gain.value = freq * 0.006;
  vib.connect(vg).connect(o.frequency);
  f.type = "lowpass";
  f.Q.value = 2;
  f.frequency.setValueAtTime(freq * 1.5, t);
  f.frequency.linearRampToValueAtTime(freq * 6, t + 0.06);
  f.frequency.exponentialRampToValueAtTime(freq * 3, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.035);
  g.gain.setValueAtTime(gain * 0.8, t + dur - 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  const mix = ctx.createGain();
  mix.gain.value = 0.5;
  o.connect(f);
  o2.connect(mix).connect(f);
  f.connect(g).connect(ctx.destination);
  for (const n of [o, o2, vib]) { n.start(t); n.stop(t + dur + 0.1); }
}
function fanfare() {
  if (!ctx || !store.sound) return;
  const t = ctx.currentTime + 0.02;
  // G4 . C5 C5 . E5 . G5 (held)
  const notes: [number, number, number][] = [[392, 0, 0.14], [523.25, 0.16, 0.1], [523.25, 0.28, 0.1], [659.25, 0.4, 0.16], [783.99, 0.6, 0.7]];
  for (const [f, at, d] of notes) {
    horn(f, t + at, d, 0.09);
    horn(f / 2, t + at, d, 0.05);
  }
}
function clink(power: number) {
  if (!ctx || !store.sound) return;
  const t = ctx.currentTime;
  for (const [f, g] of [[2310, 1], [3470, 0.6], [5120, 0.35]] as const) {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f * (0.97 + power * 0.06);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(0.12 * g * power, t + 0.004);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + power * 0.3);
    o.connect(gn).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.7);
  }
}
function paintSound() {
  sndBtn.setAttribute("aria-pressed", String(store.sound));
  sndBtn.querySelector("b")!.textContent = store.sound ? "on" : "off";
}
sndBtn.addEventListener("click", () => {
  store.sound = !store.sound;
  save();
  paintSound();
  if (store.sound) audio();
});

// ---------- the proclamation ----------
const caEl = $<HTMLElement>("ca");
caEl.textContent = CONFIG.ca;
($<HTMLAnchorElement>("xlink")).href = CONFIG.x;
let toastTimer = 0;
function say(msg: string) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}
$<HTMLButtonElement>("seal").addEventListener("click", async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  btn.classList.remove("broken");
  void btn.offsetWidth;
  btn.classList.add("broken");
  try {
    await navigator.clipboard.writeText(CONFIG.ca);
  } catch {
    const r = document.createRange();
    r.selectNodeContents(caEl);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(r);
    document.execCommand("copy");
  }
  say("seal broken. contract copied.");
});

// ---------- boot ----------
layout();
new ResizeObserver(layout).observe(plate);
paintSound();
renderRoll();
setKing(null);
holdLabel();
draw();
requestAnimationFrame(tick);

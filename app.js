document.addEventListener("DOMContentLoaded", () => {

// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/AKfycbyC_SDp6SBZPcVWh59U5m5WE1jbO8nSpmvXSo4iqF21lIa1Yu32DFgjJ6VhkCydCwmzEA/exec";

// ====== DOM ======
const el = (id) => document.getElementById(id);

const netStatus = el("netStatus");
const video = el("video");

const btnStartScan = el("btnStartScan");
const btnStopScan  = el("btnStopScan");

const lastGb     = el("lastGb");
const lastRoute  = el("lastRoute");
const lastResult = el("lastResult");
const scanMsg    = el("scanMsg");

// ====== STATE ======
let scanner = null;
let scanning = false;

// ====== PWA SW ======
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// ====== Network indicator ======
function updateNet() {
  const online = navigator.onLine;
  netStatus.textContent = online ? "● online" : "● offline";
  netStatus.style.color = online ? "#9aa7b6" : "#b14040";
}
window.addEventListener("online", updateNet);
window.addEventListener("offline", updateNet);
updateNet();

// ====== Sound ======
function beep(ok=true) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 120);
  } catch {}
}

// ====== API ======
async function apiScan(gb) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gb })
  });
  return res.json();
}

// ====== Scanner ======
btnStartScan.addEventListener("click", startScan);
btnStopScan.addEventListener("click", stopScan);

async function startScan() {
  if (scanning) return;
  if (!window.ZXing) {
    scanMsg.textContent = "ZXing not loaded.";
    return;
  }

  scanner = new window.ZXing.BrowserMultiFormatReader();
  scanning = true;

  const hints = new Map();
  hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    window.ZXing.BarcodeFormat.CODE_128,
    window.ZXing.BarcodeFormat.EAN_13,
    window.ZXing.BarcodeFormat.EAN_8,
    window.ZXing.BarcodeFormat.QR_CODE
  ]);

  await scanner.decodeFromVideoDevice(null, video, async (result) => {
    if (!scanning || !result) return;

    const raw = result.getText().replace(/\s+/g, "");
    const m = raw.match(/GB\d{6,}/i);
    if (!m) return;

    scanning = false;
    await handleScan(m[0].toUpperCase());
    setTimeout(() => scanning = true, 400);
  }, hints);
}

async function stopScan() {
  try { scanner?.reset(); } catch {}
  scanning = false;
}

// ====== Scan handler ======
async function handleScan(gb) {
  lastGb.textContent = gb;
  lastRoute.textContent = "—";
  scanMsg.textContent = "Saving…";

  try {
    const data = await apiScan(gb);

    if (data.status === "ADDED") {
      beep(true);
      lastResult.textContent = "ADDED";
      lastResult.style.borderColor = "#1f8a4c";
      scanMsg.textContent = "";
    } else if (data.status === "DUPLICATE") {
      beep(false);
      lastResult.textContent = "DUPLICATE";
      lastResult.style.borderColor = "#b28704";
      scanMsg.textContent = "Already scanned.";
    } else {
      beep(false);
      lastResult.textContent = "INVALID";
      lastResult.style.borderColor = "#b14040";
      scanMsg.textContent = "Invalid GB.";
    }
  } catch {
    beep(false);
    lastResult.textContent = "ERROR";
    lastResult.style.borderColor = "#b14040";
    scanMsg.textContent = "Network / API error.";
  }
}
});

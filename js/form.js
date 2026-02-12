// ===================================================
// form.js (UI TABLE) + FETCH MASTER CSV ROBUST + REMARK 4 OPSI
// ===================================================

let MASTER_DATA = [];
let CHANNEL_MASTERS = {}; // cache biar filter cepat

function cleanStr(v) {
  return String(v ?? "").replace(/(^"|"$)/g, "").trim();
}

// Ambil angka channel biar "Channel 1" == "1"
function normalizeChannel(raw) {
  const s = cleanStr(raw);
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
}

// CSV parser robust (support quote + koma di dalam quote)
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function buildChannelMastersFromMasterData() {
  const obj = {};
  for (const row of MASTER_DATA) {
    const channel = normalizeChannel(row.channel);
    const bearingType = cleanStr(row.bearingType);
    const category = cleanStr(row.category);
    const name = cleanStr(row.name);
    const code = cleanStr(row.code);

    if (!channel || !bearingType || !category || !name) continue;

    obj[channel] ??= {};
    obj[channel][bearingType] ??= {};
    obj[channel][bearingType][category] ??= [];
    obj[channel][bearingType][category].push({ name, code, channel, bearingType, category });
  }
  CHANNEL_MASTERS = obj;
}

// ==========================================
// FETCH MASTER DATA (FIXED)
// ==========================================
async function fetchMasterData() {
  const loadingModal = document.getElementById("loadingModal");
  const modalText = loadingModal?.querySelector("p");
  if (modalText) modalText.textContent = "Memuat data master...";
  if (loadingModal) loadingModal.classList.add("show");

  try {
    const masterDataUrl =
      window.CONFIG?.MASTER_DATA_URL ||
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrVEMf_DG702fbz5Gy12__YvNYc1lNXTW-gFcZbV5J0NSndYYvjQb_HmjsEWImsZBLAEZqlTs9eLDh/pub?gid=0&single=true&output=csv";

    console.log("[form] Memuat data master dari:", masterDataUrl);

    const res = await fetch(masterDataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) throw new Error("CSV kosong / header tidak ada");

    const headerCols = parseCsvLine(lines[0]).map((h) => cleanStr(h).toLowerCase());
    const idx = {
      channel: headerCols.indexOf("channel"),
      bearingType: headerCols.indexOf("bearingtype"),
      category: headerCols.indexOf("category"),
      name: headerCols.indexOf("name"),
      code: headerCols.indexOf("code"),
    };
    if (Object.values(idx).some((v) => v === -1)) {
      throw new Error("Header CSV harus: Channel,BearingType,Category,Name,Code");
    }

    MASTER_DATA = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]).map(cleanStr);
      if (cols.every((c) => !c)) continue;

      MASTER_DATA.push({
        channel: cols[idx.channel],
        bearingType: cols[idx.bearingType],
        category: cols[idx.category],
        name: cols[idx.name],
        code: cols[idx.code],
      });
    }

    buildChannelMastersFromMasterData();
    console.log("[form] Data master berhasil dimuat:", MASTER_DATA.length, "baris");
  } catch (err) {
    console.error("[form] Error fetching master data:", err);
    alert("Gagal memuat data master.\n" + err.message);
  } finally {
    if (modalText) modalText.textContent = "Menyimpan data...";
    if (loadingModal) loadingModal.classList.remove("show");
  }
}

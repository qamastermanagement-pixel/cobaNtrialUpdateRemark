// =====================================================
// form.js (UI LAMA) + MASTER DATA DARI GOOGLE SHEETS CSV
// =====================================================

let MASTER_DATA = [];
let CHANNEL_MASTERS = {};

function cleanStr(v) {
  return String(v ?? "").replace(/(^"|"$)/g, "").trim();
}

function normalizeChannel(raw) {
  const s = cleanStr(raw);
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
}

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
    obj[channel][bearingType][category].push({ name, code });
  }
  CHANNEL_MASTERS = obj;
}

async function fetchMasterData() {
  const loadingModal = document.getElementById("loadingModal");
  const modalText = loadingModal?.querySelector("p");
  if (modalText) modalText.textContent = "Memuat data master...";
  if (loadingModal) loadingModal.classList.add("show");

  try {
    const url = window.CONFIG?.MASTER_DATA_URL;
    if (!url) throw new Error("CONFIG.MASTER_DATA_URL belum di-set di config.js");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length < 2) throw new Error("CSV kosong / header tidak ada");

    const headerCols = parseCsvLine(lines[0]).map(h => cleanStr(h).toLowerCase());
    const idx = {
      channel: headerCols.indexOf("channel"),
      bearingType: headerCols.indexOf("bearingtype"),
      category: headerCols.indexOf("category"),
      name: headerCols.indexOf("name"),
      code: headerCols.indexOf("code"),
    };
    if (Object.values(idx).some(v => v === -1)) {
      throw new Error("Header CSV harus: Channel,BearingType,Category,Name,Code");
    }

    MASTER_DATA = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]).map(cleanStr);
      if (cols.every(c => !c)) continue;

      MASTER_DATA.push({
        channel: cols[idx.channel],
        bearingType: cols[idx.bearingType],
        category: cols[idx.category],
        name: cols[idx.name],
        code: cols[idx.code],
      });
    }

    buildChannelMastersFromMasterData();
    console.log("[OK] Master loaded:", MASTER_DATA.length, "rows");
  } catch (err) {
    console.error("[ERR] fetchMasterData:", err);
    alert("Gagal memuat data master.\n" + err.message);
  } finally {
    if (modalText) modalText.textContent = "Menyimpan data...";
    if (loadingModal) loadingModal.classList.remove("show");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // default tanggal
  const today = new Date().toISOString().split("T")[0];
  const tanggalEl = document.getElementById("tanggal");
  if (tanggalEl) tanggalEl.value = today;

  // disable dulu sampai master siap
  const channelEl = document.getElementById("channel");
  const bearingEl = document.getElementById("bearingType");
  if (channelEl) channelEl.disabled = true;
  if (bearingEl) bearingEl.disabled = true;

  await fetchMasterData();

  if (channelEl) channelEl.disabled = false;

  document.getElementById("basicInfoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    goToStep2();
  });

  document.getElementById("masterCheckForm").addEventListener("submit", (e) => {
    e.preventDefault();
    submitData();
  });

  document.getElementById("channel").addEventListener("change", function () {
    const channel = this.value;
    const bearingSelect = document.getElementById("bearingType");
    bearingSelect.innerHTML = '<option value="">Pilih Tipe</option>';

    if (CHANNEL_MASTERS[channel]) {
      Object.keys(CHANNEL_MASTERS[channel]).forEach(type => {
        const opt = document.createElement("option");
        opt.value = type;
        opt.textContent = type;
        bearingSelect.appendChild(opt);
      });
      bearingSelect.disabled = false;
    } else {
      bearingSelect.disabled = true;
    }
  });

  document.getElementById("category").addEventListener("change", function () {
    const field = document.getElementById("clearanceField");
    if (!field) return;

    if (this.value === "Clearance") {
      field.style.display = "block";
    } else {
      field.style.display = "none";
      const cl = document.getElementById("clearanceType");
      if (cl) cl.value = "";
    }
  });
});

function goToStep2() {
  const tanggal = document.getElementById("tanggal").value;
  const shift = document.getElementById("shift").value;
  const npk = document.getElementById("npk").value;
  const channel = document.getElementById("channel").value;
  const bearingType = document.getElementById("bearingType").value;
  const category = document.getElementById("category").value;

  let clearanceType = "";
  if (category === "Clearance") {
    clearanceType = document.getElementById("clearanceType")?.value;
    if (!clearanceType) {
      alert("Pilih tipe clearance yang sedang running!");
      return;
    }
  }

  if (!tanggal || !shift || !npk || !channel || !bearingType || !category) {
    alert("Semua field harus diisi!");
    return;
  }

  sessionStorage.setItem("tanggal", tanggal);
  sessionStorage.setItem("shift", shift);
  sessionStorage.setItem("npk", npk);
  sessionStorage.setItem("channel", channel);
  sessionStorage.setItem("bearingType", bearingType);

  const actualCategory = (category === "Clearance") ? "Pokayoke" : category;
  sessionStorage.setItem("category", actualCategory);

  const sc = document.getElementById("selectedChannel");
  if (sc) sc.textContent = channel;

  let masters = [];

  if (category === "Clearance") {
    const pokayokeMasters = CHANNEL_MASTERS[channel]?.[bearingType]?.["Pokayoke"];
    if (!pokayokeMasters) {
      alert("Data Pokayoke tidak ditemukan!");
      return;
    }

    const map = {};
    pokayokeMasters.forEach(item => {
      const m = item.name.match(/Clearance Check - (C2|Cn|C3|C4|C5)/);
      if (m) map[m[1]] = item;
    });

    const order = ["C2", "Cn", "C3", "C4", "C5"];
    const idx = order.indexOf(clearanceType);
    if (idx === -1) {
      alert("Tipe clearance tidak valid!");
      return;
    }

    if (idx > 0 && map[order[idx - 1]]) masters.push(map[order[idx - 1]]);
    if (map[clearanceType]) masters.push(map[clearanceType]);
    if (idx < order.length - 1 && map[order[idx + 1]]) masters.push(map[order[idx + 1]]);
  } else {
    const raw = CHANNEL_MASTERS[channel]?.[bearingType]?.[category] || [];
    if (category === "Pokayoke") {
      masters = raw.filter(item => !/Clearance Check - (C2|Cn|C3|C4|C5)/.test(item.name));
    } else {
      masters = raw;
    }
  }

  if (!masters.length) {
    alert(`Data master tidak ditemukan untuk Channel ${channel}, Tipe ${bearingType}, Kategori ${category}!`);
    return;
  }

  const tm = document.getElementById("totalMasters");
  if (tm) tm.textContent = masters.length;

  const masterList = document.getElementById("masterList");
  if (!masterList) {
    alert("ERROR: #masterList tidak ditemukan. Pastikan form.html yang kamu upload adalah versi UI lama.");
    return;
  }
  masterList.innerHTML = "";

  masters.forEach((item, index) => {
    const label = `${item.name} (${item.code})`;

    const masterItem = document.createElement("div");
    masterItem.className = "master-item";
    masterItem.innerHTML = `
      <div class="master-item-header">
        <div class="master-name">${index + 1}. ${label}</div>
        <div class="status-buttons">
          <button type="button" class="btn-ok" onclick="selectStatus(${index}, 'OK')">OK</button>
          <button type="button" class="btn-ng" onclick="selectStatus(${index}, 'NG')">NG</button>
        </div>
      </div>

      <div class="remark-field" id="remark-${index}" style="display:none;">
        <label class="form-label">Jenis Remark</label>
        <div class="remark-type-group">
          <label><input type="radio" name="remarkType_${index}" value="numeric" checked> Perubahan nilai pada master</label>
          <label><input type="radio" name="remarkType_${index}" value="text"> Lainnya: Keterangan</label>
        </div>

        <div class="remark-input numeric-input" id="numericInput_${index}">
          <textarea class="remark-textarea" placeholder="Remark hanya boleh diisi jika ada perubahan nilai numerik pada master"></textarea>
          <small class="error-msg" id="errorNumeric_${index}" style="color:red; display:none;"></small>
        </div>

        <div class="remark-input text-input" id="textInput_${index}" style="display:none;">
          <textarea class="remark-textarea" placeholder="Remark diisi jika NG, dapat berupa problem yang terjadi. Tapi bukan perubahan nilai!"></textarea>
        </div>
      </div>
    `;
    masterList.appendChild(masterItem);

    document.querySelectorAll(`input[name="remarkType_${index}"]`).forEach(radio => {
      radio.addEventListener("change", function () {
        const numericDiv = document.getElementById(`numericInput_${index}`);
        const textDiv = document.getElementById(`textInput_${index}`);
        const errorDiv = document.getElementById(`errorNumeric_${index}`);

        if (this.value === "numeric") {
          numericDiv.style.display = "block";
          textDiv.style.display = "none";
        } else {
          numericDiv.style.display = "none";
          textDiv.style.display = "block";
        }
        if (errorDiv) errorDiv.style.display = "none";
      });
    });
  });

  sessionStorage.setItem("displayedMasters", JSON.stringify(masters));

  // ✅ FIX STEP (class + display)
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  step1.classList.remove("active");
  step1.style.display = "none";
  step2.classList.add("active");
  step2.style.display = "block";
}

function goToStep1() {
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");

  step2.classList.remove("active");
  step2.style.display = "none";

  step1.classList.add("active");
  step1.style.display = "block";
}

function selectStatus(index, status) {
  const masterItem = document.querySelectorAll(".master-item")[index];
  const okBtn = masterItem.querySelector(".btn-ok");
  const ngBtn = masterItem.querySelector(".btn-ng");

  const remarkField = document.getElementById(`remark-${index}`);
  const errorDiv = document.getElementById(`errorNumeric_${index}`);

  // helper reset remark UI
  const resetRemarkUI = () => {
    if (remarkField) remarkField.style.display = "none";

    const numericRadio = document.querySelector(`input[name="remarkType_${index}"][value="numeric"]`);
    if (numericRadio) numericRadio.checked = true;

    const numericDiv = document.getElementById(`numericInput_${index}`);
    const textDiv = document.getElementById(`textInput_${index}`);
    if (numericDiv) numericDiv.style.display = "block";
    if (textDiv) textDiv.style.display = "none";

    // reset textarea
    const numericTA = numericDiv?.querySelector("textarea");
    const textTA = textDiv?.querySelector("textarea");
    if (numericTA) numericTA.value = "";
    if (textTA) textTA.value = "";

    if (errorDiv) errorDiv.style.display = "none";
  };

  // === TOGGLE LOGIC ===
  if (status === "OK") {
    // kalau OK sudah aktif, klik lagi => unselect
    if (okBtn.classList.contains("active")) {
      okBtn.classList.remove("active");
      resetRemarkUI(); // pastikan remark bersih
      return;
    }

    // aktifkan OK, matikan NG
    okBtn.classList.add("active");
    ngBtn.classList.remove("active");

    // OK -> remark disembunyikan & dibersihkan
    resetRemarkUI();
    return;
  }

  if (status === "NG") {
    // kalau NG sudah aktif, klik lagi => unselect
    if (ngBtn.classList.contains("active")) {
      ngBtn.classList.remove("active");
      resetRemarkUI(); // remark ikut hilang
      return;
    }

    // aktifkan NG, matikan OK
    ngBtn.classList.add("active");
    okBtn.classList.remove("active");

    // NG -> tampilkan remark (default numeric)
    if (remarkField) remarkField.style.display = "block";

    const numericRadio = document.querySelector(`input[name="remarkType_${index}"][value="numeric"]`);
    if (numericRadio) numericRadio.checked = true;

    const numericDiv = document.getElementById(`numericInput_${index}`);
    const textDiv = document.getElementById(`textInput_${index}`);
    if (numericDiv) numericDiv.style.display = "block";
    if (textDiv) textDiv.style.display = "none";

    if (errorDiv) errorDiv.style.display = "none";
    return;
  }
}


async function submitData() {
  const masters = JSON.parse(sessionStorage.getItem("displayedMasters") || "[]");
  if (!masters.length) {
    alert("Data master kosong. Silakan ulangi.");
    return;
  }

  const appsScriptUrl = window.CONFIG?.APPS_SCRIPT_URL;
  if (!appsScriptUrl) {
    alert("CONFIG.APPS_SCRIPT_URL belum di-set di config.js");
    return;
  }

  const loadingModal = document.getElementById("loadingModal");
  if (loadingModal) loadingModal.classList.add("show");

  try {
    const results = [];

    for (let i = 0; i < masters.length; i++) {
      const masterItem = document.querySelectorAll(".master-item")[i];
      const okBtn = masterItem.querySelector(".btn-ok");
      const ngBtn = masterItem.querySelector(".btn-ng");

      const status =
        okBtn.classList.contains("active") ? "OK" :
        ngBtn.classList.contains("active") ? "NG" :
        "";

      const masterLabel = `${masters[i].name} (${masters[i].code})`;

      if (!status) {
        alert(`Mohon pilih status untuk: ${masterLabel}`);
        return;
      }

      let remark = "";

      if (status === "NG") {
        const numericChecked = document.querySelector(`input[name="remarkType_${i}"][value="numeric"]`)?.checked;
        const numericTA = document.getElementById(`numericInput_${i}`)?.querySelector("textarea");
        const textTA = document.getElementById(`textInput_${i}`)?.querySelector("textarea");
        const errorDiv = document.getElementById(`errorNumeric_${i}`);

        if (numericChecked) {
          remark = numericTA?.value.trim() || "";
          if (!remark) {
            if (errorDiv) {
              errorDiv.textContent = "Wajib diisi karena memilih 'Perubahan nilai pada master'";
              errorDiv.style.display = "block";
            }
            alert(`Mohon isi remark (numeric) untuk: ${masterLabel}`);
            return;
          }

          const singleNum = /^[-+]?\d*\.?\d+$/;
          const numList = /^([-+]?\d*\.?\d+)(;[-+]?\d*\.?\d+)*$/;

          if (!singleNum.test(remark) && !numList.test(remark)) {
            if (errorDiv) {
              errorDiv.textContent = "Hanya boleh angka (misal: 0, -1, +3, atau -9;-10;-11)";
              errorDiv.style.display = "block";
            }
            alert(`Format remark numeric tidak valid untuk: ${masterLabel}`);
            return;
          }
          if (errorDiv) errorDiv.style.display = "none";
        } else {
          remark = textTA?.value.trim() || "";
        }
      }

      results.push({
        name: masters[i].name,
        code: masters[i].code,
        status,
        remark
      });
    }

    const payload = {
      tanggal: sessionStorage.getItem("tanggal"),
      shift: sessionStorage.getItem("shift"),
      npk: sessionStorage.getItem("npk"),
      channel: `Channel ${sessionStorage.getItem("channel")}`,
      bearingType: sessionStorage.getItem("bearingType"),
      category: sessionStorage.getItem("category"),
      masters: results
    };

    const res = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log("[OK] submit response:", text);

    alert("Data berhasil disimpan!");
    sessionStorage.clear();
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("[ERR] submitData:", err);
    alert("Gagal menyimpan data.\n" + err.message);
  } finally {
    if (loadingModal) loadingModal.classList.remove("show");
  }
}

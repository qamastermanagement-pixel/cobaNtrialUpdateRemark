// ===================================================
// form.js (UI LAMA) + FETCH MASTER CSV + REMARK 4 OPSI
// Payload masters: remarkValue, remarkType, remarkDetail
// ===================================================

// ==========================================
// 1. DEKLARASI DATA MASTER (KOSONG)
// ==========================================
let MASTER_DATA = [];

// ==========================================
// 2. FUNGSI FETCH DATA DARI GOOGLE SHEETS
// ==========================================
async function fetchMasterData() {
  const loadingModal = document.getElementById("loadingModal");
  if (loadingModal) loadingModal.classList.add("show");

  try {
    const masterDataUrl =
      window.CONFIG?.MASTER_DATA_URL ||
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vTrVEMf_DG702fbz5Gy12__YvNYc1lNXTW-gFcZbV5J0NSndYYvjQb_HmjsEWImsZBLAEZqlTs9eLDh/pub?gid=0&single=true&output=csv";

    console.log("[form] Memuat data master dari Sheets...");
    const response = await fetch(masterDataUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const csvText = await response.text();

    const rows = csvText.split("\n");
    MASTER_DATA = [];

    const cleanStr = (str) =>
      str ? str.replace(/(^"|"$)/g, "").trim() : "";

    for (let i = 1; i < rows.length; i++) {
      const rowText = rows[i].trim();
      if (!rowText) continue;

      // NOTE: CSV parser sederhana (asumsi data tidak mengandung koma di value)
      const cols = rowText.split(",");

      MASTER_DATA.push({
        channel: cleanStr(cols[0]),
        bearingType: cleanStr(cols[1]),
        category: cleanStr(cols[2]),
        name: cleanStr(cols[3]),
        code: cleanStr(cols[4]),
      });
    }

    console.log("[form] Data master berhasil dimuat:", MASTER_DATA.length, "baris");
  } catch (error) {
    console.error("[form] Error fetching master data:", error);
    alert(
      "Gagal memuat data master dari Google Sheets. Pastikan koneksi internet stabil / link publish CSV benar."
    );
  } finally {
    if (loadingModal) loadingModal.classList.remove("show");
  }
}

// ==========================================
// 3. HELPERS UNTUK REMARK NG
// ==========================================

// Label remark type (HARUS TEXT, bukan angka)
const REMARK_TYPE_LABELS = {
  OPT1: "Deviasi nilai (master tetap)",
  OPT2: "Deviasi nilai (master diganti)",
  OPT3: "Master rusak/hilang (ganti baru)",
  OPT4: "Lainnya",
};

// Placeholder/helper sesuai opsi
const REMARK_HELPER = {
  OPT1: "Remark hanya boleh diisi angka (deviasi nilai). Contoh: +5 / -2 / 0.02",
  OPT2: "Remark hanya boleh diisi angka (deviasi nilai). Contoh: +5 / -2 / 0.02",
  OPT3: "Opsional: jelaskan kondisi (contoh: holder patah / master hilang).",
  OPT4: "Wajib: jelaskan kondisi/temuan lainnya.",
};

// Validasi angka deviasi:
// - boleh + atau -
// - boleh desimal . atau ,
// - boleh spasi tipis
// - boleh nilai integer
// - pengecualian (kalau kamu punya rule khusus) taruh di sini
const REMARK_VALUE_EXCEPTIONS = new Set([
  // tambahkan kalau memang ada pengecualian dari rule lama kamu
  // "NA", "N/A", "-", "Hilang"
]);

function isValidDeviationValue(raw) {
  const v = String(raw ?? "").trim();
  if (!v) return false;

  if (REMARK_VALUE_EXCEPTIONS.has(v)) return true;

  // normalize: ganti koma jadi titik (untuk validasi)
  const norm = v.replace(/\s+/g, "").replace(",", ".");

  // regex angka: +5, -2, 0.02, .5 (kalau kamu nggak mau .5, tinggal ubah)
  const re = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;
  return re.test(norm);
}

// ==========================================
// 4. INISIALISASI & EVENT LISTENER
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[form] Form.js loaded");

  await fetchMasterData();

  const today = new Date().toISOString().split("T")[0];
  const tanggalInput = document.getElementById("tanggal");
  if (tanggalInput) tanggalInput.value = today;

  document.getElementById("basicInfoForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    goToStep2();
  });

  document.getElementById("masterCheckForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitData();
  });

  // Dropdown Channel -> Filter Bearing Type
  document.getElementById("channel")?.addEventListener("change", function () {
    const selectedChannel = String(this.value).trim();

    const bearingSelect = document.getElementById("bearingType");
    if (!bearingSelect) return;

    bearingSelect.innerHTML = '<option value="">--Pilih Tipe--</option>';

    if (MASTER_DATA.length === 0) {
      alert("Data master belum termuat, silakan refresh halaman.");
      return;
    }

    const uniqueBearings = [
      ...new Set(
        MASTER_DATA.filter(
          (item) => item.channel === selectedChannel || item.channel.includes(selectedChannel)
        )
          .map((item) => item.bearingType)
          .filter((type) => type !== "")
      ),
    ];

    uniqueBearings.forEach((type) => {
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = type;
      bearingSelect.appendChild(opt);
    });
  });

  // Toggle Kategori Clearance
  document.getElementById("category")?.addEventListener("change", function () {
    const field = document.getElementById("clearanceField");
    if (!field) return;

    if (this.value === "Clearance") {
      field.style.display = "block";
    } else {
      field.style.display = "none";
      const clType = document.getElementById("clearanceType");
      if (clType) clType.value = "";
    }
  });
});

// ==========================================
// 5. PINDAH KE STEP 2 (RENDER TABEL + REMARK UI)
// ==========================================
function goToStep2() {
  const tanggal = document.getElementById("tanggal")?.value;
  const shift = document.getElementById("shift")?.value;
  const npk = document.getElementById("npk")?.value;
  const channel = document.getElementById("channel")?.value;
  const bearingType = document.getElementById("bearingType")?.value;
  const category = document.getElementById("category")?.value;
  const clearanceType = document.getElementById("clearanceType")?.value || "";

  if (!tanggal || !shift || !npk || !channel || !bearingType || !category) {
    alert("Lengkapi semua field informasi dasar!");
    return;
  }

  if (category === "Clearance" && !clearanceType) {
    alert("Pilih tipe clearance yang sedang running!");
    return;
  }

  sessionStorage.setItem("tanggal", tanggal);
  sessionStorage.setItem("shift", shift);
  sessionStorage.setItem("npk", npk);
  sessionStorage.setItem("channel", channel);
  sessionStorage.setItem("bearingType", bearingType);

  // Clearance disimpan sebagai Pokayoke (sesuai sistem kamu)
  const actualCategory = category === "Clearance" ? "Pokayoke" : category;
  sessionStorage.setItem("category", actualCategory);

  // Filter master
  let masters = MASTER_DATA.filter((item) => {
    const matchChannel = item.channel === channel || item.channel.includes(channel);
    const matchBearing = item.bearingType === bearingType;

    if (!matchChannel || !matchBearing) return false;

    if (category === "Clearance") {
      // ambil clearance berdasarkan tipe yang dipilih
      const re = new RegExp(`Clearance Check - ${clearanceType}$`);
      return item.category === "Pokayoke" && re.test(item.name);
    }

    return item.category === category;
  });

  // Jika kategori Pokayoke biasa, buang item Clearance
  if (category === "Pokayoke") {
    masters = masters.filter((item) => !/Clearance Check - (C2|Cn|C3|C4|C5)/.test(item.name));
  }

  if (masters.length === 0) {
    alert(`Data master tidak ditemukan untuk Channel ${channel}, Tipe ${bearingType}, Kategori ${category}!`);
    return;
  }

  document.getElementById("selectedChannel")?.textContent = channel;
  document.getElementById("totalMasters")?.textContent = masters.length;

  const tableBody = document.getElementById("tableBody");
  if (!tableBody) {
    alert("ERROR: tableBody tidak ditemukan di HTML step2.");
    return;
  }
  tableBody.innerHTML = "";

  masters.forEach((item, index) => {
    const row = document.createElement("tr");
    row.dataset.code = item.code;
    row.dataset.name = item.name;

    const remarkName = `remarkType_${index}`; // unik per row

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>
        ${item.name} <br><small style="color: gray;">(${item.code})</small>
      </td>

      <td style="min-width:140px;">
        <select class="status-select" required>
          <option value="">Pilih</option>
          <option value="OK">OK</option>
          <option value="NG">NG</option>
        </select>
      </td>

      <td>
        <div class="remark-wrap" style="display:none;">
          <div class="remark-type-group" style="margin-bottom:8px;">
            <div style="font-weight:600; margin-bottom:6px;">Jenis Remark</div>

            <label style="display:block; margin:4px 0; cursor:pointer;">
              <input type="radio" name="${remarkName}" value="OPT1">
              ${REMARK_TYPE_LABELS.OPT1}
            </label>

            <label style="display:block; margin:4px 0; cursor:pointer;">
              <input type="radio" name="${remarkName}" value="OPT2">
              ${REMARK_TYPE_LABELS.OPT2}
            </label>

            <label style="display:block; margin:4px 0; cursor:pointer;">
              <input type="radio" name="${remarkName}" value="OPT3">
              ${REMARK_TYPE_LABELS.OPT3}
            </label>

            <label style="display:block; margin:4px 0; cursor:pointer;">
              <input type="radio" name="${remarkName}" value="OPT4">
              ${REMARK_TYPE_LABELS.OPT4}
            </label>
          </div>

          <div class="remark-value-box" style="display:none; margin-top:8px;">
            <input type="text" class="remark-value-input form-input" placeholder="Contoh: +5 / -2 / 0.02" />
            <div class="remark-helper" style="font-size:12px; color:#ef4444; margin-top:6px;">
              ${REMARK_HELPER.OPT1}
            </div>
            <div class="remark-error error-msg" style="display:none; color:#ef4444; font-size:12px; margin-top:6px;"></div>
          </div>

          <div class="remark-detail-box" style="display:none; margin-top:10px;">
            <textarea class="remark-detail-input remark-textarea" placeholder="Jelaskan kondisi..."></textarea>
            <div class="remark-detail-helper" style="font-size:12px; color:#64748b; margin-top:6px;"></div>
            <div class="remark-error-detail error-msg" style="display:none; color:#ef4444; font-size:12px; margin-top:6px;"></div>
          </div>

        </div>
      </td>
    `;

    tableBody.appendChild(row);
    wireRowRemarkLogic(row);
  });

  document.getElementById("step1")?.classList.remove("active");
  document.getElementById("step1").style.display = "none";
  document.getElementById("step2")?.classList.add("active");
  document.getElementById("step2").style.display = "block";
}

function wireRowRemarkLogic(row) {
  const statusEl = row.querySelector(".status-select");
  const remarkWrap = row.querySelector(".remark-wrap");

  const valueBox = row.querySelector(".remark-value-box");
  const valueInput = row.querySelector(".remark-value-input");
  const valueHelper = row.querySelector(".remark-helper");
  const valueErr = row.querySelector(".remark-error");

  const detailBox = row.querySelector(".remark-detail-box");
  const detailInput = row.querySelector(".remark-detail-input");
  const detailHelper = row.querySelector(".remark-detail-helper");
  const detailErr = row.querySelector(".remark-error-detail");

  const radios = row.querySelectorAll('input[type="radio"]');

  const resetRemarkUI = () => {
    // hide all
    remarkWrap.style.display = "none";
    valueBox.style.display = "none";
    detailBox.style.display = "none";

    // clear values
    radios.forEach((r) => (r.checked = false));
    valueInput.value = "";
    detailInput.value = "";

    valueErr.style.display = "none";
    detailErr.style.display = "none";
  };

  const applyRemarkMode = (opt) => {
    // reset boxes
    valueBox.style.display = "none";
    detailBox.style.display = "none";
    valueErr.style.display = "none";
    detailErr.style.display = "none";

    if (opt === "OPT1" || opt === "OPT2") {
      valueBox.style.display = "block";
      detailBox.style.display = "none";

      valueHelper.textContent = REMARK_HELPER[opt];
      valueInput.placeholder = "Contoh: +5 / -2 / 0.02";
      detailInput.value = "";
    } else if (opt === "OPT3") {
      // optional detail
      valueBox.style.display = "none";
      detailBox.style.display = "block";
      detailHelper.textContent = REMARK_HELPER[opt];
      detailInput.placeholder = "Opsional: jelaskan kondisi...";
      valueInput.value = "";
    } else if (opt === "OPT4") {
      valueBox.style.display = "none";
      detailBox.style.display = "block";
      detailHelper.textContent = REMARK_HELPER[opt];
      detailInput.placeholder = "Wajib: jelaskan kondisi...";
      valueInput.value = "";
    }
  };

  statusEl.addEventListener("change", () => {
    const status = statusEl.value;

    if (status === "NG") {
      remarkWrap.style.display = "block";
      // default: belum pilih remark type
      valueBox.style.display = "none";
      detailBox.style.display = "none";
    } else {
      // OK atau kosong
      resetRemarkUI();
    }
  });

  radios.forEach((r) => {
    r.addEventListener("change", () => applyRemarkMode(r.value));
  });

  // live validation ringan untuk value (opsi 1/2)
  valueInput.addEventListener("input", () => {
    valueErr.style.display = "none";
  });

  detailInput.addEventListener("input", () => {
    detailErr.style.display = "none";
  });
}

// ==========================================
// 6. KEMBALI KE STEP 1
// ==========================================
function goToStep1() {
  document.getElementById("step2")?.classList.remove("active");
  document.getElementById("step2").style.display = "none";
  document.getElementById("step1")?.classList.add("active");
  document.getElementById("step1").style.display = "block";
}

// ==========================================
// 7. SUBMIT (VALIDASI + PAYLOAD 3 KOLOM REMARK)
// ==========================================
async function submitData() {
  const tableBody = document.getElementById("tableBody");
  const rows = tableBody.querySelectorAll("tr");

  const masterResults = [];

  for (let row of rows) {
    const name = row.dataset.name;
    const code = row.dataset.code;

    const statusEl = row.querySelector(".status-select");
    const status = statusEl?.value;

    if (!status) {
      alert(`Mohon pilih status (OK/NG) untuk pengecekan: ${name}`);
      statusEl?.focus();
      return;
    }

    // default remark fields
    let remarkValue = "";
    let remarkType = "";
    let remarkDetail = "";

    if (status === "NG") {
      // remark type wajib
      const checked = row.querySelector('input[type="radio"]:checked');
      if (!checked) {
        alert(`Mohon pilih Jenis Remark untuk item NG: ${name}`);
        return;
      }

      const opt = checked.value;
      remarkType = REMARK_TYPE_LABELS[opt] || "";

      const valueInput = row.querySelector(".remark-value-input");
      const valueErr = row.querySelector(".remark-error");

      const detailInput = row.querySelector(".remark-detail-input");
      const detailErr = row.querySelector(".remark-error-detail");

      if (opt === "OPT1" || opt === "OPT2") {
        // wajib angka deviasi
        const v = (valueInput?.value ?? "").trim();
        if (!v) {
          alert(`Mohon isi Remark Value (angka deviasi) untuk item NG: ${name}`);
          valueInput?.focus();
          return;
        }
        if (!isValidDeviationValue(v)) {
          if (valueErr) {
            valueErr.textContent = "Format tidak valid. Remark Value harus angka (contoh: +5 / -2 / 0.02).";
            valueErr.style.display = "block";
          }
          alert(`Remark Value harus angka deviasi untuk: ${name}`);
          valueInput?.focus();
          return;
        }
        remarkValue = v; // simpan raw (biar + tetap)
        remarkDetail = "";
      } else if (opt === "OPT3") {
        // optional detail
        remarkValue = "";
        remarkDetail = (detailInput?.value ?? "").trim(); // boleh kosong
      } else if (opt === "OPT4") {
        // wajib detail
        const d = (detailInput?.value ?? "").trim();
        if (!d) {
          if (detailErr) {
            detailErr.textContent = "Remark Detail wajib diisi untuk opsi Lainnya.";
            detailErr.style.display = "block";
          }
          alert(`Mohon isi Remark Detail untuk item NG (Lainnya): ${name}`);
          detailInput?.focus();
          return;
        }
        remarkValue = "";
        remarkDetail = d;
      }
    }

    masterResults.push({
      name,
      code,
      status,
      remarkValue,
      remarkType,
      remarkDetail,
    });
  }

  const dataToSend = {
    tanggal: sessionStorage.getItem("tanggal"),
    shift: sessionStorage.getItem("shift"),
    npk: sessionStorage.getItem("npk"),
    channel: `Channel ${sessionStorage.getItem("channel")}`,
    bearingType: sessionStorage.getItem("bearingType"),
    category: sessionStorage.getItem("category"),
    masters: masterResults,
  };

  console.log("[form] Data to send:", JSON.stringify(dataToSend, null, 2));

  const appsScriptUrl =
    window.CONFIG?.APPS_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbytpHuYFDR_G-sugVMYFVpEbw1uQObHt68HiiRsuo01YybVLh_otjhjW971CO9QrH5gtA/exec";

  const loadingModal = document.getElementById("loadingModal");
  if (loadingModal) loadingModal.classList.add("show");

  try {
    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(dataToSend),
    });

    const result = await response.text();
    console.log("[form] Response:", result);

    alert("Data berhasil disimpan!");
    sessionStorage.clear();
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error("[form] Submit Error:", error);
    alert("Gagal menyimpan data. Silakan coba lagi.\nError: " + error.message);
  } finally {
    if (loadingModal) loadingModal.classList.remove("show");
  }
}

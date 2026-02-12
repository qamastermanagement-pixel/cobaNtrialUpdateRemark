let allData = []
let chartInstance = null

// ================================
// LOADING MODAL FUNCTIONS
// ================================
function showLoading(text = "Memuat data...") {
  const modal = document.getElementById("loadingModal")
  const label = document.getElementById("loadingText")
  if (label) label.textContent = text
  if (modal) modal.classList.add("show")
}

function hideLoading() {
  const modal = document.getElementById("loadingModal")
  if (modal) modal.classList.remove("show")
}

// ================================
// INIT
// ================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v3] Dashboard.js loaded")
  console.log("[v3] CONFIG:", window.CONFIG)

  // default date = today
  const today = new Date().toISOString().split("T")[0]
  document.getElementById("filterDate").value = today

  loadData()

  document.getElementById("filterDate").addEventListener("change", () => {
    showLoading("Memuat data...")
    setTimeout(() => {
      filterAndDisplayData()
      hideLoading()
    }, 200)
  })

  // PDF button
  const btnPdf = document.getElementById("btnDownloadNGPdf")
  if (btnPdf) btnPdf.addEventListener("click", downloadNGFormalPdf)
})

// ================================
// LOAD DATA
// ================================
async function loadData() {
  showLoading("Memuat data dashboard...")

  try {
    console.log("[v3] Fetching data...")
    const res = await fetch(window.CONFIG.APPS_SCRIPT_URL)
    const result = await res.json()

    if (result.status === "success") {
      allData = result.data || []
      console.log("[v3] Data loaded:", allData.length)
    } else {
      allData = []
      console.error("[v3] API error:", result.message)
      alert("Gagal memuat data dashboard: " + (result.message || "unknown error"))
    }

    filterAndDisplayData()
  } catch (err) {
    console.error("[v3] Fetch failed:", err)
    allData = []
    filterAndDisplayData()
    alert("Gagal memuat data. Cek koneksi / Apps Script.\n" + err.message)
  } finally {
    hideLoading()
  }
}

// ================================
// FILTER
// ================================
function filterAndDisplayData() {
  const filterDate = document.getElementById("filterDate").value
  console.log("[v3] Filter date:", filterDate)

  const filteredData = allData.filter((entry) => {
    const entryDate = String(entry.Tanggal).split("T")[0]
    return entryDate === filterDate
  })

  console.log("[v3] Filtered:", filteredData.length)

  updateStats(filteredData)
  updateChannelTable(filteredData)
  updateChart(filteredData)
  updateNGTrackerTable(filteredData)
}

// ================================
// STATS
// ================================
function updateStats(data) {
  const TOTAL_CHANNELS = 16
  const TOTAL_SHIFTS = 3
  const TOTAL_CHECKPOINTS = TOTAL_CHANNELS * TOTAL_SHIFTS

  let okCount = 0
  let ngCount = 0

  const checkpointSet = new Set()

  data.forEach((entry) => {
    const channel = entry.Channel
    const shift = String(entry.Shift)

    if (entry.Status === "OK") okCount++
    else ngCount++

    checkpointSet.add(`${channel}-shift-${shift}`)
  })

  const covered = checkpointSet.size
  const coverage = Math.round((covered / TOTAL_CHECKPOINTS) * 100)
  const totalEntries = data.length
  const okRate = totalEntries > 0 ? Math.round((okCount / totalEntries) * 100) : 0

  document.getElementById("totalChecked").textContent = totalEntries
  document.getElementById("mastersOk").textContent = okCount
  document.getElementById("mastersNg").textContent = ngCount
  document.getElementById("ngCount").textContent = ngCount
  document.getElementById("okRate").textContent = okRate
  document.getElementById("coverage").textContent = `${coverage}%`
  document.getElementById("checkPoints").textContent = `${covered}/${TOTAL_CHECKPOINTS}`
}

// ================================
// CHANNEL TABLE
// ================================
function updateChannelTable(data) {
  const tableBody = document.getElementById("channelTable")
  tableBody.innerHTML = ""

  const statusMap = {}

  data.forEach((entry) => {
    const channel = entry.Channel
    const shift = String(entry.Shift)
    const status = entry.Status

    if (!statusMap[channel]) statusMap[channel] = {}
    if (!statusMap[channel][shift]) statusMap[channel][shift] = { ok: 0, ng: 0 }

    status === "OK"
      ? statusMap[channel][shift].ok++
      : statusMap[channel][shift].ng++
  })

  for (let i = 1; i <= 16; i++) {
    const channelName = `Channel ${i}`
    const row = document.createElement("tr")

    row.innerHTML = `
      <td><strong>${channelName}</strong></td>
      ${generateShiftCell(statusMap, channelName, "1")}
      ${generateShiftCell(statusMap, channelName, "2")}
      ${generateShiftCell(statusMap, channelName, "3")}
    `

    tableBody.appendChild(row)
  }
}

function generateShiftCell(map, channel, shift) {
  const data = map[channel]?.[shift]

  if (!data) {
    return `<td><span class="status-indicator empty">-</span></td>`
  }

  if (data.ng > 0) {
    return `<td><span class="status-indicator ng">${data.ng}</span></td>`
  }

  return `<td><span class="status-indicator ok">✓</span></td>`
}

// ================================
// CHART
// ================================
function updateChart(data) {
  let ok = 0
  let ng = 0

  data.forEach((e) => (e.Status === "OK" ? ok++ : ng++))

  const ctx = document.getElementById("statusChart").getContext("2d")

  if (chartInstance) chartInstance.destroy()

  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["OK Masters", "NG Masters"],
      datasets: [
        {
          data: [ok, ng],
          backgroundColor: ["#10B981", "#EF4444"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => {
              const total = ok + ng
              const pct = total > 0 ? Math.round((c.parsed / total) * 100) : 0
              return `${c.label}: ${c.parsed} (${pct}%)`
            },
          },
        },
      },
    },
  })
}

// ================================
// NG TRACKER TABLE
// ================================
function updateNGTrackerTable(data) {
  const tbody = document.getElementById("remarkTableBody")
  tbody.innerHTML = ""

  const ngEntries = data.filter((entry) => entry.Status === "NG")

  if (ngEntries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center">Tidak ada NG hari ini</td></tr>`
    return
  }

  ngEntries.forEach((entry) => {
    const row = document.createElement("tr")
    row.innerHTML = `
      <td>${entry.Tanggal}</td>
      <td>${entry.Channel}</td>
      <td>${entry.Shift}</td>
      <td>${entry.Master}</td>
      <td>${entry.Remark || ""}</td>
      <td>${entry.Kategori || "-"}</td>
      <td>${entry.Code || "-"}</td>
    `
    tbody.appendChild(row)
  })
}

// ================================
// FORMAL PDF REPORT
// ================================
function downloadNGFormalPdf() {
  const tbody = document.getElementById("remarkTableBody")
  if (!tbody) {
    alert("ERROR: #remarkTableBody tidak ditemukan.")
    return
  }

  const filterDate = document.getElementById("filterDate")?.value || new Date().toISOString().split("T")[0]
  const rows = Array.from(tbody.querySelectorAll("tr"))

  if (rows.length === 1) {
    const tds = rows[0].querySelectorAll("td")
    if (tds.length === 1 && (tds[0].textContent || "").toLowerCase().includes("tidak ada ng")) {
      alert(`Tidak ada NG untuk tanggal ${filterDate}.`)
      return
    }
  }

  const data = []
  rows.forEach((tr) => {
    const cols = Array.from(tr.querySelectorAll("td")).map((td) => (td.textContent || "").trim())
    if (cols.length >= 7) {
      const rowDate = String(cols[0]).split("T")[0]
      if (rowDate === filterDate) data.push(cols.slice(0, 7))
    }
  })

  if (data.length === 0) {
    alert(`Tidak ada NG untuk tanggal ${filterDate}.`)
    return
  }

  const countBy = (idx) => {
    const map = {}
    data.forEach((r) => {
      const key = (r[idx] || "-").trim() || "-"
      map[key] = (map[key] || 0) + 1
    })
    return map
  }

  const topOne = (map) => {
    let bestK = "-"
    let bestV = 0
    Object.entries(map).forEach(([k, v]) => {
      if (v > bestV) {
        bestK = k
        bestV = v
      }
    })
    return { key: bestK, val: bestV }
  }

  const topChannel = topOne(countBy(1))
  const topCategory = topOne(countBy(5))
  const topMaster = topOne(countBy(3))
  const totalNG = data.length

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const now = new Date()
  const pad2 = (n) => String(n).padStart(2, "0")
  const generatedAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`

  doc.saveGraphicsState()
  doc.setTextColor(210)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(26)
  doc.text("CONFIDENTIAL", pageW / 2, pageH / 2 - 10, { align: "center", angle: 25 })
  doc.setFontSize(13)
  doc.text("INTERNAL USE ONLY", pageW / 2, pageH / 2 + 5, { align: "center", angle: 25 })
  doc.restoreGraphicsState()

  doc.setTextColor(20)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("QA MASTER MANAGEMENT – NG TRACKER REPORT", 14, 18)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.text("SKF Indonesia | Quality Assurance Department", 14, 24)

  doc.setLineWidth(0.3)
  doc.line(14, 28, pageW - 14, 28)

  const boxX = 14
  const boxY = 32
  const boxW = pageW - 28
  const boxH = 24

  doc.setDrawColor(170)
  doc.setLineWidth(0.2)
  doc.rect(boxX, boxY, boxW, boxH)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Report Information", boxX + 3, boxY + 7)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`Date: ${filterDate}`, boxX + 3, boxY + 14)
  doc.text(`Total NG: ${totalNG}`, boxX + boxW / 2 + 2, boxY + 14)
  doc.setFontSize(9.5)
  doc.text(`Generated at: ${generatedAt}`, boxX + 3, boxY + 20)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("A. NG TRACKER DETAIL", 14, boxY + boxH + 10)

  const body = data.map((r, i) => [String(i + 1), ...r])

  doc.autoTable({
    startY: boxY + boxH + 14,
    head: [["No", "Tanggal", "Channel", "Shift", "Master", "Remark", "Kategori", "Code"]],
    body,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.8, cellPadding: 2 },
    headStyles: { fontStyle: "bold" },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 12 },
      4: { cellWidth: 60 },
      5: { cellWidth: 18 },
      6: { cellWidth: 22 },
      7: { cellWidth: 16 },
    },
  })

  const afterTableY = doc.lastAutoTable.finalY + 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text("B. SUMMARY", 14, afterTableY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`• Total NG: ${totalNG}`, 16, afterTableY + 7)
  doc.text(`• Top Channel: ${topChannel.key} (${topChannel.val})`, 16, afterTableY + 13)
  doc.text(`• Top Category: ${topCategory.key} (${topCategory.val})`, 16, afterTableY + 19)
  doc.text(`• Top Master: ${topMaster.key} (${topMaster.val})`, 16, afterTableY + 25)

  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)

    doc.setDrawColor(200)
    doc.setLineWidth(0.2)
    doc.line(14, pageH - 18, pageW - 14, pageH - 18)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.text("Prepared by: QA Master Management System", 14, pageH - 12)
    doc.text("Approved by: ____________________", 14, pageH - 7)
    doc.text(`Page ${p} / ${pageCount}`, pageW - 14, pageH - 10, { align: "right" })
  }

  doc.save(`NG_Tracker_Report_${filterDate}.pdf`)
}

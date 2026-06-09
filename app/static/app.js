// ── 常數 ────────────────────────────────────────────────
const MAX_HISTORY = 60; // 60 筆 × 5s = 5 分鐘

// GPU 顏色
const GPU_COLORS = [
  "#76b900", "#00aaff", "#ff6b35", "#c084fc",
  "#f59e0b", "#34d399", "#f87171", "#60a5fa",
];

// ── 狀態 ────────────────────────────────────────────────
const gpuState = {}; // { index: { charts:{}, history:{} } }

// ── 工具函式 ─────────────────────────────────────────────
function fmtVal(v, unit = "") {
  if (v === null || v === undefined) return "N/A";
  return `${v}${unit}`;
}

function colorByPct(pct) {
  if (pct === null || pct === undefined) return "#76b900";
  if (pct >= 90) return "#f87171";
  if (pct >= 70) return "#f59e0b";
  return "#76b900";
}

// ── 建立 Gauge（doughnut 模擬）────────────────────────────
function makeGauge(canvas, label, color) {
  return new Chart(canvas, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [0, 100],
        backgroundColor: [color, "#2a2a3a"],
        borderWidth: 0,
        circumference: 270,
        rotation: 225,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      animation: { duration: 400 },
    },
    plugins: [{
      id: "center-text",
      afterDraw(chart) {
        const { ctx, chartArea: { top, width, height } } = chart;
        const centerX = width / 2 + chart.chartArea.left;
        const centerY = top + height * 0.62;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#e0e0f0";
        ctx.font = `bold ${Math.max(12, width * 0.14)}px 'Segoe UI', sans-serif`;
        ctx.fillText(chart._customText || "—", centerX, centerY);
        ctx.fillStyle = "#888";
        ctx.font = `${Math.max(9, width * 0.09)}px 'Segoe UI', sans-serif`;
        ctx.fillText(label, centerX, centerY + height * 0.16);
        ctx.restore();
      },
    }],
  });
}

// ── 更新 Gauge ────────────────────────────────────────────
function updateGauge(chart, pct, text, color) {
  chart._customText = text;
  chart.data.datasets[0].data = [pct ?? 0, 100 - (pct ?? 0)];
  chart.data.datasets[0].backgroundColor[0] = color ?? "#76b900";
  chart.update();
}

// ── 建立折線圖 ────────────────────────────────────────────
function makeLine(canvas, labels, color) {
  const datasets = labels.map((lbl, i) => ({
    label: lbl,
    data: [],
    borderColor: [color, "#00aaff", "#f59e0b", "#c084fc"][i % 4],
    backgroundColor: "transparent",
    tension: 0.3,
    pointRadius: 0,
    borderWidth: 2,
  }));
  return new Chart(canvas, {
    type: "line",
    data: { labels: [], datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      scales: {
        x: {
          ticks: { color: "#666", maxTicksLimit: 6, maxRotation: 0 },
          grid: { color: "#2a2a3a" },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: "#888", stepSize: 25 },
          grid: { color: "#2a2a3a" },
        },
      },
      plugins: { legend: { labels: { color: "#ccc", boxWidth: 12 } } },
    },
  });
}

// ── 建立/取得 GPU 卡片 ────────────────────────────────────
function ensureGpuCard(gpu) {
  const idx = gpu.index;
  if (gpuState[idx]) return gpuState[idx];

  const color = GPU_COLORS[idx % GPU_COLORS.length];
  const grid = document.getElementById("gpu-grid");

  const card = document.createElement("div");
  card.className = "gpu-card";
  card.id = `gpu-card-${idx}`;
  card.innerHTML = `
    <div class="gpu-header">
      <span class="gpu-badge" style="background:${color}">#${idx}</span>
      <span class="gpu-name">${gpu.name ?? "Unknown GPU"}</span>
      <span class="gpu-extra" id="gpu-extra-${idx}"></span>
    </div>
    <div class="gauges">
      <div class="gauge-wrap"><canvas id="g-util-${idx}"></canvas></div>
      <div class="gauge-wrap"><canvas id="g-mem-${idx}"></canvas></div>
      <div class="gauge-wrap"><canvas id="g-temp-${idx}"></canvas></div>
      <div class="gauge-wrap"><canvas id="g-power-${idx}"></canvas></div>
    </div>
    <div class="line-wrap">
      <canvas id="l-${idx}"></canvas>
    </div>
  `;
  grid.appendChild(card);

  const history = { time: [], util: [], mem: [], temp: [], power: [] };

  const charts = {
    util:  makeGauge(document.getElementById(`g-util-${idx}`),  "GPU %",   color),
    mem:   makeGauge(document.getElementById(`g-mem-${idx}`),   "MEM %",   "#00aaff"),
    temp:  makeGauge(document.getElementById(`g-temp-${idx}`),  "°C",      "#f59e0b"),
    power: makeGauge(document.getElementById(`g-power-${idx}`), "POWER %", "#c084fc"),
    line:  makeLine(document.getElementById(`l-${idx}`),
                    ["GPU %", "MEM %", "Temp °C (÷1)", "Power %"], color),
  };

  gpuState[idx] = { charts, history, color };
  return gpuState[idx];
}

// ── 推送單張 GPU 資料 ─────────────────────────────────────
function updateGpuCard(gpu) {
  const state = ensureGpuCard(gpu);
  const { charts, history, color } = state;

  const utilPct  = gpu.utilization_pct;
  const memPct   = gpu.memory_pct;
  const tempC    = gpu.temperature_c;
  const powerPct = (gpu.power_draw_w != null && gpu.power_limit_w)
    ? Math.min(100, Math.round(gpu.power_draw_w / gpu.power_limit_w * 100))
    : null;

  updateGauge(charts.util,  utilPct,  fmtVal(utilPct, "%"),          colorByPct(utilPct));
  updateGauge(charts.mem,   memPct,   fmtVal(memPct, "%"),           colorByPct(memPct));
  updateGauge(charts.temp,  tempC != null ? Math.min(100, tempC) : null,
              fmtVal(tempC, "°C"),  colorByPct(tempC != null ? (tempC - 40) * 2 : null));
  updateGauge(charts.power, powerPct, fmtVal(gpu.power_draw_w, "W"), colorByPct(powerPct));

  // 副標題
  const extra = document.getElementById(`gpu-extra-${gpu.index}`);
  if (extra) {
    extra.textContent =
      `${fmtVal(gpu.memory_used_mib)} / ${fmtVal(gpu.memory_total_mib)} MiB` +
      ` | SM ${fmtVal(gpu.clock_sm_mhz)} MHz | MEM ${fmtVal(gpu.clock_mem_mhz)} MHz`;
  }

  // 折線歷史
  const now = new Date().toLocaleTimeString("zh-TW", { hour12: false });
  history.time.push(now);
  history.util.push(utilPct ?? null);
  history.mem.push(memPct ?? null);
  history.temp.push(tempC != null ? Math.min(100, tempC) : null);
  history.power.push(powerPct ?? null);
  if (history.time.length > MAX_HISTORY) {
    ["time","util","mem","temp","power"].forEach(k => history[k].shift());
  }

  charts.line.data.labels = history.time;
  charts.line.data.datasets[0].data = history.util;
  charts.line.data.datasets[1].data = history.mem;
  charts.line.data.datasets[2].data = history.temp;
  charts.line.data.datasets[3].data = history.power;
  charts.line.update();
}

// ── 更新系統資料 ─────────────────────────────────────────
function updateSystem(sys) {
  document.getElementById("cpu-val").textContent = `${sys.cpu_pct}%`;
  document.getElementById("cpu-bar").style.width = `${sys.cpu_pct}%`;
  document.getElementById("ram-val").textContent =
    `${sys.ram_used_gb} / ${sys.ram_total_gb} GB (${sys.ram_pct}%)`;
  document.getElementById("ram-bar").style.width = `${sys.ram_pct}%`;
}

// ── 更新程序列表 ─────────────────────────────────────────
function updateProcs(procs) {
  const tbody = document.getElementById("proc-tbody");
  if (!procs || procs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="no-data">目前無佔用 GPU 的程序</td></tr>`;
    return;
  }
  tbody.innerHTML = procs.map(p => `
    <tr>
      <td><span class="gpu-badge" style="background:${GPU_COLORS[p.gpu_index % GPU_COLORS.length]}">#${p.gpu_index}</span></td>
      <td>${p.pid}</td>
      <td>${p.name}</td>
      <td>${p.memory_mib != null ? p.memory_mib + " MiB" : "N/A"}</td>
    </tr>
  `).join("");
}

// ── SSE 連線 ─────────────────────────────────────────────
function connect() {
  const es = new EventSource("/api/stream");

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      const now = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      document.getElementById("last-update").textContent = `最後更新：${now}`;

      (data.gpus || []).forEach(g => {
        if (!g.error) updateGpuCard(g);
      });
      if (data.system) updateSystem(data.system);
      updateProcs(data.processes || []);
    } catch (err) {
      console.error("資料解析失敗", err);
    }
  };

  es.onerror = () => {
    document.getElementById("last-update").textContent = "連線中斷，5 秒後重連…";
    es.close();
    setTimeout(connect, 5000);
  };
}

connect();

// ==========================================================================
// Research — Pilih Variabel: kolom diambil dari file yang benar-benar diunggah.
// Struktur fleksibel: Dependen >= 1 (numerik), Independen >= 1 (kategorik /
// kode kelompok), Kovariat opsional (numerik). Metode mengikuti pilihan.
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const st = RS.load();
  const guard = document.getElementById("varGuard");
  const main = document.getElementById("varMain");

  if (!st.datasetId || !st.cleaned || !st.profile) {
    guard.innerHTML = 'Belum ada data yang siap dianalisis. <a href="research-upload.html">Unggah file</a> dan selesaikan validasi terlebih dahulu.';
    guard.hidden = false;
    return;
  }
  main.hidden = false;

  const cols = st.profile.columns;
  const colByName = Object.fromEntries(cols.map((c) => [c.name, c]));

  // ---- Pratinjau data ----
  const isNum = (c) => c.dtype === "numeric";
  document.getElementById("previewHead").innerHTML =
    '<th class="rn">#</th>' +
    cols.map((c) => `<th class="${isNum(c) ? "num" : ""}">${RS.esc(c.name)}<span class="th-type">${isNum(c) ? "numerik" : "kategorik"}</span></th>`).join("");
  document.getElementById("previewBody").innerHTML = st.profile.preview
    .map((row, i) => {
      const cells = cols
        .map((c) => {
          const v = row[c.name];
          if (v === null || v === undefined || v === "") return '<td class="na">kosong</td>';
          const shown = isNum(c) && typeof v === "number" ? RS.fmtNum(v, 3) : RS.esc(v);
          return `<td class="${isNum(c) ? "num" : ""}">${shown}</td>`;
        })
        .join("");
      return `<tr><td class="rn">${i + 1}</td>${cells}</tr>`;
    })
    .join("");
  document.getElementById("previewCaption").textContent =
    `${st.profile.preview.length} baris pertama dari ${st.filename} (${st.profile.n_rows.toLocaleString("id-ID")} baris, ${cols.length} kolom). Geser tabel untuk melihat kolom lainnya.`;

  // ---- Chip variabel ----
  const pool = document.getElementById("pool");
  const dropzones = [...document.querySelectorAll(".dropzone")];
  let dragged = null;
  let selected = null;

  const RULES = {
    "dz-dependent": {
      ok: (c) => c.dtype === "numeric",
      msg: (c) => `"${c.name}" bukan kolom numerik, sehingga tidak bisa menjadi variabel dependen.`,
    },
    "dz-independent": {
      ok: (c) => c.can_be_factor,
      msg: (c) => `"${c.name}" tidak cocok sebagai faktor: kolom numerik hanya bisa dipakai bila berupa kode kelompok (2–10 nilai unik).`,
    },
    "dz-covariates": {
      ok: (c) => c.dtype === "numeric",
      msg: (c) => `"${c.name}" bukan kolom numerik, sehingga tidak bisa menjadi kovariat.`,
    },
  };

  function makeChip(c) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.draggable = true;
    chip.tabIndex = 0;
    chip.dataset.var = c.name;
    const dots = document.createElement("span");
    dots.className = "drag-dots";
    dots.textContent = "⠿";
    const label = document.createElement("span");
    label.textContent = " " + c.name;
    const type = document.createElement("span");
    type.className = "chip-type";
    type.textContent = c.dtype === "numeric" ? (c.can_be_factor ? "angka · bisa faktor" : "angka") : "kategori";
    chip.append(dots, label, type);

    chip.addEventListener("dragstart", (e) => {
      // Firefox mensyaratkan data di-set agar drag dimulai
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", c.name);
        e.dataTransfer.effectAllowed = "move";
      }
      dragged = chip;
      chip.classList.add("dragging");
    });
    chip.addEventListener("dragend", () => {
      chip.classList.remove("dragging");
      dragged = null;
    });
    chip.addEventListener("click", (e) => {
      if (e.target.closest(".chip-remove")) return;
      // Variabel terpilih + klik pada kotak yang sudah berisi variabel lain = letakkan ke kotak itu
      const hostZone = chip.closest(".dropzone");
      if (hostZone && selected && selected !== chip) {
        place(selected, hostZone);
        return;
      }
      if (selected === chip) {
        chip.classList.remove("selected");
        selected = null;
      } else {
        if (selected) selected.classList.remove("selected");
        selected = chip;
        chip.classList.add("selected");
      }
    });
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        chip.click();
      }
    });
    return chip;
  }

  cols.forEach((c) => pool.appendChild(makeChip(c)));

  // ---- Dropzone ----
  function renderEmpty(dz) {
    if (dz.querySelector(".dropzone-chips")?.children.length) return;
    dz.classList.remove("has-items");
    dz.innerHTML = "";
    const ex = document.createElement("div");
    ex.className = "dz-example";
    ex.textContent = dz.dataset.example;
    const hint = document.createElement("div");
    hint.className = "dz-hint";
    hint.textContent = dz.dataset.hint;
    dz.append(ex, hint);
  }

  function returnToPool(chip) {
    chip.classList.remove("in-dropzone", "selected");
    chip.querySelector(".chip-remove")?.remove();
    pool.appendChild(chip);
  }

  function place(chip, dz) {
    const col = colByName[chip.dataset.var];
    const rule = RULES[dz.id];
    if (!rule.ok(col)) {
      setHint(rule.msg(col), true);
      dz.classList.add("invalid");
      setTimeout(() => dz.classList.remove("invalid"), 1200);
      return;
    }

    const oldDz = chip.closest(".dropzone");
    let wrap = dz.querySelector(".dropzone-chips");
    if (!wrap) {
      dz.innerHTML = "";
      wrap = document.createElement("div");
      wrap.className = "dropzone-chips";
      dz.appendChild(wrap);
    }

    chip.classList.add("in-dropzone");
    chip.classList.remove("selected");
    selected = null;

    if (!chip.querySelector(".chip-remove")) {
      const btn = document.createElement("button");
      btn.className = "chip-remove";
      btn.type = "button";
      btn.setAttribute("aria-label", "Keluarkan variabel");
      btn.textContent = "✕";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const from = chip.closest(".dropzone");
        returnToPool(chip);
        if (from) renderEmpty(from);
        refresh();
      });
      chip.appendChild(btn);
    }

    wrap.appendChild(chip);
    dz.classList.add("has-items");
    if (oldDz && oldDz !== dz) renderEmpty(oldDz);
    refresh();
  }

  dropzones.forEach((dz) => {
    renderEmpty(dz);
    dz.addEventListener("dragover", (e) => {
      e.preventDefault();
      dz.classList.add("drag-over");
    });
    dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("drag-over");
      if (dragged) place(dragged, dz);
    });
    dz.addEventListener("click", (e) => {
      if (selected && !e.target.closest(".chip")) place(selected, dz);
    });
  });

  pool.addEventListener("dragover", (e) => e.preventDefault());
  pool.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!dragged) return;
    const from = dragged.closest(".dropzone");
    returnToPool(dragged);
    if (from) renderEmpty(from);
    refresh();
  });

  // ---- Validasi struktur + pratinjau metode ----
  const runBtn = document.getElementById("runAnalysisBtn");
  const hint = document.getElementById("varHint");
  const preview = document.getElementById("methodPreview");

  function setHint(text, warn) {
    hint.textContent = text;
    hint.classList.toggle("warn", !!warn);
    hint.style.color = warn ? "" : "var(--slate-500)";
  }

  function selection() {
    const get = (id) => [...document.querySelectorAll(`#${id} .chip`)].map((c) => c.dataset.var);
    return {
      dependent: get("dz-dependent"),
      independent: get("dz-independent"),
      covariates: get("dz-covariates"),
    };
  }

  function refresh() {
    const s = selection();
    const regression = s.independent.length === 0 && s.covariates.length >= 1;
    const regressionMulti = regression && s.dependent.length > 1;
    const ok = s.dependent.length >= 1 && (s.independent.length >= 1 || regression) && !regressionMulti;
    runBtn.disabled = !ok;

    if (regressionMulti) {
      setHint("Regresi Linier (tanpa faktor) hanya untuk 1 variabel Dependen. Sisakan 1 Dependen, atau tambahkan faktor.", true);
      preview.hidden = true;
    } else if (ok) {
      const m = RS.identifyMethod(s.dependent.length, s.covariates.length, s.independent.length);
      setHint(
        regression
          ? "Tanpa faktor, kovariat berperan sebagai prediktor Regresi Linier."
          : "Struktur variabel valid. Kovariat bersifat opsional.",
        false
      );
      preview.innerHTML = `Metode yang akan dipakai: <strong>${m.code}</strong>`;
      preview.hidden = false;
    } else {
      const missing = [];
      if (s.dependent.length < 1) missing.push("minimal 1 variabel Dependen");
      if (s.independent.length < 1) missing.push("1 variabel Independen (faktor), atau kosongkan faktor dan isi Kovariat untuk Regresi Linier");
      setHint(`Lengkapi dahulu: ${missing.join(" dan ")}.`, false);
      preview.hidden = true;
    }
  }

  // ---- Pulihkan pilihan sebelumnya ----
  if (st.selection) {
    const map = { dependent: "dz-dependent", independent: "dz-independent", covariates: "dz-covariates" };
    Object.entries(map).forEach(([key, id]) => {
      (st.selection[key] || []).forEach((name) => {
        const chip = pool.querySelector(`.chip[data-var="${CSS.escape(name)}"]`);
        if (chip) place(chip, document.getElementById(id));
      });
    });
  }
  refresh();

  runBtn.addEventListener("click", () => {
    if (runBtn.disabled) return;
    RS.save({ selection: selection(), result: null, resultKey: null });
    window.location.href = "research-methods.html";
  });
});

// ==========================================================================
// Status alur Analisis Ragam (disimpan di sessionStorage per tab) +
// hasil analisis terakhir (localStorage, agar bisa dilihat lagi)
// ==========================================================================

const RS = {
  KEY: "mancova_research_v1",
  LAST: "mancova_last_analysis_v1",

  load() {
    try {
      return JSON.parse(sessionStorage.getItem(RS.KEY)) || {};
    } catch (e) {
      return {};
    }
  },
  save(patch) {
    const state = Object.assign(RS.load(), patch);
    try {
      sessionStorage.setItem(RS.KEY, JSON.stringify(state));
    } catch (e) {}
    return state;
  },
  reset() {
    sessionStorage.removeItem(RS.KEY);
  },

  setLast(result) {
    try {
      localStorage.setItem(RS.LAST, JSON.stringify({ savedAt: new Date().toISOString(), result }));
    } catch (e) {}
  },
  getLast() {
    try {
      return JSON.parse(localStorage.getItem(RS.LAST));
    } catch (e) {
      return null;
    }
  },
  clearLast() {
    localStorage.removeItem(RS.LAST);
  },

  // Aturan yang sama dengan backend (MancovaService.identify_method)
  identifyMethod(nDependent, nCovariates, nIndependent = 1) {
    if (nIndependent === 0 && nCovariates >= 1) {
      return { code: "Regresi Linier", full: "Linear Regression (Regresi Linier)", multivariate: false, hasCov: true, isRegression: true };
    }
    const multivariate = nDependent >= 2;
    const hasCov = nCovariates >= 1;
    const code = multivariate ? (hasCov ? "MANCOVA" : "MANOVA") : hasCov ? "ANCOVA" : "ANOVA";
    const full = {
      ANOVA: "Analysis of Variance",
      ANCOVA: "Analysis of Covariance",
      MANOVA: "Multivariate Analysis of Variance",
      MANCOVA: "Multivariate Analysis of Covariance",
    }[code];
    return { code, full, multivariate, hasCov, isRegression: false };
  },

  // Ringkasan model Regresi Linier (dipakai halaman Hasil dan Laporan)
  regressionHtml(reg) {
    if (!reg) return "";
    const e = RS.esc;
    const rows = reg.coefficients
      .map(
        (c) => `<tr><td><strong>${e(c.term === "Intercept" ? "Konstanta (Intercept)" : c.term)}</strong></td>
          <td>${RS.fmtNum(c.estimate, 4)}</td><td>${RS.fmtNum(c.std_error, 4)}</td><td>${RS.fmtNum(c.t_value, 3)}</td>
          <td>${RS.fmtP(c.p_value)}</td><td>${RS.fmtNum(c.ci_low, 3)} – ${RS.fmtNum(c.ci_high, 3)}</td>
          <td>${c.beta == null ? "–" : RS.fmtNum(c.beta, 3)}</td>
          <td>${c.significant ? '<span class="pill-sig">Signifikan</span>' : '<span class="pill-ns">Tidak signifikan</span>'}</td></tr>`
      )
      .join("");
    return `<div class="res-effect">
      <div class="res-effect-head"><h4>Ringkasan Model Regresi</h4><span class="type-tag">${e(reg.dependent)}</span></div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>R²</th><th>R² disesuaikan</th><th>F model</th><th>df</th><th>p</th><th>RMSE</th><th>n</th></tr></thead>
        <tbody><tr><td>${RS.fmtNum(reg.r_squared, 3)}</td><td>${RS.fmtNum(reg.adj_r_squared, 3)}</td><td>${RS.fmtNum(reg.f_value, 3)}</td>
        <td>${RS.fmtNum(reg.df_model, 0)}, ${RS.fmtNum(reg.df_resid, 0)}</td><td>${RS.fmtP(reg.f_p_value)}</td><td>${RS.fmtNum(reg.rmse, 3)}</td><td>${RS.fmtNum(reg.n, 0)}</td></tr></tbody></table></div>
      <div class="table-scroll" style="margin-top:12px;"><table class="data-table"><thead><tr><th>Suku</th><th>Koefisien (b)</th><th>Galat baku</th><th>t</th><th>p</th><th>CI 95%</th><th>Beta</th><th>Keputusan</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="res-note">Koefisien b: perubahan ${e(reg.dependent)} bila prediktor naik 1 satuan dengan prediktor lain tetap. Beta (terstandar) membandingkan kekuatan antar prediktor.</p>
    </div>`;
  },

  esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  fmtNum(n, d = 4) {
    if (n === null || n === undefined || Number.isNaN(n)) return "-";
    return Number(n).toLocaleString("id-ID", { maximumFractionDigits: d });
  },
  fmtP(p) {
    if (p === null || p === undefined || Number.isNaN(p)) return "-";
    return p < 0.001 ? "< 0,001" : p.toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  },
  fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return iso || "";
    }
  },
};

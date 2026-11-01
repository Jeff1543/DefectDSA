// ==========================================================================
// Research — Identifikasi Metode: dihitung dari variabel yang benar-benar dipilih
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const st = RS.load();
  const guard = document.getElementById("metGuard");
  const card = document.getElementById("metCard");
  const sel = st.selection;

  if (!st.datasetId || !sel || !sel.dependent || !sel.dependent.length || !sel.independent || (!sel.independent.length && !(sel.covariates && sel.covariates.length))) {
    guard.innerHTML = 'Variabel belum dipilih. <a href="research-variables.html">Pilih variabel</a> terlebih dahulu.';
    guard.hidden = false;
    return;
  }

  const nDep = sel.dependent.length;
  const nInd = sel.independent.length;
  const nCov = sel.covariates.length;
  const m = RS.identifyMethod(nDep, nCov, nInd);

  const names = (arr) => `<small>${arr.map(RS.esc).join(", ")}</small>`;
  document.getElementById("mDep").innerHTML = `${nDep} variabel${names(sel.dependent)}`;
  document.getElementById("mInd").innerHTML = nInd
    ? `${nInd} variabel faktor${names(sel.independent)}`
    : `Tidak ada<small>Regresi Linier tidak memakai faktor</small>`;
  document.getElementById("mCov").innerHTML = nCov
    ? `${nCov} variabel numerik${names(sel.covariates)}`
    : `Tidak ada<small>Kovariat bersifat opsional</small>`;

  document.getElementById("mCode").textContent = m.code;
  document.getElementById("mFull").textContent = `(${m.full})`;
  document.getElementById("mExplain").textContent =
    (m.isRegression
      ? `Sistem memilih Regresi Linier karena tidak ada faktor (kategori) dan terdapat ${nCov} prediktor numerik untuk 1 variabel dependen.`
      : `Sistem memilih ${m.code} karena data memiliki ${nDep} variabel dependen ` +
    `(${m.multivariate ? "multivariat" : "univariat"}) dan ` +
    (m.hasCov ? `${nCov} kovariat yang dikendalikan.` : "tidak memakai kovariat."));

  document.querySelectorAll(".decision-tree-leaf").forEach((leaf) => {
    const on = leaf.dataset.method === m.code;
    leaf.classList.toggle("selected", on);
    leaf.classList.toggle("dim", !on);
  });

  if (m.isRegression) document.getElementById("metNext").textContent = "Lanjut ke Hasil →";

  card.hidden = false;
});

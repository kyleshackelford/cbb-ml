function toNumber(x) {
  if (x === null || x === undefined) return NaN;
  const s = String(x).replace(/[%,$]/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function fmtPct(x) {
  const n = toNumber(x);
  if (!Number.isFinite(n)) return x ?? "";
  // Your CSV looks like percent values already (e.g., 65.96)
  return `${n.toFixed(2)}%`;
}

function fmtNum(x, digits = 2) {
  const n = toNumber(x);
  if (!Number.isFinite(n)) return x ?? "";
  return n.toFixed(digits);
}

async function loadCSV(path) {
  const resp = await fetch(path, { cache: "no-store" });
  if (!resp.ok) throw new Error(`Failed to fetch ${path} (${resp.status})`);
  const text = await resp.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: resolve,
      error: reject
    });
  });
}

function buildTable(columns, rows) {
  const headerRename = {
    "home team": "Home",
    "away team": "Away",
    "market spread": "Market Spread",
    "market odds": "Market Odds",
    "model mean": "Model Mean",
    "model P(cover)": "Model P(Cover)",
    "model edge": "Edge",
    "model fair odds": "Fair Odds",
    "# members cover": "# Models Cover"
  };

  // Build thead
  const thead = document.querySelector("#picks thead");
  thead.innerHTML = "";
  const tr = document.createElement("tr");
  columns.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = headerRename[c] ?? c;
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Convert objects -> arrays in column order
  const data = rows.map(r => columns.map(c => r[c]));

  const edgeIdx = columns.indexOf("model edge");
  const pIdx = columns.indexOf("model P(cover)");
  const meanIdx = columns.indexOf("model mean");

  const dtColumns = columns.map((c) => {
    const lc = c.toLowerCase();
    if (c === "model P(cover)" || lc.includes("p(cover)")) {
      return { title: headerRename[c] ?? c, render: (d) => fmtPct(d) };
    }
    if (c === "model edge" || lc.includes("edge")) {
      return { title: headerRename[c] ?? c, render: (d) => fmtPct(d) };
    }
    if (c === "model mean" || lc.includes("mean")) {
      return { title: headerRename[c] ?? c, render: (d) => fmtNum(d, 2) };
    }
    return { title: headerRename[c] ?? c };
  });

  // Destroy existing DataTable if present
  if ($.fn.dataTable.isDataTable("#picks")) {
    $("#picks").DataTable().destroy();
    document.querySelector("#picks tbody").innerHTML = "";
  }

  $("#picks").DataTable({
    data,
    columns: dtColumns,
    pageLength: 25,
    order: edgeIdx >= 0 ? [[edgeIdx, "desc"]] : [[0, "asc"]],
    createdRow: function(row, rowData) {
      if (edgeIdx >= 0) {
        const e = toNumber(rowData[edgeIdx]);
        if (Number.isFinite(e) && e >= 6) row.classList.add("edge-great");
        else if (Number.isFinite(e) && e >= 2) row.classList.add("edge-good");
        else if (Number.isFinite(e) && e <= -2) row.classList.add("edge-bad");
      }
    }
  });

  // Status line
  const status = document.getElementById("status");
  status.textContent = `Loaded ${rows.length} games • ${new Date().toLocaleString()}`;
}

(async () => {
  try {
    const parsed = await loadCSV("data/latest.csv");
    if (parsed.errors?.length) console.warn("CSV parse warnings:", parsed.errors);

    const columns = parsed.meta.fields;
    const rows = parsed.data;

    buildTable(columns, rows);
  } catch (err) {
    console.error(err);
    const status = document.getElementById("status");
    status.textContent = `Error: ${err.message}`;
  }
})();


const $ = (id) => document.getElementById(id);
const state = JSON.parse(localStorage.getItem("fire-drill-v2") || "{}");
state.asins = state.asins || [];
state.chargebacks = state.chargebacks || [];
state.fill = state.fill || [];
state.disclaimer = state.disclaimer || "";
state.cause = state.cause || "Confirming above allocated stock";
state.map = state.map || {};
const save = () => localStorage.setItem("fire-drill-v2", JSON.stringify(state));

document.querySelectorAll("nav button").forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("on"));
    document.querySelectorAll("section").forEach((s) => s.classList.remove("on"));
    btn.classList.add("on");
    $(btn.dataset.tab).classList.add("on");
  };
});

function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t") { row.push(cur.trim()); cur = ""; }
    else if (c === "\n") { row.push(cur.trim()); if (row.some(Boolean)) rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  row.push(cur.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function money(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function pct(n) { return (n * 100).toFixed(1) + "%"; }
function num(v) { return Number(String(v || "").replace(/[^0-9.-]/g, "")) || 0; }
function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function pick(headers, aliases) {
  const n = headers.map(norm);
  for (const a of aliases) {
    const i = n.findIndex((h) => h === a || h.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}
function fileText(input, cb) {
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => cb(String(reader.result || ""));
  reader.readAsText(f);
}
function renderMap(host, headers, fields, key) {
  if (!headers.length) { host.innerHTML = ""; return; }
  host.innerHTML = fields.map((f) => {
    const saved = state.map[key + ":" + f.id];
    const opts = headers.map((h, i) => `<option value="${i}" ${String(saved) === String(i) ? "selected" : ""}>${h || "(blank)"}</option>`).join("");
    return `<label>${f.label}</label><select data-map="${key}:${f.id}">${opts}<option value="-1">Ignore</option></select>`;
  }).join("");
  host.querySelectorAll("select").forEach((sel) => {
    sel.onchange = () => { state.map[sel.dataset.map] = Number(sel.value); save(); };
  });
}
function disclaimerReady() { return (state.disclaimer || "").trim().length > 0; }
function renderAsins() {
  const rows = state.asins;
  const ready = rows.filter((r) => r.status === "Ready for APA").length;
  $("asin-stats").innerHTML = [
    ["ASINs", rows.length || "—"],
    ["Legal hold", rows.length ? rows.length - ready : "—"],
    ["Ready", rows.length ? ready : "—"]
  ].map(([k, v]) => `<div class="stat"><b class="${k === "Legal hold" && v && v !== "—" ? "warn" : ""}">${v}</b><span>${k}</span></div>`).join("");
  $("asin-body").innerHTML = rows.length
    ? rows.slice(0, 80).map((r) => `<tr><td>${r.asin}</td><td>${r.where}</td><td class="${r.status === "Ready for APA" ? "ok" : "warn"}">${r.status}</td></tr>`).join("")
    : `<tr><td colspan="3" class="muted">No export loaded.</td></tr>`;
  const text = rows.length ? [
    "Priority: urgent same-day. Do not start until fee and ETA are confirmed in writing.",
    "Ask: submit the approved disclaimer only. No other copy changes.",
    disclaimerReady() ? "Approved disclaimer: " + state.disclaimer.trim() : "Approved disclaimer: NOT IN HAND. Do not start.",
    "ASIN count: " + rows.length,
    "Ready: " + ready + "    Legal hold: " + (rows.length - ready),
    "Fields you may touch: only the placement on each row.",
    "Fields you may not touch: images, price, variations, backend, A+ unless the row says A+.",
    "Proof back: before/after text per ASIN and a live confirmation.",
    "Rollback: if Warner rejects the sentence, revert that ASIN the same day.",
    "",
    ...rows.filter((r) => r.status === "Ready for APA").map((r) => `${r.asin} | ${r.where}`)
  ].join("\n") : "No ASIN export loaded.";
  $("ticket-out").textContent = text;
  const canCopy = disclaimerReady() && ready > 0;
  $("copy-ticket").disabled = !canCopy;
  $("download-ticket").disabled = !canCopy;
  $("ticket-lock").textContent = canCopy ? ready + " ready rows. Copy is on." : "Copy is off until the disclaimer box has text and at least one row is Ready.";
  renderCall();
}
function renderMoney() {
  const rows = state.chargebacks;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byType = {};
  const byWh = {};
  rows.forEach((r) => {
    byType[r.type] = byType[r.type] || { amount: 0, n: 0 };
    byType[r.type].amount += r.amount;
    byType[r.type].n += 1;
    byWh[r.warehouse] = (byWh[r.warehouse] || 0) + r.amount;
  });
  const top = Object.entries(byType).sort((a, b) => b[1].amount - a[1].amount);
  $("cb-stats").innerHTML = [
    ["Dollars", rows.length ? money(total) : "—"],
    ["Rows", rows.length || "—"],
    ["Top type", top[0] ? top[0][0] : "—"]
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("");
  $("cb-body").innerHTML = top.length
    ? top.map(([k, v]) => `<tr><td>${k}</td><td>${money(v.amount)}</td><td>${v.n}</td></tr>`).join("")
    : `<tr><td colspan="3" class="muted">No export loaded.</td></tr>`;
  $("cb-deck").innerHTML = rows.length ? [
    `<div class="slide"><b>1.</b> Warehouse-driven chargebacks listed: ${money(total)} across ${rows.length} rows.</div>`,
    `<div class="slide"><b>2.</b> Three causes: ${top.slice(0, 3).map(([k, v]) => k + " " + money(v.amount)).join("; ") || "none"}.</div>`,
    `<div class="slide"><b>3.</b> Owners: ${Object.entries(byWh).map(([k, v]) => k + " " + money(v)).join("; ")}.</div>`,
    `<div class="slide"><b>4.</b> Ask: confirm from allocated stock, ASN before the carrier, photo of the label before the carton closes.</div>`,
    `<div class="slide"><b>5.</b> Dispute only rows with a contradicting timestamp or pack photo. Do not dispute date-stamped misses with no contradicting EDI or carrier scan.</div>`
  ].join("") : "Load a chargeback export to write the five lines.";
  renderCall();
}
function renderFill() {
  const rows = state.fill;
  const confirmed = rows.reduce((s, r) => s + r.confirmed, 0);
  const shipped = rows.reduce((s, r) => s + r.shipped, 0);
  const rate = confirmed ? shipped / confirmed : null;
  $("fill-stats").innerHTML = [
    ["Fill rate", rate == null ? "—" : pct(rate)],
    ["Confirmed", rows.length ? confirmed.toLocaleString() : "—"],
    ["Short", rows.length ? (confirmed - shipped).toLocaleString() : "—"]
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("");
  const latest = rows[rows.length - 1];
  $("fill-deck").innerHTML = rows.length ? [
    `<div class="slide"><b>1.</b> Period fill rate ${pct(rate)}. Shipped ${shipped.toLocaleString()} over confirmed ${confirmed.toLocaleString()}.</div>`,
    `<div class="slide"><b>2.</b> Latest week ${latest.week}: ${latest.confirmed ? pct(latest.shipped / latest.confirmed) : "n/a"}.</div>`,
    `<div class="slide"><b>3.</b> Short units: ${(confirmed - shipped).toLocaleString()}.</div>`,
    `<div class="slide"><b>4.</b> Cause: ${state.cause}.</div>`,
    `<div class="slide"><b>5.</b> Amazon ask only if a PO window or receiving delay is not on us. Bring the PO list or do not say it.</div>`
  ].join("") : "Load a fill export to write the five lines.";
  renderCall();
}
function renderCall() {
  const rows = state.fill;
  const confirmed = rows.reduce((s, r) => s + r.confirmed, 0);
  const shipped = rows.reduce((s, r) => s + r.shipped, 0);
  const rate = confirmed ? pct(shipped / confirmed) : null;
  const cbs = state.chargebacks;
  const total = cbs.reduce((s, r) => s + r.amount, 0);
  const asins = state.asins;
  const held = asins.filter((r) => r.status !== "Ready for APA").length;
  $("fill-line").textContent = rate ? `Fill rate: ${rate} shipped over confirmed. Cause: ${state.cause}. Fix is already in motion.` : "Fill rate is not loaded. Do not invent a number.";
  $("cb-line").textContent = cbs.length ? `Chargebacks: ${money(total)} across ${cbs.length} rows. Dispute only rows with a contradicting timestamp or pack photo.` : "Chargeback export is not loaded.";
  $("warner-line").textContent = asins.length ? `Warner: ${asins.length} ASINs identified, ${held} on legal hold. Copy frozen. Updates submit the hour approved language is in hand. No live date.` : "Warner: ASINs not loaded. Copy stays frozen. No live date.";
  $("call-stats").innerHTML = [
    ["Fill", rate || "—"],
    ["Chargebacks", cbs.length ? money(total) : "—"],
    ["ASINs held", asins.length ? held : "—"]
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("");
}
function readAsins() {
  const text = $("asin-paste").value.trim();
  if (!text) return;
  const grid = parseCSV(text);
  const headers = grid[0] || [];
  const body = grid.slice(1);
  const fields = [
    { id: "asin", label: "ASIN column" },
    { id: "title", label: "Title column" },
    { id: "bullets", label: "Bullets column" },
    { id: "desc", label: "Description column" }
  ];
  if (state.map["asin:asin"] == null) {
    state.map["asin:asin"] = pick(headers, ["asin"]);
    state.map["asin:title"] = pick(headers, ["title", "item name", "product name"]);
    state.map["asin:bullets"] = pick(headers, ["bullet", "key product"]);
    state.map["asin:desc"] = pick(headers, ["description", "product description"]);
  }
  renderMap($("asin-map"), headers, fields, "asin");
  const idx = (id) => Number(state.map["asin:" + id] ?? -1);
  const sentence = state.disclaimer.trim().toLowerCase();
  state.asins = body.map((r) => {
    const asin = r[idx("asin")] || r[0] || "";
    const title = idx("title") >= 0 ? r[idx("title")] : "";
    const bullets = idx("bullets") >= 0 ? r[idx("bullets")] : "";
    const desc = idx("desc") >= 0 ? r[idx("desc")] : "";
    const blob = (title + " " + bullets + " " + desc).toLowerCase();
    const found = sentence && blob.includes(sentence);
    let where = "Description";
    if (title && sentence && title.toLowerCase().includes(sentence)) where = "Title";
    else if (bullets && sentence && bullets.toLowerCase().includes(sentence)) where = "Bullet";
    else if (!found) where = title ? "Title / bullets / description" : "Unknown placement";
    return { asin, where, status: found ? "Ready for APA" : "Legal hold" };
  }).filter((r) => r.asin && !/^asin$/i.test(r.asin));
  save();
  renderAsins();
}
function readChargebacks() {
  const text = $("cb-paste").value.trim();
  if (!text) return;
  const grid = parseCSV(text);
  const headers = grid[0] || [];
  const body = grid.slice(1);
  const fields = [
    { id: "id", label: "Chargeback id" },
    { id: "wh", label: "Warehouse / FC" },
    { id: "type", label: "Defect type" },
    { id: "amount", label: "Amount" }
  ];
  if (state.map["cb:id"] == null) {
    state.map["cb:id"] = pick(headers, ["chargeback id", "defect id", "id"]);
    state.map["cb:wh"] = pick(headers, ["fulfillment center", "warehouse", "fc", "ship from"]);
    state.map["cb:type"] = pick(headers, ["defect type", "chargeback type", "issue type", "type", "sub type"]);
    state.map["cb:amount"] = pick(headers, ["amount", "chargeback amount", "financial charge", "fee"]);
  }
  renderMap($("cb-map"), headers, fields, "cb");
  const idx = (id) => Number(state.map["cb:" + id] ?? -1);
  state.chargebacks = body.map((r, i) => ({
    id: (idx("id") >= 0 ? r[idx("id")] : r[0]) || ("row-" + (i + 1)),
    warehouse: idx("wh") >= 0 ? (r[idx("wh")] || "Unassigned") : "Unassigned",
    type: idx("type") >= 0 ? (r[idx("type")] || "Other") : (r[2] || "Other"),
    amount: num(idx("amount") >= 0 ? r[idx("amount")] : r[3])
  })).filter((r) => r.amount || r.id);
  save();
  renderMoney();
}
function readFill() {
  const text = $("fill-paste").value.trim();
  if (!text) return;
  const grid = parseCSV(text);
  const headers = grid[0].map(norm);
  const hasHeader = headers.some((h) => h.includes("confirm") || h.includes("ship"));
  const body = hasHeader ? grid.slice(1) : grid;
  const hi = hasHeader ? headers : [];
  const cI = hasHeader ? pick(hi, ["confirmed", "units confirmed", "accepted"]) : 1;
  const sI = hasHeader ? pick(hi, ["shipped", "units shipped"]) : 2;
  const wI = hasHeader ? pick(hi, ["week", "date", "period"]) : 0;
  state.fill = body.map((r) => ({
    week: r[wI] || r[0] || "week",
    confirmed: num(r[cI >= 0 ? cI : 1]),
    shipped: num(r[sI >= 0 ? sI : 2])
  })).filter((r) => r.confirmed);
  state.cause = $("cause").value.trim() || state.cause;
  save();
  renderFill();
}
$("disclaimer").value = state.disclaimer;
$("cause").value = state.cause;
$("disclaimer").oninput = () => { state.disclaimer = $("disclaimer").value; save(); if (state.asins.length) readAsins(); else renderAsins(); };
$("cause").oninput = () => { state.cause = $("cause").value; save(); renderFill(); };
$("asin-file").onchange = () => fileText($("asin-file"), (t) => { $("asin-paste").value = t; readAsins(); });
$("cb-file").onchange = () => fileText($("cb-file"), (t) => { $("cb-paste").value = t; readChargebacks(); });
$("fill-file").onchange = () => fileText($("fill-file"), (t) => { $("fill-paste").value = t; readFill(); });
$("parse-asins").onclick = readAsins;
$("parse-cb").onclick = readChargebacks;
$("parse-fill").onclick = readFill;
$("clear-asins").onclick = () => { state.asins = []; $("asin-paste").value = ""; save(); renderAsins(); };
$("clear-cb").onclick = () => { state.chargebacks = []; $("cb-paste").value = ""; save(); renderMoney(); };
$("clear-fill").onclick = () => { state.fill = []; $("fill-paste").value = ""; save(); renderFill(); };
$("copy-ticket").onclick = async () => {
  if ($("copy-ticket").disabled) return;
  await navigator.clipboard.writeText($("ticket-out").textContent);
  $("copy-ticket").textContent = "Copied";
  setTimeout(() => { $("copy-ticket").textContent = "Copy ticket"; }, 1200);
};
$("download-ticket").onclick = () => {
  const blob = new Blob([$("ticket-out").textContent], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "apa-ticket.txt";
  a.click();
};
renderAsins();
renderMoney();
renderFill();

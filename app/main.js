// Deal Scout — bootstrap, router and filters.
//
// Routes (hash): #/ the deal list, #/deal/<id> one deal's page.
// The list's search, category, store and discount filters and its sort all
// run in the browser against the deals in data.js; nothing is fetched.
//
// window.__shotReady is false while a page renders and true once it is on
// screen, so a screenshot script knows when to capture.

import { CATEGORIES, STORES, deals, discountOf, saveOf } from "./data.js";
import { dealPage, listPage, missingPage } from "./views.js";

const app = document.getElementById("app");

const VERDICT_RANK = { "new-low": 0, strong: 1, routine: 2 };

const state = {
  q: "",
  cat: "all",
  store: "all",
  minoff: "0",
  sort: "discount",
  filtered: deals.slice(),
};

function applyFilters() {
  const q = state.q.trim().toLowerCase();
  let rows = deals.filter((d) => {
    if (state.cat !== "all" && d.category !== state.cat) return false;
    if (state.store !== "all" && d.store !== state.store) return false;
    if (discountOf(d) < Number(state.minoff)) return false;
    if (q) {
      const hay = `${d.title} ${d.store} ${d.category} ${d.verdict}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const by = {
    discount: (a, b) => discountOf(b) - discountOf(a) || saveOf(b) - saveOf(a),
    saving: (a, b) => saveOf(b) - saveOf(a),
    price: (a, b) => a.price - b.price,
    verdict: (a, b) =>
      VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || discountOf(b) - discountOf(a),
  }[state.sort];
  rows.sort(by);
  state.filtered = rows;
}

function counts() {
  return {
    newLow: deals.filter((d) => d.verdict === "new-low").length,
    stores: new Set(deals.map((d) => d.store)).size,
    totalSave: deals.reduce((s, d) => s + saveOf(d), 0),
  };
}

function renderList() {
  applyFilters();
  app.innerHTML = listPage(state, counts());
  const q = document.getElementById("q");
  q.addEventListener("input", () => {
    state.q = q.value;
    renderList();
    const again = document.getElementById("q");
    again.focus();
    again.setSelectionRange(again.value.length, again.value.length);
  });
  app.querySelectorAll(".chip").forEach((button) => {
    button.addEventListener("click", () => {
      state[button.dataset.kind] = button.dataset.value;
      renderList();
    });
  });
  document.getElementById("sort").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderList();
  });
  window.__shotReady = true;
}

function render() {
  window.__shotReady = false;
  const match = location.hash.match(/^#\/deal\/([^/?]+)/);
  if (match) {
    const found = deals.find((d) => d.id === decodeURIComponent(match[1]));
    app.innerHTML = found ? dealPage(found) : missingPage(match[1]);
  } else {
    renderList();
    return;
  }
  window.__shotReady = true;
}

window.addEventListener("hashchange", render);
render();

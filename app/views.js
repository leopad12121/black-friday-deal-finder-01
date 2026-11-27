// Deal Scout — the pages: the deal list and one deal's page.
//
// Every card shows the same facts a shopper needs to act: product, store,
// sale price, usual price, discount, money saved, the verdict on whether
// it is really a deal (with its evidence), a link to the product at the
// store, and when and where the price was checked.

import { CHECKED_LABEL, VERDICTS, deals, discountOf, saveOf } from "./data.js";

export function money(n) {
  return "$" + n.toFixed(2).replace(/\.00$/, "");
}

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function verdictBadge(d) {
  const v = VERDICTS[d.verdict];
  return `<span class="verdict verdict-${d.verdict}" title="${esc(d.evidence)}">${v.short}</span>`;
}

function storeBadge(store) {
  return `<span class="store store-${store.toLowerCase().replace(/[^a-z]/g, "")}">${esc(store)}</span>`;
}

export function dealCard(d) {
  const pct = discountOf(d);
  const also = d.alsoAt
    ? `<p class="also">Also ${d.alsoAt.map((a) => `${esc(a.store)} ${money(a.price)}`).join(" · ")}</p>`
    : "";
  return `<article class="card">
    <div class="card-top">
      ${storeBadge(d.store)}
      <span class="cat">${esc(d.category)}</span>
      ${verdictBadge(d)}
    </div>
    <h3><a href="#/deal/${d.id}">${esc(d.title)}</a></h3>
    <p class="prices"><span class="now">${money(d.price)}</span>
      <span class="was">${money(d.was)}</span>
      <span class="off">−${pct}% · save ${money(saveOf(d))}</span></p>
    <p class="evidence">${esc(d.evidence)}</p>
    ${also}
    <p class="meta">Checked ${esc(CHECKED_LABEL)} · ${esc(d.source)}</p>
    <p class="actions"><a class="buy" href="${esc(d.url)}" target="_blank" rel="noopener">View at ${esc(d.store)} ↗</a>
    <a class="details" href="#/deal/${d.id}">Why this is a deal →</a></p>
  </article>`;
}

// ---------- the list ----------

export function listPage(state, counts) {
  const rows = state.filtered;
  const cards = rows.map(dealCard).join("\n");
  const totalSave = rows.reduce((s, d) => s + saveOf(d), 0);
  return `<section class="intro">
    <p class="lede"><strong>${deals.length} Black Friday and Cyber Monday deals</strong>, each
    checked by hand on ${esc(CHECKED_LABEL)} at the store or in a deals source that names
    the store. Every card says whether it is really a deal — a new low, a strong price,
    or a routine sale — and on what evidence. Prices move fast: verify at the store before you buy.</p>
    <div class="stats">
      <div class="stat"><b>${deals.length}</b><span>deals checked</span></div>
      <div class="stat"><b>${counts.newLow}</b><span>new lows</span></div>
      <div class="stat"><b>${counts.stores}</b><span>stores</span></div>
      <div class="stat"><b>${money(counts.totalSave)}</b><span>total savings</span></div>
    </div>
  </section>
  <section class="controls" aria-label="Search and filter deals">
    <input id="q" type="search" placeholder="Search deals — try “OLED”, “LEGO”, “vacuum”…" value="${esc(state.q)}" aria-label="Search deals">
    <div class="chips" role="group" aria-label="Category">
      ${chip("cat", "all", "All categories", state.cat)}
      ${["Audio", "TVs", "Laptops", "Wearables", "Gaming", "Smart home", "Home & kitchen", "Toys"]
        .map((c) => chip("cat", c, c, state.cat))
        .join("")}
    </div>
    <div class="chips" role="group" aria-label="Store">
      ${chip("store", "all", "All stores", state.store)}
      ${["Amazon", "Best Buy", "Walmart", "Samsung", "Dell"]
        .map((s) => chip("store", s, s, state.store))
        .join("")}
    </div>
    <div class="chips" role="group" aria-label="Discount">
      ${chip("minoff", "0", "Any discount", state.minoff)}
      ${chip("minoff", "20", "20% off or more", state.minoff)}
      ${chip("minoff", "40", "40% off or more", state.minoff)}
      ${chip("minoff", "50", "50% off or more", state.minoff)}
    </div>
    <div class="chips" role="group" aria-label="Sort">
      <label class="sort-label" for="sort">Sort</label>
      <select id="sort">
        <option value="discount" ${state.sort === "discount" ? "selected" : ""}>Biggest discount first</option>
        <option value="saving" ${state.sort === "saving" ? "selected" : ""}>Biggest saving first</option>
        <option value="price" ${state.sort === "price" ? "selected" : ""}>Lowest price first</option>
        <option value="verdict" ${state.sort === "verdict" ? "selected" : ""}>Best verdict first</option>
      </select>
    </div>
  </section>
  <p class="count" role="status">Showing <strong>${rows.length}</strong> of ${deals.length} deals
    ${rows.length ? `· <strong>${money(totalSave)}</strong> combined savings` : "— try clearing a filter"}</p>
  <section class="grid" aria-label="Deals">
    ${cards || `<p class="empty">No deals match those filters. Clear the search or pick another category.</p>`}
  </section>
  <section class="legend">
    <h2>How to read a deal</h2>
    <dl>
      <dt><span class="verdict verdict-new-low">NEW LOW</span></dt>
      <dd>The lowest price anyone has tracked for this product. Buy with confidence.</dd>
      <dt><span class="verdict verdict-strong">STRONG</span></dt>
      <dd>A deep, genuine cut — roughly 30% or more off, or $100+ saved.</dd>
      <dt><span class="verdict verdict-routine">ROUTINE</span></dt>
      <dd>A real cut, but a small one. The list price does most of the work — buy it for the product, not the discount.</dd>
    </dl>
    <p>“Also at” compares the same product at another store, so one store's tag never decides alone.
    Every price was read on ${esc(CHECKED_LABEL)}; a deal can sell out or change after that.</p>
  </section>`;
}

function chip(kind, value, label, current) {
  const on = String(current) === String(value) ? " on" : "";
  return `<button type="button" class="chip${on}" data-kind="${kind}" data-value="${esc(value)}">${esc(label)}</button>`;
}

// ---------- one deal ----------

export function dealPage(d) {
  const pct = discountOf(d);
  const also = d.alsoAt
    ? `<section class="compare"><h2>Same product, other stores</h2>
      <table><thead><tr><th>Store</th><th>Price</th><th>Compared with this deal</th></tr></thead><tbody>
      <tr><td><strong>${esc(d.store)}</strong></td><td><strong>${money(d.price)}</strong></td><td>this deal</td></tr>
      ${d.alsoAt
        .map(
          (a) =>
            `<tr><td>${esc(a.store)}</td><td>${money(a.price)}</td><td>${
              a.price === d.price
                ? "same price"
                : a.price > d.price
                  ? `${money(a.price - d.price)} more`
                  : `${money(d.price - a.price)} less`
            }</td></tr>`,
        )
        .join("")}
      </tbody></table></section>`
    : `<section class="compare"><h2>Same product, other stores</h2>
      <p>No other store was checked for this exact product. The price above is the one ${esc(d.store)} showed.</p></section>`;
  return `<p class="back"><a href="#/">← All deals</a></p>
  <article class="detail">
    <div class="card-top">${storeBadge(d.store)}<span class="cat">${esc(d.category)}</span>${verdictBadge(d)}</div>
    <h2>${esc(d.title)}</h2>
    <p class="prices big"><span class="now">${money(d.price)}</span>
      <span class="was">${money(d.was)}</span>
      <span class="off">−${pct}% · save ${money(saveOf(d))}</span></p>
    <section class="why"><h2>Is it really a deal?</h2>
      <p><strong>${VERDICTS[d.verdict].label}.</strong> ${esc(d.evidence)}</p></section>
    <section class="proof"><h2>Where the price was read</h2>
      <dl>
        <dt>Store</dt><dd>${esc(d.store)}</dd>
        <dt>Checked</dt><dd>${esc(CHECKED_LABEL)}</dd>
        <dt>Source</dt><dd>${esc(d.source)}</dd>
        <dt>Usual price</dt><dd>${money(d.was)} — the store's own list price as reported by that source</dd>
      </dl>
      <p class="actions"><a class="buy" href="${esc(d.url)}" target="_blank" rel="noopener">View at ${esc(d.store)} ↗</a></p>
      <p class="note">Prices change and stock runs out. This page shows the price as checked;
      the store's page is the final word.</p>
    </section>
    ${also}
  </article>`;
}

export function missingPage(id) {
  return `<p class="back"><a href="#/">← All deals</a></p>
  <p class="empty">No deal with the id “${esc(id)}” is on this board.</p>`;
}

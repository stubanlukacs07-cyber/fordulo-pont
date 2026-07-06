/* =====================================================================
   FORDULÓ. — megosztott JavaScript
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) BEÁLLÍTÁSOK — ide illeszd be a GHL "Inbound Webhook" URL-eket.
   Amíg üresek, az űrlapok DEMO módban futnak (nem küldenek sehova,
   csak megjelenítik a sikeres visszajelzést és a konzolra írják az adatot).
--------------------------------------------------------------------- */
const FORDULO_CONFIG = {
  reservationWebhook: "", // Asztalfoglalás   -> GHL inbound webhook URL
  eventWebhook:       "", // Rendezvény/ajánlatkérés -> GHL inbound webhook URL
  contactWebhook:     ""  // Kapcsolat üzenet -> GHL inbound webhook URL
};

/* --------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", function () {

  /* ---- Lábléc évszám ---- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Mobil menü ---- */
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("navMenu");
  if (toggle && menu) {
    const closeMenu = function () {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    };
    toggle.addEventListener("click", function () {
      const open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("nav-open", open);
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    // kattintás a menün kívül -> bezár
    document.addEventListener("click", function (e) {
      if (!menu.classList.contains("is-open")) return;
      if (menu.contains(e.target) || toggle.contains(e.target)) return;
      closeMenu();
    });
    // Escape -> bezár
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---- Header árnyék görgetésre ---- */
  const header = document.getElementById("siteHeader");
  if (header) {
    const onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- "Ma nyitva" kiemelés a hero-ban és a nyitvatartásnál ---- */
  // Sorrend: 0=Vasárnap ... 6=Szombat
  // Nyitva: H–Cs 7:00–18:00, P 7:00–19:00, Szo 7:00–19:00, V 7:00–18:00
  const HOURS = {
    0: "7:00–18:00", // V
    1: "7:00–18:00", // H
    2: "7:00–18:00", // K
    3: "7:00–18:00", // Sze
    4: "7:00–18:00", // Cs
    5: "7:00–19:00", // P
    6: "7:00–19:00"  // Szo
  };
  const today = new Date().getDay();
  const todayTimeEl = document.getElementById("todayTime");
  if (todayTimeEl) todayTimeEl.textContent = HOURS[today];
  document.querySelectorAll(".hours__row[data-days]").forEach(function (row) {
    const days = row.getAttribute("data-days").split(",").map(Number);
    if (days.includes(today)) row.classList.add("is-today");
  });

  /* ---- Scroll reveal ---- */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---- FAQ harmonika ---- */
  document.querySelectorAll(".faq-q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const panel = btn.nextElementSibling;
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      panel.style.maxHeight = open ? null : panel.scrollHeight + "px";
    });
  });

  /* ---- Galéria lightbox (ha van valódi kép) ---- */
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    const lbImg = lightbox.querySelector("img");
    document.querySelectorAll(".tile img").forEach(function (img) {
      img.style.cursor = "zoom-in";
      img.addEventListener("click", function () {
        lbImg.src = img.src; lbImg.alt = img.alt || "";
        lightbox.classList.add("is-open");
      });
    });
    lightbox.addEventListener("click", function () { lightbox.classList.remove("is-open"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") lightbox.classList.remove("is-open"); });
  }

  /* ---- Űrlapok ---- */
  document.querySelectorAll("form[data-form]").forEach(initForm);
  document.querySelectorAll("form.booking").forEach(initBooking);
});

/* =====================================================================
   Küldés — webhook, vagy DEMO mód, ha nincs URL beállítva
===================================================================== */
async function sendForm(type, data) {
  data.form_type = type;
  data.source = "fordulo.hu";
  data.submitted_at = new Date().toISOString();
  const map = {
    reservation: FORDULO_CONFIG.reservationWebhook,
    event: FORDULO_CONFIG.eventWebhook,
    contact: FORDULO_CONFIG.contactWebhook
  };
  const url = map[type];
  if (url) {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  } else {
    console.info("[Forduló Pont DEMO] Nincs webhook beállítva ehhez:", type, data);
    await new Promise(function (r) { setTimeout(r, 600); });
  }
}

function collect(scope) {
  const data = {};
  scope.querySelectorAll("input, select, textarea").forEach(function (el) {
    if (!el.name) return;
    if (el.type === "checkbox") data[el.name] = el.checked ? "igen" : "nem";
    else data[el.name] = el.value;
  });
  return data;
}

function validateScope(scope) {
  let ok = true, first = null;
  scope.querySelectorAll("[required]").forEach(function (input) {
    const wrap = input.closest(".field, .consent");
    const filled = input.type === "checkbox" ? input.checked : String(input.value).trim() !== "";
    const emailOk = input.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    if (!filled || !emailOk) { ok = false; if (wrap) wrap.classList.add("has-error"); if (!first) first = input; }
    else if (wrap) wrap.classList.remove("has-error");
  });
  return { ok: ok, first: first };
}

/* =====================================================================
   Általános űrlap (Kapcsolat)
===================================================================== */
function initForm(form) {
  const type = form.getAttribute("data-form");
  const status = form.querySelector(".form-status");
  const submitBtn = form.querySelector("[type=submit]");
  const successMsg = {
    reservation: "Köszönjük! A foglalási kérésedet megkaptuk, hamarosan visszaigazoljuk.",
    event: "Köszönjük az érdeklődést! Hamarosan keresünk egyedi ajánlattal.",
    contact: "Köszönjük az üzenetet! Igyekszünk mielőbb válaszolni."
  };

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (status) { status.className = "form-status"; status.textContent = ""; }
    const v = validateScope(form);
    if (!v.ok) {
      if (status) { status.className = "form-status is-err"; status.textContent = "Kérlek, töltsd ki a csillaggal jelölt mezőket helyesen."; }
      if (v.first) v.first.focus();
      return;
    }
    const data = collect(form);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.label = submitBtn.textContent; submitBtn.textContent = "Küldés…"; }
    try {
      await sendForm(type, data);
      if (status) { status.className = "form-status is-ok"; status.textContent = successMsg[type]; }
      form.reset();
    } catch (err) {
      console.error(err);
      if (status) { status.className = "form-status is-err"; status.textContent = "Hiba történt a küldés közben. Kérlek, próbáld újra, vagy írj nekünk e-mailben."; }
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.label || "Küldés"; }
      if (status) status.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  form.querySelectorAll("input, select, textarea").forEach(function (input) {
    input.addEventListener("input", function () { const w = input.closest(".field, .consent"); if (w) w.classList.remove("has-error"); });
  });
}

/* =====================================================================
   Foglalás / ajánlatkérés varázsló (naptárral, lépésenként)
===================================================================== */
function initBooking(form) {
  const type = form.getAttribute("data-type"); // reservation | event
  const steps = Array.prototype.slice.call(form.querySelectorAll("[data-step]"));
  const progress = form.querySelectorAll("[data-progress] li");
  const status = form.querySelector(".form-status");
  const done = form.querySelector("[data-done]");
  const doneMsg = form.querySelector("[data-done-msg]");
  const submitBtn = form.querySelector("[data-submit]");
  let current = 0;

  // naptár + időpontok
  const calHost = form.querySelector("[data-calendar]");
  const dateInput = form.querySelector('[name="datum"]');
  const timeInput = form.querySelector('[name="idopont"]');
  const slotsBox = form.querySelector("[data-slots]");
  const slotGrid = form.querySelector("[data-slot-grid]");
  const dateLabel = form.querySelector("[data-date-label]");

  if (calHost) {
    buildCalendar(calHost, function (date, iso) {
      if (dateInput) dateInput.value = iso;
      if (dateLabel) dateLabel.textContent = formatDateHu(date);
      if (timeInput) timeInput.value = "";
      if (slotsBox && slotGrid) {
        slotGrid.innerHTML = "";
        slotsForDate(date).forEach(function (t) {
          const b = document.createElement("button");
          b.type = "button"; b.className = "slot"; b.textContent = t;
          b.addEventListener("click", function () {
            slotGrid.querySelectorAll(".slot").forEach(function (s) { s.classList.remove("is-selected"); });
            b.classList.add("is-selected");
            if (timeInput) timeInput.value = t;
            hideErr();
          });
          slotGrid.appendChild(b);
        });
        slotsBox.hidden = false;
      }
      hideErr();
    });
  }

  function showStep(i, scroll) {
    steps.forEach(function (s, idx) { s.classList.toggle("is-active", idx === i); });
    progress.forEach(function (p, idx) {
      p.classList.toggle("is-current", idx === i);
      p.classList.toggle("is-done", idx < i);
    });
    current = i;
    if (scroll) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function stepErrEl() { return steps[current].querySelector("[data-step-error]"); }
  function showErr(msg) { const e = stepErrEl(); if (e) { if (msg) e.textContent = msg; e.hidden = false; } }
  function hideErr() { const e = stepErrEl(); if (e) e.hidden = true; }

  form.querySelectorAll("[data-next]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const v = validateScope(steps[current]);
      if (!v.ok) { showErr(); if (v.first && v.first.focus) v.first.focus(); return; }
      hideErr();
      showStep(Math.min(current + 1, steps.length - 1), true);
    });
  });
  form.querySelectorAll("[data-back]").forEach(function (btn) {
    btn.addEventListener("click", function () { hideErr(); showStep(Math.max(current - 1, 0), true); });
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const v = validateScope(steps[current]);
    if (!v.ok) { showErr(); if (v.first && v.first.focus) v.first.focus(); return; }
    if (status) { status.className = "form-status"; status.textContent = ""; }
    const data = collect(form);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.label = submitBtn.textContent; submitBtn.textContent = "Küldés…"; }
    try {
      await sendForm(type, data);
      if (done) {
        steps.forEach(function (s) { s.classList.remove("is-active"); s.style.display = "none"; });
        const prog = form.querySelector("[data-progress]"); if (prog) prog.style.display = "none";
        done.hidden = false;
        done.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch (err) {
      console.error(err);
      if (status) { status.className = "form-status is-err"; status.textContent = "Hiba történt a küldés közben. Kérlek, próbáld újra, vagy írj nekünk e-mailben."; }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.label || "Küldés"; }
    }
  });

  form.querySelectorAll("input, select, textarea").forEach(function (input) {
    input.addEventListener("input", function () { const w = input.closest(".field, .consent"); if (w) w.classList.remove("has-error"); hideErr(); });
    input.addEventListener("change", function () { hideErr(); });
  });

  showStep(0, false);
}

/* ---- Naptár építő (hétfő-első, múltbeli napok tiltva) ---- */
function buildCalendar(host, onSelect) {
  const MONTHS = ["Január","Február","Március","Április","Május","Június","Július","Augusztus","Szeptember","Október","November","December"];
  const DOW = ["H","K","Sze","Cs","P","Szo","V"];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const view = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = null;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function render() {
    host.innerHTML = "";
    const head = el("div", "cal__head");
    const prev = el("button", "cal__nav"); prev.type = "button"; prev.textContent = "‹"; prev.setAttribute("aria-label", "Előző hónap");
    const title = el("div", "cal__title"); title.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
    const next = el("button", "cal__nav"); next.type = "button"; next.textContent = "›"; next.setAttribute("aria-label", "Következő hónap");
    const curStart = new Date(today.getFullYear(), today.getMonth(), 1);
    if (view <= curStart) prev.disabled = true;
    prev.addEventListener("click", function () { view.setMonth(view.getMonth() - 1); render(); });
    next.addEventListener("click", function () { view.setMonth(view.getMonth() + 1); render(); });
    head.appendChild(prev); head.appendChild(title); head.appendChild(next);
    host.appendChild(head);

    const dows = el("div", "cal__dow");
    DOW.forEach(function (d) { const s = el("span"); s.textContent = d; dows.appendChild(s); });
    host.appendChild(dows);

    const grid = el("div", "cal__grid");
    const firstDow = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
    for (let i = 0; i < firstDow; i++) { grid.appendChild(el("span", "cal__cell is-empty")); }
    const dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d); date.setHours(0, 0, 0, 0);
      const cell = el("button", "cal__cell"); cell.type = "button"; cell.textContent = d;
      if (date < today) { cell.disabled = true; cell.classList.add("is-past"); }
      if (date.getTime() === today.getTime()) cell.classList.add("is-today");
      if (selected && date.getTime() === selected.getTime()) cell.classList.add("is-selected");
      cell.addEventListener("click", function () { selected = date; render(); onSelect(date, iso(date)); });
      grid.appendChild(cell);
    }
    host.appendChild(grid);
  }
  render();
}

/* ---- Időpontok a nyitvatartás szerint (30 perces bontás) ---- */
function slotsForDate(date) {
  const H = { 0: [7, 18], 1: [7, 18], 2: [7, 18], 3: [7, 18], 4: [7, 18], 5: [7, 19], 6: [7, 19] };
  const range = H[date.getDay()]; const out = [];
  for (let h = range[0]; h < range[1]; h++) { out.push(h + ":00"); out.push(h + ":30"); }
  return out;
}

/* ---- Dátum kiírása magyarul ---- */
function formatDateHu(date) {
  const NAP = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  return date.getFullYear() + ". " + pad(date.getMonth() + 1) + ". " + pad(date.getDate()) + ". (" + NAP[date.getDay()] + ")";
}

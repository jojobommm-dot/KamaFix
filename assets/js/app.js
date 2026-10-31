/* Логика страниц KamaFix. Страница определяется по атрибуту data-page у <main>. */
(function () {
  "use strict";
  var K = window.KamaFix;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var MAIN_BRANDS = ["Apple", "Samsung", "Xiaomi", "Honor", "Huawei"];
  var PROBLEM_ORDER = ["screen", "battery", "charging", "camera", "water", "diagnostics"];
  var QUALITY_LABEL = { original: "оригинал", oled: "копия OLED", analog: "аналог", econom: "эконом" };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(key, value) {
    try {
      if (value === undefined) { var v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; }
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }
  function findModel(data, id) {
    return data.models.filter(function (m) { return m.id === id; })[0] || null;
  }
  function serviceName(data, repairId, quality, withQuality) {
    var name = data.repairs[repairId].name;
    var parts = findPartsCount(data, repairId);
    if (withQuality && quality && parts > 1) name += " (" + QUALITY_LABEL[quality] + ")";
    return name;
  }
  function findPartsCount(data, repairId) {
    var max = 0;
    data.models.forEach(function (m) { var r = m.repairs[repairId]; if (r) max = Math.max(max, Object.keys(r.parts || {}).length); });
    return max;
  }
  function loadError(el) {
    if (el) el.innerHTML = '<p class="empty">Не удалось загрузить цены. Обновите страницу или позвоните нам: +7 (900) 000-00-00.</p>';
  }
  /** Сохраняет выбор для формы записи на странице «Контакты». */
  function rememberOrder(q, data) {
    store("kamafix:order", {
      model: q.model.name,
      service: serviceName(data, q.repairId, q.quality, true),
      total: q.total
    });
  }

  /* ---------- Шапка: мобильное меню ---------- */
  var burger = $(".burger");
  if (burger) burger.addEventListener("click", function () {
    var header = $(".site-header");
    var open = header.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });

  var main = $("main[data-page]");
  if (!main) return;
  var page = main.getAttribute("data-page");

  K.load().then(function (data) {
    if (page === "home") home(data);
    if (page === "services") services(data);
    if (page === "calculator") calculator(data);
    if (page === "contacts") contacts(data);
  }).catch(function (err) {
    console.error(err);
    if (page === "contacts") contacts(null);
    loadError($("[data-load-error]"));
  });

  /* ---------- Главная ---------- */
  function home(data) {
    var modelSel = $("#quick-model"), repairSel = $("#quick-repair");
    modelSel.innerHTML = data.models.map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.name === "iPhone 13" ? " selected" : "") + ">" + esc(m.name) + "</option>";
    }).join("");
    repairSel.innerHTML = PROBLEM_ORDER.concat(["back"]).map(function (id) {
      return '<option value="' + id + '">' + esc(data.repairs[id].name) + "</option>";
    }).join("");

    function render() {
      var q = K.quote(findModel(data, modelSel.value), repairSel.value);
      if (!q) return;
      $("#quick-part").textContent = q.part.count ? K.money(q.part.avg) : "не нужна";
      $("#quick-labor").textContent = q.labor ? K.money(q.labor) : "бесплатно";
      $("#quick-total").textContent = K.money(q.total);
      rememberOrder(q, data);
      store("kamafix:calc", { model: q.model.id, repair: q.repairId, quality: q.quality });
    }
    modelSel.addEventListener("change", render);
    repairSel.addEventListener("change", render);
    render();

    // «от … ₽» для карточек услуг: самый дешёвый вариант по всем моделям
    $$("[data-from]").forEach(function (el) {
      var id = el.getAttribute("data-from"), min = Infinity;
      data.models.forEach(function (m) {
        var r = m.repairs[id]; if (!r) return;
        var qs = Object.keys(r.parts || {});
        (qs.length ? qs : [null]).forEach(function (qid) {
          var q = K.quote(m, id, qid); if (q && q.total < min) min = q.total;
        });
      });
      if (isFinite(min)) el.textContent = min === 0 ? "0 ₽" : "от " + K.money(Math.ceil(min / 100) * 100);
    });
  }

  /* ---------- Услуги и цены ---------- */
  function services(data) {
    var PAGE = 10;
    var rows = [];
    data.models.forEach(function (m) {
      ["screen", "battery", "charging", "camera", "back", "water"].forEach(function (rid) {
        var r = m.repairs[rid]; if (!r) return;
        var qs = Object.keys(r.parts || {});
        (qs.length ? qs : [null]).forEach(function (qid) {
          var q = K.quote(m, rid, qid);
          rows.push({ q: q, name: serviceName(data, rid, q.quality, true) });
        });
      });
    });
    var state = { brand: "Все", query: "", shown: PAGE };
    var tbody = $("#price-rows"), more = $("#show-more"), search = $("#price-search");

    $("#updated").textContent = "Цены на запчасти обновлены " + K.updatedLabel(data) +
      " · средняя по " + data.suppliers.length + " поставщикам";

    function filtered() {
      var needle = state.query.trim().toLowerCase();
      return rows.filter(function (r) {
        if (state.brand !== "Все" && r.q.model.brand !== state.brand) return false;
        if (!needle) return true;
        return (r.q.model.name + " " + r.name).toLowerCase().indexOf(needle) >= 0;
      });
    }
    function render() {
      var list = filtered();
      var visible = list.slice(0, state.shown);
      tbody.innerHTML = visible.length ? visible.map(function (r, i) {
        var q = r.q;
        return '<tr data-i="' + rows.indexOf(r) + '" tabindex="0" title="Открыть в калькуляторе">' +
          "<td>" + esc(q.model.name) + "</td>" +
          "<td>" + esc(r.name) + "</td>" +
          '<td class="num">' + (q.part.count ? K.money(q.part.avg) : "—") + "</td>" +
          '<td class="num">' + K.money(q.labor) + "</td>" +
          '<td class="num total-cell">' + K.money(q.total) + "</td>" +
          "<td>" + esc(q.duration) + "</td></tr>";
      }).join("") : '<tr><td colspan="6" class="empty">Ничего не нашли. Попробуйте другую модель или откройте калькулятор.</td></tr>';
      more.hidden = list.length <= state.shown;
    }
    function open(tr) {
      var r = rows[+tr.getAttribute("data-i")]; if (!r) return;
      store("kamafix:calc", { model: r.q.model.id, repair: r.q.repairId, quality: r.q.quality });
      location.href = "calculator.html";
    }
    tbody.addEventListener("click", function (e) { var tr = e.target.closest("tr[data-i]"); if (tr) open(tr); });
    tbody.addEventListener("keydown", function (e) { var tr = e.target.closest("tr[data-i]"); if (tr && e.key === "Enter") open(tr); });
    $$("#brand-chips .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        $$("#brand-chips .chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        state.brand = chip.textContent.trim(); state.shown = PAGE; render();
      });
    });
    search.addEventListener("input", function () { state.query = search.value; state.shown = PAGE; render(); });
    more.addEventListener("click", function () { state.shown += PAGE; render(); });
    render();
  }

  /* ---------- Калькулятор ---------- */
  function calculator(data) {
    var saved = store("kamafix:calc") || {};
    var hashRepair = location.hash.replace("#", "");
    var startModel = findModel(data, saved.model) || findModel(data, "iphone-13") || data.models[0];
    var state = {
      brand: MAIN_BRANDS.indexOf(startModel.brand) >= 0 ? startModel.brand : "Другой",
      model: startModel.id,
      repair: data.repairs[hashRepair] ? hashRepair : (saved.repair || "screen"),
      quality: saved.quality || "original",
      showAll: false
    };
    var modelSel = $("#calc-model");

    // Шаг 1: производитель
    $$("#calc-brands .chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.brand = chip.getAttribute("data-brand");
        var first = data.models.filter(brandFilter)[0];
        if (first) state.model = first.id;
        render();
      });
    });
    function brandFilter(m) {
      return state.brand === "Другой" ? MAIN_BRANDS.indexOf(m.brand) < 0 : m.brand === state.brand;
    }
    // Шаг 2: модель
    modelSel.addEventListener("change", function () { state.model = modelSel.value; render(); });
    // Шаг 3: неисправность
    var problems = $("#calc-problems");
    problems.innerHTML = PROBLEM_ORDER.map(function (id) {
      return '<button type="button" class="option" role="radio" data-repair="' + id + '">' + esc(data.repairs[id].problem) + "</button>";
    }).join("");
    problems.addEventListener("click", function (e) {
      var b = e.target.closest("[data-repair]"); if (!b) return;
      state.repair = b.getAttribute("data-repair"); state.showAll = false; render();
    });
    // Шаг 4: качество
    var qualities = $("#calc-qualities");
    qualities.addEventListener("click", function (e) {
      var b = e.target.closest("[data-quality]"); if (!b) return;
      state.quality = b.getAttribute("data-quality"); state.showAll = false; render();
    });
    $("#sources-toggle").addEventListener("click", function () { state.showAll = !state.showAll; render(); });

    function render() {
      $$("#calc-brands .chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c.getAttribute("data-brand") === state.brand)); });
      var models = data.models.filter(brandFilter);
      modelSel.innerHTML = models.map(function (m) {
        return '<option value="' + esc(m.id) + '"' + (m.id === state.model ? " selected" : "") + ">" + esc(m.name) + "</option>";
      }).join("");
      var model = findModel(data, state.model);
      $$("[data-repair]", problems).forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-repair") === state.repair)); });

      var q = K.quote(model, state.repair, state.quality);
      if (!q) return;
      if (q.quality) state.quality = q.quality;

      // Варианты качества с примерной ценой запчасти
      $("#step-quality").hidden = q.qualities.length === 0;
      qualities.innerHTML = q.qualities.map(function (qid) {
        var info = data.qualities[qid], avg = K.averagePart(q.repair.parts[qid]).avg;
        return '<button type="button" class="option" role="radio" aria-checked="' + (qid === q.quality) + '" data-quality="' + qid + '">' +
          '<span class="option__title"><span class="radio"></span>' + esc(info.name) + "</span>" +
          '<span class="option__note">' + esc(info.note) + "</span>" +
          '<span class="option__price num">≈ ' + K.money(avg) + "</span></button>";
      }).join("");

      // Итог
      var tags = [model.name, data.repairs[state.repair].problem];
      if (q.quality) tags.push(data.qualities[q.quality].name);
      $("#sum-tags").innerHTML = tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
      $("#sum-part").textContent = q.part.count ? K.money(q.part.avg) : "не нужна";
      $("#sum-part-note").textContent = q.part.count
        ? "по " + q.part.count + " " + plural(q.part.count, "предложению", "предложениям", "предложениям") +
          " · от " + K.money(q.part.min) + " до " + K.money(q.part.max)
        : "только работа мастера";
      $("#sum-labor").textContent = q.labor ? K.money(q.labor) : "бесплатно";
      $("#sum-total").textContent = K.money(q.total);
      $("#sum-hint").textContent = "Цена фиксируется на 3 дня после записи. Срок ремонта: " + q.duration + ".";

      // Источники цены
      var src = $("#sources");
      src.hidden = !q.part.count;
      if (q.part.count) {
        var all = q.part.used.map(function (o) { return { o: o, dropped: false }; })
          .concat(q.part.dropped.map(function (o) { return { o: o, dropped: true }; }));
        var list = state.showAll ? all : all.slice(0, 3);
        $("#sources-list").innerHTML = list.map(function (x) {
          return '<div class="line' + (x.dropped ? " is-dropped" : "") + '"' + (x.dropped ? ' title="Аномальная цена, не учитывается в средней"' : "") +
            "><span>" + esc(x.o.supplier) + (x.dropped ? " · отброшено" : "") + '</span><span class="num">' + K.money(x.o.price) + "</span></div>";
        }).join("");
        var rest = all.length - 3;
        var toggle = $("#sources-toggle");
        toggle.hidden = rest <= 0;
        toggle.textContent = state.showAll ? "Свернуть" : "+ ещё " + rest + " " + plural(rest, "предложение", "предложения", "предложений");
      }

      store("kamafix:calc", { model: model.id, repair: state.repair, quality: q.quality });
      rememberOrder(q, data);
    }
    render();
  }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* ---------- Контакты: форма записи ---------- */
  function contacts() {
    var form = $("#order-form");
    var order = store("kamafix:order");
    if (order && !$("#f-model").value) {
      $("#f-model").value = order.model;
      $("#f-problem").value = order.service + " — по калькулятору " + K.money(order.total);
    }
    var phone = $("#f-phone");
    phone.addEventListener("input", function () {
      var d = phone.value.replace(/\D/g, "").replace(/^[78]/, "").slice(0, 10);
      var out = "+7";
      if (d.length) out += " (" + d.slice(0, 3);
      if (d.length >= 3) out += ") " + d.slice(3, 6);
      if (d.length >= 6) out += "-" + d.slice(6, 8);
      if (d.length >= 8) out += "-" + d.slice(8, 10);
      phone.value = d.length ? out : "";
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("#form-error");
      var digits = phone.value.replace(/\D/g, "");
      if (!$("#f-name").value.trim()) { err.textContent = "Напишите, как к вам обращаться."; err.hidden = false; $("#f-name").focus(); return; }
      if (digits.length !== 11) { err.textContent = "Проверьте номер телефона: нужно 10 цифр после +7."; err.hidden = false; phone.focus(); return; }
      err.hidden = true;
      // TODO: отправить заявку на сервер или в Telegram-бота. Пока заявка никуда не уходит.
      var payload = {
        name: $("#f-name").value.trim(), phone: phone.value,
        model: $("#f-model").value.trim(), problem: $("#f-problem").value.trim()
      };
      console.info("Заявка (демо, не отправлена):", payload);
      form.hidden = true;
      $("#form-success").hidden = false;
    });
  }
})();

/* Расчёт цены: средняя цена запчасти (по данным парсера) + работа мастера.
   Данные берутся из data/prices.json — его перезаписывает парсер. */
(function () {
  "use strict";

  function quantile(sorted, q) {
    var pos = (sorted.length - 1) * q;
    var lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  /** Отбрасывает аномально дешёвые и дорогие предложения (правило 1,5 × IQR)
   *  и возвращает среднюю цену, округлённую до 10 ₽. */
  function averagePart(offers) {
    var list = (offers || []).filter(function (o) { return o && o.price > 0; });
    if (!list.length) return { avg: 0, min: 0, max: 0, used: [], dropped: [], count: 0 };
    var prices = list.map(function (o) { return o.price; }).sort(function (a, b) { return a - b; });
    var low = -Infinity, high = Infinity;
    if (prices.length >= 4) {
      var q1 = quantile(prices, 0.25), q3 = quantile(prices, 0.75), iqr = q3 - q1;
      low = q1 - 1.5 * iqr; high = q3 + 1.5 * iqr;
    }
    var used = [], dropped = [];
    list.forEach(function (o) { (o.price >= low && o.price <= high ? used : dropped).push(o); });
    var sum = used.reduce(function (s, o) { return s + o.price; }, 0);
    var usedPrices = used.map(function (o) { return o.price; });
    return {
      avg: Math.round(sum / used.length / 10) * 10,
      min: Math.min.apply(null, usedPrices),
      max: Math.max.apply(null, usedPrices),
      used: used.slice().sort(function (a, b) { return a.price - b.price; }),
      dropped: dropped,
      count: used.length
    };
  }

  /** Итоговая цена для модели, ремонта и качества запчасти. */
  function quote(model, repairId, qualityId) {
    var repair = model && model.repairs[repairId];
    if (!repair) return null;
    var qualities = Object.keys(repair.parts || {});
    var q = qualities.indexOf(qualityId) >= 0 ? qualityId : qualities[0] || null;
    var part = averagePart(q ? repair.parts[q] : []);
    return {
      model: model, repairId: repairId, repair: repair, quality: q, qualities: qualities,
      part: part, labor: repair.labor || 0, total: part.avg + (repair.labor || 0),
      duration: repair.duration
    };
  }

  var rub = new Intl.NumberFormat("ru-RU");
  function money(n) { return rub.format(n).replace(/ | /g, " ") + " ₽"; }

  var cache = null;
  function load() {
    if (!cache) {
      cache = fetch("data/prices.json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    }
    return cache;
  }

  function updatedLabel(data) {
    var d = new Date(data.updatedAt);
    if (isNaN(d)) return "";
    var today = new Date();
    var time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    var same = d.toDateString() === today.toDateString();
    return (same ? "сегодня" : d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })) + " в " + time;
  }

  window.KamaFix = { averagePart: averagePart, quote: quote, money: money, load: load, updatedLabel: updatedLabel };
})();

"""Генерирует пример data/prices.json (заглушка, пока нет настоящего парсера).

Настоящий парсер должен писать файл в том же формате: для каждой модели,
ремонта и качества запчасти — список предложений поставщиков. Среднюю цену
сайт считает сам (см. assets/js/pricing.js).
"""
import json, random, pathlib

random.seed(42)
SUPPLIERS = [f"Поставщик {i}" for i in range(1, 6)]

REPAIRS = {
    "screen":   {"name": "Замена экрана", "problem": "Разбит экран", "desc": "Оригинальные и совместимые дисплеи, установка за 1 час"},
    "battery":  {"name": "Замена аккумулятора", "problem": "Не держит батарея", "desc": "Новая батарея с гарантией, восстановим автономность"},
    "charging": {"name": "Ремонт разъёма зарядки", "problem": "Не заряжается", "desc": "Чистка или замена разъёма Lightning / USB-C"},
    "camera":   {"name": "Замена камеры", "problem": "Не работает камера", "desc": "Основная и фронтальная камера, стекло камеры"},
    "water":    {"name": "После попадания воды", "problem": "Попала вода", "desc": "Чистка платы и диагностика после залития"},
    "back":     {"name": "Замена задней крышки", "problem": None, "desc": "Стеклянная или пластиковая крышка с клеем"},
    "diagnostics": {"name": "Диагностика", "problem": "Другое", "desc": "Бесплатно при ремонте в нашем сервисе"},
}
QUALITIES = {
    "original": {"name": "Оригинал", "note": "Как с завода, гарантия 90 дней"},
    "oled":     {"name": "Копия OLED", "note": "Отличное качество, гарантия 60 дней"},
    "analog":   {"name": "Аналог", "note": "Качественная копия, гарантия 60 дней"},
    "econom":   {"name": "Эконом", "note": "LCD, гарантия 30 дней"},
}

# brand, name, base screen price (original), oled?, tier labor
MODELS = [
    ("Apple", "iPhone 15", 14500, True, 2000),
    ("Apple", "iPhone 14", 9800, True, 1800),
    ("Apple", "iPhone 13", 6450, True, 1500),
    ("Apple", "iPhone 12", 5600, True, 1500),
    ("Apple", "iPhone 11", 3900, False, 1300),
    ("Apple", "iPhone XR", 2900, False, 1200),
    ("Samsung", "Samsung Galaxy S23", 13800, True, 2000),
    ("Samsung", "Samsung Galaxy S22", 11900, True, 2000),
    ("Samsung", "Samsung Galaxy A54", 5200, True, 1500),
    ("Samsung", "Samsung Galaxy A34", 4300, True, 1500),
    ("Xiaomi", "Xiaomi Redmi Note 13", 3200, True, 1300),
    ("Xiaomi", "Xiaomi Redmi Note 12", 2600, False, 1300),
    ("Xiaomi", "Xiaomi 13T", 7400, True, 1600),
    ("Honor", "Honor X8", 2700, False, 1200),
    ("Honor", "Honor X9a", 4800, True, 1400),
    ("Huawei", "Huawei nova 10", 5900, True, 1500),
    ("Huawei", "Huawei P40 lite", 2400, False, 1200),
    ("Realme", "Realme C55", 2100, False, 1100),
    ("Realme", "Realme 11 Pro", 5300, True, 1400),
]

def offers(avg, n=None, outlier=True):
    n = n or random.randint(6, 14)
    out = []
    for i in range(n):
        p = avg * random.uniform(0.9, 1.1)
        out.append({"supplier": random.choice(SUPPLIERS), "price": int(round(p / 10) * 10)})
    if outlier and n >= 8:  # аномальное предложение — сайт его отбросит
        out.append({"supplier": random.choice(SUPPLIERS), "price": int(round(avg * random.choice([0.35, 1.9]) / 10) * 10)})
    random.shuffle(out)
    return out

def slug(s):
    return s.lower().replace(" ", "-")

models = []
for brand, name, screen, has_oled, labor in MODELS:
    is_apple = brand == "Apple"
    r = {}
    parts = {"original": offers(screen)}
    if has_oled:
        parts["oled"] = offers(screen * 0.6)
    parts["econom"] = offers(screen * 0.36)
    r["screen"] = {"labor": labor, "duration": "2 часа" if labor >= 2000 else "1 час", "parts": parts}
    bat = screen * (0.33 if is_apple else 0.28)
    r["battery"] = {"labor": 900 if is_apple else 1000, "duration": "30 мин" if is_apple else "40 мин",
                    "parts": {"original": offers(bat), "analog": offers(bat * 0.6)}}
    r["charging"] = {"labor": 1200, "duration": "1 час", "parts": {"original": offers(max(350, screen * 0.1))}}
    r["camera"] = {"labor": 1000 if not is_apple else 1400, "duration": "1 час",
                   "parts": {"original": offers(screen * 0.42), "analog": offers(screen * 0.25)}}
    r["back"] = {"labor": 800 if not is_apple else 1500, "duration": "40 мин" if not is_apple else "1,5 часа",
                 "parts": {"original": offers(max(600, screen * 0.18))}}
    r["water"] = {"labor": 1500, "duration": "1 день", "parts": {}}
    r["diagnostics"] = {"labor": 0, "duration": "20 мин", "parts": {}}
    models.append({"id": slug(name), "brand": brand, "name": name, "repairs": r})

data = {
    "updatedAt": "2026-10-31T09:00:00+03:00",
    "currency": "RUB",
    "sample": True,
    "suppliers": SUPPLIERS,
    "repairs": REPAIRS,
    "qualities": QUALITIES,
    "models": models,
}
out = pathlib.Path(__file__).resolve().parent.parent / "data" / "prices.json"
out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", out, len(models), "models")

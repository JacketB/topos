import os
import sys
import json
import sqlite3

def init_address_db(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city TEXT NOT NULL,
            city_normalized TEXT NOT NULL,
            street TEXT NOT NULL,
            street_normalized TEXT NOT NULL,
            house TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_addr_lookup ON addresses (city_normalized, street_normalized, house)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_addr_city ON addresses (city_normalized)")
    conn.commit()
    return conn

def normalize_text(text: str) -> str:
    if not text:
        return ""
    t = text.lower().replace("ё", "е")
    for ch in [".", ",", "-", "/", "\\", "(", ")", '"', "'"]:
        t = t.replace(ch, " ")
    words = t.split()
    clean_words = []
    stop_prefixes = {
        "г", "город", "д", "деревня", "аг", "агрогородок", "п", "пос", "поселок",
        "ул", "улица", "пер", "переулок", "пр", "проспект", "б-р", "бульвар", "тракт",
        "д", "дом", "корп", "к", "кв"
    }
    for w in words:
        if w not in stop_prefixes:
            clean_words.append(w)
    return " ".join(clean_words).strip()

def main():
    target_dir = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "assets")
    os.makedirs(target_dir, exist_ok=True)
    db_path = os.path.join(target_dir, "belarus_addresses.db")
    conn = init_address_db(db_path)
    print(f"Address database initialized at {db_path}")
    conn.close()

if __name__ == "__main__":
    main()

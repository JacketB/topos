import os
import sys
import time
import json
import math
import sqlite3
import osmium

def normalize_text(text: str) -> str:
    if not text:
        return ""
    t = text.lower().replace("ё", "е")
    for ch in [".", ",", "-", "/", "\\", "(", ")", '"', "'", "`", ";", ":"]:
        t = t.replace(ch, " ")
    words = t.split()
    clean_words = []
    stop_prefixes = {
        "г", "город", "д", "деревня", "аг", "агрогородок", "п", "пос", "поселок",
        "ул", "улица", "пер", "переулок", "пр", "проспект", "б-р", "бульвар", "тракт",
        "д", "дом", "корп", "к", "кв", "р-н", "район", "обл", "область"
    }
    for w in words:
        if w not in stop_prefixes:
            clean_words.append(w)
    return " ".join(clean_words).strip()

def normalize_house(house: str) -> str:
    if not house:
        return ""
    h = house.lower().replace("ё", "е").strip()
    h = h.replace(" ", "").replace("/", "").replace("-", "")
    for p in ["корп", "корпус", "стр", "строение", "д", "дом", "к"]:
        if h.startswith(p):
            h = h[len(p):]
    return h

class SpatialPlacesGrid:
    def __init__(self, places_json_path: str):
        self.grid = {}
        self.cell_size = 0.08
        if os.path.exists(places_json_path):
            with open(places_json_path, "r", encoding="utf-8") as f:
                places = json.load(f)
            for p in places:
                coords = p.get("coords")
                name = p.get("name", "")
                if coords and len(coords) == 2 and (coords[0] != 0 or coords[1] != 0):
                    cx = int(coords[0] / self.cell_size)
                    cy = int(coords[1] / self.cell_size)
                    self.grid.setdefault((cx, cy), []).append((coords[0], coords[1], name))

    def find_nearest_city(self, lon: float, lat: float) -> str:
        cx = int(lon / self.cell_size)
        cy = int(lat / self.cell_size)
        best_name = ""
        min_dist_sq = 1e9
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                bucket = self.grid.get((cx + dx, cy + dy))
                if bucket:
                    for p_lon, p_lat, p_name in bucket:
                        d2 = (lon - p_lon) ** 2 + (lat - p_lat) ** 2
                        if d2 < min_dist_sq:
                            min_dist_sq = d2
                            best_name = p_name
        if min_dist_sq < (0.25 ** 2):
            return best_name
        return ""

class AddressExtractor(osmium.SimpleHandler):
    def __init__(self, places_grid: SpatialPlacesGrid, db_cursor, db_conn):
        super().__init__()
        self.places_grid = places_grid
        self.cur = db_cursor
        self.conn = db_conn
        self.batch = []
        self.total = 0
        self.last_report = time.time()

    def process_entry(self, city: str, street: str, house: str, lon: float, lat: float):
        if not street or not house or lon == 0 or lat == 0:
            return
        if not city:
            city = self.places_grid.find_nearest_city(lon, lat)

        city_norm = normalize_text(city)
        street_norm = normalize_text(street)
        house_norm = normalize_house(house)

        self.batch.append((
            city,
            city_norm,
            street,
            street_norm,
            house,
            house_norm,
            lat,
            lon
        ))
        self.total += 1

        if len(self.batch) >= 20000:
            self.flush()

    def flush(self):
        if not self.batch:
            return
        self.cur.executemany("""
            INSERT INTO addresses (city, city_normalized, street, street_normalized, house, house_normalized, lat, lon)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, self.batch)
        self.conn.commit()
        self.batch.clear()

        now = time.time()
        if now - self.last_report >= 5:
            print(f"Extracted {self.total} addresses...", flush=True)
            self.last_report = now

    def node(self, n):
        tags = n.tags
        if 'addr:housenumber' in tags and 'addr:street' in tags:
            city = tags.get('addr:city', tags.get('addr:place', ''))
            street = tags.get('addr:street', '')
            house = tags.get('addr:housenumber', '')
            self.process_entry(city, street, house, n.location.lon, n.location.lat)

    def way(self, w):
        tags = w.tags
        if 'addr:housenumber' in tags and 'addr:street' in tags:
            try:
                nodes = w.nodes
                count = len(nodes)
                if count > 0:
                    lon = sum(n.lon for n in nodes) / count
                    lat = sum(n.lat for n in nodes) / count
                    city = tags.get('addr:city', tags.get('addr:place', ''))
                    street = tags.get('addr:street', '')
                    house = tags.get('addr:housenumber', '')
                    self.process_entry(city, street, house, lon, lat)
            except Exception:
                pass

def main():
    pbf_file = r"C:\Users\user\Downloads\map\belarus.osm.pbf"
    if not os.path.exists(pbf_file):
        print(f"Error: {pbf_file} does not exist!")
        sys.exit(1)

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    places_json = os.path.join(project_root, "src-tauri", "assets", "belarus_places.json")
    out_db = os.path.join(project_root, "src-tauri", "assets", "belarus_addresses.db")

    if os.path.exists(out_db):
        try:
            os.remove(out_db)
        except Exception:
            pass

    print(f"Loading places spatial index from {places_json}...")
    places_grid = SpatialPlacesGrid(places_json)

    print(f"Initializing database at {out_db}...")
    conn = sqlite3.connect(out_db)
    cur = conn.cursor()
    cur.execute("PRAGMA synchronous = OFF")
    cur.execute("PRAGMA journal_mode = MEMORY")
    cur.execute("""
        CREATE TABLE addresses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city TEXT NOT NULL,
            city_normalized TEXT NOT NULL,
            street TEXT NOT NULL,
            street_normalized TEXT NOT NULL,
            house TEXT NOT NULL,
            house_normalized TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL
        )
    """)
    conn.commit()

    print(f"Extracting addresses from {pbf_file}...")
    t0 = time.time()
    extractor = AddressExtractor(places_grid, cur, conn)
    extractor.apply_file(pbf_file, locations=True, idx='flex_mem')
    extractor.flush()

    print(f"Building indexes on {extractor.total} addresses...")
    cur.execute("CREATE INDEX idx_addr_lookup ON addresses (city_normalized, street_normalized, house_normalized)")
    cur.execute("CREATE INDEX idx_addr_street ON addresses (street_normalized, house_normalized)")
    cur.execute("CREATE INDEX idx_addr_city ON addresses (city_normalized)")
    conn.commit()

    print("Optimizing database storage (VACUUM)...")
    cur.execute("VACUUM")
    cur.execute("ANALYZE")
    conn.close()

    total_time = time.time() - t0
    db_size_mb = os.path.getsize(out_db) / (1024 * 1024)
    print(f"Done in {total_time:.1f}s!")
    print(f"Total addresses saved: {extractor.total}")
    print(f"Database size: {db_size_mb:.2f} MB")

if __name__ == '__main__':
    main()

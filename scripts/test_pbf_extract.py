import osmium
import time
import json
import math

class FastAddressScanner(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.count = 0
        self.with_city = 0
        self.without_city = 0
        self.samples = []

    def node(self, n):
        tags = n.tags
        if 'addr:housenumber' in tags and 'addr:street' in tags:
            self.count += 1
            city = tags.get('addr:city', tags.get('addr:place', ''))
            if city:
                self.with_city += 1
            else:
                self.without_city += 1
            if len(self.samples) < 5:
                self.samples.append({
                    'type': 'node',
                    'city': city,
                    'street': tags.get('addr:street'),
                    'house': tags.get('addr:housenumber'),
                    'lat': n.location.lat,
                    'lon': n.location.lon
                })

    def way(self, w):
        tags = w.tags
        if 'addr:housenumber' in tags and 'addr:street' in tags:
            self.count += 1
            city = tags.get('addr:city', tags.get('addr:place', ''))
            if city:
                self.with_city += 1
            else:
                self.without_city += 1
            if len(self.samples) < 10:
                try:
                    nodes = w.nodes
                    if len(nodes) > 0:
                        lat = sum(n.lat for n in nodes) / len(nodes)
                        lon = sum(n.lon for n in nodes) / len(nodes)
                        self.samples.append({
                            'type': 'way',
                            'city': city,
                            'street': tags.get('addr:street'),
                            'house': tags.get('addr:housenumber'),
                            'lat': lat,
                            'lon': lon
                        })
                except Exception:
                    pass

def main():
    pbf_path = r"C:\Users\user\Downloads\map\belarus.osm.pbf"
    print(f"Starting test scan of {pbf_path} with locations...")
    t0 = time.time()
    scanner = FastAddressScanner()
    scanner.apply_file(pbf_path, locations=True, idx='flex_mem')
    dt = time.time() - t0
    print(f"Scan finished in {dt:.1f}s")
    print(f"Total addresses: {scanner.count}")
    print(f"With city tag: {scanner.with_city}")
    print(f"Without city tag: {scanner.without_city}")
    print("Samples:", json.dumps(scanner.samples[:4], ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

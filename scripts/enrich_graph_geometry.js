const fs = require('fs');
const https = require('https');

const graphPath = 'D:\\рабочая\\topos\\src-tauri\\assets\\belarus_graph.json';
const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchGeometry = (lon1, lat1, lon2, lat2) => {
    return new Promise((resolve) => {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.routes && parsed.routes.length > 0 && parsed.routes[0].geometry) {
                        resolve(parsed.routes[0].geometry.coordinates);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => {
            resolve(null);
        });
    });
};

const run = async () => {
    const nodes = new Map(graphData.nodes.map(n => [n.id, n.coords]));
    const pairToGeometry = new Map();
    let processed = 0;
    const total = graphData.edges.length / 2;

    for (const edge of graphData.edges) {
        const f = edge.from;
        const t = edge.to;
        const forwardKey = `${f}-${t}`;
        const backwardKey = `${t}-${f}`;

        if (!pairToGeometry.has(forwardKey) && !pairToGeometry.has(backwardKey)) {
            processed++;
            console.log(`Processing edge ${processed}/${total}...`);
            const c1 = nodes.get(f);
            const c2 = nodes.get(t);
            if (c1 && c2) {
                const geom = await fetchGeometry(c1[0], c1[1], c2[0], c2[1]);
                if (geom) {
                    pairToGeometry.set(forwardKey, geom);
                    pairToGeometry.set(backwardKey, [...geom].reverse());
                }
                await delay(350);
            }
        }
    }

    for (const edge of graphData.edges) {
        const key = `${edge.from}-${edge.to}`;
        edge.geometry = pairToGeometry.get(key) || null;
    }

    fs.writeFileSync(graphPath, JSON.stringify(graphData, null, 2), 'utf8');
    console.log('Finished enriching graph');
};

run();

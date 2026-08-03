const fs = require('fs');
const path = require('path');
const parsePbf = require('osm-pbf-parser');

const pbfPath = path.join(__dirname, 'temp', 'belarus-latest.osm.pbf');
const outTauriPath = path.join(__dirname, '..', 'src-tauri', 'assets', 'belarus_graph.json');
const outPublicPath = path.join(__dirname, '..', 'public', 'assets', 'belarus_graph.json');

const VALID_HIGHWAYS = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
  'unclassified', 'residential', 'track',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
]);

function getDistance(p1, p2) {
  const R = 6371;
  const dLat = (p2[1] - p1[1]) * Math.PI / 180;
  const dLon = (p2[0] - p1[0]) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function roundCoord(c) {
  return [Math.round(c[0] * 100000) / 100000, Math.round(c[1] * 100000) / 100000];
}

function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return Math.hypot(p[0] - projX, p[1] - projY);
}

function simplifyRDP(points, epsilon) {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > epsilon) {
    const rec1 = simplifyRDP(points.slice(0, index + 1), epsilon);
    const rec2 = simplifyRDP(points.slice(index), epsilon);
    return rec1.slice(0, rec1.length - 1).concat(rec2);
  } else {
    return [points[0], points[end]];
  }
}

async function main() {
  console.log('Pass 1: Identifying march road ways and junction nodes...');
  
  const nodeRefCount = new Map();
  const neededNodes = new Set();
  const roadWays = [];

  await new Promise((resolve, reject) => {
    const parser = parsePbf();
    const stream = fs.createReadStream(pbfPath).pipe(parser);
    
    stream.on('data', (items) => {
      for (const item of items) {
        if (item.type === 'way' && item.tags && item.tags.highway && VALID_HIGHWAYS.has(item.tags.highway)) {
          let refs = item.refs;
          if (refs && refs.length >= 2) {
            const owTag = item.tags.oneway;
            const isReverse = owTag === '-1';
            const isOneway = isReverse ||
              owTag === 'yes' || owTag === '1' || owTag === 'true' ||
              item.tags.junction === 'roundabout' ||
              item.tags.highway === 'motorway' ||
              item.tags.highway.endsWith('_link');

            if (isReverse) {
              refs = [...refs].reverse();
            }

            roadWays.push({
              id: item.id,
              refs: refs,
              highway: item.tags.highway,
              oneway: isOneway,
              name: item.tags.name || ''
            });

            for (let i = 0; i < refs.length; i++) {
              const r = refs[i];
              neededNodes.add(r);
              const count = nodeRefCount.get(r) || 0;
              nodeRefCount.set(r, count + 1);
            }
          }
        }
      }
    });

    stream.on('end', resolve);
    stream.on('error', reject);
  });

  console.log(`Found ${roadWays.length} road ways referencing ${neededNodes.size} unique nodes.`);

  console.log('Pass 2: Extracting node coordinates...');
  const nodeCoords = new Map();

  await new Promise((resolve, reject) => {
    const parser = parsePbf();
    const stream = fs.createReadStream(pbfPath).pipe(parser);

    stream.on('data', (items) => {
      for (const item of items) {
        if (item.type === 'node' && neededNodes.has(item.id)) {
          nodeCoords.set(item.id, [item.lon, item.lat]);
        }
      }
    });

    stream.on('end', resolve);
    stream.on('error', reject);
  });

  console.log(`Extracted coordinates for ${nodeCoords.size} nodes.`);

  console.log('Pass 3: Segmenting roads at intersections...');
  
  const junctionNodeSet = new Set();
  for (const [nodeId, count] of nodeRefCount.entries()) {
    if (count >= 2) {
      junctionNodeSet.add(nodeId);
    }
  }

  for (const way of roadWays) {
    if (way.refs.length >= 2) {
      junctionNodeSet.add(way.refs[0]);
      junctionNodeSet.add(way.refs[way.refs.length - 1]);
    }
  }

  console.log(`Total junction nodes (intersections/endpoints): ${junctionNodeSet.size}`);

  const nodeIdToIndex = new Map();
  const nodesOutput = [];
  let nextNodeIdx = 0;

  function getOrAddNodeIdx(nodeId) {
    let idx = nodeIdToIndex.get(nodeId);
    if (idx === undefined) {
      idx = nextNodeIdx++;
      nodeIdToIndex.set(nodeId, idx);
      const rawC = nodeCoords.get(nodeId) || [0, 0];
      nodesOutput.push({
        id: idx,
        coords: roundCoord(rawC)
      });
    }
    return idx;
  }

  const edgesOutput = [];

  for (const way of roadWays) {
    const refs = way.refs;
    let segStart = 0;

    for (let i = 1; i < refs.length; i++) {
      const isJunction = junctionNodeSet.has(refs[i]) || i === refs.length - 1;
      if (isJunction) {
        const fromNodeId = refs[segStart];
        const toNodeId = refs[i];
        const u = getOrAddNodeIdx(fromNodeId);
        const v = getOrAddNodeIdx(toNodeId);

        const rawGeom = [];
        let totalDist = 0;
        let prevC = null;

        for (let k = segStart; k <= i; k++) {
          const rawC = nodeCoords.get(refs[k]);
          if (rawC) {
            const c = roundCoord(rawC);
            if (!prevC || c[0] !== prevC[0] || c[1] !== prevC[1]) {
              rawGeom.push(c);
              if (prevC) {
                totalDist += getDistance(prevC, c);
              }
              prevC = c;
            }
          }
        }

        if (rawGeom.length >= 2) {
          const geom = simplifyRDP(rawGeom, 0.00003);

          edgesOutput.push({
            from: u,
            to: v,
            roadType: way.highway,
            distanceKm: Math.round(totalDist * 1000) / 1000,
            oneWay: way.oneway,
            geometry: geom
          });

          if (!way.oneway) {
            edgesOutput.push({
              from: v,
              to: u,
              roadType: way.highway,
              distanceKm: Math.round(totalDist * 1000) / 1000,
              oneWay: false,
              geometry: [...geom].reverse()
            });
          }
        }

        segStart = i;
      }
    }
  }

  console.log(`Generated ${nodesOutput.length} graph nodes and ${edgesOutput.length} directed edges.`);

  const outputGraph = {
    version: '2.0.0',
    country: 'Belarus',
    nodeCount: nodesOutput.length,
    edgeCount: edgesOutput.length,
    nodes: nodesOutput,
    edges: edgesOutput
  };

  console.log('Serializing graph JSON...');
  const outStream = fs.createWriteStream(outTauriPath);
  outStream.write('{\n"version":"2.0.0",\n"country":"Belarus",\n');
  outStream.write(`"nodeCount":${nodesOutput.length},\n`);
  outStream.write(`"edgeCount":${edgesOutput.length},\n`);
  outStream.write('"nodes":[\n');
  for (let i = 0; i < nodesOutput.length; i++) {
    outStream.write(JSON.stringify(nodesOutput[i]) + (i < nodesOutput.length - 1 ? ',\n' : '\n'));
  }
  outStream.write('],\n"edges":[\n');
  for (let i = 0; i < edgesOutput.length; i++) {
    outStream.write(JSON.stringify(edgesOutput[i]) + (i < edgesOutput.length - 1 ? ',\n' : '\n'));
  }
  outStream.write(']\n}\n');
  outStream.end();

  console.log('Copying to public assets...');
  fs.copyFileSync(outTauriPath, outPublicPath);

  console.log('Dense OSM road graph generated successfully!');
}

main().catch(err => {
  console.error('Error generating dense OSM graph:', err);
  process.exit(1);
});

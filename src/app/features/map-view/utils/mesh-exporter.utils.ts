import { TerrainMeshResult } from '../services/terrain.service';

export class MeshExporterUtils {
  static exportToObj(meshData: TerrainMeshResult, exaggeration: number = 1.0): string {
    const lines: string[] = [];
    lines.push('# Topos GIS 3D Terrain Model');
    lines.push(`o Terrain_${Math.round(meshData.centerLat * 100)}_${Math.round(meshData.centerLng * 100)}`);

    const v = meshData.vertices;
    for (let i = 0; i < v.length; i += 3) {
      const x = v[i];
      const y = (v[i + 1] - meshData.minElevation) * exaggeration;
      const z = v[i + 2];
      lines.push(`v ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
    }

    const uvs = meshData.uvs;
    for (let i = 0; i < uvs.length; i += 2) {
      lines.push(`vt ${uvs[i].toFixed(4)} ${uvs[i + 1].toFixed(4)}`);
    }

    const n = meshData.normals;
    for (let i = 0; i < n.length; i += 3) {
      lines.push(`vn ${n[i].toFixed(4)} ${n[i + 1].toFixed(4)} ${n[i + 2].toFixed(4)}`);
    }

    const idx = meshData.indices;
    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i] + 1;
      const i1 = idx[i + 1] + 1;
      const i2 = idx[i + 2] + 1;
      lines.push(`f ${i0}/${i0}/${i0} ${i1}/${i1}/${i1} ${i2}/${i2}/${i2}`);
    }

    return lines.join('\n');
  }

  static exportToStl(meshData: TerrainMeshResult, exaggeration: number = 1.0): string {
    const lines: string[] = [];
    lines.push('solid ToposTerrain');

    const v = meshData.vertices;
    const n = meshData.normals;
    const idx = meshData.indices;

    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i];
      const i1 = idx[i + 1];
      const i2 = idx[i + 2];

      const nx = (n[i0 * 3] + n[i1 * 3] + n[i2 * 3]) / 3;
      const ny = (n[i0 * 3 + 1] + n[i1 * 3 + 1] + n[i2 * 3 + 1]) / 3;
      const nz = (n[i0 * 3 + 2] + n[i1 * 3 + 2] + n[i2 * 3 + 2]) / 3;

      lines.push(`  facet normal ${nx.toFixed(4)} ${ny.toFixed(4)} ${nz.toFixed(4)}`);
      lines.push('    outer loop');
      lines.push(`      vertex ${v[i0 * 3].toFixed(3)} ${((v[i0 * 3 + 1] - meshData.minElevation) * exaggeration).toFixed(3)} ${v[i0 * 3 + 2].toFixed(3)}`);
      lines.push(`      vertex ${v[i1 * 3].toFixed(3)} ${((v[i1 * 3 + 1] - meshData.minElevation) * exaggeration).toFixed(3)} ${v[i1 * 3 + 2].toFixed(3)}`);
      lines.push(`      vertex ${v[i2 * 3].toFixed(3)} ${((v[i2 * 3 + 1] - meshData.minElevation) * exaggeration).toFixed(3)} ${v[i2 * 3 + 2].toFixed(3)}`);
      lines.push('    endloop');
      lines.push('  endfacet');
    }

    lines.push('endsolid ToposTerrain');
    return lines.join('\n');
  }
}

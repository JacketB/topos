import { describe, it, expect } from 'vitest';
import { MeshExporterUtils } from './mesh-exporter.utils';
import { TerrainMeshResult } from '../services/terrain.service';

describe('MeshExporterUtils', () => {
  const dummyMesh: TerrainMeshResult = {
    vertices: [
      -10, 150, -10,
      10, 160, -10,
      -10, 155, 10,
      10, 165, 10
    ],
    normals: [
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0
    ],
    uvs: [
      0, 0,
      1, 0,
      0, 1,
      1, 1
    ],
    indices: [
      0, 1, 2,
      1, 3, 2
    ],
    minElevation: 150,
    maxElevation: 165,
    avgElevation: 157.5,
    widthM: 20,
    heightM: 20,
    centerLng: 27.5,
    centerLat: 53.9,
    gridCols: 2,
    gridRows: 2
  };

  it('should export valid OBJ format', () => {
    const obj = MeshExporterUtils.exportToObj(dummyMesh, 2.0);
    expect(obj).toContain('o Terrain_5390_2750');
    expect(obj).toContain('v -10.000 0.000 -10.000');
    expect(obj).toContain('v 10.000 20.000 -10.000');
    expect(obj).toContain('f 1/1/1 2/2/2 3/3/3');
    expect(obj).toContain('f 2/2/2 4/4/4 3/3/3');
  });

  it('should export valid STL format', () => {
    const stl = MeshExporterUtils.exportToStl(dummyMesh, 1.0);
    expect(stl).toContain('solid ToposTerrain');
    expect(stl).toContain('facet normal 0.0000 1.0000 0.0000');
    expect(stl).toContain('vertex -10.000 0.000 -10.000');
    expect(stl).toContain('endsolid ToposTerrain');
  });
});

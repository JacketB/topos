import {
  Component,
  ElementRef,
  ViewChild,
  signal,
  computed,
  input,
  output,
  effect,
  inject,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TerrainService, TerrainMeshResult } from '../../services/terrain.service';
import { MeshExporterUtils } from '../../utils/mesh-exporter.utils';

@Component({
  selector: 'app-terrain-3d-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './terrain-3d-modal.component.html',
  styleUrls: ['./terrain-3d-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Terrain3dModalComponent implements OnDestroy {
  private terrainService = inject(TerrainService);

  isOpen = input<boolean>(false);
  bbox = input<[number, number, number, number] | null>(null);
  mapTextureUrl = input<string | null>(null);
  buildings = input<any[]>([]);
  closed = output<void>();

  @ViewChild('canvasContainer') canvasContainerRef!: ElementRef<HTMLDivElement>;

  loading = signal<boolean>(false);
  meshData = signal<TerrainMeshResult | null>(null);
  exaggeration = signal<number>(3.0);
  renderMode = signal<'hypsometric' | 'texture' | 'wireframe'>('texture');
  resolution = signal<number>(64);
  sunAzimuth = signal<number>(315);
  sunElevation = signal<number>(45);
  showBuildings = signal<boolean>(true);
  buildingCount = signal<number>(0);

  stats = computed(() => {
    const data = this.meshData();
    if (!data) return null;
    const widthKm = (data.widthM / 1000).toFixed(2);
    const heightKm = (data.heightM / 1000).toFixed(2);
    const areaSqKm = ((data.widthM * data.heightM) / 1_000_000).toFixed(2);
    const deltaH = Math.round(data.maxElevation - data.minElevation);
    const polyCount = data.indices.length / 3;
    return {
      widthKm,
      heightKm,
      areaSqKm,
      minElev: Math.round(data.minElevation),
      maxElev: Math.round(data.maxElevation),
      avgElev: Math.round(data.avgElevation),
      deltaH,
      polyCount
    };
  });

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private mesh: THREE.Mesh | null = null;
  private buildingsGroup: THREE.Group | null = null;
  private dirLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private animFrameId: number | null = null;
  private textureMap: THREE.Texture | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const currentBbox = this.bbox();
      if (open && currentBbox) {
        this.fetchAndBuildMesh(currentBbox, this.resolution());
      } else if (!open) {
        this.cleanupScene();
      }
    });

    effect(() => {
      const texUrl = this.mapTextureUrl();
      if (texUrl && texUrl.length > 50) {
        new THREE.TextureLoader().load(
          texUrl,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = true;
            if (this.renderer) {
              tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            }
            this.textureMap = tex;
            this.updateMeshVisuals(this.renderMode(), this.exaggeration(), this.sunAzimuth(), this.sunElevation());
          },
          undefined,
          () => {
            this.textureMap = null;
            this.updateMeshVisuals(this.renderMode(), this.exaggeration(), this.sunAzimuth(), this.sunElevation());
          }
        );
      }
    });

    effect(() => {
      const blds = this.buildings();
      const data = this.meshData();
      if (data && this.buildingsGroup) {
        this.buildBuildings(data, blds);
      }
    });

    effect(() => {
      const visible = this.showBuildings();
      if (this.buildingsGroup) {
        this.buildingsGroup.visible = visible;
      }
    });

    effect(() => {
      const mode = this.renderMode();
      const exag = this.exaggeration();
      const az = this.sunAzimuth();
      const el = this.sunElevation();
      this.updateMeshVisuals(mode, exag, az, el);
    });
  }

  async fetchAndBuildMesh(bbox: [number, number, number, number], res: number) {
    this.loading.set(true);
    try {
      const data = await this.terrainService.generateTerrainMesh(bbox, res);
      this.meshData.set(data);
      setTimeout(() => {
        this.initThreeScene(data);
      }, 50);
    } catch {
      this.meshData.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  changeResolution(res: number) {
    this.resolution.set(res);
    const b = this.bbox();
    if (b) {
      this.fetchAndBuildMesh(b, res);
    }
  }

  toggleBuildings() {
    this.showBuildings.update(v => !v);
  }

  private initThreeScene(data: TerrainMeshResult) {
    if (!this.canvasContainerRef?.nativeElement) return;
    const container = this.canvasContainerRef.nativeElement;

    this.cleanupScene();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf1f5f9);

    const fov = 45;
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 1, 200000);

    const maxDim = Math.max(data.widthM, data.heightM);
    const initialDist = maxDim * 1.5;
    this.camera.position.set(0, initialDist * 0.8, initialDist * 0.8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.appendChild(this.renderer.domElement);

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width || container.clientWidth;
        const h = entry.contentRect.height || container.clientHeight;
        if (w > 0 && h > 0 && this.renderer && this.camera) {
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        }
      }
    });
    this.resizeObserver.observe(container);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 0, 0);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.0);
    this.hemiLight.position.set(0, 5000, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    const gridHelper = new THREE.GridHelper(maxDim * 1.2, 12, 0x94a3b8, 0xcbd5e1);
    gridHelper.position.y = -5;
    this.scene.add(gridHelper);

    this.buildingsGroup = new THREE.Group();
    this.buildingsGroup.visible = this.showBuildings();
    this.scene.add(this.buildingsGroup);

    this.buildGeometry(data);
    this.buildBuildings(data, this.buildings());

    const texUrl = this.mapTextureUrl();
    if (texUrl && texUrl.length > 50) {
      new THREE.TextureLoader().load(
        texUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          if (this.renderer) {
            tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          }
          this.textureMap = tex;
          this.updateMeshVisuals(this.renderMode(), this.exaggeration(), this.sunAzimuth(), this.sunElevation());
        },
        undefined,
        () => {
          this.textureMap = null;
          this.updateMeshVisuals(this.renderMode(), this.exaggeration(), this.sunAzimuth(), this.sunElevation());
        }
      );
    }

    this.updateMeshVisuals(this.renderMode(), this.exaggeration(), this.sunAzimuth(), this.sunElevation());

    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  private buildGeometry(data: TerrainMeshResult) {
    if (!this.scene) return;

    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array(data.vertices.length);
    const colors = new Float32Array(data.vertices.length);

    const minH = data.minElevation;
    const maxH = Math.max(data.maxElevation, minH + 1);

    for (let i = 0; i < data.vertices.length; i += 3) {
      const x = data.vertices[i];
      const y = data.vertices[i + 1] - minH;
      const z = data.vertices[i + 2];

      vertices[i] = x;
      vertices[i + 1] = y;
      vertices[i + 2] = z;

      const rawH = data.vertices[i + 1];
      const normH = Math.min(1, Math.max(0, (rawH - minH) / (maxH - minH)));
      const color = this.getHypsometricColor(normH);

      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(data.normals), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(data.uvs), 2));
    geometry.setIndex(data.indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);
  }

  private buildBuildings(data: TerrainMeshResult, bldFeatures: any[]) {
    if (!this.buildingsGroup) return;

    while (this.buildingsGroup.children.length > 0) {
      const child = this.buildingsGroup.children[0] as THREE.Mesh;
      this.buildingsGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    if (!bldFeatures || bldFeatures.length === 0) {
      this.buildingCount.set(0);
      return;
    }

    const minH = data.minElevation;
    const metersPerDegLat = 111320.0;
    const metersPerDegLng = 111320.0 * Math.cos((data.centerLat * Math.PI) / 180.0);

    const getGroundHeight = (x: number, z: number): number => {
      const u = Math.max(0, Math.min(1, (x + data.widthM / 2) / data.widthM));
      const v = Math.max(0, Math.min(1, (-z + data.heightM / 2) / data.heightM));
      const c = Math.round(u * (data.gridCols - 1));
      const r = Math.round(v * (data.gridRows - 1));
      const idx = (r * data.gridCols + c) * 3 + 1;
      return data.vertices[idx] !== undefined ? data.vertices[idx] : data.avgElevation;
    };

    const buildingMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide
    });

    let count = 0;
    const maxBuildings = 2500;

    for (const feat of bldFeatures) {
      if (count >= maxBuildings) break;
      const geom = feat?.geometry;
      if (!geom) continue;

      let rings: number[][][] = [];
      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        rings = [geom.coordinates[0]];
      } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        rings = geom.coordinates.map((poly: any) => poly[0]);
      }

      for (const ring of rings) {
        if (!ring || ring.length < 3) continue;

        let sumX = 0;
        let sumZ = 0;
        const pts: { x: number; z: number }[] = [];

        for (let i = 0; i < ring.length - 1; i++) {
          const coord = ring[i];
          if (!coord || coord.length < 2) continue;
          const [lng, lat] = coord;
          const x = (lng - data.centerLng) * metersPerDegLng;
          const z = -(lat - data.centerLat) * metersPerDegLat;
          pts.push({ x, z });
          sumX += x;
          sumZ += z;
        }

        if (pts.length < 3) continue;

        const centerX = sumX / pts.length;
        const centerZ = sumZ / pts.length;

        if (
          centerX < -data.widthM / 2 ||
          centerX > data.widthM / 2 ||
          centerZ < -data.heightM / 2 ||
          centerZ > data.heightM / 2
        ) {
          continue;
        }

        const groundH = getGroundHeight(centerX, centerZ) - minH;
        const rawH =
          Number(feat.properties?.height) ||
          Number(feat.properties?.render_height) ||
          (feat.properties?.levels ? Number(feat.properties.levels) * 3.5 : 6.5);
        const buildingH = Math.max(3.0, Math.min(60.0, rawH));

        const shape = new THREE.Shape();
        for (let i = 0; i < pts.length; i++) {
          const lx = pts[i].x - centerX;
          const lz = pts[i].z - centerZ;
          if (i === 0) {
            shape.moveTo(lx, -lz);
          } else {
            shape.lineTo(lx, -lz);
          }
        }

        const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
          depth: buildingH,
          bevelEnabled: false
        });
        extrudeGeom.rotateX(-Math.PI / 2);

        const mesh = new THREE.Mesh(extrudeGeom, buildingMat);
        mesh.position.set(centerX, groundH, centerZ);

        const edges = new THREE.EdgesGeometry(extrudeGeom);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x94a3b8 }));
        mesh.add(line);

        this.buildingsGroup.add(mesh);
        count++;
      }
    }

    this.buildingCount.set(count);
  }

  private getHypsometricColor(t: number): THREE.Color {
    const stops = [
      { p: 0.0, c: new THREE.Color(0x15803d) },
      { p: 0.25, c: new THREE.Color(0x84cc16) },
      { p: 0.5, c: new THREE.Color(0xeab308) },
      { p: 0.75, c: new THREE.Color(0xd97706) },
      { p: 1.0, c: new THREE.Color(0x78350f) }
    ];

    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].p && t <= stops[i + 1].p) {
        const span = stops[i + 1].p - stops[i].p;
        const localT = (t - stops[i].p) / span;
        return stops[i].c.clone().lerp(stops[i + 1].c, localT);
      }
    }
    return stops[stops.length - 1].c.clone();
  }

  private updateMeshVisuals(
    mode: 'hypsometric' | 'texture' | 'wireframe',
    exag: number,
    az: number,
    el: number
  ) {
    if (this.mesh) {
      this.mesh.scale.set(1, exag, 1);

      if (mode === 'wireframe') {
        this.mesh.material = new THREE.MeshBasicMaterial({
          color: 0x466bf7,
          wireframe: true
        });
      } else if (mode === 'texture' && this.textureMap) {
        this.mesh.material = new THREE.MeshLambertMaterial({
          map: this.textureMap,
          side: THREE.DoubleSide
        });
      } else {
        this.mesh.material = new THREE.MeshLambertMaterial({
          vertexColors: true,
          side: THREE.DoubleSide
        });
      }
    }

    if (this.buildingsGroup) {
      this.buildingsGroup.scale.set(1, exag, 1);
      this.buildingsGroup.visible = this.showBuildings();
    }

    if (this.dirLight && this.meshData()) {
      const maxDim = Math.max(this.meshData()!.widthM, this.meshData()!.heightM);
      const azRad = (az * Math.PI) / 180;
      const elRad = (el * Math.PI) / 180;
      const dist = maxDim * 1.5;

      const lx = Math.sin(azRad) * Math.cos(elRad) * dist;
      const ly = Math.sin(elRad) * dist;
      const lz = Math.cos(azRad) * Math.cos(elRad) * dist;

      this.dirLight.position.set(lx, ly, lz);
      this.dirLight.target.position.set(0, 0, 0);
    }
  }

  setCameraView(type: 'top' | 'iso' | 'profile') {
    if (!this.camera || !this.controls || !this.meshData()) return;
    const data = this.meshData()!;
    const maxDim = Math.max(data.widthM, data.heightM);
    const dist = maxDim * 1.4;

    if (type === 'top') {
      this.camera.position.set(0, dist * 1.3, 1);
    } else if (type === 'iso') {
      this.camera.position.set(dist * 0.7, dist * 0.6, dist * 0.7);
    } else if (type === 'profile') {
      this.camera.position.set(dist * 1.1, dist * 0.15, 0);
    }
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  async exportObj() {
    const data = this.meshData();
    if (!data) return;
    const content = MeshExporterUtils.exportToObj(data, this.exaggeration());
    await this.downloadOrSaveFile(content, 'terrain_model.obj', 'obj', 'Сохранить 3D-модель OBJ');
  }

  async exportStl() {
    const data = this.meshData();
    if (!data) return;
    const content = MeshExporterUtils.exportToStl(data, this.exaggeration());
    await this.downloadOrSaveFile(content, 'terrain_model.stl', 'stl', 'Сохранить 3D-модель STL');
  }

  async takeSnapshot() {
    if (!this.renderer) return;
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const defaultName = `terrain_3d_${Date.now()}.png`;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const chosenPath = await invoke<string | null>('choose_save_path', {
        default_name: defaultName,
        defaultName,
        extension: 'png',
        title: 'Сохранить снимок 3D-модели (PNG)'
      });
      if (chosenPath) {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        await invoke('save_scenario_to_path', {
          target_path: chosenPath,
          targetPath: chosenPath,
          content: Array.from(bytes)
        });
        return;
      }
      return;
    } catch {}

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: 'Изображение PNG (*.png)',
            accept: { 'image/png': ['.png'] }
          }]
        });
        const blob = await (await fetch(dataUrl)).blob();
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = defaultName;
    a.click();
  }

  private async downloadOrSaveFile(content: string, defaultName: string, ext: string, title?: string) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const chosenPath = await invoke<string | null>('choose_save_path', {
        default_name: defaultName,
        defaultName,
        extension: ext,
        title: title || `Сохранить файл .${ext}`
      });
      if (chosenPath) {
        const encoder = new TextEncoder();
        await invoke('save_scenario_to_path', {
          target_path: chosenPath,
          targetPath: chosenPath,
          content: Array.from(encoder.encode(content))
        });
        return;
      }
      return;
    } catch {}

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{
            description: `${ext.toUpperCase()} Файл (*.${ext})`,
            accept: { 'application/octet-stream': [`.${ext}`], 'text/plain': [`.${ext}`] }
          }]
        });
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
  }

  private cleanupScene() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach((m) => m.dispose());
      } else {
        this.mesh.material.dispose();
      }
      this.mesh = null;
    }
    if (this.buildingsGroup) {
      while (this.buildingsGroup.children.length > 0) {
        const child = this.buildingsGroup.children[0] as THREE.Mesh;
        this.buildingsGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
      this.buildingsGroup = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.textureMap) {
      this.textureMap.dispose();
      this.textureMap = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }
    this.scene = null;
    this.camera = null;
  }

  closeModal() {
    this.cleanupScene();
    this.closed.emit();
  }

  ngOnDestroy() {
    this.cleanupScene();
  }
}

import {
  Component,
  ElementRef,
  ViewChild,
  signal,
  computed,
  input,
  output,
  effect,
  OnDestroy,
  ChangeDetectionStrategy,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type Fortification3dProfileType =
  | 'trench_standard'
  | 'trench_revetment_boards'
  | 'trench_revetment_sleepers'
  | 'comm_open'
  | 'comm_covered'
  | 'infantry_cell'
  | 'dugout_1layer'
  | 'dugout_2layers'
  | 'dugout_3layers'
  | 'tank_trench'
  | 'bmp_trench';

export interface FortificationCustomParams {
  name?: string;
  lineType?: string;
  symbol?: string;
  lengthM?: number;
  depthM?: number;
  widthTopM?: number;
  widthBottomM?: number;
  revetment?: 'none' | 'wood' | 'board' | 'board_incline' | 'wattle';
  profile?: 'main' | 'full';
}

export interface ProfileMeta {
  id: Fortification3dProfileType;
  title: string;
  category: 'trenches' | 'shelters' | 'vehicles';
  categoryLabel: string;
  protectionClass: string;
  description: string;
  depthM: number;
  widthTopM: number;
  widthBottomM: number;
  lengthM: number;
  parapetHeightM: number;
  bermWidthM: number;
  roofLayersCount: number;
  roofThicknessM: number;
  earthVolumeM3: number;
  woodRoundM3: number;
  boardsM3: number;
  wireKg: number;
  masNetM2: number;
  laborHours: number;
  machHours: number;
}

export const FORTIFICATION_PROFILES: ProfileMeta[] = [
  {
    id: 'trench_standard',
    title: 'Траншея полного профиля (без одежды крутостей)',
    category: 'trenches',
    categoryLabel: 'Траншея I очереди',
    protectionClass: 'От пуль и осколков артиллерийских снарядов',
    description: 'Основное фортификационное сооружение для ведения огня, наблюдения и скрытного маневра личного состава вдоль фронта.',
    depthM: 1.5,
    widthTopM: 1.1,
    widthBottomM: 0.6,
    lengthM: 10.0,
    parapetHeightM: 0.5,
    bermWidthM: 0.3,
    roofLayersCount: 0,
    roofThicknessM: 0,
    earthVolumeM3: 18.5,
    woodRoundM3: 0,
    boardsM3: 0,
    wireKg: 0,
    masNetM2: 25,
    laborHours: 24,
    machHours: 0.25
  },
  {
    id: 'trench_revetment_boards',
    title: 'Траншея с дощатой одеждой крутостей',
    category: 'trenches',
    categoryLabel: 'Траншея II очереди',
    protectionClass: 'От пуль, осколков и осыпания крутостей',
    description: 'Траншея с укреплением откосов дощатыми щитами на стойках из круглого леса с анкерными оттяжками и водоотводным лотком.',
    depthM: 1.5,
    widthTopM: 1.0,
    widthBottomM: 0.6,
    lengthM: 10.0,
    parapetHeightM: 0.5,
    bermWidthM: 0.3,
    roofLayersCount: 0,
    roofThicknessM: 0,
    earthVolumeM3: 18.5,
    woodRoundM3: 0.45,
    boardsM3: 0.65,
    wireKg: 6.0,
    masNetM2: 25,
    laborHours: 36,
    machHours: 0.25
  },
  {
    id: 'trench_revetment_sleepers',
    title: 'Траншея с наклонной одеждой (жерди и лежни)',
    category: 'trenches',
    categoryLabel: 'Траншея II очереди',
    protectionClass: 'Повышенная противоосыпная стойкость в слабых грунтах',
    description: 'Одежда крутостей из жердей и лежней с наклонными стойками под углом естественного откоса для песчаных и переувлажненных грунтов.',
    depthM: 1.5,
    widthTopM: 1.2,
    widthBottomM: 0.7,
    lengthM: 10.0,
    parapetHeightM: 0.5,
    bermWidthM: 0.3,
    roofLayersCount: 0,
    roofThicknessM: 0,
    earthVolumeM3: 22.0,
    woodRoundM3: 1.8,
    boardsM3: 0.2,
    wireKg: 12.0,
    masNetM2: 25,
    laborHours: 40,
    machHours: 0.3
  },
  {
    id: 'comm_open',
    title: 'Ход сообщения открытый',
    category: 'trenches',
    categoryLabel: 'Ход сообщения I очереди',
    protectionClass: 'От пуль и осколков при скрытном маневре в тыл',
    description: 'Глубокий узкий ход сообщения без перекрытия для скрытного перемещения личного состава между позициями и в тыл.',
    depthM: 1.5,
    widthTopM: 1.0,
    widthBottomM: 0.6,
    lengthM: 10.0,
    parapetHeightM: 0.4,
    bermWidthM: 0.3,
    roofLayersCount: 0,
    roofThicknessM: 0,
    earthVolumeM3: 15.0,
    woodRoundM3: 0.35,
    boardsM3: 0.50,
    wireKg: 4.0,
    masNetM2: 20,
    laborHours: 28,
    machHours: 0.25
  },
  {
    id: 'comm_covered',
    title: 'Ход сообщения перекрытый (с накатом бревен)',
    category: 'trenches',
    categoryLabel: 'Ход сообщения II очереди',
    protectionClass: 'От минометного огня и кассетных суббоеприпасов',
    description: 'Перекрытый ход сообщения со сплошным накатом из бревен d=16 см, гидроизоляцией, защитной грунтовой обсыпкой 0.5 м и маскировкой.',
    depthM: 1.5,
    widthTopM: 1.0,
    widthBottomM: 0.6,
    lengthM: 10.0,
    parapetHeightM: 0.4,
    bermWidthM: 0.3,
    roofLayersCount: 1,
    roofThicknessM: 0.6,
    earthVolumeM3: 20.0,
    woodRoundM3: 1.4,
    boardsM3: 0.5,
    wireKg: 8.0,
    masNetM2: 30,
    laborHours: 48,
    machHours: 0.3
  },
  {
    id: 'infantry_cell',
    title: 'Окоп для стрельбы стоя с бруствером',
    category: 'trenches',
    categoryLabel: 'Окоп I очереди',
    protectionClass: 'Индивидуальная защита стрелка от огня с фронта',
    description: 'Одиночный стрелковый окоп со ступенькой для стрельбы, подлокотником, водоотводным приямком и сектором обстрела.',
    depthM: 1.1,
    widthTopM: 1.0,
    widthBottomM: 0.6,
    lengthM: 1.7,
    parapetHeightM: 0.4,
    bermWidthM: 0.25,
    roofLayersCount: 0,
    roofThicknessM: 0,
    earthVolumeM3: 1.9,
    woodRoundM3: 0.05,
    boardsM3: 0.08,
    wireKg: 1.0,
    masNetM2: 6,
    laborHours: 3.5,
    machHours: 0
  },
  {
    id: 'dugout_1layer',
    title: 'Блиндаж безвсплесковый (1 накат бревен)',
    category: 'shelters',
    categoryLabel: 'Блиндаж II очереди',
    protectionClass: 'От 82-мм мин и осколков тяжелых снарядов',
    description: 'Закрытое укрытие для отдыха личного состава на 6-8 чел. Остов из бревен d=16 см, один накат, гидроизоляция, грунтовая обсыпка 0.9 м, входной тамбур и печь.',
    depthM: 2.2,
    widthTopM: 3.8,
    widthBottomM: 2.8,
    lengthM: 5.2,
    parapetHeightM: 0.8,
    bermWidthM: 0.4,
    roofLayersCount: 1,
    roofThicknessM: 0.9,
    earthVolumeM3: 42.0,
    woodRoundM3: 6.2,
    boardsM3: 1.8,
    wireKg: 25.0,
    masNetM2: 50,
    laborHours: 110,
    machHours: 2.2
  },
  {
    id: 'dugout_2layers',
    title: 'Блиндаж усиленный (2 наката бревен)',
    category: 'shelters',
    categoryLabel: 'Блиндаж II-III очереди',
    protectionClass: 'От прямого попадания 120-мм мин и 122-мм ОФС',
    description: 'Усиленное сооружение с двумя перекрестными накатами бревен d=18 см, песчаной подушкой 0.2 м, гидроизоляцией и грунтовой толщей 1.3 м.',
    depthM: 2.5,
    widthTopM: 4.2,
    widthBottomM: 3.2,
    lengthM: 5.6,
    parapetHeightM: 1.0,
    bermWidthM: 0.5,
    roofLayersCount: 2,
    roofThicknessM: 1.3,
    earthVolumeM3: 56.0,
    woodRoundM3: 9.8,
    boardsM3: 2.4,
    wireKg: 40.0,
    masNetM2: 60,
    laborHours: 155,
    machHours: 3.2
  },
  {
    id: 'dugout_3layers',
    title: 'Укрытие тяжелое (3 наката бревен + тюфяк)',
    category: 'shelters',
    categoryLabel: 'Укрытие III очереди',
    protectionClass: 'Противоснарядное укрытие от 152-мм снарядов',
    description: 'Тяжелое фортификационное сооружение с 3 накатами бревен d=20 см, распределительным тюфяком, грунтовой толщей 1.6 м и вентиляцией.',
    depthM: 2.8,
    widthTopM: 4.6,
    widthBottomM: 3.6,
    lengthM: 6.2,
    parapetHeightM: 1.2,
    bermWidthM: 0.6,
    roofLayersCount: 3,
    roofThicknessM: 1.6,
    earthVolumeM3: 75.0,
    woodRoundM3: 14.5,
    boardsM3: 3.2,
    wireKg: 55.0,
    masNetM2: 75,
    laborHours: 220,
    machHours: 4.8
  },
  {
    id: 'tank_trench',
    title: 'Окоп для танка с аппарелью и укрытием экипажа',
    category: 'vehicles',
    categoryLabel: 'Окоп техники I-II очереди',
    protectionClass: 'Снижение вероятности поражения танка на 65%',
    description: 'Окоп для стрельбы и укрытия танка. Котлован под корпус глубиной 1.2 м, сектор обстрела в переднем бруствере, въездная аппарель с тыла с уклоном 1:4 и перекрытая щель для экипажа.',
    depthM: 1.2,
    widthTopM: 5.4,
    widthBottomM: 4.2,
    lengthM: 11.2,
    parapetHeightM: 0.55,
    bermWidthM: 0.5,
    roofLayersCount: 1,
    roofThicknessM: 0.5,
    earthVolumeM3: 48.0,
    woodRoundM3: 1.2,
    boardsM3: 0.5,
    wireKg: 8.0,
    masNetM2: 85,
    laborHours: 32,
    machHours: 0.7
  },
  {
    id: 'bmp_trench',
    title: 'Окоп для БМП / БТР с аппарелью',
    category: 'vehicles',
    categoryLabel: 'Окоп техники I-II очереди',
    protectionClass: 'Снижение вероятности поражения боевой машины',
    description: 'Окоп для БМП/БТР с аппарелью с тыла, сектором обстрела в переднем бруствере, колейными настилами и перекрытым укрытием для десанта.',
    depthM: 1.0,
    widthTopM: 4.6,
    widthBottomM: 3.6,
    lengthM: 9.2,
    parapetHeightM: 0.45,
    bermWidthM: 0.5,
    roofLayersCount: 1,
    roofThicknessM: 0.5,
    earthVolumeM3: 34.0,
    woodRoundM3: 0.9,
    boardsM3: 0.4,
    wireKg: 6.0,
    masNetM2: 70,
    laborHours: 24,
    machHours: 0.5
  }
];

@Component({
  selector: 'app-fortification-3d-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './fortification-3d-modal.component.html',
  styleUrls: ['./fortification-3d-modal.component.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Fortification3dModalComponent implements OnDestroy {
  isOpen = input<boolean>(false);
  initialProfile = input<Fortification3dProfileType | null>(null);
  customParams = input<FortificationCustomParams | null>(null);
  closed = output<void>();

  @ViewChild('canvasContainer') canvasContainerRef!: ElementRef<HTMLDivElement>;

  readonly profiles = FORTIFICATION_PROFILES;
  readonly activeProfileId = signal<Fortification3dProfileType>('dugout_1layer');

  readonly showEarth = signal<boolean>(true);
  readonly showWood = signal<boolean>(true);
  readonly showWaterproofing = signal<boolean>(true);
  readonly showProtectiveLayer = signal<boolean>(true);
  readonly showCamouflage = signal<boolean>(true);
  readonly showDrainage = signal<boolean>(true);
  readonly clippingSection = signal<number>(50);

  readonly currentProfile = computed<ProfileMeta>(() => {
    const base = this.profiles.find(p => p.id === this.activeProfileId()) || this.profiles[0];
    const cp = this.customParams();
    if (!cp || !cp.lengthM || Number(cp.lengthM) <= 0) return base;

    if (base.category !== 'trenches' && cp.lineType) {
      return base;
    }

    const baseLen = base.lengthM || 10.0;
    const scaleLen = cp.lengthM / baseLen;
    const customDepth = cp.depthM !== undefined ? cp.depthM : base.depthM;
    const customTopW = cp.widthTopM !== undefined ? cp.widthTopM : base.widthTopM;
    const customBotW = cp.widthBottomM !== undefined ? cp.widthBottomM : base.widthBottomM;

    let dynamicTitle = base.title;
    if (cp.name) {
      dynamicTitle = `${cp.name} (${cp.lengthM.toFixed(1)} м)`;
    } else if (cp.lineType === 'comm_covered' || base.id === 'comm_covered') {
      dynamicTitle = `Перекрытый ход сообщения (${cp.lengthM.toFixed(1)} м)`;
    } else if (cp.lineType === 'comm_open' || base.id === 'comm_open') {
      dynamicTitle = `Открытый ход сообщения (${cp.lengthM.toFixed(1)} м)`;
    } else if (cp.lineType === 'trench' || base.category === 'trenches') {
      dynamicTitle = `${base.title} (${cp.lengthM.toFixed(1)} м)`;
    }

    const depthRatio = customDepth / (base.depthM || 1.5);

    return {
      ...base,
      title: dynamicTitle,
      lengthM: cp.lengthM,
      depthM: customDepth,
      widthTopM: customTopW,
      widthBottomM: customBotW,
      earthVolumeM3: Math.round(base.earthVolumeM3 * scaleLen * depthRatio * 10) / 10,
      woodRoundM3: Math.round(base.woodRoundM3 * scaleLen * 100) / 100,
      boardsM3: Math.round(base.boardsM3 * scaleLen * 100) / 100,
      wireKg: Math.round(base.wireKg * scaleLen * 10) / 10,
      masNetM2: Math.round(base.masNetM2 * scaleLen),
      laborHours: Math.round(base.laborHours * scaleLen * depthRatio * 10) / 10,
      machHours: Math.round(base.machHours * scaleLen * 100) / 100
    };
  });

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private rootGroup: THREE.Group | null = null;
  private earthGroup: THREE.Group | null = null;
  private woodGroup: THREE.Group | null = null;
  private waterproofGroup: THREE.Group | null = null;
  private protectGroup: THREE.Group | null = null;
  private camoGroup: THREE.Group | null = null;
  private drainGroup: THREE.Group | null = null;

  private clipPlane: THREE.Plane | null = null;

  constructor() {
    effect(() => {
      const open = this.isOpen();
      const init = this.initialProfile();
      if (init) {
        this.activeProfileId.set(init);
      }
      if (open) {
        setTimeout(() => {
          this.initThreeScene();
        }, 50);
      } else {
        this.cleanupScene();
      }
    });

    effect(() => {
      const pid = this.activeProfileId();
      const cp = this.customParams();
      if (this.scene && this.isOpen()) {
        this.rebuild3dModel(pid);
      }
    });

    effect(() => {
      const e = this.showEarth();
      const w = this.showWood();
      const wp = this.showWaterproofing();
      const p = this.showProtectiveLayer();
      const c = this.showCamouflage();
      const d = this.showDrainage();

      if (this.earthGroup) this.earthGroup.visible = e;
      if (this.woodGroup) this.woodGroup.visible = w;
      if (this.waterproofGroup) this.waterproofGroup.visible = wp;
      if (this.protectGroup) this.protectGroup.visible = p;
      if (this.camoGroup) this.camoGroup.visible = c;
      if (this.drainGroup) this.drainGroup.visible = d;
    });

    effect(() => {
      const clipVal = this.clippingSection();
      this.updateClipping(clipVal);
    });
  }

  setProfile(id: Fortification3dProfileType) {
    this.activeProfileId.set(id);
    setTimeout(() => {
      this.adjustCameraForProfile(this.currentProfile());
    }, 10);
  }

  toggleEarth() {
    this.showEarth.update(v => !v);
    this.applyLayerVisibilities();
  }

  toggleWood() {
    this.showWood.update(v => !v);
    this.applyLayerVisibilities();
  }

  toggleWaterproofing() {
    this.showWaterproofing.update(v => !v);
    this.applyLayerVisibilities();
  }

  toggleProtectiveLayer() {
    this.showProtectiveLayer.update(v => !v);
    this.applyLayerVisibilities();
  }

  toggleCamouflage() {
    this.showCamouflage.update(v => !v);
    this.applyLayerVisibilities();
  }

  toggleDrainage() {
    this.showDrainage.update(v => !v);
    this.applyLayerVisibilities();
  }

  private applyLayerVisibilities() {
    if (this.earthGroup) this.earthGroup.visible = this.showEarth();
    if (this.woodGroup) this.woodGroup.visible = this.showWood();
    if (this.waterproofGroup) this.waterproofGroup.visible = this.showWaterproofing();
    if (this.protectGroup) this.protectGroup.visible = this.showProtectiveLayer();
    if (this.camoGroup) this.camoGroup.visible = this.showCamouflage();
    if (this.drainGroup) this.drainGroup.visible = this.showDrainage();
  }

  private initThreeScene() {
    if (!this.canvasContainerRef?.nativeElement) return;
    const container = this.canvasContainerRef.nativeElement;

    this.cleanupScene();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8fafc);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(7.5, 5.5, 8.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.resizeObserver = new ResizeObserver(entries => {
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.9);
    hemiLight.position.set(0, 20, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(12, 18, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.normalBias = 0.02;
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(24, 24, 0x94a3b8, 0xe2e8f0);
    gridHelper.position.y = -3.5;
    this.scene.add(gridHelper);

    this.clipPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.earthGroup = new THREE.Group();
    this.woodGroup = new THREE.Group();
    this.waterproofGroup = new THREE.Group();
    this.protectGroup = new THREE.Group();
    this.camoGroup = new THREE.Group();
    this.drainGroup = new THREE.Group();

    this.rootGroup.add(this.earthGroup);
    this.rootGroup.add(this.woodGroup);
    this.rootGroup.add(this.waterproofGroup);
    this.rootGroup.add(this.protectGroup);
    this.rootGroup.add(this.camoGroup);
    this.rootGroup.add(this.drainGroup);

    this.rebuild3dModel(this.activeProfileId());
    this.adjustCameraForProfile(this.currentProfile());
    this.updateClipping(this.clippingSection());
    this.applyLayerVisibilities();

    const animate = () => {
      this.animFrameId = requestAnimationFrame(animate);
      if (this.controls) this.controls.update();
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  private rebuild3dModel(pid: Fortification3dProfileType) {
    if (!this.rootGroup) return;

    this.clearGroup(this.earthGroup);
    this.clearGroup(this.woodGroup);
    this.clearGroup(this.waterproofGroup);
    this.clearGroup(this.protectGroup);
    this.clearGroup(this.camoGroup);
    this.clearGroup(this.drainGroup);

    const prof = this.currentProfile();

    const soilMat = new THREE.MeshLambertMaterial({
      color: 0x795548,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const parapetMat = new THREE.MeshLambertMaterial({
      color: 0x5d4037,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const woodBoardMat = new THREE.MeshLambertMaterial({
      color: 0xd97706,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const logMat = new THREE.MeshLambertMaterial({
      color: 0xb45309,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const waterproofMat = new THREE.MeshLambertMaterial({
      color: 0x1e293b,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const camoMat = new THREE.MeshLambertMaterial({
      color: 0x15803d,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      wireframe: true,
      side: THREE.DoubleSide
    });

    const drainMat = new THREE.MeshLambertMaterial({
      color: 0x475569,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const metalMat = new THREE.MeshLambertMaterial({
      color: 0x334155,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const armorMat = new THREE.MeshLambertMaterial({
      color: 0x445e38,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    const tankSteelMat = new THREE.MeshLambertMaterial({
      color: 0x1e293b,
      clippingPlanes: this.clipPlane ? [this.clipPlane] : [],
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    if (prof.category === 'trenches') {
      this.buildTrenchModel(prof, soilMat, parapetMat, woodBoardMat, logMat, waterproofMat, camoMat, drainMat);
    } else if (prof.category === 'shelters') {
      this.buildDugoutModel(prof, soilMat, parapetMat, woodBoardMat, logMat, waterproofMat, camoMat, metalMat, drainMat);
    } else {
      this.buildVehicleTrenchModel(prof, soilMat, parapetMat, woodBoardMat, logMat, waterproofMat, camoMat, metalMat, drainMat, armorMat, tankSteelMat);
    }

    this.applyLayerVisibilities();
  }

  private buildTrenchModel(
    prof: ProfileMeta,
    soilMat: THREE.Material,
    parapetMat: THREE.Material,
    woodBoardMat: THREE.Material,
    logMat: THREE.Material,
    waterproofMat: THREE.Material,
    camoMat: THREE.Material,
    drainMat: THREE.Material
  ) {
    const rawLen = prof.lengthM;
    const len = Math.min(Math.max(rawLen, 4.0), 80.0);
    const depth = prof.depthM;
    const topW = prof.widthTopM;
    const botW = prof.widthBottomM;
    const bermW = prof.bermWidthM;
    const parH = prof.parapetHeightM;

    const isComm = (prof.id === 'comm_open' || prof.id === 'comm_covered');
    const parHL = parH;
    const parHR = isComm ? parH : parH * 0.7;

    const shapeL = new THREE.Shape();
    shapeL.moveTo(-botW / 2, -depth);
    shapeL.lineTo(-topW / 2, 0);
    shapeL.lineTo(-topW / 2 - bermW, 0);
    shapeL.lineTo(-topW / 2 - bermW - 0.4, parHL);
    shapeL.lineTo(-topW / 2 - bermW - 1.8, 0);
    shapeL.lineTo(-4.5, 0);
    shapeL.lineTo(-4.5, -depth - 0.6);
    shapeL.lineTo(-botW / 2, -depth - 0.6);
    shapeL.closePath();

    const geomL = new THREE.ExtrudeGeometry(shapeL, { depth: len, bevelEnabled: false });
    geomL.translate(0, 0, -len / 2);
    const meshL = new THREE.Mesh(geomL, soilMat);
    meshL.position.set(0, 0, 0);
    this.earthGroup?.add(meshL);

    const shapeR = new THREE.Shape();
    shapeR.moveTo(botW / 2, -depth);
    shapeR.lineTo(topW / 2, 0);
    shapeR.lineTo(topW / 2 + bermW, 0);
    shapeR.lineTo(topW / 2 + bermW + 0.4, parHR);
    shapeR.lineTo(topW / 2 + bermW + 1.8, 0);
    shapeR.lineTo(4.5, 0);
    shapeR.lineTo(4.5, -depth - 0.6);
    shapeR.lineTo(botW / 2, -depth - 0.6);
    shapeR.closePath();

    const geomR = new THREE.ExtrudeGeometry(shapeR, { depth: len, bevelEnabled: false });
    geomR.translate(0, 0, -len / 2);
    const meshR = new THREE.Mesh(geomR, soilMat);
    meshR.position.set(0, 0, 0);
    this.earthGroup?.add(meshR);

    const floorShape = new THREE.Shape();
    floorShape.moveTo(-botW / 2, -depth - 0.6);
    floorShape.lineTo(botW / 2, -depth - 0.6);
    floorShape.lineTo(botW / 2, -depth);
    floorShape.lineTo(-botW / 2, -depth);
    floorShape.closePath();
    const floorGeom = new THREE.ExtrudeGeometry(floorShape, { depth: len, bevelEnabled: false });
    floorGeom.translate(0, 0, -len / 2);
    const floorMesh = new THREE.Mesh(floorGeom, soilMat);
    floorMesh.position.set(0, 0, 0);
    this.earthGroup?.add(floorMesh);

    const drainBoxGeom = new THREE.BoxGeometry(0.24, 0.12, len);
    const drainMesh = new THREE.Mesh(drainBoxGeom, drainMat);
    drainMesh.position.set(0, -depth - 0.06, 0);
    this.drainGroup?.add(drainMesh);

    const trapStringerL = new THREE.BoxGeometry(0.05, 0.05, len);
    const trapStrL = new THREE.Mesh(trapStringerL, woodBoardMat);
    trapStrL.position.set(-botW / 2 + 0.08, -depth + 0.025, 0);
    this.drainGroup?.add(trapStrL);

    const trapStrR = new THREE.Mesh(trapStringerL, woodBoardMat);
    trapStrR.position.set(botW / 2 - 0.08, -depth + 0.025, 0);
    this.drainGroup?.add(trapStrR);

    const slatCount = Math.floor(len / 0.16);
    const slatGeom = new THREE.BoxGeometry(botW - 0.06, 0.025, 0.08);
    for (let i = 0; i < slatCount; i++) {
      const zPos = -len / 2 + (i * 0.16) + 0.08;
      const slatMesh = new THREE.Mesh(slatGeom, woodBoardMat);
      slatMesh.position.set(0, -depth + 0.06, zPos);
      this.drainGroup?.add(slatMesh);
    }

    if (prof.id === 'trench_revetment_boards' || prof.id === 'comm_open' || prof.id === 'comm_covered') {
      const slopeAngle = Math.atan2((topW - botW) / 2, depth);
      const slopeLen = Math.sqrt(Math.pow((topW - botW) / 2, 2) + Math.pow(depth, 2));
      const midX = (topW + botW) / 4;
      const boardGeom = new THREE.BoxGeometry(0.025, slopeLen, len);

      const boardL = new THREE.Mesh(boardGeom, woodBoardMat);
      boardL.position.set(-midX + 0.012, -depth / 2, 0);
      boardL.rotation.z = slopeAngle;
      this.woodGroup?.add(boardL);

      const boardR = new THREE.Mesh(boardGeom, woodBoardMat);
      boardR.position.set(midX - 0.012, -depth / 2, 0);
      boardR.rotation.z = -slopeAngle;
      this.woodGroup?.add(boardR);

      const postSpacing = 1.2;
      const postCount = Math.floor(len / postSpacing);
      const postGeom = new THREE.CylinderGeometry(0.045, 0.045, slopeLen + 0.2, 12);

      for (let i = 0; i <= postCount; i++) {
        const zPos = -len / 2 + (i * postSpacing);

        const postL = new THREE.Mesh(postGeom, logMat);
        postL.position.set(-midX + 0.04, -depth / 2, zPos);
        postL.rotation.z = slopeAngle;
        this.woodGroup?.add(postL);

        const postR = new THREE.Mesh(postGeom, logMat);
        postR.position.set(midX - 0.04, -depth / 2, zPos);
        postR.rotation.z = -slopeAngle;
        this.woodGroup?.add(postR);
      }
    } else if (prof.id === 'trench_revetment_sleepers') {
      const logsCount = Math.floor(depth / 0.16);
      for (let i = 0; i < logsCount; i++) {
        const yPos = -depth + 0.08 + (i * 0.16);
        const ratio = (yPos + depth) / depth;
        const curHalfW = botW / 2 + ratio * ((topW - botW) / 2);

        const sleeperGeom = new THREE.CylinderGeometry(0.06, 0.06, len, 8);
        sleeperGeom.rotateX(Math.PI / 2);

        const sleeperL = new THREE.Mesh(sleeperGeom, logMat);
        sleeperL.position.set(-curHalfW + 0.04, yPos, 0);
        this.woodGroup?.add(sleeperL);

        const sleeperR = new THREE.Mesh(sleeperGeom, logMat);
        sleeperR.position.set(curHalfW - 0.04, yPos, 0);
        this.woodGroup?.add(sleeperR);
      }
    }

    if (prof.id === 'comm_covered') {
      const logRollCount = Math.floor(len / 0.18);
      const logGeom = new THREE.CylinderGeometry(0.085, 0.085, topW + 1.2, 12);
      logGeom.rotateZ(Math.PI / 2);

      for (let i = 0; i < logRollCount; i++) {
        const zPos = -len / 2 + (i * 0.18) + 0.09;
        const logMesh = new THREE.Mesh(logGeom, logMat);
        logMesh.position.set(0, 0.085, zPos);
        this.woodGroup?.add(logMesh);
      }

      const wpGeom = new THREE.BoxGeometry(topW + 1.4, 0.03, len);
      const wpMesh = new THREE.Mesh(wpGeom, waterproofMat);
      wpMesh.position.set(0, 0.17 + 0.015, 0);
      this.waterproofGroup?.add(wpMesh);

      const moundShape = new THREE.Shape();
      moundShape.moveTo(-topW / 2 - 0.7, 0.20);
      moundShape.lineTo(-topW / 2 + 0.1, 0.65);
      moundShape.lineTo(topW / 2 - 0.1, 0.65);
      moundShape.lineTo(topW / 2 + 0.7, 0.20);
      moundShape.closePath();

      const moundGeom = new THREE.ExtrudeGeometry(moundShape, { depth: len, bevelEnabled: false });
      moundGeom.translate(0, 0, -len / 2);
      const moundMesh = new THREE.Mesh(moundGeom, parapetMat);
      moundMesh.position.set(0, 0, 0);
      this.protectGroup?.add(moundMesh);

      const camoGeom = new THREE.PlaneGeometry(topW + 1.8, len);
      camoGeom.rotateX(-Math.PI / 2);
      const camoMesh = new THREE.Mesh(camoGeom, camoMat);
      camoMesh.position.set(0, 0.72, 0);
      this.camoGroup?.add(camoMesh);

      const portalGeom = new THREE.BoxGeometry(topW + 0.6, 0.15, 0.2);
      const portalFront = new THREE.Mesh(portalGeom, logMat);
      portalFront.position.set(0, 0.075, len / 2);
      this.woodGroup?.add(portalFront);

      const portalRear = new THREE.Mesh(portalGeom, logMat);
      portalRear.position.set(0, 0.075, -len / 2);
      this.woodGroup?.add(portalRear);
    } else {
      const camoGeomL = new THREE.PlaneGeometry(1.6, len);
      camoGeomL.rotateX(-Math.PI / 2);
      camoGeomL.rotateZ(0.12);
      const camoMeshL = new THREE.Mesh(camoGeomL, camoMat);
      camoMeshL.position.set(-topW / 2 - bermW - 0.8, parHL * 0.65, 0);
      this.camoGroup?.add(camoMeshL);

      const camoGeomR = new THREE.PlaneGeometry(1.6, len);
      camoGeomR.rotateX(-Math.PI / 2);
      camoGeomR.rotateZ(-0.12);
      const camoMeshR = new THREE.Mesh(camoGeomR, camoMat);
      camoMeshR.position.set(topW / 2 + bermW + 0.8, parHR * 0.65, 0);
      this.camoGroup?.add(camoMeshR);
    }
  }

  private buildDugoutModel(
    prof: ProfileMeta,
    soilMat: THREE.Material,
    parapetMat: THREE.Material,
    woodBoardMat: THREE.Material,
    logMat: THREE.Material,
    waterproofMat: THREE.Material,
    camoMat: THREE.Material,
    metalMat: THREE.Material,
    drainMat: THREE.Material
  ) {
    const l = prof.lengthM;
    const w = Math.max(prof.widthBottomM || 2.8, 2.8);
    const depth = prof.depthM;
    const roomH = 1.95;
    const layers = prof.roofLayersCount;
    const soilThickness = prof.roofThicknessM || 0.9;
    const vestibuleL = 2.0;
    const totalL = l + vestibuleL;

    const shapeLeft = new THREE.Shape();
    shapeLeft.moveTo(-w / 2, -depth);
    shapeLeft.lineTo(-w / 2, 0);
    shapeLeft.lineTo(-5.0, 0);
    shapeLeft.lineTo(-5.0, -depth - 0.6);
    shapeLeft.lineTo(-w / 2, -depth - 0.6);
    shapeLeft.closePath();

    const earthLeftGeom = new THREE.ExtrudeGeometry(shapeLeft, { depth: totalL + 2.4, bevelEnabled: false });
    earthLeftGeom.translate(0, 0, -(totalL + 2.4) / 2);
    const earthLeft = new THREE.Mesh(earthLeftGeom, soilMat);
    earthLeft.position.set(0, 0, vestibuleL / 2);
    this.earthGroup?.add(earthLeft);

    const shapeRight = new THREE.Shape();
    shapeRight.moveTo(w / 2, -depth);
    shapeRight.lineTo(w / 2, 0);
    shapeRight.lineTo(5.0, 0);
    shapeRight.lineTo(5.0, -depth - 0.6);
    shapeRight.lineTo(w / 2, -depth - 0.6);
    shapeRight.closePath();

    const earthRightGeom = new THREE.ExtrudeGeometry(shapeRight, { depth: totalL + 2.4, bevelEnabled: false });
    earthRightGeom.translate(0, 0, -(totalL + 2.4) / 2);
    const earthRight = new THREE.Mesh(earthRightGeom, soilMat);
    earthRight.position.set(0, 0, vestibuleL / 2);
    this.earthGroup?.add(earthRight);

    const shapeRear = new THREE.Shape();
    shapeRear.moveTo(-w / 2, -depth);
    shapeRear.lineTo(w / 2, -depth);
    shapeRear.lineTo(w / 2, 0);
    shapeRear.lineTo(-w / 2, 0);
    shapeRear.closePath();

    const earthRearGeom = new THREE.ExtrudeGeometry(shapeRear, { depth: 1.8, bevelEnabled: false });
    earthRearGeom.translate(0, 0, -0.9);
    const earthRear = new THREE.Mesh(earthRearGeom, soilMat);
    earthRear.position.set(0, 0, -l / 2 - 0.9);
    this.earthGroup?.add(earthRear);

    const baseFloorGeom = new THREE.BoxGeometry(w, 0.4, totalL + 0.6);
    const baseFloor = new THREE.Mesh(baseFloorGeom, soilMat);
    baseFloor.position.set(0, -depth - 0.2, vestibuleL / 2);
    this.earthGroup?.add(baseFloor);

    const shapeFrontL = new THREE.Shape();
    shapeFrontL.moveTo(-w / 2, -depth);
    shapeFrontL.lineTo(-0.65, -depth + 0.5);
    shapeFrontL.lineTo(-0.65, 0);
    shapeFrontL.lineTo(-w / 2, 0);
    shapeFrontL.closePath();
    const geomFrontL = new THREE.ExtrudeGeometry(shapeFrontL, { depth: vestibuleL, bevelEnabled: false });
    geomFrontL.translate(0, 0, -vestibuleL / 2);
    const meshFrontL = new THREE.Mesh(geomFrontL, soilMat);
    meshFrontL.position.set(0, 0, l / 2 + vestibuleL / 2);
    this.earthGroup?.add(meshFrontL);

    const shapeFrontR = new THREE.Shape();
    shapeFrontR.moveTo(0.65, -depth + 0.5);
    shapeFrontR.lineTo(w / 2, -depth);
    shapeFrontR.lineTo(w / 2, 0);
    shapeFrontR.lineTo(0.65, 0);
    shapeFrontR.closePath();
    const geomFrontR = new THREE.ExtrudeGeometry(shapeFrontR, { depth: vestibuleL, bevelEnabled: false });
    geomFrontR.translate(0, 0, -vestibuleL / 2);
    const meshFrontR = new THREE.Mesh(geomFrontR, soilMat);
    meshFrontR.position.set(0, 0, l / 2 + vestibuleL / 2);
    this.earthGroup?.add(meshFrontR);

    const wallLogCount = Math.floor(roomH / 0.12);
    const logSideGeom = new THREE.CylinderGeometry(0.055, 0.055, l, 8);
    logSideGeom.rotateX(Math.PI / 2);
    for (let i = 0; i < wallLogCount; i++) {
      const yPos = -depth + 0.06 + (i * 0.12);
      const logL = new THREE.Mesh(logSideGeom, logMat);
      logL.position.set(-w / 2 + 0.055, yPos, 0);
      this.woodGroup?.add(logL);

      const logR = new THREE.Mesh(logSideGeom, logMat);
      logR.position.set(w / 2 - 0.055, yPos, 0);
      this.woodGroup?.add(logR);
    }

    const logRearGeom = new THREE.CylinderGeometry(0.055, 0.055, w - 0.11, 8);
    logRearGeom.rotateZ(Math.PI / 2);
    for (let i = 0; i < wallLogCount; i++) {
      const yPos = -depth + 0.06 + (i * 0.12);
      const logRear = new THREE.Mesh(logRearGeom, logMat);
      logRear.position.set(0, yPos, -l / 2 + 0.055);
      this.woodGroup?.add(logRear);
    }

    const doorW = 0.80;
    const doorH = 1.55;
    const sideLogW = (w - doorW) / 2;
    const logFrontSideGeom = new THREE.CylinderGeometry(0.055, 0.055, sideLogW, 8);
    logFrontSideGeom.rotateZ(Math.PI / 2);
    for (let i = 0; i < wallLogCount; i++) {
      const yPos = -depth + 0.06 + (i * 0.12);
      if (yPos < -depth + doorH) {
        const logFL = new THREE.Mesh(logFrontSideGeom, logMat);
        logFL.position.set(-w / 2 + sideLogW / 2 + 0.055, yPos, l / 2 - 0.055);
        this.woodGroup?.add(logFL);

        const logFR = new THREE.Mesh(logFrontSideGeom, logMat);
        logFR.position.set(w / 2 - sideLogW / 2 - 0.055, yPos, l / 2 - 0.055);
        this.woodGroup?.add(logFR);
      } else {
        const logFTop = new THREE.Mesh(logRearGeom, logMat);
        logFTop.position.set(0, yPos, l / 2 - 0.055);
        this.woodGroup?.add(logFTop);
      }
    }

    const postGeom = new THREE.CylinderGeometry(0.07, 0.07, roomH, 8);
    const postPositions = [
      [-w / 2 + 0.08, -l / 2 + 0.08],
      [w / 2 - 0.08, -l / 2 + 0.08],
      [-w / 2 + 0.08, l / 2 - 0.08],
      [w / 2 - 0.08, l / 2 - 0.08],
      [-w / 2 + 0.08, 0],
      [w / 2 - 0.08, 0]
    ];
    for (const pos of postPositions) {
      const pMesh = new THREE.Mesh(postGeom, logMat);
      pMesh.position.set(pos[0], -depth + roomH / 2, pos[1]);
      this.woodGroup?.add(pMesh);
    }

    const girderGeom = new THREE.CylinderGeometry(0.08, 0.08, l + 0.2, 8);
    girderGeom.rotateX(Math.PI / 2);
    const girderL = new THREE.Mesh(girderGeom, logMat);
    girderL.position.set(-w / 2 + 0.08, -depth + roomH, 0);
    this.woodGroup?.add(girderL);

    const girderR = new THREE.Mesh(girderGeom, logMat);
    girderR.position.set(w / 2 - 0.08, -depth + roomH, 0);
    this.woodGroup?.add(girderR);

    const floorGeom = new THREE.BoxGeometry(w - 0.16, 0.03, l - 0.16);
    const floorMesh = new THREE.Mesh(floorGeom, woodBoardMat);
    floorMesh.position.set(0, -depth + 0.015, 0);
    this.woodGroup?.add(floorMesh);

    const doorPostGeom = new THREE.CylinderGeometry(0.06, 0.06, doorH + 0.2, 8);
    const doorPostL = new THREE.Mesh(doorPostGeom, logMat);
    doorPostL.position.set(-doorW / 2, -depth + doorH / 2, l / 2);
    this.woodGroup?.add(doorPostL);

    const doorPostR = new THREE.Mesh(doorPostGeom, logMat);
    doorPostR.position.set(doorW / 2, -depth + doorH / 2, l / 2);
    this.woodGroup?.add(doorPostR);

    const doorLintelGeom = new THREE.CylinderGeometry(0.06, 0.06, doorW + 0.2, 8);
    doorLintelGeom.rotateZ(Math.PI / 2);
    const doorLintel = new THREE.Mesh(doorLintelGeom, logMat);
    doorLintel.position.set(0, -depth + doorH + 0.05, l / 2);
    this.woodGroup?.add(doorLintel);

    const doorLeafGeom = new THREE.BoxGeometry(0.65, 1.45, 0.035);
    const doorLeaf = new THREE.Mesh(doorLeafGeom, woodBoardMat);
    doorLeaf.position.set(-0.15, -depth + 0.75, l / 2 + 0.15);
    doorLeaf.rotation.y = 0.45;
    this.woodGroup?.add(doorLeaf);

    const tamburFrameGeom = new THREE.CylinderGeometry(0.055, 0.055, 1.6, 8);
    const tamburPostL = new THREE.Mesh(tamburFrameGeom, logMat);
    tamburPostL.position.set(-0.60, -depth + 0.80, l / 2 + 1.2);
    this.woodGroup?.add(tamburPostL);

    const tamburPostR = new THREE.Mesh(tamburFrameGeom, logMat);
    tamburPostR.position.set(0.60, -depth + 0.80, l / 2 + 1.2);
    this.woodGroup?.add(tamburPostR);

    const tamburBeamGeom = new THREE.CylinderGeometry(0.055, 0.055, 1.30, 8);
    tamburBeamGeom.rotateZ(Math.PI / 2);
    const tamburBeam = new THREE.Mesh(tamburBeamGeom, logMat);
    tamburBeam.position.set(0, -depth + 1.60, l / 2 + 1.2);
    this.woodGroup?.add(tamburBeam);

    const tamburBoardGeom = new THREE.BoxGeometry(0.025, 1.5, 1.3);
    const tamburBoardL = new THREE.Mesh(tamburBoardGeom, woodBoardMat);
    tamburBoardL.position.set(-0.62, -depth + 0.75, l / 2 + 0.65);
    this.woodGroup?.add(tamburBoardL);

    const tamburBoardR = new THREE.Mesh(tamburBoardGeom, woodBoardMat);
    tamburBoardR.position.set(0.62, -depth + 0.75, l / 2 + 0.65);
    this.woodGroup?.add(tamburBoardR);

    const sumpGeom = new THREE.BoxGeometry(0.50, 0.20, 0.50);
    const sumpMesh = new THREE.Mesh(sumpGeom, drainMat);
    sumpMesh.position.set(0, -depth - 0.10, l / 2 + 0.45);
    this.drainGroup?.add(sumpMesh);

    const grateGeom = new THREE.BoxGeometry(0.48, 0.02, 0.06);
    for (let g = 0; g < 4; g++) {
      const grateSlat = new THREE.Mesh(grateGeom, woodBoardMat);
      grateSlat.position.set(0, -depth + 0.01, l / 2 + 0.30 + (g * 0.10));
      this.drainGroup?.add(grateSlat);
    }

    const bunkL = 1.95;
    const bunkW = w - 0.16;
    const bunkX = 0;
    const bunkZ = -l / 2 + 0.08 + bunkL / 2;
    const bunkGeom = new THREE.BoxGeometry(bunkW, 0.04, bunkL);

    const bunkLower = new THREE.Mesh(bunkGeom, woodBoardMat);
    bunkLower.position.set(bunkX, -depth + 0.40, bunkZ);
    this.woodGroup?.add(bunkLower);

    const bunkUpper = new THREE.Mesh(bunkGeom, woodBoardMat);
    bunkUpper.position.set(bunkX, -depth + 1.25, bunkZ);
    this.woodGroup?.add(bunkUpper);

    const bunkPostGeom = new THREE.CylinderGeometry(0.035, 0.035, 1.45, 6);
    const bunkPostPositions = [
      [-w / 2 + 0.10, bunkZ - bunkL / 2 + 0.04],
      [w / 2 - 0.10, bunkZ - bunkL / 2 + 0.04],
      [-w / 2 + 0.10, bunkZ + bunkL / 2 - 0.04],
      [0, bunkZ + bunkL / 2 - 0.04],
      [w / 2 - 0.10, bunkZ + bunkL / 2 - 0.04]
    ];
    for (const pos of bunkPostPositions) {
      const bp = new THREE.Mesh(bunkPostGeom, logMat);
      bp.position.set(pos[0], -depth + 0.725, pos[1]);
      this.woodGroup?.add(bp);
    }

    const rackW = 0.28;
    const rackL = 0.70;
    const rackX = -w / 2 + rackW / 2 + 0.08;
    const rackZ = l / 2 - 0.65;
    const rackBaseGeom = new THREE.BoxGeometry(rackW, 0.04, rackL);
    const rackBaseMesh = new THREE.Mesh(rackBaseGeom, woodBoardMat);
    rackBaseMesh.position.set(rackX, -depth + 0.02, rackZ);
    this.woodGroup?.add(rackBaseMesh);

    const rackPostGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6);
    const rackPost1 = new THREE.Mesh(rackPostGeom, logMat);
    rackPost1.position.set(rackX, -depth + 0.425, rackZ - rackL / 2 + 0.05);
    this.woodGroup?.add(rackPost1);

    const rackPost2 = new THREE.Mesh(rackPostGeom, logMat);
    rackPost2.position.set(rackX, -depth + 0.425, rackZ + rackL / 2 - 0.05);
    this.woodGroup?.add(rackPost2);

    const rackBarGeom = new THREE.BoxGeometry(0.04, 0.04, rackL);
    const rackBar = new THREE.Mesh(rackBarGeom, woodBoardMat);
    rackBar.position.set(rackX, -depth + 0.75, rackZ);
    this.woodGroup?.add(rackBar);

    const seatsStartZ = bunkZ + bunkL / 2 + 0.25;
    const seatsEndZ = l / 2 - 1.20;
    const seatsL = Math.max(seatsEndZ - seatsStartZ, 1.4);
    const seatsW = 0.45;
    const seatsX = w / 2 - seatsW / 2 - 0.08;
    const seatsZ = seatsStartZ + seatsL / 2;
    const seatsGeom = new THREE.BoxGeometry(seatsW, 0.04, seatsL);
    const seatsMesh = new THREE.Mesh(seatsGeom, woodBoardMat);
    seatsMesh.position.set(seatsX, -depth + 0.40, seatsZ);
    this.woodGroup?.add(seatsMesh);

    const seatsLegGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.40, 6);
    const seatsLeg1 = new THREE.Mesh(seatsLegGeom, logMat);
    seatsLeg1.position.set(seatsX - seatsW / 2 + 0.05, -depth + 0.20, seatsZ - seatsL / 2 + 0.15);
    this.woodGroup?.add(seatsLeg1);

    const seatsLeg2 = new THREE.Mesh(seatsLegGeom, logMat);
    seatsLeg2.position.set(seatsX - seatsW / 2 + 0.05, -depth + 0.20, seatsZ + seatsL / 2 - 0.15);
    this.woodGroup?.add(seatsLeg2);

    const seatsLeg3 = new THREE.Mesh(seatsLegGeom, logMat);
    seatsLeg3.position.set(seatsX - seatsW / 2 + 0.05, -depth + 0.20, seatsZ);
    this.woodGroup?.add(seatsLeg3);

    const stoveBaseGeom = new THREE.BoxGeometry(0.60, 0.04, 0.60);
    const stoveBaseMesh = new THREE.Mesh(stoveBaseGeom, woodBoardMat);
    stoveBaseMesh.position.set(w / 2 - 0.55, -depth + 0.02, l / 2 - 0.85);
    this.woodGroup?.add(stoveBaseMesh);

    const stoveBody = new THREE.CylinderGeometry(0.18, 0.18, 0.48, 12);
    const stoveMesh = new THREE.Mesh(stoveBody, metalMat);
    stoveMesh.position.set(w / 2 - 0.55, -depth + 0.34, l / 2 - 0.85);
    this.woodGroup?.add(stoveMesh);

    const chimneyCutGeom = new THREE.BoxGeometry(0.40, 0.18, 0.40);
    const chimneyCutMesh = new THREE.Mesh(chimneyCutGeom, drainMat);
    chimneyCutMesh.position.set(w / 2 - 0.55, -depth + roomH + 0.09, l / 2 - 0.85);
    this.drainGroup?.add(chimneyCutMesh);

    const pipeGeom = new THREE.CylinderGeometry(0.045, 0.045, roomH + soilThickness + 0.9, 8);
    const pipeMesh = new THREE.Mesh(pipeGeom, metalMat);
    pipeMesh.position.set(w / 2 - 0.55, -depth + (roomH + soilThickness + 0.9) / 2 + 0.1, l / 2 - 0.85);
    this.woodGroup?.add(pipeMesh);

    const sparkCapGeom = new THREE.ConeGeometry(0.09, 0.08, 8);
    const sparkCap = new THREE.Mesh(sparkCapGeom, metalMat);
    sparkCap.position.set(w / 2 - 0.55, -depth + roomH + soilThickness + 1.0, l / 2 - 0.85);
    this.woodGroup?.add(sparkCap);

    const ventInX = w / 2 - 0.30;
    const ventInZ = -l / 2 + 0.25;
    const ventH = 0.55;
    const ventGeom = new THREE.BoxGeometry(0.16, ventH, 0.16);
    const ventMesh = new THREE.Mesh(ventGeom, woodBoardMat);
    ventMesh.position.set(ventInX, -depth + roomH - ventH / 2, ventInZ);
    this.woodGroup?.add(ventMesh);

    const damperGeom = new THREE.BoxGeometry(0.18, 0.02, 0.18);
    const damperMesh = new THREE.Mesh(damperGeom, metalMat);
    damperMesh.position.set(ventInX, -depth + roomH - ventH - 0.01, ventInZ);
    this.woodGroup?.add(damperMesh);

    const ventHorizL = 1.10;
    const ventHorizGeom = new THREE.BoxGeometry(0.16, 0.16, ventHorizL);
    const ventHorizMesh = new THREE.Mesh(ventHorizGeom, woodBoardMat);
    ventHorizMesh.position.set(ventInX, -depth + roomH + 0.08, ventInZ - ventHorizL / 2 + 0.08);
    this.woodGroup?.add(ventHorizMesh);

    const ventOutZ = ventInZ - ventHorizL + 0.08;
    const ventOutH = soilThickness * 0.7 + 0.40;
    const ventOutGeom = new THREE.BoxGeometry(0.16, ventOutH, 0.16);
    const ventOutMesh = new THREE.Mesh(ventOutGeom, woodBoardMat);
    ventOutMesh.position.set(ventInX, -depth + roomH + ventOutH / 2, ventOutZ);
    this.woodGroup?.add(ventOutMesh);

    const ventCapGeom = new THREE.BoxGeometry(0.24, 0.03, 0.24);
    const ventCap = new THREE.Mesh(ventCapGeom, woodBoardMat);
    ventCap.position.set(ventInX, -depth + roomH + ventOutH + 0.02, ventOutZ);
    this.woodGroup?.add(ventCap);

    const ventScreenGeom = new THREE.BoxGeometry(0.17, 0.06, 0.17);
    const ventScreen = new THREE.Mesh(ventScreenGeom, metalMat);
    ventScreen.position.set(ventInX, -depth + roomH + ventOutH - 0.03, ventOutZ);
    this.woodGroup?.add(ventScreen);

    if (prof.id === 'dugout_3layers' || layers >= 3) {
      const fvaGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.40, 10);
      const fvaMesh = new THREE.Mesh(fvaGeom, metalMat);
      fvaMesh.position.set(0, -depth + 1.15, -l / 2 + 0.15);
      this.woodGroup?.add(fvaMesh);
    }

    const roofLogRadius = 0.085;
    const roofSpanL = totalL + 0.4;
    const roofLogsCount = Math.floor(roofSpanL / (roofLogRadius * 2));
    const roofLogGeom = new THREE.CylinderGeometry(roofLogRadius, roofLogRadius, w + 1.5, 10);
    roofLogGeom.rotateZ(Math.PI / 2);

    for (let layerIdx = 0; layerIdx < layers; layerIdx++) {
      const layerY = -depth + roomH + roofLogRadius + (layerIdx * (roofLogRadius * 2 + 0.02));
      for (let i = 0; i < roofLogsCount; i++) {
        const zPos = -l / 2 - 0.2 + (i * roofLogRadius * 2) + roofLogRadius;
        const rLog = new THREE.Mesh(roofLogGeom, logMat);
        rLog.position.set(0, layerY, zPos);
        this.woodGroup?.add(rLog);
      }
    }

    const topRoofY = -depth + roomH + (layers * (roofLogRadius * 2 + 0.02));

    const wpGeom = new THREE.BoxGeometry(w + 1.8, 0.035, roofSpanL + 0.2);
    const wpMesh = new THREE.Mesh(wpGeom, waterproofMat);
    wpMesh.position.set(0, topRoofY + 0.02, vestibuleL / 2);
    this.waterproofGroup?.add(wpMesh);

    const moundShape = new THREE.Shape();
    moundShape.moveTo(-w / 2 - 2.0, topRoofY + 0.04);
    moundShape.lineTo(-w / 2 + 0.2, topRoofY + 0.04 + soilThickness);
    moundShape.lineTo(w / 2 - 0.2, topRoofY + 0.04 + soilThickness);
    moundShape.lineTo(w / 2 + 2.0, topRoofY + 0.04);
    moundShape.closePath();

    const moundGeom = new THREE.ExtrudeGeometry(moundShape, { depth: roofSpanL + 0.6, bevelEnabled: false });
    moundGeom.translate(0, 0, -(roofSpanL + 0.6) / 2);
    const moundMesh = new THREE.Mesh(moundGeom, parapetMat);
    moundMesh.position.set(0, 0, vestibuleL / 2);
    this.protectGroup?.add(moundMesh);

    const camoGeom = new THREE.PlaneGeometry(w + 4.2, roofSpanL + 1.2);
    camoGeom.rotateX(-Math.PI / 2);
    const camoMesh = new THREE.Mesh(camoGeom, camoMat);
    camoMesh.position.set(0, topRoofY + 0.06 + soilThickness, vestibuleL / 2);
    this.camoGroup?.add(camoMesh);
  }

  private buildVehicleTrenchModel(
    prof: ProfileMeta,
    soilMat: THREE.Material,
    parapetMat: THREE.Material,
    woodBoardMat: THREE.Material,
    logMat: THREE.Material,
    waterproofMat: THREE.Material,
    camoMat: THREE.Material,
    metalMat: THREE.Material,
    drainMat: THREE.Material,
    armorMat: THREE.Material,
    tankSteelMat: THREE.Material
  ) {
    const isTank = prof.id === 'tank_trench';
    const rawLen = prof.lengthM;
    const l = Math.min(Math.max(rawLen, isTank ? 11.2 : 9.2), 40.0);
    const w = isTank ? 5.4 : 4.6;
    const botW = isTank ? 4.2 : 3.6;
    const depth = isTank ? 1.2 : 1.0;
    const parH = isTank ? 0.55 : 0.45;
    const bermW = prof.bermWidthM || 0.5;

    const standLen = isTank ? 6.4 : 5.2;
    const rampLen = l - standLen;
    const standCenterZ = -l / 2 + standLen / 2;
    const rampCenterZ = l / 2 - rampLen / 2;
    const junctionZ = -l / 2 + standLen;
    const frontLen = isTank ? 2.4 : 2.0;

    const shapeStandL = new THREE.Shape();
    shapeStandL.moveTo(-botW / 2, -depth);
    shapeStandL.lineTo(-w / 2, 0);
    shapeStandL.lineTo(-w / 2 - bermW, 0);
    shapeStandL.lineTo(-w / 2 - bermW - 0.4, parH);
    shapeStandL.lineTo(-w / 2 - bermW - 2.0, 0);
    shapeStandL.lineTo(-5.6, 0);
    shapeStandL.lineTo(-5.6, -depth - 0.5);
    shapeStandL.lineTo(-botW / 2, -depth - 0.5);
    shapeStandL.closePath();

    const earthStandLGeom = new THREE.ExtrudeGeometry(shapeStandL, { depth: standLen, bevelEnabled: false });
    earthStandLGeom.translate(0, 0, -standLen / 2);
    const earthStandL = new THREE.Mesh(earthStandLGeom, soilMat);
    earthStandL.position.set(0, 0, standCenterZ);
    this.earthGroup?.add(earthStandL);

    const shapeStandR = new THREE.Shape();
    shapeStandR.moveTo(botW / 2, -depth);
    shapeStandR.lineTo(w / 2, 0);
    shapeStandR.lineTo(w / 2 + bermW, 0);
    shapeStandR.lineTo(w / 2 + bermW + 0.4, parH);
    shapeStandR.lineTo(w / 2 + bermW + 2.0, 0);
    shapeStandR.lineTo(5.6, 0);
    shapeStandR.lineTo(5.6, -depth - 0.5);
    shapeStandR.lineTo(botW / 2, -depth - 0.5);
    shapeStandR.closePath();

    const earthStandRGeom = new THREE.ExtrudeGeometry(shapeStandR, { depth: standLen, bevelEnabled: false });
    earthStandRGeom.translate(0, 0, -standLen / 2);
    const earthStandR = new THREE.Mesh(earthStandRGeom, soilMat);
    earthStandR.position.set(0, 0, standCenterZ);
    this.earthGroup?.add(earthStandR);

    const floorGeom = new THREE.BoxGeometry(botW, 0.35, standLen);
    const floorMesh = new THREE.Mesh(floorGeom, soilMat);
    floorMesh.position.set(0, -depth - 0.175, standCenterZ);
    this.earthGroup?.add(floorMesh);

    const frontSlopeShape = new THREE.Shape();
    frontSlopeShape.moveTo(-l / 2, -depth);
    frontSlopeShape.lineTo(-l / 2 - frontLen, 0);
    frontSlopeShape.lineTo(-l / 2 - frontLen, -depth - 0.5);
    frontSlopeShape.lineTo(-l / 2, -depth - 0.5);
    frontSlopeShape.closePath();

    const frontSlopeGeom = new THREE.ExtrudeGeometry(frontSlopeShape, { depth: botW, bevelEnabled: false });
    frontSlopeGeom.translate(0, 0, -botW / 2);
    frontSlopeGeom.rotateY(-Math.PI / 2);
    const frontSlopeMesh = new THREE.Mesh(frontSlopeGeom, soilMat);
    frontSlopeMesh.position.set(0, 0, 0);
    this.earthGroup?.add(frontSlopeMesh);

    const leftFrontPositions: number[] = [
      -botW / 2, -depth, -l / 2,
      -w / 2, 0, -l / 2,
      -w / 2 - bermW, 0, -l / 2,
      -w / 2 - bermW - 0.4, parH, -l / 2,
      -w / 2 - bermW - 2.0, 0, -l / 2,
      -5.6, 0, -l / 2,
      -5.6, -depth - 0.5, -l / 2,
      -botW / 2, -depth - 0.5, -l / 2,

      -botW / 2, 0, -l / 2 - frontLen,
      -botW / 2, 0, -l / 2 - frontLen,
      -w / 2 - bermW, 0, -l / 2 - frontLen,
      -w / 2 - bermW - 0.4, 0, -l / 2 - frontLen,
      -w / 2 - bermW - 2.0, 0, -l / 2 - frontLen,
      -5.6, 0, -l / 2 - frontLen,
      -5.6, -depth - 0.5, -l / 2 - frontLen,
      -botW / 2, -depth - 0.5, -l / 2 - frontLen
    ];

    const leftFrontIndices: number[] = [];
    for (let i = 0; i < 7; i++) {
      leftFrontIndices.push(i, i + 8, i + 1);
      leftFrontIndices.push(i + 1, i + 8, i + 9);
    }
    leftFrontIndices.push(7, 15, 0);
    leftFrontIndices.push(0, 15, 8);

    const leftFrontGeom = new THREE.BufferGeometry();
    leftFrontGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftFrontPositions, 3));
    leftFrontGeom.setIndex(leftFrontIndices);
    leftFrontGeom.computeVertexNormals();
    const leftFrontMesh = new THREE.Mesh(leftFrontGeom, soilMat);
    this.earthGroup?.add(leftFrontMesh);

    const rightFrontPositions = leftFrontPositions.map((val, idx) => (idx % 3 === 0 ? -val : val));
    const rightFrontIndices: number[] = [];
    for (let i = 0; i < leftFrontIndices.length; i += 3) {
      rightFrontIndices.push(leftFrontIndices[i], leftFrontIndices[i + 2], leftFrontIndices[i + 1]);
    }
    const rightFrontGeom = new THREE.BufferGeometry();
    rightFrontGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightFrontPositions, 3));
    rightFrontGeom.setIndex(rightFrontIndices);
    rightFrontGeom.computeVertexNormals();
    const rightFrontMesh = new THREE.Mesh(rightFrontGeom, soilMat);
    this.earthGroup?.add(rightFrontMesh);

    const frontFieldGeom = new THREE.BoxGeometry(w + bermW * 2 + 4.0, 0.35, 2.8);
    const frontField = new THREE.Mesh(frontFieldGeom, soilMat);
    frontField.position.set(0, -0.175, -l / 2 - frontLen - 1.4);
    this.earthGroup?.add(frontField);

    const rampSlopeShape = new THREE.Shape();
    rampSlopeShape.moveTo(junctionZ, -depth);
    rampSlopeShape.lineTo(l / 2, 0);
    rampSlopeShape.lineTo(l / 2 + 0.6, 0);
    rampSlopeShape.lineTo(l / 2 + 0.6, -depth - 0.5);
    rampSlopeShape.lineTo(junctionZ, -depth - 0.5);
    rampSlopeShape.closePath();

    const rampFloorGeom = new THREE.ExtrudeGeometry(rampSlopeShape, { depth: botW, bevelEnabled: false });
    rampFloorGeom.translate(0, 0, -botW / 2);
    rampFloorGeom.rotateY(-Math.PI / 2);
    const rampFloorMesh = new THREE.Mesh(rampFloorGeom, soilMat);
    rampFloorMesh.position.set(0, 0, 0);
    this.earthGroup?.add(rampFloorMesh);

    const leftRampPositions: number[] = [
      -botW / 2, -depth, junctionZ,
      -w / 2, 0, junctionZ,
      -w / 2 - bermW, 0, junctionZ,
      -w / 2 - bermW - 0.4, parH, junctionZ,
      -w / 2 - bermW - 2.0, 0, junctionZ,
      -5.6, 0, junctionZ,
      -5.6, -depth - 0.5, junctionZ,
      -botW / 2, -depth - 0.5, junctionZ,

      -botW / 2, 0, l / 2,
      -botW / 2, 0, l / 2,
      -w / 2 - bermW, 0, l / 2,
      -w / 2 - bermW - 0.4, 0, l / 2,
      -w / 2 - bermW - 2.0, 0, l / 2,
      -5.6, 0, l / 2,
      -5.6, -depth - 0.5, l / 2,
      -botW / 2, -depth - 0.5, l / 2
    ];

    const leftRampIndices: number[] = [];
    for (let i = 0; i < 7; i++) {
      leftRampIndices.push(i, i + 8, i + 1);
      leftRampIndices.push(i + 1, i + 8, i + 9);
    }
    leftRampIndices.push(7, 15, 0);
    leftRampIndices.push(0, 15, 8);

    const leftRampGeom = new THREE.BufferGeometry();
    leftRampGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftRampPositions, 3));
    leftRampGeom.setIndex(leftRampIndices);
    leftRampGeom.computeVertexNormals();
    const leftRampMesh = new THREE.Mesh(leftRampGeom, soilMat);
    this.earthGroup?.add(leftRampMesh);

    const rightRampPositions = leftRampPositions.map((val, idx) => (idx % 3 === 0 ? -val : val));
    const rightRampIndices: number[] = [];
    for (let i = 0; i < leftRampIndices.length; i += 3) {
      rightRampIndices.push(leftRampIndices[i], leftRampIndices[i + 2], leftRampIndices[i + 1]);
    }
    const rightRampGeom = new THREE.BufferGeometry();
    rightRampGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightRampPositions, 3));
    rightRampGeom.setIndex(rightRampIndices);
    rightRampGeom.computeVertexNormals();
    const rightRampMesh = new THREE.Mesh(rightRampGeom, soilMat);
    this.earthGroup?.add(rightRampMesh);

    const trackWidth = isTank ? 0.80 : 0.65;
    const trackOffsetX = isTank ? 1.25 : 1.00;

    const trackStandGeom = new THREE.BoxGeometry(trackWidth, 0.05, standLen - 0.40);
    const trackStandL = new THREE.Mesh(trackStandGeom, woodBoardMat);
    trackStandL.position.set(-trackOffsetX, -depth + 0.025, standCenterZ);
    this.woodGroup?.add(trackStandL);

    const trackStandR = new THREE.Mesh(trackStandGeom, woodBoardMat);
    trackStandR.position.set(trackOffsetX, -depth + 0.025, standCenterZ);
    this.woodGroup?.add(trackStandR);

    const curbStandGeom = new THREE.BoxGeometry(0.07, 0.07, standLen - 0.40);
    const curbStandL = new THREE.Mesh(curbStandGeom, logMat);
    curbStandL.position.set(-trackOffsetX - trackWidth / 2 - 0.04, -depth + 0.05, standCenterZ);
    this.woodGroup?.add(curbStandL);

    const curbStandR = new THREE.Mesh(curbStandGeom, logMat);
    curbStandR.position.set(trackOffsetX + trackWidth / 2 + 0.04, -depth + 0.05, standCenterZ);
    this.woodGroup?.add(curbStandR);

    const rampHypotenuse = Math.sqrt(rampLen * rampLen + depth * depth);
    const rampAngle = Math.atan2(depth, rampLen);

    const trackRampGeom = new THREE.BoxGeometry(trackWidth, 0.05, rampHypotenuse);
    const trackRampL = new THREE.Mesh(trackRampGeom, woodBoardMat);
    trackRampL.position.set(-trackOffsetX, -depth / 2 + 0.025, rampCenterZ);
    trackRampL.rotation.x = -rampAngle;
    this.woodGroup?.add(trackRampL);

    const trackRampR = new THREE.Mesh(trackRampGeom, woodBoardMat);
    trackRampR.position.set(trackOffsetX, -depth / 2 + 0.025, rampCenterZ);
    trackRampR.rotation.x = -rampAngle;
    this.woodGroup?.add(trackRampR);

    const cleatCount = Math.floor(rampHypotenuse / 0.45);
    const cleatGeom = new THREE.BoxGeometry(trackWidth, 0.025, 0.05);
    for (let c = 0; c < cleatCount; c++) {
      const frac = (c + 0.5) / cleatCount - 0.5;
      const cleatZ = rampCenterZ + frac * rampLen;
      const cleatY = -depth / 2 + 0.05 + frac * depth;

      const clL = new THREE.Mesh(cleatGeom, woodBoardMat);
      clL.position.set(-trackOffsetX, cleatY, cleatZ);
      clL.rotation.x = -rampAngle;
      this.woodGroup?.add(clL);

      const clR = new THREE.Mesh(cleatGeom, woodBoardMat);
      clR.position.set(trackOffsetX, cleatY, cleatZ);
      clR.rotation.x = -rampAngle;
      this.woodGroup?.add(clR);
    }

    const sumpGeom = new THREE.BoxGeometry(0.60, 0.25, 0.60);
    const sumpMesh = new THREE.Mesh(sumpGeom, drainMat);
    sumpMesh.position.set(0, -depth - 0.125, junctionZ);
    this.drainGroup?.add(sumpMesh);

    const grateGeom = new THREE.BoxGeometry(0.58, 0.03, 0.07);
    for (let g = 0; g < 5; g++) {
      const gSlat = new THREE.Mesh(grateGeom, woodBoardMat);
      gSlat.position.set(0, -depth + 0.015, junctionZ - 0.20 + (g * 0.10));
      this.drainGroup?.add(gSlat);
    }

    const slitL = 2.4;
    const slitW = 1.2;
    const slitDepth = 1.3;
    const slitX = -w / 2 - 0.95;
    const slitZ = standCenterZ;

    const slitFloorGeom = new THREE.BoxGeometry(slitW, 0.05, slitL);
    const slitFloor = new THREE.Mesh(slitFloorGeom, woodBoardMat);
    slitFloor.position.set(slitX, -slitDepth + 0.025, slitZ);
    this.woodGroup?.add(slitFloor);

    const slitStepGeom = new THREE.BoxGeometry(0.60, 0.15, 0.80);
    const slitStep = new THREE.Mesh(slitStepGeom, woodBoardMat);
    slitStep.position.set(-w / 2 - 0.25, -depth + 0.15, slitZ);
    this.woodGroup?.add(slitStep);

    const slitPostGeom = new THREE.CylinderGeometry(0.05, 0.05, 1.40, 8);
    const slitPostPositions = [
      [slitX - slitW / 2 + 0.08, slitZ - slitL / 2 + 0.08],
      [slitX + slitW / 2 - 0.08, slitZ - slitL / 2 + 0.08],
      [slitX - slitW / 2 + 0.08, slitZ + slitL / 2 - 0.08],
      [slitX + slitW / 2 - 0.08, slitZ + slitL / 2 - 0.08]
    ];
    for (const sp of slitPostPositions) {
      const pMesh = new THREE.Mesh(slitPostGeom, logMat);
      pMesh.position.set(sp[0], -slitDepth + 0.70, sp[1]);
      this.woodGroup?.add(pMesh);
    }

    const slitLogsCount = Math.floor((slitL + 0.2) / 0.16);
    const slitRoofLogGeom = new THREE.CylinderGeometry(0.065, 0.065, slitW + 0.4, 8);
    slitRoofLogGeom.rotateZ(Math.PI / 2);

    for (let i = 0; i < slitLogsCount; i++) {
      const zLog = slitZ - slitL / 2 + (i * 0.16) + 0.08;
      const sLog = new THREE.Mesh(slitRoofLogGeom, logMat);
      sLog.position.set(slitX, 0.065, zLog);
      this.woodGroup?.add(sLog);
    }

    const slitWpGeom = new THREE.BoxGeometry(slitW + 0.5, 0.03, slitL + 0.3);
    const slitWp = new THREE.Mesh(slitWpGeom, waterproofMat);
    slitWp.position.set(slitX, 0.145, slitZ);
    this.waterproofGroup?.add(slitWp);

    const slitMoundGeom = new THREE.BoxGeometry(slitW + 0.9, 0.35, slitL + 0.6);
    const slitMound = new THREE.Mesh(slitMoundGeom, parapetMat);
    slitMound.position.set(slitX, 0.32, slitZ);
    this.protectGroup?.add(slitMound);

    const vehPosZ = junctionZ - (isTank ? 2.65 : 2.20);

    if (isTank) {
      const trackGeom = new THREE.BoxGeometry(0.65, 0.72, 4.90);
      const trackLMesh = new THREE.Mesh(trackGeom, tankSteelMat);
      trackLMesh.position.set(-trackOffsetX, -depth + 0.36, vehPosZ);
      this.woodGroup?.add(trackLMesh);

      const trackRMesh = new THREE.Mesh(trackGeom, tankSteelMat);
      trackRMesh.position.set(trackOffsetX, -depth + 0.36, vehPosZ);
      this.woodGroup?.add(trackRMesh);

      const wheelGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14);
      wheelGeom.rotateZ(Math.PI / 2);
      for (let wIdx = 0; wIdx < 6; wIdx++) {
        const wZ = vehPosZ - 1.80 + (wIdx * 0.72);
        const wL = new THREE.Mesh(wheelGeom, tankSteelMat);
        wL.position.set(-trackOffsetX - 0.23, -depth + 0.30, wZ);
        this.woodGroup?.add(wL);

        const wR = new THREE.Mesh(wheelGeom, tankSteelMat);
        wR.position.set(trackOffsetX + 0.23, -depth + 0.30, wZ);
        this.woodGroup?.add(wR);
      }

      const lowerHullGeom = new THREE.BoxGeometry(1.80, 0.55, 4.90);
      const lowerHull = new THREE.Mesh(lowerHullGeom, armorMat);
      lowerHull.position.set(0, -depth + 0.48, vehPosZ);
      this.woodGroup?.add(lowerHull);

      const glacisGeom = new THREE.BoxGeometry(2.30, 0.24, 1.55);
      const glacis = new THREE.Mesh(glacisGeom, armorMat);
      glacis.position.set(0, -depth + 0.82, vehPosZ - 1.75);
      glacis.rotation.x = -0.48;
      this.woodGroup?.add(glacis);

      const skirtGeom = new THREE.BoxGeometry(0.04, 0.55, 4.50);
      const skirtL = new THREE.Mesh(skirtGeom, armorMat);
      skirtL.position.set(-trackOffsetX - 0.35, -depth + 0.55, vehPosZ);
      this.woodGroup?.add(skirtL);

      const skirtR = new THREE.Mesh(skirtGeom, armorMat);
      skirtR.position.set(trackOffsetX + 0.35, -depth + 0.55, vehPosZ);
      this.woodGroup?.add(skirtR);

      const turretGeom = new THREE.CylinderGeometry(1.05, 1.30, 0.50, 16);
      const turretMesh = new THREE.Mesh(turretGeom, armorMat);
      turretMesh.position.set(0, -depth + 1.25, vehPosZ - 0.30);
      this.woodGroup?.add(turretMesh);

      const cupolaGeom = new THREE.CylinderGeometry(0.24, 0.26, 0.14, 10);
      const cupola = new THREE.Mesh(cupolaGeom, armorMat);
      cupola.position.set(0.38, -depth + 1.57, vehPosZ - 0.20);
      this.woodGroup?.add(cupola);

      const nsvtGeom = new THREE.BoxGeometry(0.08, 0.12, 0.65);
      const nsvt = new THREE.Mesh(nsvtGeom, tankSteelMat);
      nsvt.position.set(0.38, -depth + 1.75, vehPosZ - 0.40);
      this.woodGroup?.add(nsvt);

      const mantletGeom = new THREE.BoxGeometry(0.55, 0.32, 0.45);
      const mantlet = new THREE.Mesh(mantletGeom, armorMat);
      mantlet.position.set(0, -depth + 1.25, vehPosZ - 1.45);
      this.woodGroup?.add(mantlet);

      const gunLen = 4.80;
      const gunGeom = new THREE.CylinderGeometry(0.065, 0.065, gunLen, 10);
      gunGeom.rotateX(Math.PI / 2);
      const gunMesh = new THREE.Mesh(gunGeom, tankSteelMat);
      gunMesh.position.set(0, -depth + 1.25, vehPosZ - 1.45 - gunLen / 2);
      this.woodGroup?.add(gunMesh);

      const ejectorGeom = new THREE.CylinderGeometry(0.095, 0.095, 0.55, 10);
      ejectorGeom.rotateX(Math.PI / 2);
      const ejectorMesh = new THREE.Mesh(ejectorGeom, tankSteelMat);
      ejectorMesh.position.set(0, -depth + 1.25, vehPosZ - 3.80);
      this.woodGroup?.add(ejectorMesh);

      const logBeamGeom = new THREE.CylinderGeometry(0.08, 0.08, 2.40, 8);
      logBeamGeom.rotateZ(Math.PI / 2);
      const logBeam = new THREE.Mesh(logBeamGeom, logMat);
      logBeam.position.set(0, -depth + 0.85, vehPosZ + 2.35);
      this.woodGroup?.add(logBeam);

      const barrelGeom = new THREE.CylinderGeometry(0.20, 0.20, 0.55, 10);
      barrelGeom.rotateZ(Math.PI / 2);
      const barrelL = new THREE.Mesh(barrelGeom, armorMat);
      barrelL.position.set(-0.70, -depth + 1.05, vehPosZ + 2.30);
      this.woodGroup?.add(barrelL);

      const barrelR = new THREE.Mesh(barrelGeom, armorMat);
      barrelR.position.set(0.70, -depth + 1.05, vehPosZ + 2.30);
      this.woodGroup?.add(barrelR);
    } else {
      const trackGeom = new THREE.BoxGeometry(0.52, 0.58, 4.20);
      const trackLMesh = new THREE.Mesh(trackGeom, tankSteelMat);
      trackLMesh.position.set(-trackOffsetX, -depth + 0.29, vehPosZ);
      this.woodGroup?.add(trackLMesh);

      const trackRMesh = new THREE.Mesh(trackGeom, tankSteelMat);
      trackRMesh.position.set(trackOffsetX, -depth + 0.29, vehPosZ);
      this.woodGroup?.add(trackRMesh);

      const wheelGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10);
      wheelGeom.rotateZ(Math.PI / 2);
      for (let wIdx = 0; wIdx < 6; wIdx++) {
        const wZ = vehPosZ - 1.55 + (wIdx * 0.62);
        const wL = new THREE.Mesh(wheelGeom, tankSteelMat);
        wL.position.set(-trackOffsetX - 0.20, -depth + 0.24, wZ);
        this.woodGroup?.add(wL);

        const wR = new THREE.Mesh(wheelGeom, tankSteelMat);
        wR.position.set(trackOffsetX + 0.20, -depth + 0.24, wZ);
        this.woodGroup?.add(wR);
      }

      const lowerHullGeom = new THREE.BoxGeometry(1.55, 0.50, 4.20);
      const lowerHull = new THREE.Mesh(lowerHullGeom, armorMat);
      lowerHull.position.set(0, -depth + 0.44, vehPosZ);
      this.woodGroup?.add(lowerHull);

      const glacisGeom = new THREE.BoxGeometry(1.95, 0.22, 1.35);
      const glacis = new THREE.Mesh(glacisGeom, armorMat);
      glacis.position.set(0, -depth + 0.68, vehPosZ - 1.45);
      glacis.rotation.x = -0.45;
      this.woodGroup?.add(glacis);

      const turretGeom = new THREE.CylinderGeometry(0.70, 0.90, 0.42, 14);
      const turretMesh = new THREE.Mesh(turretGeom, armorMat);
      turretMesh.position.set(0, -depth + 1.05, vehPosZ - 0.30);
      this.woodGroup?.add(turretMesh);

      const mantletGeom = new THREE.BoxGeometry(0.35, 0.24, 0.35);
      const mantlet = new THREE.Mesh(mantletGeom, armorMat);
      mantlet.position.set(0, -depth + 1.05, vehPosZ - 1.15);
      this.woodGroup?.add(mantlet);

      const gunLen = 3.20;
      const gunGeom = new THREE.CylinderGeometry(0.035, 0.035, gunLen, 8);
      gunGeom.rotateX(Math.PI / 2);
      const gunMesh = new THREE.Mesh(gunGeom, tankSteelMat);
      gunMesh.position.set(0, -depth + 1.05, vehPosZ - 1.15 - gunLen / 2);
      this.woodGroup?.add(gunMesh);

      const muzzleGeom = new THREE.CylinderGeometry(0.055, 0.055, 0.18, 8);
      muzzleGeom.rotateX(Math.PI / 2);
      const muzzleMesh = new THREE.Mesh(muzzleGeom, tankSteelMat);
      muzzleMesh.position.set(0, -depth + 1.05, vehPosZ - 1.15 - gunLen + 0.08);
      this.woodGroup?.add(muzzleMesh);

      const atgmGeom = new THREE.CylinderGeometry(0.07, 0.07, 0.90, 8);
      atgmGeom.rotateX(Math.PI / 2);
      const atgm = new THREE.Mesh(atgmGeom, tankSteelMat);
      atgm.position.set(0, -depth + 1.38, vehPosZ - 0.30);
      this.woodGroup?.add(atgm);
    }

    const camoPostGeom = new THREE.CylinderGeometry(0.03, 0.03, parH + 0.6, 6);
    const camoPostPositions = [
      [-w / 2 - bermW - 0.4, parH / 2 + 0.3, -l / 2 + 0.6],
      [-w / 2 - bermW - 0.4, parH / 2 + 0.3, junctionZ - 0.4],
      [w / 2 + bermW + 0.4, parH / 2 + 0.3, -l / 2 + 0.6],
      [w / 2 + bermW + 0.4, parH / 2 + 0.3, junctionZ - 0.4]
    ];
    for (const cp of camoPostPositions) {
      const cMesh = new THREE.Mesh(camoPostGeom, logMat);
      cMesh.position.set(cp[0], cp[1], cp[2]);
      this.camoGroup?.add(cMesh);
    }

    const camoNetLGeom = new THREE.PlaneGeometry(1.6, standLen + 0.8);
    camoNetLGeom.rotateX(-Math.PI / 2);
    camoNetLGeom.rotateZ(0.12);
    const camoNetL = new THREE.Mesh(camoNetLGeom, camoMat);
    camoNetL.position.set(-w / 2 - bermW - 0.9, parH * 0.75, standCenterZ);
    this.camoGroup?.add(camoNetL);

    const camoNetRGeom = new THREE.PlaneGeometry(1.6, standLen + 0.8);
    camoNetRGeom.rotateX(-Math.PI / 2);
    camoNetRGeom.rotateZ(-0.12);
    const camoNetR = new THREE.Mesh(camoNetRGeom, camoMat);
    camoNetR.position.set(w / 2 + bermW + 0.9, parH * 0.75, standCenterZ);
    this.camoGroup?.add(camoNetR);
  }

  updateClipping(pct: number) {
    this.clippingSection.set(pct);
    if (!this.clipPlane) return;
    if (pct <= 0) {
      this.clipPlane.constant = 100;
    } else if (pct >= 100) {
      this.clipPlane.constant = -100;
    } else {
      const offset = ((pct - 50) / 50) * 4.5;
      this.clipPlane.constant = -offset;
    }
  }

  adjustCameraForProfile(prof: ProfileMeta) {
    if (!this.camera || !this.controls) return;
    const len = Math.min(Math.max(prof.lengthM, 4.0), 80.0);
    const dist = Math.max(len * 0.75, 8.0);
    this.camera.position.set(dist * 0.75, dist * 0.55, dist * 0.85);
    this.controls.target.set(0, -0.3, 0);
    this.controls.update();
  }

  setCameraView(type: 'iso' | 'profile' | 'top') {
    if (!this.camera || !this.controls) return;
    const prof = this.currentProfile();
    const len = Math.min(Math.max(prof.lengthM, 4.0), 80.0);
    const dist = Math.max(len * 0.75, 8.0);
    if (type === 'iso') {
      this.camera.position.set(dist * 0.75, dist * 0.55, dist * 0.85);
    } else if (type === 'profile') {
      this.camera.position.set(dist * 0.95, 0, 0);
    } else if (type === 'top') {
      this.camera.position.set(0, dist * 1.2, 0.01);
    }
    this.controls.target.set(0, -0.3, 0);
    this.controls.update();
  }

  async takeSnapshot() {
    if (!this.renderer) return;
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const defaultName = `fortification_3d_${this.activeProfileId()}_${Date.now()}.png`;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const chosenPath = await invoke<string | null>('choose_save_path', {
        default_name: defaultName,
        defaultName,
        extension: 'png',
        title: 'Сохранить 3D-сечение фортификации (PNG)'
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

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = defaultName;
    a.click();
  }

  private clearGroup(group: THREE.Group | null) {
    if (!group) return;
    while (group.children.length > 0) {
      const obj = group.children[0] as THREE.Mesh;
      group.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    }
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
    if (this.rootGroup) {
      this.clearGroup(this.earthGroup);
      this.clearGroup(this.woodGroup);
      this.clearGroup(this.waterproofGroup);
      this.clearGroup(this.protectGroup);
      this.clearGroup(this.camoGroup);
      this.clearGroup(this.drainGroup);
      this.rootGroup = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
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

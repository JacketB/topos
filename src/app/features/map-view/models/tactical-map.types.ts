export type MapInteractionMode = 'pan' | 'edit' | 'select';

export type TacticalLineMode = 'none' | 'simple_line' | 'line' | 'trench' | 'comm_open' | 'comm_covered' | 'wire' | 'ditch_pt' | 'escarp' | 'counterscarp' | 'abatis' | 'march_route' | 'march' | 'area_polygon' | 'text_box';

export type ColumnType = 'wheel' | 'caterpillar' | 'mixed' | 'foot';

export interface ObjectGroup {
  id: string;
  name: string;
  elementIds: number[];
}

export interface PlacedSymbolProperties {
  id: number;
  name?: string;
  symbol?: string;
  iconId?: string;
  size?: number;
  angle?: number;
  color?: string;
  isLinear?: boolean;
  isPolygon?: boolean;
  isText?: boolean;
  lineType?: string;
  lineStyle?: 'solid' | 'dashed' | 'dashdot' | 'double_solid' | 'double_solid_dashed' | string;
  lineWidth?: number;
  fillOpacity?: number;
  lineDashArray?: number[];
  textSize?: number;
  textColor?: string;
  textHaloColor?: string;
  textHaloWidth?: number;
  origCoords?: [number, number][];
  isSmooth?: boolean;
  areaHa?: number;
  perimeterKm?: number;
  lineLengthKm?: number;
  fortProfile?: string;
  fortDepth?: number;
  fortWidth?: number;
  fortLength?: number;
  fortRevetment?: string;
  hasPatrol?: boolean;
  patrolStyle?: 'solid' | 'dashed';
  patrolAngle?: number;
  patrolLength?: number;
  patrolRadius?: number;
  [key: string]: any;
}

export interface PlacedSymbolFeature {
  type: 'Feature';
  properties: PlacedSymbolProperties;
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: any;
  };
}

export interface GeodesyMeasurementInfo {
  distance: number;
  distanceStr: string;
  bearingTrue: number;
  bearingTrueStr: string;
  bearingMag: number;
  bearingMagStr: string;
  areaM2?: number;
  areaStr?: string;
}

export interface MapImageOverlay {
  id: string;
  name: string;
  url: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  opacity: number;
  locked: boolean;
  center: [number, number];
  widthMeters: number;
  aspectRatio: number;
  bearing: number;
}

export interface MarchOrderElement {
  id: string;
  name: string;
  icon: string;
  composition: string;
  vehicleCount: number;
  vehicleLength: number;
  vehicleDistance: number;
  vehicleDistanceUnit: 'm' | 'km';
  distanceToNext: number;
  distanceUnit: 'm' | 'km';
}

export interface MarchSegment {
  from: [number, number];
  to: [number, number];
  distanceKm: number;
  roadType: string;
  elevationSlope: number;
  speedKmH: number;
  durationHrs: number;
}

export interface MarchRoute {
  segments: MarchSegment[];
  totalDistanceKm: number;
  totalDurationHrs: number;
}

export interface RangeRing {
  radiusMeters: number;
  label: string;
  color: string;
}

export interface VopTask {
  id: number;
  phase: number;
  name: string;
  objectName: string;
  unit: string;
  qty: number;
  laborNorm: number;
  machNorm: number;
  machType: string;
  earthNorm?: number;
  woodNorm?: number;
  boardsNorm?: number;
  wireViazNorm?: number;
  masNetNorm?: number;
  trapsNorm?: number;
  doorsNorm?: number;
  stovesNorm?: number;
  machQty?: number;
}

export interface MachDevice {
  id: string;
  name: string;
  type: string;
  basePerf: number;
  currentPerf: number;
  efficiency: number;
  notes: string;
}

export interface GanttSegment {
  startCal: number;
  endCal: number;
  duration: number;
}

export interface MarchCalculationParams {
  avgVehicleLengthM: number;
  distBetweenVehiclesM: number;
  distBetweenUnitsM: number;
  speedToIrKmh: number;
  routeLengthKm: number;
  marchSpeedKmh: number;
  restTimeMin: number;
  barrierCount: number;
  barrierSpeedKmh: number;
}

export interface MarchCalculationResult {
  totalVehicles: number;
  totalDepthM: number;
  totalDepthKm: number;
  irDistanceKm: number;
  timeToIrMin: number;
  timeStretchMin: number;
  pureTravelTimeMin: number;
  barrierDelayMin: number;
  totalMarchTimeMin: number;
  totalMarchTimeFormatted: string;
  barrierDelayFormatted: string;
}

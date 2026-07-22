export type MapInteractionMode = 'pan' | 'edit' | 'select';

export type TacticalLineMode = 'none' | 'trench' | 'comm_open' | 'comm_covered' | 'wire' | 'march_route' | 'march';

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
  lineType?: string;
  origCoords?: [number, number][];
  isSmooth?: boolean;
  fortProfile?: string;
  fortDepth?: number;
  fortWidth?: number;
  fortLength?: number;
  fortRevetment?: string;
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

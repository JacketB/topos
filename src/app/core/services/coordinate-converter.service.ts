import { Injectable, signal } from '@angular/core';

export type CoordinateFormat = 
  | 'WGS84_DECIMAL' 
  | 'WGS84_DMS' 
  | 'SK42_RECTANGULAR' 
  | 'SK42_GEO' 
  | 'SK42_TACTICAL';

export interface GaussKrugerCoords {
  x: number;
  y: number;
  zone: number;
  centralMeridian: number;
  formattedX: string;
  formattedY: string;
  shortSquareX: string;
  shortSquareY: string;
}

export interface TopoSheetInfo {
  sheet1M: string;
  sheet100k: string;
  sheet50k: string;
  sheet25k: string;
}

export interface CoordinateDetails {
  wgs84Decimal: string;
  wgs84Dms: string;
  sk42Decimal: string;
  sk42Dms: string;
  gaussKruger: GaussKrugerCoords;
  topoSheet: TopoSheetInfo;
  currentFormatted: string;
}

const WGS84_A = 6378137.0;
const WGS84_F = 1.0 / 298.257223563;
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;

const KRAS_A = 6378245.0;
const KRAS_F = 1.0 / 298.3;
const KRAS_E2 = 2 * KRAS_F - KRAS_F * KRAS_F;
const KRAS_B = KRAS_A * Math.sqrt(1 - KRAS_E2);
const KRAS_EP2 = (KRAS_A * KRAS_A - KRAS_B * KRAS_B) / (KRAS_B * KRAS_B);

const DX = 23.57;
const DY = -140.95;
const DZ = -79.80;
const WX = 0.0;
const WY = -0.35 * (Math.PI / 648000.0);
const WZ = -0.79 * (Math.PI / 648000.0);
const MS = -0.22e-6;

const STORAGE_KEY_FORMAT = 'topos_coordinate_format';

@Injectable({
  providedIn: 'root'
})
export class CoordinateConverterService {
  readonly currentFormat = signal<CoordinateFormat>(this.loadSavedFormat());

  private loadSavedFormat(): CoordinateFormat {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FORMAT) as CoordinateFormat;
      if (saved && ['WGS84_DECIMAL', 'WGS84_DMS', 'SK42_RECTANGULAR', 'SK42_GEO', 'SK42_TACTICAL'].includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.error(e);
    }
    return 'SK42_RECTANGULAR';
  }

  setFormat(format: CoordinateFormat) {
    this.currentFormat.set(format);
    try {
      localStorage.setItem(STORAGE_KEY_FORMAT, format);
    } catch (e) {
      console.error(e);
    }
  }

  cycleNextFormat() {
    const formats: CoordinateFormat[] = [
      'SK42_RECTANGULAR',
      'SK42_TACTICAL',
      'WGS84_DMS',
      'WGS84_DECIMAL',
      'SK42_GEO'
    ];
    const curIndex = formats.indexOf(this.currentFormat());
    const nextIndex = (curIndex + 1) % formats.length;
    this.setFormat(formats[nextIndex]);
  }

  getFormatLabel(format: CoordinateFormat = this.currentFormat()): string {
    switch (format) {
      case 'SK42_RECTANGULAR':
        return 'СК-42 (Метры X, Y)';
      case 'SK42_TACTICAL':
        return 'СК-42 (Квадрат / Лист)';
      case 'WGS84_DMS':
        return 'WGS-84 (ГМС)';
      case 'WGS84_DECIMAL':
        return 'WGS-84 (Градусы)';
      case 'SK42_GEO':
        return 'СК-42 (Геодезич. B, L)';
    }
  }

  wgs84ToSk42(latDeg: number, lonDeg: number, h: number = 0): { lat: number; lon: number; h: number } {
    const bRad = (latDeg * Math.PI) / 180.0;
    const lRad = (lonDeg * Math.PI) / 180.0;

    const sinB = Math.sin(bRad);
    const cosB = Math.cos(bRad);
    const sinL = Math.sin(lRad);
    const cosL = Math.cos(lRad);

    const nW = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinB * sinB);
    const xW = (nW + h) * cosB * cosL;
    const yW = (nW + h) * cosB * sinL;
    const zW = (nW * (1 - WGS84_E2) + h) * sinB;

    const scale = 1.0 + MS;
    const xK = scale * (xW - WZ * yW + WY * zW) + DX;
    const yK = scale * (WZ * xW + yW - WX * zW) + DY;
    const zK = scale * (-WY * xW + WX * yW + zW) + DZ;

    const p = Math.sqrt(xK * xK + yK * yK);
    const theta = Math.atan2(zK * KRAS_A, p * KRAS_B);

    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    const bKRad = Math.atan2(
      zK + KRAS_EP2 * KRAS_B * sinTheta * sinTheta * sinTheta,
      p - KRAS_E2 * KRAS_A * cosTheta * cosTheta * cosTheta
    );
    const lKRad = Math.atan2(yK, xK);

    const sinBK = Math.sin(bKRad);
    const nK = KRAS_A / Math.sqrt(1 - KRAS_E2 * sinBK * sinBK);
    const hK = p / Math.cos(bKRad) - nK;

    return {
      lat: (bKRad * 180.0) / Math.PI,
      lon: (lKRad * 180.0) / Math.PI,
      h: hK
    };
  }

  sk42ToWgs84(latDeg: number, lonDeg: number, h: number = 0): { lat: number; lon: number; h: number } {
    const bRad = (latDeg * Math.PI) / 180.0;
    const lRad = (lonDeg * Math.PI) / 180.0;

    const sinB = Math.sin(bRad);
    const cosB = Math.cos(bRad);
    const sinL = Math.sin(lRad);
    const cosL = Math.cos(lRad);

    const nK = KRAS_A / Math.sqrt(1 - KRAS_E2 * sinB * sinB);
    const xK = (nK + h) * cosB * cosL;
    const yK = (nK + h) * cosB * sinL;
    const zK = (nK * (1 - KRAS_E2) + h) * sinB;

    const scale = 1.0 - MS;
    const xW = scale * ((xK - DX) + WZ * (yK - DY) - WY * (zK - DZ));
    const yW = scale * (-WZ * (xK - DX) + (yK - DY) + WX * (zK - DZ));
    const zW = scale * (WY * (xK - DX) - WX * (yK - DY) + (zK - DZ));

    const p = Math.sqrt(xW * xW + yW * yW);
    const bW0 = Math.sqrt(WGS84_A * WGS84_A - WGS84_E2 * WGS84_A * WGS84_A);
    const ep2W = (WGS84_A * WGS84_A - bW0 * bW0) / (bW0 * bW0);
    const theta = Math.atan2(zW * WGS84_A, p * bW0);

    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    const bWRad = Math.atan2(
      zW + ep2W * bW0 * sinTheta * sinTheta * sinTheta,
      p - WGS84_E2 * WGS84_A * cosTheta * cosTheta * cosTheta
    );
    const lWRad = Math.atan2(yW, xW);

    const sinBW = Math.sin(bWRad);
    const nW = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinBW * sinBW);
    const hW = p / Math.cos(bWRad) - nW;

    return {
      lat: (bWRad * 180.0) / Math.PI,
      lon: (lWRad * 180.0) / Math.PI,
      h: hW
    };
  }

  wgs84ToGaussKruger(latDeg: number, lonDeg: number): GaussKrugerCoords {
    const sk42 = this.wgs84ToSk42(latDeg, lonDeg);
    const zone = Math.floor(sk42.lon / 6.0) + 1;
    const l0Deg = zone * 6.0 - 3.0;

    const bRad = (sk42.lat * Math.PI) / 180.0;
    const lRad = ((sk42.lon - l0Deg) * Math.PI) / 180.0;

    const sinB = Math.sin(bRad);
    const cosB = Math.cos(bRad);
    const tanB = Math.tan(bRad);
    const tan2B = tanB * tanB;
    const tan4B = tan2B * tan2B;

    const cos2B = cosB * cosB;
    const cos3B = cos2B * cosB;
    const cos5B = cos3B * cos2B;

    const eta2 = KRAS_EP2 * cos2B;
    const eta4 = eta2 * eta2;

    const n = KRAS_A / Math.sqrt(1.0 - KRAS_E2 * sinB * sinB);

    const a0 = 1.0 - KRAS_E2 / 4.0 - (3.0 * KRAS_E2 * KRAS_E2) / 64.0 - (5.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 256.0;
    const a2 = (3.0 * KRAS_E2) / 8.0 + (3.0 * KRAS_E2 * KRAS_E2) / 32.0 + (45.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 1024.0;
    const a4 = (15.0 * KRAS_E2 * KRAS_E2) / 256.0 + (45.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 1024.0;
    const a6 = (35.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 3072.0;

    const xMeridian = KRAS_A * (a0 * bRad - a2 * Math.sin(2.0 * bRad) + a4 * Math.sin(4.0 * bRad) - a6 * Math.sin(6.0 * bRad));

    const l2 = lRad * lRad;
    const l4 = l2 * l2;
    const l6 = l4 * l2;

    const x = xMeridian 
      + n * sinB * cosB * (l2 / 2.0)
      + n * sinB * cos3B * (5.0 - tan2B + 9.0 * eta2 + 4.0 * eta4) * (l4 / 24.0)
      + n * sinB * cos5B * (61.0 - 58.0 * tan2B + tan4B) * (l6 / 720.0);

    const yRel = n * cosB * lRad
      + n * cos3B * (1.0 - tan2B + eta2) * (lRad * l2 / 6.0)
      + n * cos5B * (5.0 - 18.0 * tan2B + tan4B + 14.0 * eta2 - 58.0 * eta2 * tan2B) * (lRad * l4 / 120.0);

    const fullY = zone * 1000000 + 500000 + yRel;
    const fullX = x;

    const roundX = Math.round(fullX);
    const roundY = Math.round(fullY);

    const kmX = Math.floor(roundX / 1000);
    const mX = roundX % 1000;
    const kmY = Math.floor(roundY / 1000);
    const mY = roundY % 1000;

    const shortSquareX = String(kmX % 100).padStart(2, '0');
    const shortSquareY = String(kmY % 100).padStart(2, '0');

    return {
      x: fullX,
      y: fullY,
      zone,
      centralMeridian: l0Deg,
      formattedX: `X: ${kmX.toLocaleString('ru-RU')} ${String(mX).padStart(3, '0')} м`,
      formattedY: `Y: ${kmY.toLocaleString('ru-RU')} ${String(mY).padStart(3, '0')} м`,
      shortSquareX,
      shortSquareY
    };
  }

  gaussKrugerToWgs84(x: number, y: number, zoneInput?: number): { lat: number; lon: number } {
    let zone = zoneInput;
    let yRel = y;

    if (!zone) {
      zone = Math.floor(y / 1000000);
      yRel = y - zone * 1000000 - 500000;
    } else if (y >= 1000000) {
      yRel = y - zone * 1000000 - 500000;
    }

    const l0Deg = zone * 6.0 - 3.0;

    const a0 = 1.0 - KRAS_E2 / 4.0 - (3.0 * KRAS_E2 * KRAS_E2) / 64.0 - (5.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 256.0;
    let b0 = x / (KRAS_A * a0);

    for (let iter = 0; iter < 5; iter++) {
      const a2 = (3.0 * KRAS_E2) / 8.0 + (3.0 * KRAS_E2 * KRAS_E2) / 32.0 + (45.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 1024.0;
      const a4 = (15.0 * KRAS_E2 * KRAS_E2) / 256.0 + (45.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 1024.0;
      const a6 = (35.0 * KRAS_E2 * KRAS_E2 * KRAS_E2) / 3072.0;

      const xM = KRAS_A * (a0 * b0 - a2 * Math.sin(2.0 * b0) + a4 * Math.sin(4.0 * b0) - a6 * Math.sin(6.0 * b0));
      const diff = (x - xM) / (KRAS_A * a0);
      b0 += diff;
      if (Math.abs(diff) < 1e-12) break;
    }

    const sinB0 = Math.sin(b0);
    const cosB0 = Math.cos(b0);
    const tanB0 = Math.tan(b0);
    const tan2B0 = tanB0 * tanB0;
    const tan4B0 = tan2B0 * tan2B0;

    const cos2B0 = cosB0 * cosB0;
    const eta2 = KRAS_EP2 * cos2B0;

    const n0 = KRAS_A / Math.sqrt(1.0 - KRAS_E2 * sinB0 * sinB0);
    const rho0 = (KRAS_A * (1.0 - KRAS_E2)) / Math.pow(1.0 - KRAS_E2 * sinB0 * sinB0, 1.5);

    const yn = yRel / n0;
    const yn2 = yn * yn;
    const yn4 = yn2 * yn2;
    const yn6 = yn4 * yn2;

    const bRad = b0 - (tanB0 * n0 / (2.0 * rho0)) * yn2
      + (tanB0 * n0 / (24.0 * rho0)) * (5.0 + 3.0 * tan2B0 + eta2 - 9.0 * eta2 * tan2B0) * yn4
      - (tanB0 * n0 / (720.0 * rho0)) * (61.0 + 90.0 * tan2B0 + 45.0 * tan4B0) * yn6;

    const lRad = (1.0 / cosB0) * yn
      - (1.0 / (6.0 * cosB0)) * (1.0 + 2.0 * tan2B0 + eta2) * (yn * yn2)
      + (1.0 / (120.0 * cosB0)) * (5.0 + 28.0 * tan2B0 + 24.0 * tan4B0 + 6.0 * eta2 + 8.0 * eta2 * tan2B0) * (yn * yn4);

    const sk42Lat = (bRad * 180.0) / Math.PI;
    const sk42Lon = l0Deg + (lRad * 180.0) / Math.PI;

    return this.sk42ToWgs84(sk42Lat, sk42Lon);
  }

  getTopographicSheet(latDeg: number, lonDeg: number): TopoSheetInfo {
    const sk42 = this.wgs84ToSk42(latDeg, lonDeg);
    const lat = sk42.lat;
    const lon = sk42.lon;

    const rowIdx = Math.floor(lat / 4.0);
    const colIdx = Math.floor(lon / 6.0) + 31;

    const rowLetter = String.fromCharCode('A'.charCodeAt(0) + rowIdx);
    const sheet1M = `${rowLetter}-${colIdx}`;

    const latIn1M = lat - rowIdx * 4.0;
    const lonIn1M = lon - (colIdx - 31) * 6.0;

    const stepLat100k = 20.0 / 60.0;
    const stepLon100k = 30.0 / 60.0;

    const r100 = 11 - Math.min(11, Math.max(0, Math.floor(latIn1M / stepLat100k)));
    const c100 = Math.min(11, Math.max(0, Math.floor(lonIn1M / stepLon100k)));

    const num100k = r100 * 12 + c100 + 1;
    const sheet100k = `${sheet1M}-${num100k}`;

    const latIn100k = latIn1M - (11 - r100) * stepLat100k;
    const lonIn100k = lonIn1M - c100 * stepLon100k;

    const isTop50k = latIn100k >= (10.0 / 60.0);
    const isLeft50k = lonIn100k < (15.0 / 60.0);

    const letter50k = isTop50k ? (isLeft50k ? 'А' : 'Б') : (isLeft50k ? 'В' : 'Г');
    const sheet50k = `${sheet100k}-${letter50k}`;

    const latIn50k = isTop50k ? (latIn100k - 10.0 / 60.0) : latIn100k;
    const lonIn50k = isLeft50k ? lonIn100k : (lonIn100k - 15.0 / 60.0);

    const isTop25k = latIn50k >= (5.0 / 60.0);
    const isLeft25k = lonIn50k < (7.5 / 60.0);

    const letter25k = isTop25k ? (isLeft25k ? 'а' : 'б') : (isLeft25k ? 'в' : 'г');
    const sheet25k = `${sheet50k}-${letter25k}`;

    return {
      sheet1M,
      sheet100k,
      sheet50k,
      sheet25k
    };
  }

  formatDms(degVal: number, isLat: boolean): string {
    const abs = Math.abs(degVal);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60 * 10) / 10;

    const secStr = sec.toFixed(1).padStart(4, '0');
    const minStr = String(min).padStart(2, '0');
    const degStr = String(deg);

    let suffix = '';
    if (isLat) {
      suffix = degVal >= 0 ? 'N' : 'S';
    } else {
      suffix = degVal >= 0 ? 'E' : 'W';
    }

    return `${degStr}°${minStr}'${secStr}"${suffix}`;
  }

  getCoordinateDetails(latDeg: number, lonDeg: number): CoordinateDetails {
    const wgs84Decimal = `${latDeg.toFixed(5)}°, ${lonDeg.toFixed(5)}°`;
    const wgs84Dms = `${this.formatDms(latDeg, true)}, ${this.formatDms(lonDeg, false)}`;

    const sk42 = this.wgs84ToSk42(latDeg, lonDeg);
    const sk42Decimal = `${sk42.lat.toFixed(5)}°, ${sk42.lon.toFixed(5)}°`;
    const sk42Dms = `${this.formatDms(sk42.lat, true)}, ${this.formatDms(sk42.lon, false)}`;

    const gk = this.wgs84ToGaussKruger(latDeg, lonDeg);
    const topo = this.getTopographicSheet(latDeg, lonDeg);

    let currentFormatted = '';
    switch (this.currentFormat()) {
      case 'SK42_RECTANGULAR':
        currentFormatted = `${gk.formattedX}  ${gk.formattedY} (Зона ${gk.zone})`;
        break;
      case 'SK42_TACTICAL':
        currentFormatted = `X=${(gk.x / 1000).toFixed(2)} Y=${(gk.y / 1000).toFixed(2)} [${topo.sheet50k}]`;
        break;
      case 'WGS84_DMS':
        currentFormatted = wgs84Dms;
        break;
      case 'WGS84_DECIMAL':
        currentFormatted = wgs84Decimal;
        break;
      case 'SK42_GEO':
        currentFormatted = `${sk42Dms} (СК-42)`;
        break;
    }

    return {
      wgs84Decimal,
      wgs84Dms,
      sk42Decimal,
      sk42Dms,
      gaussKruger: gk,
      topoSheet: topo,
      currentFormatted
    };
  }

  formatCoordinates(latDeg: number, lonDeg: number, format?: CoordinateFormat): string {
    const fmt = format || this.currentFormat();
    const gk = this.wgs84ToGaussKruger(latDeg, lonDeg);
    const topo = this.getTopographicSheet(latDeg, lonDeg);

    switch (fmt) {
      case 'SK42_RECTANGULAR':
        return `${gk.formattedX}  ${gk.formattedY} (Зона ${gk.zone})`;
      case 'SK42_TACTICAL':
        return `X=${(gk.x / 1000).toFixed(2)} Y=${(gk.y / 1000).toFixed(2)} [${topo.sheet50k}]`;
      case 'WGS84_DMS':
        return `${this.formatDms(latDeg, true)}, ${this.formatDms(lonDeg, false)}`;
      case 'WGS84_DECIMAL':
        return `${latDeg.toFixed(5)}°, ${lonDeg.toFixed(5)}°`;
      case 'SK42_GEO': {
        const sk42 = this.wgs84ToSk42(latDeg, lonDeg);
        return `${this.formatDms(sk42.lat, true)}, ${this.formatDms(sk42.lon, false)} (СК-42)`;
      }
    }
  }
}

import { Injectable } from '@angular/core';

export type TacticalLineType = 'trench' | 'comm_open' | 'comm_covered' | 'wire' | 'arrow_attack' | 'arrow_supporting' | 'arrow_retreat' | string;

@Injectable({
  providedIn: 'root'
})
export class TrenchGeometryService {

  /**
   * Сглаживание массива точек по алгоритму Catmull-Rom.
   */
  interpolateCatmullRom(points: [number, number][], pointsPerSegment: number = 12): [number, number][] {
    if (points.length < 3) return points;

    const result: [number, number][] = [];

    const getPoint = (idx: number): [number, number] => {
      if (idx < 0) return points[0];
      if (idx >= points.length) return points[points.length - 1];
      return points[idx];
    };

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = getPoint(i - 1);
      const p1 = getPoint(i);
      const p2 = getPoint(i + 1);
      const p3 = getPoint(i + 2);

      for (let j = 0; j < pointsPerSegment; j++) {
        const t = j / pointsPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
          (2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
        );

        const y = 0.5 * (
          (2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
        );

        result.push([x, y]);
      }
    }

    result.push(points[points.length - 1]);
    return result;
  }

  interpolateClosedCatmullRom(points: [number, number][], pointsPerSegment: number = 10): [number, number][] {
    const n = points.length;
    if (n < 3) return points;

    const result: [number, number][] = [];

    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n];
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const p3 = points[(i + 2) % n];

      for (let j = 0; j < pointsPerSegment; j++) {
        const t = j / pointsPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
          (2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
        );

        const y = 0.5 * (
          (2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
        );

        result.push([x, y]);
      }
    }

    return result;
  }

  calculateLineLengthKm(coords: [number, number][]): { lengthM: number; lengthKm: number } {
    if (!coords || coords.length < 2) return { lengthM: 0, lengthKm: 0 };
    let totalM = 0;
    const n = coords.length;
    let meanLat = 0;
    for (let i = 0; i < n; i++) meanLat += coords[i][1];
    meanLat = (meanLat / n) * (Math.PI / 180);
    const cosLat = Math.cos(meanLat);
    const mPerDegLat = 111132.954 - 559.822 * Math.cos(2 * meanLat);
    const mPerDegLng = 111412.84 * cosLat - 93.5 * Math.cos(3 * meanLat);

    for (let i = 0; i < n - 1; i++) {
      const dx = (coords[i + 1][0] - coords[i][0]) * mPerDegLng;
      const dy = (coords[i + 1][1] - coords[i][1]) * mPerDegLat;
      totalM += Math.sqrt(dx * dx + dy * dy);
    }
    return { lengthM: totalM, lengthKm: totalM / 1000 };
  }

  getPolylineCumulativeDists(points: [number, number][]): { cum: number[]; cosLat: number } {
    const n = points.length;
    if (n < 2) return { cum: [0], cosLat: 1 };
    let meanLat = 0;
    for (let i = 0; i < n; i++) meanLat += points[i][1];
    meanLat = (meanLat / n) * (Math.PI / 180);
    const cosLat = Math.cos(meanLat);
    const cum = [0];
    for (let i = 0; i < n - 1; i++) {
      const dx = (points[i + 1][0] - points[i][0]) * cosLat;
      const dy = points[i + 1][1] - points[i][1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      cum.push(cum[cum.length - 1] + dist);
    }
    return { cum, cosLat };
  }

  getPointAtDistance(points: [number, number][], targetDist: number, cum: number[], cosLat: number): [number, number] {
    if (targetDist <= 0) return points[0];
    if (targetDist >= cum[cum.length - 1]) return points[points.length - 1];
    for (let i = 0; i < cum.length - 1; i++) {
      if (cum[i] <= targetDist && targetDist <= cum[i + 1]) {
        const segLen = cum[i + 1] - cum[i];
        if (segLen <= 0) return points[i];
        const ratio = (targetDist - cum[i]) / segLen;
        const x = points[i][0] + (points[i + 1][0] - points[i][0]) * ratio;
        const y = points[i][1] + (points[i + 1][1] - points[i][1]) * ratio;
        return [x, y];
      }
    }
    return points[points.length - 1];
  }

  discretizeToDashes(points: [number, number][], dashLen: number = 0.00014, gapLen: number = 0.00009): [number, number][][] {
    if (!points || points.length < 2) return [points || []];
    const { cum, cosLat } = this.getPolylineCumulativeDists(points);
    const totalLen = cum[cum.length - 1];
    if (totalLen <= 0) return [points];
    const res: [number, number][][] = [];
    let cur = 0;
    while (cur < totalLen) {
      const dEnd = Math.min(totalLen, cur + dashLen);
      const pStart = this.getPointAtDistance(points, cur, cum, cosLat);
      const pEnd = this.getPointAtDistance(points, dEnd, cum, cosLat);
      const segPts: [number, number][] = [pStart];
      for (let i = 0; i < cum.length; i++) {
        if (cur < cum[i] && cum[i] < dEnd) {
          segPts.push(points[i]);
        }
      }
      segPts.push(pEnd);
      res.push(segPts);
      cur += dashLen + gapLen;
    }
    return res.length > 0 ? res : [points];
  }

  discretizeToDashDot(points: [number, number][], dashLen: number = 0.00065, dotLen: number = 0.00012, gapLen: number = 0.00025): [number, number][][] {
    if (!points || points.length < 2) return [points || []];
    const { cum, cosLat } = this.getPolylineCumulativeDists(points);
    const totalLen = cum[cum.length - 1];
    if (totalLen <= 0) return [points];
    const res: [number, number][][] = [];
    let cur = 0;
    while (cur < totalLen) {
      const pDashStart = this.getPointAtDistance(points, cur, cum, cosLat);
      const pDashEnd = this.getPointAtDistance(points, Math.min(totalLen, cur + dashLen), cum, cosLat);
      res.push([pDashStart, pDashEnd]);
      cur += dashLen + gapLen;
      if (cur >= totalLen) break;

      const pDotStart = this.getPointAtDistance(points, cur, cum, cosLat);
      const pDotEnd = this.getPointAtDistance(points, Math.min(totalLen, cur + dotLen), cum, cosLat);
      res.push([pDotStart, pDotEnd]);
      cur += dotLen + gapLen;
    }
    return res.length > 0 ? res : [points];
  }

  offsetPolyline(points: [number, number][], offsetDist: number): [number, number][] {
    if (!points || points.length < 2) return points || [];
    const n = points.length;
    const res: [number, number][] = [];
    let meanLat = 0;
    for (let i = 0; i < n; i++) meanLat += points[i][1];
    meanLat = (meanLat / n) * (Math.PI / 180);
    const cosLat = Math.cos(meanLat);

    for (let i = 0; i < n; i++) {
      const p = points[i];
      let dx = 0;
      let dy = 0;
      if (i === 0) {
        dx = (points[1][0] - p[0]) * cosLat;
        dy = points[1][1] - p[1];
      } else if (i === n - 1) {
        dx = (p[0] - points[n - 2][0]) * cosLat;
        dy = p[1] - points[n - 2][1];
      } else {
        dx = (points[i + 1][0] - points[i - 1][0]) * cosLat;
        dy = points[i + 1][1] - points[i - 1][1];
      }
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length === 0) {
        res.push(p);
        continue;
      }
      const nx = -dy / length;
      const ny = dx / length;
      res.push([p[0] + (nx / cosLat) * offsetDist, p[1] + ny * offsetDist]);
    }
    return res;
  }

  calculatePolygonAreaAndPerimeter(coords: [number, number][]): { areaM2: number; areaHa: number; areaKm2: number; perimeterKm: number } {
    if (!coords || coords.length < 3) {
      return { areaM2: 0, areaHa: 0, areaKm2: 0, perimeterKm: 0 };
    }

    const n = coords.length;
    let meanLat = 0;
    for (let i = 0; i < n; i++) meanLat += coords[i][1];
    meanLat = (meanLat / n) * (Math.PI / 180);
    const cosLat = Math.cos(meanLat);

    const mPerDegLat = 111132.954 - 559.822 * Math.cos(2 * meanLat);
    const mPerDegLng = 111412.84 * cosLat - 93.5 * Math.cos(3 * meanLat);

    let areaSum = 0;
    let perimeterM = 0;

    for (let i = 0; i < n; i++) {
      const p1 = coords[i];
      const p2 = coords[(i + 1) % n];

      const x1 = p1[0] * mPerDegLng;
      const y1 = p1[1] * mPerDegLat;
      const x2 = p2[0] * mPerDegLng;
      const y2 = p2[1] * mPerDegLat;

      areaSum += (x1 * y2 - x2 * y1);

      const dx = x2 - x1;
      const dy = y2 - y1;
      perimeterM += Math.sqrt(dx * dx + dy * dy);
    }

    const areaM2 = Math.abs(areaSum) * 0.5;
    const areaHa = areaM2 / 10000;
    const areaKm2 = areaM2 / 1000000;
    const perimeterKm = perimeterM / 1000;

    return { areaM2, areaHa, areaKm2, perimeterKm };
  }

  generateAreaPolygonGeometry(origCoords: [number, number][], isSmooth: boolean = false): any {
    if (!origCoords || origCoords.length < 3) {
      return { type: 'Polygon', coordinates: [origCoords ? [...origCoords, origCoords[0] || [0, 0]] : []] };
    }

    const baseCoords = (isSmooth && origCoords.length >= 3)
      ? this.interpolateClosedCatmullRom(origCoords, 10)
      : origCoords;

    const ring = [...baseCoords, baseCoords[0]];
    return {
      type: 'Polygon',
      coordinates: [ring]
    };
  }

  generateLinearGeometry(origCoords: [number, number][], lineType: TacticalLineType, flipSide: boolean = false, isSmooth: boolean = false, lineWidth: number = 3, lineStyle: string = 'solid'): any {
    if (!origCoords || origCoords.length < 2) {
      return { type: 'LineString', coordinates: origCoords || [] };
    }

    if (lineType === 'area_polygon' || lineType === 'area') {
      return this.generateAreaPolygonGeometry(origCoords, isSmooth);
    }

    if (lineType && lineType.startsWith('arrow_')) {
      return this.generateArrowGeometry(origCoords, lineType, isSmooth, lineWidth);
    }

    const activeCoords = (isSmooth && origCoords.length >= 3)
      ? this.interpolateCatmullRom(origCoords, 12)
      : origCoords;

    if (lineType === 'simple_line' || lineType === 'line') {
      if (lineStyle === 'dashed') {
        const dashes = this.discretizeToDashes(activeCoords, 0.00045, 0.0003);
        return { type: 'MultiLineString', coordinates: dashes };
      }
      if (lineStyle === 'dashdot') {
        const dashDots = this.discretizeToDashDot(activeCoords, 0.00065, 0.00012, 0.00025);
        return { type: 'MultiLineString', coordinates: dashDots };
      }
      if (lineStyle === 'double_solid') {
        const d = Math.max(0.000035, lineWidth * 0.00002);
        const left = this.offsetPolyline(activeCoords, d);
        const right = this.offsetPolyline(activeCoords, -d);
        return { type: 'MultiLineString', coordinates: [left, right] };
      }
      if (lineStyle === 'double_solid_dashed') {
        const d = Math.max(0.000035, lineWidth * 0.00002);
        const left = this.offsetPolyline(activeCoords, d);
        const right = this.offsetPolyline(activeCoords, -d);
        const rightDashes = this.discretizeToDashes(right, 0.00045, 0.0003);
        return { type: 'MultiLineString', coordinates: [left, ...rightDashes] };
      }
      return { type: 'LineString', coordinates: activeCoords };
    }

    const lines: [number, number][][] = [activeCoords];

    // Для маршрута марша генерируем шевроны направления
    if (lineType === 'march_route') {
      for (let i = 0; i < activeCoords.length - 1; i++) {
        const p1 = activeCoords[i];
        const p2 = activeCoords[i + 1];

        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];

        const cosLat = Math.cos((p1[1] + p2[1]) * 0.5 * (Math.PI / 180));
        const dxM = dx * cosLat;
        const dyM = dy;
        const distM = Math.sqrt(dxM * dxM + dyM * dyM);

        if (distM === 0) continue;

        const step = 0.0008; // Шаг между шевронами
        const numSteps = Math.max(1, Math.floor(distM / step));

        const dirX = dxM / distM;
        const dirY = dyM / distM;
        const nx = -dirY;
        const ny = dirX;

        const cosAngle = Math.cos(30 * Math.PI / 180);
        const sinAngle = Math.sin(30 * Math.PI / 180);

        const vLeftX = -dirX * cosAngle + nx * sinAngle;
        const vLeftY = -dirY * cosAngle + ny * sinAngle;

        const vRightX = -dirX * cosAngle - nx * sinAngle;
        const vRightY = -dirY * cosAngle - ny * sinAngle;

        const toothLen = 0.00008;
        const dLeftLng = (vLeftX * toothLen) / cosLat;
        const dLeftLat = vLeftY * toothLen;
        const dRightLng = (vRightX * toothLen) / cosLat;
        const dRightLat = vRightY * toothLen;

        for (let s = 1; s <= numSteps; s++) {
          const t = s / (numSteps + 1);
          const cx = p1[0] + dx * t;
          const cy = p1[1] + dy * t;

          lines.push([[cx, cy], [cx + dLeftLng, cy + dLeftLat]]);
          lines.push([[cx, cy], [cx + dRightLng, cy + dRightLat]]);
        }
      }
    }

    // Добавляем две перпендикулярные полоски по середине для крытого хода сообщения (comm_covered)
    if (lineType === 'comm_covered') {
      const segments: { p1: [number, number]; p2: [number, number]; len: number }[] = [];
      let totalLen = 0;
      for (let k = 0; k < activeCoords.length - 1; k++) {
        const p1 = activeCoords[k];
        const p2 = activeCoords[k + 1];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        segments.push({ p1, p2, len });
        totalLen += len;
      }

      if (totalLen > 0) {
        const spacing = 0.00004; // Расстояние между штрихами (~4м)
        const midPoint = totalLen * 0.5;
        // Защита от выхода за границы коротких линий
        const targets = [
          Math.max(0.00001, midPoint - spacing),
          Math.min(totalLen - 0.00001, midPoint + spacing)
        ];

        for (const targetD of targets) {
          let accumulated = 0;
          for (const seg of segments) {
            if (accumulated + seg.len >= targetD || seg === segments[segments.length - 1]) {
              const localT = seg.len > 0 ? (targetD - accumulated) / seg.len : 0.5;
              const cx = seg.p1[0] + (seg.p2[0] - seg.p1[0]) * localT;
              const cy = seg.p1[1] + (seg.p2[1] - seg.p1[1]) * localT;

              const dx = seg.p2[0] - seg.p1[0];
              const dy = seg.p2[1] - seg.p1[1];
              const cosLat = Math.cos(cy * (Math.PI / 180));
              const dxM = dx * cosLat;
              const dyM = dy;
              const distM = Math.sqrt(dxM * dxM + dyM * dyM);

              if (distM > 0) {
                const sideMult = flipSide ? -1 : 1;
                const nxM = (-dyM / distM) * sideMult;
                const nyM = (dxM / distM) * sideMult;

                const toothLen = 0.000038; // Высота штриха
                const dLng = (nxM * toothLen) / (cosLat || 1);
                const dLat = nyM * toothLen;

                lines.push([[cx - dLng, cy - dLat], [cx + dLng, cy + dLat]]);
              }
              break;
            }
            accumulated += seg.len;
          }
        }
      }
    }

    if (['trench', 'wire', 'ditch_pt', 'escarp', 'counterscarp', 'abatis'].includes(lineType)) {
      let step = 0.00018;
      if (lineType === 'trench') step = 0.00009;
      else if (lineType === 'ditch_pt') step = 0.00012;
      else if (lineType === 'escarp' || lineType === 'counterscarp') step = 0.00010;
      else if (lineType === 'abatis') step = 0.00015;

      let toothLen = 0.00009;
      if (lineType === 'trench') toothLen = 0.000035;
      else if (lineType === 'wire') toothLen = 0.000028;
      else if (lineType === 'ditch_pt') toothLen = 0.000045;
      else if (lineType === 'escarp' || lineType === 'counterscarp') toothLen = 0.000040;
      else if (lineType === 'abatis') toothLen = 0.000035;

      const sideMult = flipSide ? -1 : 1;
      let distanceSinceLastTooth = step;

      for (let i = 0; i < activeCoords.length - 1; i++) {
        const p1 = activeCoords[i];
        const p2 = activeCoords[i + 1];

        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];

        const cosLat = Math.cos((p1[1] + p2[1]) * 0.5 * (Math.PI / 180));
        const dxM = dx * cosLat;
        const dyM = dy;
        const segmentDist = Math.sqrt(dxM * dxM + dyM * dyM);

        if (segmentDist === 0) continue;

        const nxM = (-dyM / segmentDist) * sideMult;
        const nyM = (dxM / segmentDist) * sideMult;
        const dLng = (nxM * toothLen) / (cosLat || 1);
        const dLat = nyM * toothLen;

        const tangentLng = ((dxM / segmentDist) * toothLen) / (cosLat || 1);
        const tangentLat = (dyM / segmentDist) * toothLen;

        let currentT = 0;

        while (currentT < 1) {
          const neededDist = step - distanceSinceLastTooth;
          const remainingSegmentDist = segmentDist * (1 - currentT);

          if (remainingSegmentDist >= neededDist) {
            if (segmentDist > 0) {
              currentT += neededDist / segmentDist;
            } else {
              currentT = 1;
            }
            distanceSinceLastTooth = 0;

            const cx = p1[0] + dx * currentT;
            const cy = p1[1] + dy * currentT;

            if (lineType === 'trench') {
              const tipX = cx + dLng;
              const tipY = cy + dLat;
              lines.push([[cx, cy], [tipX, tipY]]);
            } else if (lineType === 'wire') {
              const halfLng = dLng * 0.75;
              const halfLat = dLat * 0.75;
              lines.push([
                [cx - halfLng + dLng, cy - halfLat + dLat],
                [cx + halfLng - dLng, cy + halfLat - dLat]
              ]);
              lines.push([
                [cx - halfLng - dLng, cy - halfLat - dLat],
                [cx + halfLng + dLng, cy + halfLat + dLat]
              ]);
            } else if (lineType === 'ditch_pt') {
              lines.push([
                [cx - tangentLng * 0.5, cy - tangentLat * 0.5],
                [cx + dLng, cy + dLat]
              ]);
              lines.push([
                [cx + dLng, cy + dLat],
                [cx + tangentLng * 0.5, cy + tangentLat * 0.5]
              ]);
            } else if (lineType === 'escarp') {
              lines.push([[cx, cy], [cx + dLng, cy + dLat]]);
              lines.push([
                [cx + dLng - tangentLng * 0.4, cy + dLat - tangentLat * 0.4],
                [cx + dLng + tangentLng * 0.4, cy + dLat + tangentLat * 0.4]
              ]);
            } else if (lineType === 'counterscarp') {
              lines.push([[cx, cy], [cx - dLng, cy - dLat]]);
              lines.push([
                [cx - dLng - tangentLng * 0.4, cy - dLat - tangentLat * 0.4],
                [cx - dLng + tangentLng * 0.4, cy - dLat + tangentLat * 0.4]
              ]);
            } else if (lineType === 'abatis') {
              lines.push([[cx - dLng * 0.7, cy - dLat * 0.7], [cx + dLng * 0.7, cy + dLat * 0.7]]);
              lines.push([
                [cx - tangentLng * 0.6 + dLng * 0.4, cy - tangentLat * 0.6 + dLat * 0.4],
                [cx + tangentLng * 0.6 - dLng * 0.4, cy + tangentLat * 0.6 - dLat * 0.4]
              ]);
            }
          } else {
            distanceSinceLastTooth += remainingSegmentDist;
            currentT = 1.0;
          }
        }
      }
    }

    return {
      type: 'MultiLineString',
      coordinates: lines
    };
  }

  /**
   * Генерирует полигональную геометрию (Polygon) тактической стрелки по контрольным точкам.
   * Поддерживает сглаживание Catmull-Rom, пропорциональное масштабирование головы и тип хвоста.
   */
  private generateArrowGeometry(origCoords: [number, number][], lineType: string, isSmooth: boolean, lineWidth: number = 3): any {
    if (!origCoords || origCoords.length < 2) {
      return { type: 'Polygon', coordinates: [] };
    }

    const activeCoords = (isSmooth && origCoords.length >= 3)
      ? this.interpolateCatmullRom(origCoords, 16)
      : origCoords;

    const nPoints = activeCoords.length;
    const segmentLengths: number[] = [];
    let totalLength = 0;
    const cosLat = Math.cos(activeCoords[0][1] * (Math.PI / 180));

    for (let i = 0; i < nPoints - 1; i++) {
      const p1 = activeCoords[i];
      const p2 = activeCoords[i + 1];
      const dx = (p2[0] - p1[0]) * cosLat;
      const dy = p2[1] - p1[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      segmentLengths.push(len);
      totalLength += len;
    }

    if (totalLength === 0) {
      return { type: 'Polygon', coordinates: [] };
    }

    const scaleWidth = lineWidth / 3.0; // 3.0 - базовая ширина по умолчанию

    // Геометрические параметры в гео-градусах
    let wStart = 0.00024 * scaleWidth;  // Полуширина у основания (хвост) ~24м
    let wEnd = 0.00010 * scaleWidth;    // Полуширина тела перед головой ~10м
    let hLength = 0.00045 * scaleWidth; // Длина головы ~45м
    let hWidth = 0.00030 * scaleWidth;  // Полуширина ушей головы ~30м
    let tailIndent = 0.0;               // Глубина ласточкиного хвоста

    if (lineType === 'arrow_attack') {
      wStart = 0.00030 * scaleWidth;
      wEnd = 0.00014 * scaleWidth;
      hLength = 0.00055 * scaleWidth;
      hWidth = 0.00038 * scaleWidth;
      tailIndent = wStart * 0.55; // Вдавленный хвост
    } else if (lineType === 'arrow_supporting' || lineType === 'arrow_retreat') {
      wStart = 0.00018 * scaleWidth;
      wEnd = 0.00009 * scaleWidth;
      hLength = 0.00038 * scaleWidth;
      hWidth = 0.00025 * scaleWidth;
      tailIndent = 0.0; // Плоский хвост
    }

    // Пропорциональное сжатие элементов при короткой длине
    if (totalLength < hLength * 1.5) {
      const scale = totalLength / (hLength * 1.5);
      wStart *= scale;
      wEnd *= scale;
      hLength *= scale;
      hWidth *= scale;
      tailIndent *= scale;
    }

    // Поиск точки стыка тела и головы стрелки (hLength метров от конца)
    let headBaseIndex = nPoints - 1;
    let accumulatedDist = 0;
    let headBaseCoord: [number, number] = activeCoords[nPoints - 1];

    while (headBaseIndex > 0) {
      const segLen = segmentLengths[headBaseIndex - 1];
      if (accumulatedDist + segLen >= hLength) {
        const needed = hLength - accumulatedDist;
        const ratio = needed / segLen;
        const pEnd = activeCoords[headBaseIndex];
        const pStart = activeCoords[headBaseIndex - 1];
        headBaseCoord = [
          pEnd[0] + (pStart[0] - pEnd[0]) * ratio,
          pEnd[1] + (pStart[1] - pEnd[1]) * ratio
        ];
        break;
      }
      accumulatedDist += segLen;
      headBaseIndex--;
    }

    if (headBaseIndex === 0) {
      headBaseIndex = 1;
      headBaseCoord = activeCoords[0];
    }

    // Построение оси тела
    const bodyAxisPoints: [number, number][] = [];
    for (let i = 0; i < headBaseIndex; i++) {
      bodyAxisPoints.push(activeCoords[i]);
    }
    bodyAxisPoints.push(headBaseCoord);

    const nBody = bodyAxisPoints.length;
    const leftCoords: [number, number][] = [];
    const rightCoords: [number, number][] = [];

    // Вычисление нормалей и координат левой/правой сторон тела
    for (let i = 0; i < nBody; i++) {
      let dx = 0;
      let dy = 0;

      if (i === 0) {
        dx = (bodyAxisPoints[1][0] - bodyAxisPoints[0][0]) * cosLat;
        dy = bodyAxisPoints[1][1] - bodyAxisPoints[0][1];
      } else if (i === nBody - 1) {
        dx = (bodyAxisPoints[nBody - 1][0] - bodyAxisPoints[nBody - 2][0]) * cosLat;
        dy = bodyAxisPoints[nBody - 1][1] - bodyAxisPoints[nBody - 2][1];
      } else {
        const dx1 = (bodyAxisPoints[i][0] - bodyAxisPoints[i - 1][0]) * cosLat;
        const dy1 = bodyAxisPoints[i][1] - bodyAxisPoints[i - 1][1];
        const dx2 = (bodyAxisPoints[i + 1][0] - bodyAxisPoints[i][0]) * cosLat;
        const dy2 = bodyAxisPoints[i + 1][1] - bodyAxisPoints[i][1];
        dx = (dx1 + dx2) * 0.5;
        dy = (dy1 + dy2) * 0.5;
      }

      const dist = Math.sqrt(dx * dx + dy * dy);
      let nx = 0;
      let ny = 1;
      if (dist > 0) {
        nx = -dy / dist;
        ny = dx / dist;
      }

      const dLng = nx / cosLat;
      const dLat = ny;

      const t = i / (nBody - 1);
      const w = wStart + (wEnd - wStart) * t;

      leftCoords.push([bodyAxisPoints[i][0] + dLng * w, bodyAxisPoints[i][1] + dLat * w]);
      rightCoords.push([bodyAxisPoints[i][0] - dLng * w, bodyAxisPoints[i][1] - dLat * w]);
    }

    // Нормаль для крыльев головы стрелки по конечному сегменту тела
    const lastSegDx = (bodyAxisPoints[nBody - 1][0] - bodyAxisPoints[nBody - 2][0]) * cosLat;
    const lastSegDy = bodyAxisPoints[nBody - 1][1] - bodyAxisPoints[nBody - 2][1];
    const lastSegDist = Math.sqrt(lastSegDx * lastSegDx + lastSegDy * lastSegDy);
    let headNx = 0;
    let headNy = 1;
    if (lastSegDist > 0) {
      headNx = -lastSegDy / lastSegDist;
      headNy = lastSegDx / lastSegDist;
    }

    const headNLng = headNx / cosLat;
    const headNLat = headNy;

    // Координаты левого и правого крыльев
    const leftWing: [number, number] = [
      headBaseCoord[0] + headNLng * hWidth,
      headBaseCoord[1] + headNLat * hWidth
    ];
    const rightWing: [number, number] = [
      headBaseCoord[0] - headNLng * hWidth,
      headBaseCoord[1] - headNLat * hWidth
    ];

    // Острие головы стрелки
    const tip = activeCoords[nPoints - 1];

    // Формирование итогового замкнутого контура полигона
    const polygonCoords: [number, number][] = [];

    // 1. Левая граница тела (от хвоста к голове)
    for (let i = 0; i < nBody; i++) {
      polygonCoords.push(leftCoords[i]);
    }

    // 2. Левое крыло
    polygonCoords.push(leftWing);

    // 3. Вершина
    polygonCoords.push(tip);

    // 4. Правое крыло
    polygonCoords.push(rightWing);

    // 5. Правая граница тела (от головы к хвосту)
    for (let i = nBody - 1; i >= 0; i--) {
      polygonCoords.push(rightCoords[i]);
    }

    // 6. Оформление хвоста
    if (tailIndent > 0) {
      const tailDx = (bodyAxisPoints[1][0] - bodyAxisPoints[0][0]) * cosLat;
      const tailDy = bodyAxisPoints[1][1] - bodyAxisPoints[0][1];
      const tailDist = Math.sqrt(tailDx * tailDx + tailDy * tailDy);
      let tailDirX = 1;
      let tailDirY = 0;
      if (tailDist > 0) {
        tailDirX = tailDx / tailDist;
        tailDirY = tailDy / tailDist;
      }
      const tailDirLng = tailDirX / cosLat;
      const tailDirLat = tailDirY;

      const indentPoint: [number, number] = [
        bodyAxisPoints[0][0] + tailDirLng * tailIndent,
        bodyAxisPoints[0][1] + tailDirLat * tailIndent
      ];
      polygonCoords.push(indentPoint);
    }

    // Замыкающая точка
    polygonCoords.push(polygonCoords[0]);

    return {
      type: 'Polygon',
      coordinates: [polygonCoords]
    };
  }

  generatePatrolGeometry(
    center: [number, number],
    angleDeg: number = 0,
    lengthM: number = 400,
    radiusM: number = 25,
    isDashed: boolean = false
  ): [number, number][][] {
    const centerLng = center[0];
    const centerLat = center[1];
    const latRad = (centerLat * Math.PI) / 180;
    const mPerLat = 111320.0;
    const mPerLng = 111320.0 * Math.cos(latRad);

    const alpha = (angleDeg * Math.PI) / 180;
    const uX = Math.sin(alpha);
    const uY = Math.cos(alpha);
    const vX = Math.cos(alpha);
    const vY = -Math.sin(alpha);

    const d0 = 15.0;
    const L = lengthM;
    const R = Math.max(16.0, Math.min(32.0, radiusM || L * 0.08));
    const lTail = Math.max(25.0, Math.min(50.0, L * 0.12));
    const W = Math.max(14.0, Math.min(22.0, R * 0.85));
    const wingAngle = (25 * Math.PI) / 180;

    const toLngLat = (xM: number, yM: number): [number, number] => [
      centerLng + xM / mPerLng,
      centerLat + yM / mPerLat
    ];

    const p1StartX = d0 * uX;
    const p1StartY = d0 * uY;
    const p1TurnX = p1StartX + L * uX;
    const p1TurnY = p1StartY + L * uY;

    const c1X = p1TurnX + R * vX;
    const c1Y = p1TurnY + R * vY;

    const branch1Pts: [number, number][] = [toLngLat(p1StartX, p1StartY), toLngLat(p1TurnX, p1TurnY)];
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ptX = c1X - R * vX * Math.cos(Math.PI * t) + R * uX * Math.sin(Math.PI * t);
      const ptY = c1Y - R * vY * Math.cos(Math.PI * t) + R * uY * Math.sin(Math.PI * t);
      branch1Pts.push(toLngLat(ptX, ptY));
    }

    const p1ArcEndX = c1X + R * vX;
    const p1ArcEndY = c1Y + R * vY;
    const p1EndX = p1ArcEndX - lTail * uX;
    const p1EndY = p1ArcEndY - lTail * uY;
    branch1Pts.push(toLngLat(p1EndX, p1EndY));

    const w1Cos = W * Math.cos(wingAngle);
    const w1Sin = W * Math.sin(wingAngle);

    const arrow1Left: [number, number] = toLngLat(
      p1EndX + w1Cos * uX + w1Sin * vX,
      p1EndY + w1Cos * uY + w1Sin * vY
    );
    const arrow1Right: [number, number] = toLngLat(
      p1EndX + w1Cos * uX - w1Sin * vX,
      p1EndY + w1Cos * uY - w1Sin * vY
    );
    const p1EndLngLat = toLngLat(p1EndX, p1EndY);

    const arrow1WingL: [number, number][] = [arrow1Left, p1EndLngLat];
    const arrow1WingR: [number, number][] = [arrow1Right, p1EndLngLat];

    const p2StartX = -d0 * uX;
    const p2StartY = -d0 * uY;
    const p2TurnX = p2StartX - L * uX;
    const p2TurnY = p2StartY - L * uY;

    const c2X = p2TurnX - R * vX;
    const c2Y = p2TurnY - R * vY;

    const branch2Pts: [number, number][] = [toLngLat(p2StartX, p2StartY), toLngLat(p2TurnX, p2TurnY)];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ptX = c2X + R * vX * Math.cos(Math.PI * t) - R * uX * Math.sin(Math.PI * t);
      const ptY = c2Y + R * vY * Math.cos(Math.PI * t) - R * uY * Math.sin(Math.PI * t);
      branch2Pts.push(toLngLat(ptX, ptY));
    }

    const p2ArcEndX = c2X - R * vX;
    const p2ArcEndY = c2Y - R * vY;
    const p2EndX = p2ArcEndX + lTail * uX;
    const p2EndY = p2ArcEndY + lTail * uY;
    branch2Pts.push(toLngLat(p2EndX, p2EndY));

    const arrow2Left: [number, number] = toLngLat(
      p2EndX - w1Cos * uX + w1Sin * vX,
      p2EndY - w1Cos * uY + w1Sin * vY
    );
    const arrow2Right: [number, number] = toLngLat(
      p2EndX - w1Cos * uX - w1Sin * vX,
      p2EndY - w1Cos * uY - w1Sin * vY
    );
    const p2EndLngLat = toLngLat(p2EndX, p2EndY);

    const arrow2WingL: [number, number][] = [arrow2Left, p2EndLngLat];
    const arrow2WingR: [number, number][] = [arrow2Right, p2EndLngLat];

    if (isDashed) {
      const dashed1 = this.discretizeToDashes(branch1Pts, 0.00012, 0.00008);
      const dashed2 = this.discretizeToDashes(branch2Pts, 0.00012, 0.00008);
      return [
        ...dashed1,
        arrow1WingL,
        arrow1WingR,
        ...dashed2,
        arrow2WingL,
        arrow2WingR
      ];
    } else {
      return [
        branch1Pts,
        arrow1WingL,
        arrow1WingR,
        branch2Pts,
        arrow2WingL,
        arrow2WingR
      ];
    }
  }
}


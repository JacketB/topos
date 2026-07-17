import { Injectable } from '@angular/core';

export type TacticalLineType = 'trench' | 'comm_open' | 'comm_covered' | 'wire' | string;

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

  /**
   * Генерирует MultiLineString с осью и зубцами/штриховкой для траншеи (МО СССР 1984),
   * открытых и перекрытых ходов сообщения или крестиками для проволочного заграждения с коррекцией проекции Меркатора.
   * Опционально выполняет сглаживание линии по алгоритму Catmull-Rom.
   */
  generateLinearGeometry(origCoords: [number, number][], lineType: TacticalLineType, flipSide: boolean = false, isSmooth: boolean = false): any {
    if (!origCoords || origCoords.length < 2) {
      return { type: 'LineString', coordinates: origCoords || [] };
    }

    // Применяем сглаживание Catmull-Rom, если установлен флаг и точек достаточно для кривой
    const activeCoords = (isSmooth && origCoords.length >= 3)
      ? this.interpolateCatmullRom(origCoords, 12)
      : origCoords;

    const lines: [number, number][][] = [activeCoords];

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

    // Для остальных типов с повторяющимися элементами по всей длине (trench, wire)
    if (lineType === 'trench' || lineType === 'wire') {
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

        // Шаг вдоль линии
        let step = 0.00018;
        if (lineType === 'trench') step = 0.000055;

        const numSteps = Math.max(1, Math.floor(distM / step));

        const sideMult = flipSide ? -1 : 1;
        const nxM = (-dyM / distM) * sideMult;
        const nyM = (dxM / distM) * sideMult;

        // Длина штриха/зубца
        let toothLen = 0.00009;
        if (lineType === 'trench') toothLen = 0.000035;
        else if (lineType === 'wire') toothLen = 0.000028; // Меньший размер перпендикулярных линий для колючей проволоки

        const dLng = (nxM * toothLen) / (cosLat || 1);
        const dLat = nyM * toothLen;

        for (let s = 1; s <= numSteps; s++) {
          const t = s / (numSteps + 1);
          const cx = p1[0] + dx * t;
          const cy = p1[1] + dy * t;

          if (lineType === 'trench') {
            const tipX = cx + dLng;
            const tipY = cy + dLat;
            lines.push([[cx, cy], [tipX, tipY]]);
          } else if (lineType === 'wire') {
            // Крестик МЗП (колючая проволока) меньшего размера
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
          }
        }
      }
    }

    return {
      type: 'MultiLineString',
      coordinates: lines
    };
  }
}

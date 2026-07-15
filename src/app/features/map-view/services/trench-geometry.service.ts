import { Injectable } from '@angular/core';

export type TacticalLineType = 'trench' | 'comm_open' | 'comm_covered' | 'wire' | string;

@Injectable({
  providedIn: 'root'
})
export class TrenchGeometryService {

  /**
   * Генерирует MultiLineString с осью и зубцами/штриховкой для траншеи (МО СССР 1984),
   * открытых и перекрытых ходов сообщения или крестиками для проволочного заграждения с коррекцией проекции Меркатора.
   */
  generateLinearGeometry(origCoords: [number, number][], lineType: TacticalLineType, flipSide: boolean = false): any {
    if (!origCoords || origCoords.length < 2) {
      return { type: 'LineString', coordinates: origCoords || [] };
    }

    const lines: [number, number][][] = [origCoords];

    for (let i = 0; i < origCoords.length - 1; i++) {
      const p1 = origCoords[i];
      const p2 = origCoords[i + 1];

      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];

      // Учет искажения проекции Меркатора по долготе для сохранения строгих 90 градусов на карте
      const cosLat = Math.cos((p1[1] + p2[1]) * 0.5 * (Math.PI / 180));
      const dxM = dx * cosLat;
      const dyM = dy;
      const distM = Math.sqrt(dxM * dxM + dyM * dyM);

      if (distM === 0) continue;

      // Шаг вдоль линии
      let step = 0.00018;
      if (lineType === 'trench' || lineType === 'comm_open') step = 0.000055;
      else if (lineType === 'comm_covered') step = 0.000045; // Перекрытая щель, частые перекладины перекрытия

      const numSteps = Math.max(1, Math.floor(distM / step));

      // Единичный вектор нормали в плоскости экрана (поворот на 90° или -90° при flipSide)
      const sideMult = flipSide ? -1 : 1;
      const nxM = (-dyM / distM) * sideMult;
      const nyM = (dxM / distM) * sideMult;

      // Длина штриха/зубца
      let toothLen = 0.00009;
      if (lineType === 'trench') toothLen = 0.000035;
      else if (lineType === 'comm_open') toothLen = 0.000032;
      else if (lineType === 'comm_covered') toothLen = 0.000038;

      // Перевод нормали из экрана обратно в градусы координат
      const dLng = (nxM * toothLen) / (cosLat || 1);
      const dLat = nyM * toothLen;

      for (let s = 1; s <= numSteps; s++) {
        const t = s / (numSteps + 1);
        const cx = p1[0] + dx * t;
        const cy = p1[1] + dy * t;

        if (lineType === 'trench') {
          // Короткий зубец бруствера (в сторону противника/бруствера)
          const tipX = cx + dLng;
          const tipY = cy + dLat;
          lines.push([[cx, cy], [tipX, tipY]]);
        } else if (lineType === 'comm_open') {
          // Открытый ход сообщения — зубцы с обеих сторон от оси (двухсторонний бруствер) в шахматном порядке
          if (s % 2 === 0) {
            lines.push([[cx, cy], [cx + dLng, cy + dLat]]);
          } else {
            lines.push([[cx, cy], [cx - dLng, cy - dLat]]);
          }
        } else if (lineType === 'comm_covered') {
          // Крытый ход сообщения (перекрытая щель) — сплошные поперечные перекладины перекрытия (наката)
          lines.push([[cx - dLng, cy - dLat], [cx + dLng, cy + dLat]]);
        } else if (lineType === 'wire') {
          // Крестик МЗП
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

    return {
      type: 'MultiLineString',
      coordinates: lines
    };
  }
}

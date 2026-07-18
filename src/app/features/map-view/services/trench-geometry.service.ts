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

  /**
   * Генерирует MultiLineString с осью и зубцами/штриховкой для траншеи (МО СССР 1984),
   * открытых и перекрытых ходов сообщения или крестиками для проволочного заграждения с коррекцией проекции Меркатора.
   * Опционально выполняет сглаживание линии по алгоритму Catmull-Rom.
   */
  generateLinearGeometry(origCoords: [number, number][], lineType: TacticalLineType, flipSide: boolean = false, isSmooth: boolean = false, lineWidth: number = 3): any {
    if (!origCoords || origCoords.length < 2) {
      return { type: 'LineString', coordinates: origCoords || [] };
    }

    if (lineType && lineType.startsWith('arrow_')) {
      return this.generateArrowGeometry(origCoords, lineType, isSmooth, lineWidth);
    }

    // Применяем сглаживание Catmull-Rom, если установлен флаг и точек достаточно для кривой
    const activeCoords = (isSmooth && origCoords.length >= 3)
      ? this.interpolateCatmullRom(origCoords, 12)
      : origCoords;

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
}


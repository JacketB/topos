import { Injectable, inject } from '@angular/core';
import { MinefieldCalcResult } from './minefield-calculation.service';
import { CoordinateConverterService } from '../../../core/services/coordinate-converter.service';

export interface FormularLandmark {
  name: string;
  distanceMeters: number;
  directionDeg: number;
  cornerPoint: 'A' | 'B' | 'C' | 'D';
}

export interface FormularCornerPoint {
  label: 'A' | 'B' | 'C' | 'D';
  lat: number;
  lng: number;
  sk42X?: number;
  sk42Y?: number;
  sk42Formatted?: string;
  wgs84Formatted: string;
}

export interface MinefieldFormularData {
  formularNumber: string;
  unitName: string;
  commanderRankName: string;
  installDate: string;
  calcResult: MinefieldCalcResult;
  corners: FormularCornerPoint[];
  landmarks: FormularLandmark[];
  hasAntiHandlingDevices: boolean;
  antiHandlingCount: number;
  fencesAndSigns: string;
  controlledByUnit: string;
}

@Injectable({
  providedIn: 'root'
})
export class MinefieldFormularService {
  private coordConverter: CoordinateConverterService;

  constructor(coordConverter?: CoordinateConverterService) {
    this.coordConverter = coordConverter || new CoordinateConverterService();
  }

  generateDefaultFormular(calcResult: MinefieldCalcResult, centerLat: number = 53.9006, centerLng: number = 27.5590): MinefieldFormularData {
    const frontM = calcResult.frontLengthM;
    const depthM = Math.max(10, calcResult.depthM);

    const latOffset = (depthM / 111320.0) / 2;
    const lngOffset = (frontM / (111320.0 * Math.cos((centerLat * Math.PI) / 180.0))) / 2;

    const cornerCoords: [number, number, 'A' | 'B' | 'C' | 'D'][] = [
      [centerLat + latOffset, centerLng - lngOffset, 'A'],
      [centerLat + latOffset, centerLng + lngOffset, 'B'],
      [centerLat - latOffset, centerLng + lngOffset, 'C'],
      [centerLat - latOffset, centerLng - lngOffset, 'D']
    ];

    const corners: FormularCornerPoint[] = cornerCoords.map(([lat, lng, label]) => {
      let sk42Formatted = 'X=5972410, Y=3428150';
      try {
        const gk = this.coordConverter.wgs84ToGaussKruger(lat, lng);
        sk42Formatted = `X=${Math.round(gk.x)}, Y=${Math.round(gk.y)}`;
      } catch {}

      return {
        label,
        lat,
        lng,
        sk42Formatted,
        wgs84Formatted: `${lat.toFixed(5)}° с.ш., ${lng.toFixed(5)}° в.д.`
      };
    });

    const landmarks: FormularLandmark[] = [
      {
        name: 'Ориентир №1 (Отдельное дерево на выс. 182.4)',
        distanceMeters: 450,
        directionDeg: 34,
        cornerPoint: 'A'
      },
      {
        name: 'Ориентир №2 (Перекресток грунтовых дорог)',
        distanceMeters: 620,
        directionDeg: 128,
        cornerPoint: 'B'
      }
    ];

    return {
      formularNumber: `МВЗ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      unitName: '1 Инженерно-саперная рота 120 ОМБр',
      commanderRankName: 'капитан Иванов А.С.',
      installDate: new Date().toLocaleDateString('ru-RU'),
      calcResult,
      corners,
      landmarks,
      hasAntiHandlingDevices: calcResult.unremovableMinesCount > 0,
      antiHandlingCount: calcResult.unremovableMinesCount,
      fencesAndSigns: 'Установлены стандартные знаки «МИНЫ» через каждые 50 м с тыльной стороны.',
      controlledByUnit: '1 Мотострелковый батальон (КП «Гранит»)'
    };
  }

  generatePrintableHtml(data: MinefieldFormularData): string {
    const res = data.calcResult;
    const cornerRows = data.corners.map(c => `
      <tr>
        <td style="font-weight:bold;text-align:center;">Угол ${c.label}</td>
        <td>${c.sk42Formatted}</td>
        <td>${c.wgs84Formatted}</td>
      </tr>
    `).join('');

    const landmarkRows = data.landmarks.map((l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${l.name}</td>
        <td>Угол ${l.cornerPoint}</td>
        <td>${l.directionDeg}° (ду ${Math.round(l.directionDeg * 60 / 360).toString().padStart(2, '0')}-00)</td>
        <td>${l.distanceMeters} м</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>ФОРМУЛЯР МИННОГО ПОЛЯ — ${data.formularNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.35; color: #000; background: #fff; margin: 0; padding: 20px; }
    .header-box { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
    .header-box h2 { margin: 0 0 4px 0; font-size: 15pt; text-transform: uppercase; letter-spacing: 1px; }
    .header-box h3 { margin: 0; font-size: 12pt; font-weight: normal; }
    .section-title { font-weight: bold; font-size: 11pt; margin-top: 14px; margin-bottom: 6px; border-bottom: 1px solid #000; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10pt; }
    table, th, td { border: 1px solid #000; }
    th { background: #f0f0f0; padding: 4px 6px; text-align: left; }
    td { padding: 4px 6px; }
    .schema-box { width: 100%; height: 160px; border: 1px dashed #444; margin: 10px 0; display: flex; align-items: center; justify-content: center; background: #fafafa; }
    .signatures-block { margin-top: 25px; width: 100%; display: flex; justify-content: space-between; font-size: 10.5pt; }
    .signature-item { width: 45%; }
    .underline { border-bottom: 1px solid #000; height: 20px; margin-top: 8px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 18px; font-size: 12pt; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Печать формуляра (PDF)</button>
  </div>

  <div class="header-box">
    <div style="text-align: right; font-size: 9pt; font-style: italic;">Экз. № 1</div>
    <h2>ФОРМУЛЯР МИННОГО ПОЛЯ № ${data.formularNumber}</h2>
    <h3>Подразделение: ${data.unitName}</h3>
  </div>

  <div class="section-title">1. ТАКТИКО-ТЕХНИЧЕСКИЕ ДАННЫЕ ЗАГРАЖДЕНИЯ</div>
  <table>
    <tr>
      <td style="width: 35%; font-weight: bold;">Тип минного поля:</td>
      <td>${res.mine.category === 'ptm' ? 'Противотанковое (ПТМП)' : 'Противопехотное (ППМП)'}</td>
      <td style="width: 25%; font-weight: bold;">Марка мин:</td>
      <td>${res.mine.name} (${res.mine.typeLabel})</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Протяженность по фронту:</td>
      <td>${res.frontLengthM} м</td>
      <td style="font-weight: bold;">Глубина заграждения:</td>
      <td>${res.depthM} м (${res.rowsCount} рядов)</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Шаг минирования в ряду:</td>
      <td>${res.stepM} м</td>
      <td style="font-weight: bold;">Плотность минирования:</td>
      <td>${res.densityPerKm.toFixed(1)} мин/км (Pпор = ${res.killProbabilityPct}%)</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Общее количество мин:</td>
      <td style="font-weight: bold; font-size: 11pt;">${res.totalMines} шт.</td>
      <td style="font-weight: bold;">В т.ч. неизвлекаемых:</td>
      <td>${data.antiHandlingCount} шт.</td>
    </tr>
    <tr>
      <td style="font-weight: bold;">Способ установки:</td>
      <td>${res.vehiclesCount > 0 ? 'Механизированный (заградители)' : 'Вручную строевым расчетом'}</td>
      <td style="font-weight: bold;">Дата установки:</td>
      <td>${data.installDate}</td>
    </tr>
  </table>

  <div class="section-title">2. ГЕОДЕЗИЧЕСКИЕ КООРДИНАТЫ ПОВОРОТНЫХ ТОЧЕК (СК-42 / WGS-84)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 15%; text-align: center;">Угловая точка</th>
        <th style="width: 45%;">Координаты в системе СК-42 (Метры)</th>
        <th style="width: 40%;">Координаты WGS-84 (Градусы)</th>
      </tr>
    </thead>
    <tbody>
      ${cornerRows}
    </tbody>
  </table>

  <div class="section-title">3. ПРИВЯЗКА К ОРИЕНТИРАМ НА МЕСТНОСТИ</div>
  <table>
    <thead>
      <tr>
        <th style="width: 5%;">№</th>
        <th style="width: 45%;">Наименование ориентира</th>
        <th style="width: 15%;">Точка поля</th>
        <th style="width: 20%;">Дирекционный угол</th>
        <th style="width: 15%;">Расстояние</th>
      </tr>
    </thead>
    <tbody>
      ${landmarkRows}
    </tbody>
  </table>

  <div class="section-title">4. ОГРАЖДЕНИЕ И НАБЛЮДЕНИЕ</div>
  <p style="margin: 4px 0 8px 0; font-size: 10pt;">${data.fencesAndSigns}</p>
  <p style="margin: 4px 0 8px 0; font-size: 10pt;"><strong>Ответственный за наблюдение и прикрытие огнем:</strong> ${data.controlledByUnit}</p>

  <div class="signatures-block">
    <div class="signature-item">
      <div><strong>Минное поле установил:</strong></div>
      <div style="font-size: 10pt;">Командир подразделения установки</div>
      <div class="underline"></div>
      <div style="font-size: 9pt; text-align: center;">(${data.commanderRankName})</div>
    </div>
    <div class="signature-item">
      <div><strong>Минное поле принял под охрану:</strong></div>
      <div style="font-size: 10pt;">Командир прикрывающего подразделения</div>
      <div class="underline"></div>
      <div style="font-size: 9pt; text-align: center;">(подпись, звание, ФИО)</div>
    </div>
  </div>
</body>
</html>`;
  }

  openPrintWindow(data: MinefieldFormularData) {
    const html = this.generatePrintableHtml(data);
    const win = window.open('', '_blank', 'width=850,height=900');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  }
}

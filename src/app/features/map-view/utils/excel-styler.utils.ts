import * as XLSX from 'xlsx-js-style';

export interface ExcelKpiCard {
  label: string;
  value: string | number;
}

export interface ExcelKeyValueItem {
  label: string;
  value: string | number;
  unit?: string;
  note?: string;
}

export interface ExcelSection {
  sectionTitle: string;
  items: ExcelKeyValueItem[];
}

export interface ExcelCalculationStep {
  parameter: string;
  formula: string;
  calculation: string;
  description: string;
}

export interface ExcelTableSheetOptions {
  title: string;
  subtitle?: string;
  kpiCards?: ExcelKpiCard[];
  headers: string[];
  data: (string | number | null | undefined)[][];
  totals?: (string | number | null | undefined)[];
  customColWidths?: Record<number, number>;
  enableAutofilter?: boolean;
  methodologyTitle?: string;
  calculationSteps?: ExcelCalculationStep[];
}

export interface ExcelKeyValueSheetOptions {
  title: string;
  subtitle?: string;
  sections: ExcelSection[];
  customColWidths?: Record<number, number>;
  methodologyTitle?: string;
  calculationSteps?: ExcelCalculationStep[];
}

export class ExcelStylerUtils {
  private static readonly BORDER_THIN = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } }
  };

  private static readonly BORDER_KPI = {
    top: { style: 'thin', color: { rgb: '93C5FD' } },
    bottom: { style: 'thin', color: { rgb: '93C5FD' } },
    left: { style: 'thin', color: { rgb: '93C5FD' } },
    right: { style: 'thin', color: { rgb: '93C5FD' } }
  };

  private static readonly BORDER_TOTALS = {
    top: { style: 'thin', color: { rgb: 'F59E0B' } },
    bottom: { style: 'double', color: { rgb: 'D97706' } },
    left: { style: 'thin', color: { rgb: 'FDE68A' } },
    right: { style: 'thin', color: { rgb: 'FDE68A' } }
  };

  static autoCalculateColWidths(
    aoa: any[][],
    customWidths?: Record<number, number>,
    minWidth: number = 10,
    maxWidth: number = 65
  ): Array<{ wch: number }> {
    const colCount = Math.max(...aoa.map(row => (Array.isArray(row) ? row.length : 0)), 0);
    const widths: Array<{ wch: number }> = [];

    for (let c = 0; c < colCount; c++) {
      if (customWidths && customWidths[c]) {
        widths.push({ wch: customWidths[c] });
        continue;
      }

      let maxLen = minWidth;
      for (let r = 0; r < aoa.length; r++) {
        const val = aoa[r]?.[c];
        if (val !== null && val !== undefined && val !== '') {
          const str = String(val);
          if (!str.startsWith('ТОПОС') && !str.startsWith('ВЕДОМОСТЬ') && !str.startsWith('РАСЧЕТ')) {
            const len = this.getVisualStringLength(str);
            if (len > maxLen) {
              maxLen = len;
            }
          }
        }
      }

      const padded = Math.min(maxWidth, Math.max(minWidth, maxLen + 3));
      widths.push({ wch: padded });
    }

    return widths;
  }

  private static getVisualStringLength(str: string): number {
    let len = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code >= 0x0400 && code <= 0x04ff) {
        len += 1.1;
      } else if (code > 0x7f) {
        len += 1.2;
      } else {
        len += 1.0;
      }
    }
    return Math.ceil(len);
  }

  static buildTableSheet(options: ExcelTableSheetOptions): XLSX.WorkSheet {
    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];
    const rowHeights: Array<{ hpt: number }> = [];

    const numCols = Math.max(
      options.headers.length,
      options.kpiCards ? options.kpiCards.length * 2 : 1,
      4
    );

    const titleRowIdx = aoa.length;
    aoa.push([options.title]);
    merges.push({ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: numCols - 1 } });
    rowHeights.push({ hpt: 28 });

    const subtitleRowIdx = aoa.length;
    if (options.subtitle) {
      aoa.push([options.subtitle]);
    } else {
      const dateStr = `Сформировано в Topos GIS: ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      aoa.push([dateStr]);
    }
    merges.push({ s: { r: subtitleRowIdx, c: 0 }, e: { r: subtitleRowIdx, c: numCols - 1 } });
    rowHeights.push({ hpt: 19 });

    aoa.push([]);
    rowHeights.push({ hpt: 8 });

    let kpiLabelRowIdx = -1;
    let kpiValueRowIdx = -1;

    if (options.kpiCards && options.kpiCards.length > 0) {
      const kpiLabelRow: any[] = [];
      const kpiValueRow: any[] = [];

      options.kpiCards.forEach(card => {
        kpiLabelRow.push(card.label, '');
        kpiValueRow.push(card.value, '');
      });

      kpiLabelRowIdx = aoa.length;
      aoa.push(kpiLabelRow);
      rowHeights.push({ hpt: 18 });

      kpiValueRowIdx = aoa.length;
      aoa.push(kpiValueRow);
      rowHeights.push({ hpt: 24 });

      for (let i = 0; i < options.kpiCards.length; i++) {
        merges.push({ s: { r: kpiLabelRowIdx, c: i * 2 }, e: { r: kpiLabelRowIdx, c: i * 2 + 1 } });
        merges.push({ s: { r: kpiValueRowIdx, c: i * 2 }, e: { r: kpiValueRowIdx, c: i * 2 + 1 } });
      }

      aoa.push([]);
      rowHeights.push({ hpt: 10 });
    }

    const tableHeaderRowIndex = aoa.length;
    aoa.push(options.headers);
    rowHeights.push({ hpt: 24 });

    const dataStartRowIdx = aoa.length;
    for (const row of options.data) {
      aoa.push(row);
      rowHeights.push({ hpt: 19 });
    }
    const dataEndRowIdx = aoa.length - 1;

    let totalsRowIdx = -1;
    if (options.totals && options.totals.length > 0) {
      totalsRowIdx = aoa.length;
      aoa.push(options.totals);
      rowHeights.push({ hpt: 22 });
    }

    let methodologyMeta: { titleRowIdx: number; headerRowIdx: number; startIdx: number; endIdx: number } | null = null;
    if (options.calculationSteps && options.calculationSteps.length > 0) {
      methodologyMeta = this.appendMethodologyBlock(
        aoa,
        merges,
        rowHeights,
        options.calculationSteps,
        numCols,
        options.methodologyTitle
      );
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;
    ws['!cols'] = this.autoCalculateColWidths(aoa, options.customColWidths);

    if (options.enableAutofilter !== false && options.data.length > 0) {
      const startCol = XLSX.utils.encode_col(0);
      const endCol = XLSX.utils.encode_col(options.headers.length - 1);
      const startRow = tableHeaderRowIndex + 1;
      const endRow = tableHeaderRowIndex + 1 + options.data.length;
      ws['!autofilter'] = { ref: `${startCol}${startRow}:${endCol}${endRow}` };
    }

    this.applyTableStyles(
      ws,
      numCols,
      titleRowIdx,
      subtitleRowIdx,
      kpiLabelRowIdx,
      kpiValueRowIdx,
      options.kpiCards?.length || 0,
      tableHeaderRowIndex,
      dataStartRowIdx,
      dataEndRowIdx,
      totalsRowIdx,
      options.headers.length
    );

    if (methodologyMeta) {
      this.applyMethodologyStyles(ws, methodologyMeta, numCols);
    }

    return ws;
  }

  private static applyTableStyles(
    ws: XLSX.WorkSheet,
    numCols: number,
    titleRowIdx: number,
    subtitleRowIdx: number,
    kpiLabelRowIdx: number,
    kpiValueRowIdx: number,
    kpiCount: number,
    headerRowIdx: number,
    dataStartIdx: number,
    dataEndIdx: number,
    totalsRowIdx: number,
    headersCount: number
  ) {
    for (let c = 0; c < numCols; c++) {
      const titleCellAddr = XLSX.utils.encode_cell({ r: titleRowIdx, c });
      if (!ws[titleCellAddr]) ws[titleCellAddr] = { t: 's', v: '' };
      ws[titleCellAddr].s = {
        fill: { fgColor: { rgb: '1E3A8A' } },
        font: { name: 'Calibri', sz: 12.5, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };

      const subCellAddr = XLSX.utils.encode_cell({ r: subtitleRowIdx, c });
      if (!ws[subCellAddr]) ws[subCellAddr] = { t: 's', v: '' };
      ws[subCellAddr].s = {
        fill: { fgColor: { rgb: 'F1F5F9' } },
        font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: '475569' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    if (kpiCount > 0 && kpiLabelRowIdx >= 0 && kpiValueRowIdx >= 0) {
      for (let i = 0; i < kpiCount; i++) {
        for (let subC = 0; subC < 2; subC++) {
          const col = i * 2 + subC;
          const lblAddr = XLSX.utils.encode_cell({ r: kpiLabelRowIdx, c: col });
          if (!ws[lblAddr]) ws[lblAddr] = { t: 's', v: '' };
          ws[lblAddr].s = {
            fill: { fgColor: { rgb: 'DBEAFE' } },
            font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '1E40AF' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: this.BORDER_KPI
          };

          const valAddr = XLSX.utils.encode_cell({ r: kpiValueRowIdx, c: col });
          if (!ws[valAddr]) ws[valAddr] = { t: 's', v: '' };
          ws[valAddr].s = {
            fill: { fgColor: { rgb: 'EFF6FF' } },
            font: { name: 'Calibri', sz: 11.5, bold: true, color: { rgb: '1D4ED8' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: this.BORDER_KPI
          };
        }
      }
    }

    for (let c = 0; c < headersCount; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
      if (ws[cellAddr]) {
        ws[cellAddr].s = {
          fill: { fgColor: { rgb: '2563EB' } },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '1D4ED8' } },
            bottom: { style: 'medium', color: { rgb: '1E3A8A' } },
            left: { style: 'thin', color: { rgb: '60A5FA' } },
            right: { style: 'thin', color: { rgb: '60A5FA' } }
          }
        };
      }
    }

    for (let r = dataStartIdx; r <= dataEndIdx; r++) {
      const isOdd = (r - dataStartIdx) % 2 === 1;
      const bgRgb = isOdd ? 'F8FAFC' : 'FFFFFF';

      for (let c = 0; c < headersCount; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (ws[cellAddr]) {
          const val = ws[cellAddr].v;
          let align: 'left' | 'center' | 'right' = 'left';

          if (typeof val === 'number') {
            align = 'right';
          } else if (c === 0 || (typeof val === 'string' && (val.includes('км') || val.includes('м') || val.includes('Очередь') || val.includes('кат.')))) {
            align = 'center';
          }

          ws[cellAddr].s = {
            fill: { fgColor: { rgb: bgRgb } },
            font: { name: 'Calibri', sz: 10, color: { rgb: '0F172A' } },
            alignment: { horizontal: align, vertical: 'center' },
            border: this.BORDER_THIN
          };
        }
      }
    }

    if (totalsRowIdx >= 0) {
      for (let c = 0; c < headersCount; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r: totalsRowIdx, c });
        if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };
        const val = ws[cellAddr].v;
        const align: 'left' | 'center' | 'right' = typeof val === 'number' ? 'right' : c === 0 ? 'left' : 'center';

        ws[cellAddr].s = {
          fill: { fgColor: { rgb: 'FEF3C7' } },
          font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: '92400E' } },
          alignment: { horizontal: align, vertical: 'center' },
          border: this.BORDER_TOTALS
        };
      }
    }
  }

  static buildKeyValueSheet(options: ExcelKeyValueSheetOptions): XLSX.WorkSheet {
    const aoa: any[][] = [];
    const merges: XLSX.Range[] = [];
    const rowHeights: Array<{ hpt: number }> = [];

    const numCols = 4;

    const titleRowIdx = aoa.length;
    aoa.push([options.title]);
    merges.push({ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: numCols - 1 } });
    rowHeights.push({ hpt: 28 });

    const subtitleRowIdx = aoa.length;
    if (options.subtitle) {
      aoa.push([options.subtitle]);
    } else {
      const dateStr = `Topos GIS — Военно-инженерный расчетный модуль (${new Date().toLocaleDateString('ru-RU')})`;
      aoa.push([dateStr]);
    }
    merges.push({ s: { r: subtitleRowIdx, c: 0 }, e: { r: subtitleRowIdx, c: numCols - 1 } });
    rowHeights.push({ hpt: 19 });

    aoa.push([]);
    rowHeights.push({ hpt: 10 });

    const sectionIndices: Array<{ secTitleIdx: number; secHeaderIdx: number; startIdx: number; endIdx: number }> = [];

    for (const sec of options.sections) {
      const secRowIndex = aoa.length;
      aoa.push([sec.sectionTitle]);
      merges.push({ s: { r: secRowIndex, c: 0 }, e: { r: secRowIndex, c: numCols - 1 } });
      rowHeights.push({ hpt: 22 });

      const secHeaderIdx = aoa.length;
      aoa.push(['Параметр / Показатель', 'Значение', 'Ед. изм.', 'Примечание']);
      rowHeights.push({ hpt: 20 });

      const startIdx = aoa.length;
      for (const item of sec.items) {
        aoa.push([
          item.label,
          item.value,
          item.unit || '',
          item.note || ''
        ]);
        rowHeights.push({ hpt: 18 });
      }
      const endIdx = aoa.length - 1;

      sectionIndices.push({ secTitleIdx: secRowIndex, secHeaderIdx, startIdx, endIdx });

      aoa.push([]);
      rowHeights.push({ hpt: 8 });
    }

    let methodologyMeta: { titleRowIdx: number; headerRowIdx: number; startIdx: number; endIdx: number } | null = null;
    if (options.calculationSteps && options.calculationSteps.length > 0) {
      methodologyMeta = this.appendMethodologyBlock(
        aoa,
        merges,
        rowHeights,
        options.calculationSteps,
        numCols,
        options.methodologyTitle
      );
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;
    const defaultWidths = options.calculationSteps && options.calculationSteps.length > 0
      ? { 0: 42, 1: 26, 2: 32, 3: 45 }
      : { 0: 44, 1: 24, 2: 15, 3: 34 };
    ws['!cols'] = this.autoCalculateColWidths(
      aoa,
      options.customColWidths || defaultWidths
    );

    for (let c = 0; c < numCols; c++) {
      const titleCellAddr = XLSX.utils.encode_cell({ r: titleRowIdx, c });
      if (!ws[titleCellAddr]) ws[titleCellAddr] = { t: 's', v: '' };
      ws[titleCellAddr].s = {
        fill: { fgColor: { rgb: '1E3A8A' } },
        font: { name: 'Calibri', sz: 12.5, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };

      const subCellAddr = XLSX.utils.encode_cell({ r: subtitleRowIdx, c });
      if (!ws[subCellAddr]) ws[subCellAddr] = { t: 's', v: '' };
      ws[subCellAddr].s = {
        fill: { fgColor: { rgb: 'F1F5F9' } },
        font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: '475569' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    for (const secMeta of sectionIndices) {
      for (let c = 0; c < numCols; c++) {
        const secTitleAddr = XLSX.utils.encode_cell({ r: secMeta.secTitleIdx, c });
        if (!ws[secTitleAddr]) ws[secTitleAddr] = { t: 's', v: '' };
        ws[secTitleAddr].s = {
          fill: { fgColor: { rgb: '1E40AF' } },
          font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
          alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
        };

        const secHdrAddr = XLSX.utils.encode_cell({ r: secMeta.secHeaderIdx, c });
        if (ws[secHdrAddr]) {
          ws[secHdrAddr].s = {
            fill: { fgColor: { rgb: 'E2E8F0' } },
            font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: '1E293B' } },
            alignment: { horizontal: c === 1 ? 'right' : c === 2 ? 'center' : 'left', vertical: 'center' },
            border: this.BORDER_THIN
          };
        }
      }

      for (let r = secMeta.startIdx; r <= secMeta.endIdx; r++) {
        const isOdd = (r - secMeta.startIdx) % 2 === 1;
        const bgRgb = isOdd ? 'F8FAFC' : 'FFFFFF';

        for (let c = 0; c < numCols; c++) {
          const cellAddr = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };

          if (c === 0) {
            ws[cellAddr].s = {
              fill: { fgColor: { rgb: bgRgb } },
              font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '334155' } },
              alignment: { horizontal: 'left', vertical: 'center' },
              border: this.BORDER_THIN
            };
          } else if (c === 1) {
            ws[cellAddr].s = {
              fill: { fgColor: { rgb: bgRgb } },
              font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1D4ED8' } },
              alignment: { horizontal: 'right', vertical: 'center' },
              border: this.BORDER_THIN
            };
          } else if (c === 2) {
            ws[cellAddr].s = {
              fill: { fgColor: { rgb: bgRgb } },
              font: { name: 'Calibri', sz: 9.5, color: { rgb: '64748B' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: this.BORDER_THIN
            };
          } else {
            ws[cellAddr].s = {
              fill: { fgColor: { rgb: bgRgb } },
              font: { name: 'Calibri', sz: 9.5, italic: true, color: { rgb: '64748B' } },
              alignment: { horizontal: 'left', vertical: 'center' },
              border: this.BORDER_THIN
            };
          }
        }
      }
    }

    if (methodologyMeta) {
      this.applyMethodologyStyles(ws, methodologyMeta, numCols);
    }

    return ws;
  }

  private static appendMethodologyBlock(
    aoa: any[][],
    merges: XLSX.Range[],
    rowHeights: Array<{ hpt: number }>,
    steps: ExcelCalculationStep[],
    numCols: number,
    blockTitle?: string
  ): { titleRowIdx: number; headerRowIdx: number; startIdx: number; endIdx: number } {
    aoa.push([]);
    rowHeights.push({ hpt: 12 });

    const titleRowIdx = aoa.length;
    aoa.push([blockTitle || 'ПОРЯДОК И МЕТОДИКА РАСЧЕТА (ФОРМУЛЫ И ДЕЙСТВИЯ)']);
    merges.push({ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: numCols - 1 } });
    rowHeights.push({ hpt: 22 });

    const headerRowIdx = aoa.length;
    aoa.push(['№ / Расчетный показатель', 'Математическая формула', 'Расчетные действия (подстановка)', 'Пояснение и нормативная база']);
    rowHeights.push({ hpt: 20 });

    const startIdx = aoa.length;
    for (const step of steps) {
      const rowIdx = aoa.length;
      aoa.push([step.parameter, step.formula, step.calculation, step.description]);
      if (numCols > 4) {
        merges.push({ s: { r: rowIdx, c: 3 }, e: { r: rowIdx, c: numCols - 1 } });
      }
      rowHeights.push({ hpt: 24 });
    }
    const endIdx = aoa.length - 1;

    return { titleRowIdx, headerRowIdx, startIdx, endIdx };
  }

  private static applyMethodologyStyles(
    ws: XLSX.WorkSheet,
    meta: { titleRowIdx: number; headerRowIdx: number; startIdx: number; endIdx: number },
    numCols: number
  ): void {
    for (let c = 0; c < numCols; c++) {
      const titleCellAddr = XLSX.utils.encode_cell({ r: meta.titleRowIdx, c });
      if (!ws[titleCellAddr]) ws[titleCellAddr] = { t: 's', v: '' };
      ws[titleCellAddr].s = {
        fill: { fgColor: { rgb: '1E3A8A' } },
        font: { name: 'Calibri', sz: 10.5, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
      };

      const hdrAddr = XLSX.utils.encode_cell({ r: meta.headerRowIdx, c });
      if (!ws[hdrAddr]) ws[hdrAddr] = { t: 's', v: '' };
      ws[hdrAddr].s = {
        fill: { fgColor: { rgb: '3B82F6' } },
        font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: c === 1 ? 'center' : 'left', vertical: 'center' },
        border: this.BORDER_THIN
      };
    }

    for (let r = meta.startIdx; r <= meta.endIdx; r++) {
      const isOdd = (r - meta.startIdx) % 2 === 1;
      const bgRgb = isOdd ? 'F8FAFC' : 'FFFFFF';

      for (let c = 0; c < numCols; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };

        let fontColor = '0F172A';
        let bold = false;
        let align: 'left' | 'center' | 'right' = 'left';
        let sz = 10;
        let wrapText = false;

        if (c === 0) {
          bold = true;
          fontColor = '1E293B';
        } else if (c === 1) {
          bold = true;
          fontColor = '1E40AF';
          align = 'center';
        } else if (c === 2) {
          fontColor = '0F172A';
        } else {
          fontColor = '475569';
          sz = 9.5;
          wrapText = true;
        }

        ws[cellAddr].s = {
          fill: { fgColor: { rgb: bgRgb } },
          font: { name: 'Calibri', sz, bold, color: { rgb: fontColor } },
          alignment: { horizontal: align, vertical: 'center', wrapText },
          border: this.BORDER_THIN
        };
      }
    }
  }

  static async saveWorkbookWithDialog(wb: XLSX.WorkBook, defaultFilename: string): Promise<boolean> {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
    const safeName = defaultFilename.endsWith('.xlsx') ? defaultFilename : `${defaultFilename}.xlsx`;

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosenPath = await invoke<string | null>('choose_save_path', {
          defaultName: safeName,
          extension: 'xlsx',
          title: 'Сохранить расчет Excel как...'
        });

        if (!chosenPath) {
          return false;
        }

        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const bytes = Array.from(new Uint8Array(buf));
        await invoke<string>('save_scenario_to_path', {
          targetPath: chosenPath,
          content: bytes
        });
        return true;
      } catch (e) {
        console.warn('Tauri save dialog fallback to standard download:', e);
      }
    }

    if (typeof window !== 'undefined' && (window as any).showSaveFilePicker) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: safeName,
          types: [
            {
              description: 'Книга Excel (*.xlsx)',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
              }
            }
          ]
        });
        const writable = await handle.createWritable();
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        await writable.write(buf);
        await writable.close();
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return false;
        }
      }
    }

    XLSX.writeFile(wb, safeName);
    return true;
  }
}

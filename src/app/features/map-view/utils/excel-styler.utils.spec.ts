import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { ExcelStylerUtils } from './excel-styler.utils';

describe('ExcelStylerUtils', () => {
  it('should build a formatted and styled table sheet with cell styles, merges, and widths', () => {
    const ws = ExcelStylerUtils.buildTableSheet({
      title: 'ТЕСТОВАЯ ВЕДОМОСТЬ',
      subtitle: 'Подзаголовок отчета',
      kpiCards: [
        { label: 'Всего личного состава', value: '120 чел.' },
        { label: 'Всего техники', value: '24 ед.' }
      ],
      headers: ['№', 'Наименование', 'Кол-во', 'Примечание'],
      data: [
        [1, '1 мотострелковый взвод', 30, 'Штатный состав'],
        [2, '2 мотострелковый взвод', 30, 'Штатный состав']
      ],
      totals: ['ИТОГО', '', 60, '']
    });

    expect(ws).toBeDefined();
    expect(ws['!merges']).toBeDefined();
    expect(ws['!merges']!.length).toBeGreaterThanOrEqual(3);
    expect(ws['!cols']).toBeDefined();
    expect(ws['!rows']).toBeDefined();
    expect(ws['!autofilter']).toBeDefined();

    const titleCell = ws['A1'];
    expect(titleCell).toBeDefined();
    expect(titleCell.s).toBeDefined();
    expect(titleCell.s.fill.fgColor.rgb).toBe('1E3A8A');
    expect(titleCell.s.font.bold).toBe(true);

    const headerCell = ws['A7'];
    expect(headerCell).toBeDefined();
    expect(headerCell.s).toBeDefined();
    expect(headerCell.s.fill.fgColor.rgb).toBe('2563EB');
  });

  it('should build a structured key-value sheet with sections, styles, and custom widths', () => {
    const ws = ExcelStylerUtils.buildKeyValueSheet({
      title: 'СВОДНЫЕ ПОКАЗАТЕЛИ',
      sections: [
        {
          sectionTitle: '1. ИСХОДНЫЕ ДАННЫЕ',
          items: [
            { label: 'Длина маршрута', value: 100, unit: 'км', note: 'Основная трасса' },
            { label: 'Маршевая скорость', value: 50, unit: 'км/ч', note: 'Средняя скорость' }
          ]
        }
      ]
    });

    expect(ws).toBeDefined();
    expect(ws['!merges']).toBeDefined();
    expect(ws['!cols']).toBeDefined();
    expect(ws['!cols']!.length).toBe(4);

    const titleCell = ws['A1'];
    expect(titleCell.s.fill.fgColor.rgb).toBe('1E3A8A');

    const secTitleCell = ws['A4'];
    expect(secTitleCell.s.fill.fgColor.rgb).toBe('1E40AF');
  });
});

import { Component, inject, signal, computed, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SystemDiagnosticsService,
  DiagnosticTestItem,
  DiagnosticSuiteId,
  DiagnosticStatus
} from '../../services/system-diagnostics.service';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { checkIsTauri } from '../../../../core/utils/tauri.utils';

@Component({
  selector: 'app-system-diagnostics-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './system-diagnostics-modal.component.html',
  styleUrl: './system-diagnostics-modal.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SystemDiagnosticsModalComponent {
  readonly vm = inject(MapViewModel);
  readonly diagnosticsService = inject(SystemDiagnosticsService);

  readonly filterStatus = signal<'all' | 'error' | 'warning' | 'success'>('all');
  readonly selectedSuite = signal<'all' | DiagnosticSuiteId>('all');
  readonly expandedTestIds = signal<Set<string>>(new Set());
  readonly reportCopied = signal<boolean>(false);

  readonly suites: { id: 'all' | DiagnosticSuiteId; label: string }[] = [
    { id: 'all', label: 'Все подсистемы' },
    { id: 'database', label: 'База SQLite' },
    { id: 'routing', label: 'Маршрутизация' },
    { id: 'cartography', label: 'PMTiles & WebGL' },
    { id: 'terrain', label: 'Рельеф DEM' },
    { id: 'dispatch', label: 'Оповещение' },
    { id: 'storage', label: 'Хранилище' },
    { id: 'calculators', label: 'Калькуляторы' },
    { id: 'export', label: 'Экспорт' }
  ];

  readonly filteredTests = computed<DiagnosticTestItem[]>(() => {
    const list = this.diagnosticsService.tests();
    const statusFilter = this.filterStatus();
    const suiteFilter = this.selectedSuite();

    return list.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      if (suiteFilter !== 'all' && t.suiteId !== suiteFilter) {
        return false;
      }
      return true;
    });
  });

  constructor() {
    this.diagnosticsService.setMapInstance(this.vm.getMapInstance());
  }

  onClose() {
    this.vm.closeDiagnosticsModal();
  }

  async onRunAll() {
    this.diagnosticsService.setMapInstance(this.vm.getMapInstance());
    await this.diagnosticsService.runAllDiagnostics();
  }

  async onRunSingle(testId: string, event: MouseEvent) {
    event.stopPropagation();
    this.diagnosticsService.setMapInstance(this.vm.getMapInstance());
    await this.diagnosticsService.runSingleTest(testId);
  }

  toggleDetails(testId: string) {
    this.expandedTestIds.update(set => {
      const next = new Set(set);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  }

  isExpanded(testId: string): boolean {
    return this.expandedTestIds().has(testId);
  }

  async onExportReport() {
    const reportText = this.diagnosticsService.generateReportText();
    const filename = `topos_diagnostics_${new Date().toISOString().slice(0, 10)}.txt`;
    const isTauri = await checkIsTauri();

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosenPath = await invoke<string | null>('choose_save_path', {
          defaultName: filename,
          extension: 'txt',
          title: 'Сохранить отчет диагностики'
        });
        if (chosenPath) {
          const encoder = new TextEncoder();
          const bytes = Array.from(encoder.encode(reportText));
          await invoke('save_scenario_to_path', { targetPath: chosenPath, content: bytes });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async onCopyReport() {
    const reportText = this.diagnosticsService.generateReportText();
    try {
      await navigator.clipboard.writeText(reportText);
      this.reportCopied.set(true);
      setTimeout(() => this.reportCopied.set(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = reportText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.reportCopied.set(true);
      setTimeout(() => this.reportCopied.set(false), 2500);
    }
  }

  getMetricsEntries(metrics?: Record<string, string | number>): [string, string | number][] {
    if (!metrics) return [];
    return Object.entries(metrics);
  }
}

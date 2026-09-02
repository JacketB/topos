import { Component, inject, signal, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { ProjectManagerService, ProjectInfo } from '../../../../core/services/project-manager.service';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './project-modal.component.html',
  styleUrl: './project-modal.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectModalComponent {
  readonly vm = inject(MapViewModel);
  readonly projectService = inject(ProjectManagerService);

  readonly isCreateMode = signal<boolean>(false);
  readonly newProjectName = signal<string>('');
  readonly isSaveAsMode = signal<boolean>(false);
  readonly saveAsProjectName = signal<string>('');

  onCreateNewClick() {
    this.newProjectName.set(`Проект_${new Date().toISOString().slice(0, 10)}`);
    this.isCreateMode.set(true);
    this.isSaveAsMode.set(false);
  }

  onConfirmCreate() {
    const name = this.newProjectName().trim() || 'Новый проект';
    this.vm.tacticalMapService.clearAllTacticalFeatures();
    const created = this.projectService.createNewProject(name);
    this.isCreateMode.set(false);
    this.projectService.closeProjectModal();
  }

  onCancelCreate() {
    this.isCreateMode.set(false);
  }

  onSaveAsClick() {
    this.saveAsProjectName.set(this.projectService.currentProject().name);
    this.isSaveAsMode.set(true);
    this.isCreateMode.set(false);
  }

  async onConfirmSaveAs() {
    const name = this.saveAsProjectName().trim() || this.projectService.currentProject().name;
    const data = this.vm.tacticalMapService.exportScenarioData();
    this.isSaveAsMode.set(false);
    this.projectService.closeProjectModal();
    await this.projectService.saveProjectAs(data, name);
  }

  onCancelSaveAs() {
    this.isSaveAsMode.set(false);
  }

  async onQuickSave() {
    const data = this.vm.tacticalMapService.exportScenarioData();
    this.projectService.closeProjectModal();
    await this.projectService.saveProject(data);
  }

  async onOpenRecent(proj: ProjectInfo) {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (isTauri && proj.filePath) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const fileContent = await invoke<string>('read_file_content', { filePath: proj.filePath });
        const parsed = JSON.parse(fileContent);
        if (parsed) {
          proj.data = parsed;
          this.vm.tacticalMapService.importScenarioData(parsed);
          this.projectService.setCurrentProject(proj);
          this.projectService.closeProjectModal();
          return;
        }
      } catch (e) {
        console.warn(e);
      }
    }
    if (proj.data) {
      this.vm.tacticalMapService.importScenarioData(proj.data);
    }
    this.projectService.setCurrentProject(proj);
    this.projectService.closeProjectModal();
  }

  onDeleteRecent(proj: ProjectInfo, event: MouseEvent) {
    event.stopPropagation();
    this.projectService.deleteProject(proj.id);
  }

  async onBrowseFileClick() {
    this.projectService.closeProjectModal();
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (isTauri) {
      const res = await this.projectService.openProjectFromDiskWithDialog();
      if (res && res.data) {
        this.vm.tacticalMapService.importScenarioData(res.data);
      }
    } else {
      const fileInput = document.querySelector('input[type="file"][accept=".tps,.json"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  }
}

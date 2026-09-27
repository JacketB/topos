import { Component, inject, signal, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectManagerService, ProjectInfo } from '../../core/services/project-manager.service';
import { checkIsTauri } from '../../core/utils/tauri.utils';

@Component({
  selector: 'app-projects-view',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './projects-view.html',
  styleUrl: './projects-view.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectsView {
  readonly projectService = inject(ProjectManagerService);
  readonly router = inject(Router);

  readonly newProjectName = signal<string>(`Проект_${new Date().toISOString().slice(0, 10)}`);
  readonly isCreating = signal<boolean>(false);

  onCreateProject() {
    const name = this.newProjectName().trim() || 'Новый тактический проект';
    const newProj = this.projectService.createNewProject(name);
    this.projectService.pendingLoadProjectData.set({
      type: 'topos_scenario',
      placedSymbols: [],
      objectGroups: []
    });
    this.router.navigate(['/map']);
  }

  async onOpenProject(proj: ProjectInfo) {
    this.projectService.setCurrentProject(proj);
    const isTauri = await checkIsTauri();
    if (isTauri && proj.filePath) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const fileContent = await invoke<string>('read_file_content', { filePath: proj.filePath });
        const parsed = JSON.parse(fileContent);
        if (parsed) {
          proj.data = parsed;
          this.projectService.saveProjectState(parsed, proj.name);
          this.projectService.pendingLoadProjectData.set(parsed);
          this.router.navigate(['/map']);
          return;
        }
      } catch (e) {
        console.warn(e);
      }
    }
    if (proj.data) {
      this.projectService.pendingLoadProjectData.set(proj.data);
    }
    this.router.navigate(['/map']);
  }

  onContinueCurrent() {
    const cur = this.projectService.currentProject();
    if (cur.data) {
      this.projectService.pendingLoadProjectData.set(cur.data);
    }
    this.router.navigate(['/map']);
  }

  onDeleteProject(proj: ProjectInfo, event: MouseEvent) {
    event.stopPropagation();
    this.projectService.deleteProject(proj.id);
  }

  async onOpenFileClick() {
    const isTauri = await checkIsTauri();
    if (isTauri) {
      const result = await this.projectService.openProjectFromDiskWithDialog();
      if (result) {
        this.projectService.pendingLoadProjectData.set(result.data);
        this.router.navigate(['/map']);
      }
    } else {
      const fileInput = document.getElementById('project-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed && (parsed.type === 'topos_scenario' || Array.isArray(parsed.symbols) || Array.isArray(parsed.placedSymbols))) {
            const name = file.name.replace(/\.(tps|json)$/i, '');
            const newProj = this.projectService.createNewProject(name);
            newProj.data = parsed;
            this.projectService.saveProjectState(parsed, name);
            this.projectService.pendingLoadProjectData.set(parsed);
            this.router.navigate(['/map']);
          } else {
            alert('Выбранный файл не является корректным проектом Topos (.tps)');
          }
        } catch (err) {
          console.error(err);
          alert('Ошибка чтения файла проекта');
        }
      };
      reader.readAsText(file);
    }
  }
}

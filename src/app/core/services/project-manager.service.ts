import { Injectable, signal } from '@angular/core';

export interface ProjectInfo {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  symbolsCount: number;
  linesCount: number;
  areasCount: number;
  routesCount: number;
  filePath?: string;
  data?: any;
}

const STORAGE_KEY_RECENT = 'topos_recent_projects';
const STORAGE_KEY_CURRENT_ID = 'topos_current_project_id';

@Injectable({
  providedIn: 'root'
})
export class ProjectManagerService {
  readonly recentProjects = signal<ProjectInfo[]>(this.loadRecentProjects());
  readonly currentProject = signal<ProjectInfo>(this.loadInitialProject());
  readonly pendingLoadProjectData = signal<any | null>(null);
  readonly isProjectModalOpen = signal<boolean>(false);
  readonly saveStatus = signal<{ state: 'saved' | 'saving' | 'error'; message: string } | null>(null);
  private statusTimer: any = null;

  private loadRecentProjects(): ProjectInfo[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RECENT);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'default_tactical_scenario',
        name: 'Тактический сценарий по умолчанию',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        symbolsCount: 0,
        linesCount: 0,
        areasCount: 0,
        routesCount: 0
      }
    ];
  }

  private loadInitialProject(): ProjectInfo {
    const recents = this.loadRecentProjects();
    const currentId = localStorage.getItem(STORAGE_KEY_CURRENT_ID);
    if (currentId) {
      const found = recents.find(p => p.id === currentId);
      if (found) return found;
    }
    return recents[0] || {
      id: 'default_tactical_scenario',
      name: 'Тактический сценарий',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      symbolsCount: 0,
      linesCount: 0,
      areasCount: 0,
      routesCount: 0
    };
  }

  public saveRecents(list: ProjectInfo[]) {
    this.recentProjects.set(list);
    try {
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  }

  openProjectModal() {
    this.isProjectModalOpen.set(true);
  }

  closeProjectModal() {
    this.isProjectModalOpen.set(false);
  }

  createNewProject(name: string): ProjectInfo {
    const projName = name.trim() || 'Новый тактический проект';
    const newProj: ProjectInfo = {
      id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: projName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      symbolsCount: 0,
      linesCount: 0,
      areasCount: 0,
      routesCount: 0
    };

    const currentList = this.recentProjects().filter(p => p.id !== newProj.id);
    const updatedList = [newProj, ...currentList].slice(0, 15);
    this.saveRecents(updatedList);
    this.currentProject.set(newProj);
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, newProj.id);
    return newProj;
  }

  saveProjectState(scenarioData: any, customName?: string): ProjectInfo {
    const cur = this.currentProject();
    const name = customName ? customName.trim() : cur.name;

    const symbolsCount = scenarioData?.symbols?.length || 0;
    const linesCount = scenarioData?.lines?.length || 0;
    const areasCount = scenarioData?.areas?.length || 0;
    const routesCount = scenarioData?.marchRoutes?.length || 0;

    const updated: ProjectInfo = {
      ...cur,
      name,
      updatedAt: new Date().toISOString(),
      symbolsCount,
      linesCount,
      areasCount,
      routesCount,
      data: scenarioData
    };

    const currentList = this.recentProjects().filter(p => p.id !== updated.id);
    const updatedList = [updated, ...currentList].slice(0, 15);
    this.saveRecents(updatedList);
    this.currentProject.set(updated);
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, updated.id);
    return updated;
  }

  setCurrentProject(project: ProjectInfo) {
    this.currentProject.set(project);
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, project.id);
    const currentList = this.recentProjects().filter(p => p.id !== project.id);
    const updatedList = [project, ...currentList].slice(0, 15);
    this.saveRecents(updatedList);
  }

  deleteProject(id: string) {
    const filtered = this.recentProjects().filter(p => p.id !== id);
    this.saveRecents(filtered);
    if (this.currentProject().id === id && filtered.length > 0) {
      this.currentProject.set(filtered[0]);
    }
  }

  setSaveStatus(state: 'saved' | 'saving' | 'error', message: string, autoHideMs = 3500) {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.saveStatus.set({ state, message });
    if (autoHideMs > 0) {
      this.statusTimer = setTimeout(() => {
        this.saveStatus.set(null);
        this.statusTimer = null;
      }, autoHideMs);
    }
  }

  async saveProject(scenarioData: any): Promise<string | null> {
    const cur = this.currentProject();
    this.setSaveStatus('saving', 'Сохранение...', 0);
    if (cur.filePath) {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (isTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const jsonStr = JSON.stringify(scenarioData, null, 2);
          const encoder = new TextEncoder();
          const bytes = encoder.encode(jsonStr);
          await invoke<string>('save_scenario_to_path', {
            targetPath: cur.filePath,
            content: Array.from(bytes)
          });
          const updated = this.saveProjectState(scenarioData, cur.name);
          updated.filePath = cur.filePath;
          this.saveRecents(this.recentProjects().map(p => p.id === updated.id ? updated : p));
          this.setSaveStatus('saved', 'Проект сохранен');
          return cur.filePath;
        } catch (e) {
          console.error('Ошибка перезаписи файла проекта:', e);
          this.setSaveStatus('error', 'Ошибка сохранения');
          return null;
        }
      } else {
        const jsonStr = JSON.stringify(scenarioData, null, 2);
        const filename = `${cur.name.trim().replace(/[\s\\\/:\*\?"<>\|]+/g, '_')}.tps`;
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.saveProjectState(scenarioData, cur.name);
        this.setSaveStatus('saved', 'Файл скачан');
        return filename;
      }
    }
    return this.saveProjectAs(scenarioData, cur.name);
  }

  async saveProjectAs(scenarioData: any, customName?: string): Promise<string | null> {
    const cur = this.currentProject();
    const baseName = customName || cur.name || `Проект_${new Date().toISOString().slice(0, 10)}`;
    const safeName = baseName.trim().replace(/[\s\\\/:\*\?"<>\|]+/g, '_');
    const filename = safeName.endsWith('.tps') || safeName.endsWith('.json') ? safeName : `${safeName}.tps`;
    const jsonStr = JSON.stringify(scenarioData, null, 2);

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosenPath = await invoke<string | null>('choose_save_path', {
          defaultName: filename,
          extension: 'tps',
          title: 'Сохранить тактический проект как...'
        });

        if (!chosenPath) {
          this.saveStatus.set(null);
          return null;
        }

        this.setSaveStatus('saving', 'Сохранение...', 0);
        const encoder = new TextEncoder();
        const bytes = encoder.encode(jsonStr);
        await invoke<string>('save_scenario_to_path', {
          targetPath: chosenPath,
          content: Array.from(bytes)
        });

        const updated = this.saveProjectState(scenarioData, baseName);
        updated.filePath = chosenPath;
        this.saveRecents(this.recentProjects().map(p => p.id === updated.id ? updated : p));
        this.setSaveStatus('saved', 'Проект сохранен');
        return chosenPath;
      } catch (e) {
        console.error('Ошибка сохранения файла в Tauri:', e);
        this.setSaveStatus('error', 'Ошибка сохранения');
        return null;
      }
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const updated = this.saveProjectState(scenarioData, baseName);
      this.setSaveStatus('saved', 'Файл скачан');
      return filename;
    }
  }

  async saveProjectToDiskWithDialog(scenarioData: any, defaultName?: string): Promise<string | null> {
    return this.saveProjectAs(scenarioData, defaultName);
  }

  async openProjectFromDiskWithDialog(): Promise<{ project: ProjectInfo; data: any } | null> {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const chosenPath = await invoke<string | null>('choose_open_path', {
          extension: 'tps',
          title: 'Открыть тактический проект'
        });

        if (!chosenPath) return null;

        const fileContent = await invoke<string>('read_file_content', {
          filePath: chosenPath
        });

        const parsed = JSON.parse(fileContent);
        if (parsed && (parsed.type === 'topos_scenario' || Array.isArray(parsed.symbols) || Array.isArray(parsed.placedSymbols))) {
          const fileName = chosenPath.split(/[\\\/]/).pop() || 'Проект';
          const name = fileName.replace(/\.(tps|json)$/i, '');
          const newProj = this.createNewProject(name);
          newProj.filePath = chosenPath;
          newProj.data = parsed;
          const updated = this.saveProjectState(parsed, name);
          updated.filePath = chosenPath;
          this.saveRecents(this.recentProjects().map(p => p.id === updated.id ? updated : p));
          return { project: updated, data: parsed };
        } else {
          alert('Выбранный файл не является корректным проектом Topos (.tps)');
          return null;
        }
      } catch (e) {
        console.error('Ошибка открытия проекта в Tauri:', e);
        alert('Ошибка при чтении файла проекта');
        return null;
      }
    }
    return null;
  }
}

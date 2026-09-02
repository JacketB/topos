import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectManagerService } from './project-manager.service';

describe('ProjectManagerService', () => {
  let service: ProjectManagerService;

  beforeEach(() => {
    localStorage.clear();
    service = new ProjectManagerService();
  });

  it('should initialize with default project', () => {
    expect(service.currentProject()).toBeDefined();
    expect(service.recentProjects().length).toBeGreaterThan(0);
  });

  it('should create new project and add it to recent projects', () => {
    const proj = service.createNewProject('Тактическое учение 2026');
    expect(proj.name).toBe('Тактическое учение 2026');
    expect(service.currentProject().name).toBe('Тактическое учение 2026');
    expect(service.recentProjects()[0].id).toBe(proj.id);
  });

  it('should save project state and update counters', () => {
    const data = {
      placedSymbols: [{ id: '1' }, { id: '2' }],
      objectGroups: [{ id: 'g1' }]
    };

    const updated = service.saveProjectState(data, 'Обновленный проект');
    expect(updated.name).toBe('Обновленный проект');
    expect(service.currentProject().name).toBe('Обновленный проект');
  });

  it('should delete project from recents', () => {
    const p1 = service.createNewProject('Проект для удаления');
    expect(service.recentProjects().some(p => p.id === p1.id)).toBe(true);

    service.deleteProject(p1.id);
    expect(service.recentProjects().some(p => p.id === p1.id)).toBe(false);
  });
});

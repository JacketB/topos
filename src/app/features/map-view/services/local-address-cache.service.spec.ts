import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAddressCacheService } from './local-address-cache.service';

describe('LocalAddressCacheService', () => {
  let service: LocalAddressCacheService;

  beforeEach(() => {
    service = new LocalAddressCacheService();
    service.clear();
  });

  it('should normalize keys properly', () => {
    const k1 = service.normalizeKey('г. Минск', 'ул. Ленина', 'д. 14а');
    const k2 = service.normalizeKey('Минск', 'Ленина', '14а');
    expect(k1).toBe('минск|ленина|14а');
    expect(k1).toBe(k2);
  });

  it('should save and resolve address coordinates', () => {
    service.save('г. Борисов', 'ул. Гагарина', '45', [28.51, 54.23]);
    const resolved = service.resolve('Борисов', 'Гагарина', '45');
    expect(resolved).toEqual([28.51, 54.23]);
  });

  it('should fallback to street coordinates if house is missing in cache', () => {
    service.save('Борисов', 'Гагарина', '', [28.50, 54.22]);
    const resolved = service.resolve('Борисов', 'Гагарина', '100');
    expect(resolved).toEqual([28.50, 54.22]);
  });

  it('should return null for unknown address', () => {
    const resolved = service.resolve('Неизвестный', 'Новая', '1');
    expect(resolved).toBeNull();
  });

  it('should import and export JSON cache', () => {
    service.save('Минск', 'Победителей', '1', [27.55, 53.90]);
    const json = service.exportAsJson();
    expect(json).toContain('минск|победителей|1');

    const service2 = new LocalAddressCacheService();
    service2.clear();
    const imported = service2.importFromJson(json);
    expect(imported).toBe(1);
    expect(service2.resolve('Минск', 'Победителей', '1')).toEqual([27.55, 53.90]);
  });
});

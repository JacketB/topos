import { describe, it, expect } from 'vitest';
import { CoordinateConverterService } from './coordinate-converter.service';

describe('CoordinateConverterService', () => {
  const service = new CoordinateConverterService();

  it('should accurately convert WGS-84 to SK-42 and back for Minsk coordinates', () => {
    const latWgs = 53.9022;
    const lonWgs = 27.5618;

    const sk42 = service.wgs84ToSk42(latWgs, lonWgs);
    expect(sk42.lat).toBeCloseTo(53.9022, 1);
    expect(sk42.lon).toBeCloseTo(27.5618, 1);

    const backWgs = service.sk42ToWgs84(sk42.lat, sk42.lon, sk42.h);
    expect(backWgs.lat).toBeCloseTo(latWgs, 5);
    expect(backWgs.lon).toBeCloseTo(lonWgs, 5);
  });

  it('should compute valid Gauss-Kruger 6-degree zone and meters for Belarus', () => {
    const latMinsk = 53.9022;
    const lonMinsk = 27.5618;

    const gk = service.wgs84ToGaussKruger(latMinsk, lonMinsk);
    expect(gk.zone).toBe(5);
    expect(gk.centralMeridian).toBe(27.0);
    expect(gk.x).toBeGreaterThan(5900000);
    expect(gk.x).toBeLessThan(6050000);
    expect(gk.y).toBeGreaterThan(5500000);
    expect(gk.y).toBeLessThan(5600000);

    const back = service.gaussKrugerToWgs84(gk.x, gk.y, gk.zone);
    expect(back.lat).toBeCloseTo(latMinsk, 4);
    expect(back.lon).toBeCloseTo(lonMinsk, 4);
  });

  it('should compute valid Soviet/CIS topographic sheet nomenclature', () => {
    const latMinsk = 53.9022;
    const lonMinsk = 27.5618;

    const topo = service.getTopographicSheet(latMinsk, lonMinsk);
    expect(topo.sheet1M).toBe('N-35');
    expect(topo.sheet100k).toMatch(/^N-35-\d+$/);
    expect(topo.sheet50k).toMatch(/^N-35-\d+-[А-Г]$/);
    expect(topo.sheet25k).toMatch(/^N-35-\d+-[А-Г]-[а-г]$/);
  });

  it('should format DMS coordinates accurately', () => {
    const dmsLat = service.formatDms(53.9022, true);
    expect(dmsLat).toContain('53°54\'');
    expect(dmsLat).toContain('N');

    const dmsLon = service.formatDms(27.5618, false);
    expect(dmsLon).toContain('27°33\'');
    expect(dmsLon).toContain('E');
  });

  it('should toggle and format across all coordinate system styles', () => {
    const lat = 53.9022;
    const lon = 27.5618;

    const sk42Rect = service.formatCoordinates(lat, lon, 'SK42_RECTANGULAR');
    expect(sk42Rect).toContain('X:');
    expect(sk42Rect).toContain('Y:');
    expect(sk42Rect).toContain('Зона 5');

    const sk42Tactical = service.formatCoordinates(lat, lon, 'SK42_TACTICAL');
    expect(sk42Tactical).toContain('X=');
    expect(sk42Tactical).toContain('Y=');
    expect(sk42Tactical).toContain('[N-35-');

    const wgsDec = service.formatCoordinates(lat, lon, 'WGS84_DECIMAL');
    expect(wgsDec).toContain('53.90220°, 27.56180°');
  });
});

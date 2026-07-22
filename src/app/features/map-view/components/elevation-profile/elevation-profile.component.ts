import { Component, ElementRef, ViewChild, Input, OnChanges, SimpleChanges, inject, output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TerrainService } from '../../services/terrain.service';

export interface ElevationPoint {
  distanceM: number;
  elevationM: number;
  coord: [number, number];
}

@Component({
  selector: 'app-elevation-profile',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './elevation-profile.component.html',
  styleUrl: './elevation-profile.component.css'
})
export class ElevationProfileComponent implements OnChanges {
  private readonly terrainService = inject(TerrainService);

  @Input() coordinates: [number, number][] = [];
  @Input() title: string = 'Профиль высот рельефа местности';

  @ViewChild('profileCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly hoverPoint = output<[number, number] | null>();
  readonly close = output<void>();

  profilePoints: ElevationPoint[] = [];
  totalDistanceM = 0;
  minElevation = 0;
  maxElevation = 0;
  elevationGainM = 0;

  hoveredPoint: ElevationPoint | null = null;
  hoveredX = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['coordinates']) {
      this.generateProfileData();
    }
  }

  generateProfileData() {
    if (!this.coordinates || this.coordinates.length < 2) {
      this.profilePoints = [];
      this.totalDistanceM = 0;
      this.minElevation = 0;
      this.maxElevation = 0;
      this.elevationGainM = 0;
      return;
    }

    const points: ElevationPoint[] = [];
    let accDist = 0;
    let gain = 0;
    let minE = Infinity;
    let maxE = -Infinity;

    const stepM = 50;
    let lastPt: [number, number] | null = null;
    let lastElev: number | null = null;

    for (let i = 0; i < this.coordinates.length - 1; i++) {
      const p1 = this.coordinates[i];
      const p2 = this.coordinates[i + 1];
      const segDist = this.getDistance(p1, p2);
      const steps = Math.max(1, Math.ceil(segDist / stepM));

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const lng = p1[0] + (p2[0] - p1[0]) * t;
        const lat = p1[1] + (p2[1] - p1[1]) * t;
        const pt: [number, number] = [lng, lat];

        if (lastPt) {
          accDist += this.getDistance(lastPt, pt);
        }

        const elev = Math.round(this.terrainService.getElevationAt(lng, lat) || 120);

        if (lastElev !== null && elev > lastElev) {
          gain += (elev - lastElev);
        }

        if (elev < minE) minE = elev;
        if (elev > maxE) maxE = elev;

        points.push({
          distanceM: accDist,
          elevationM: elev,
          coord: pt
        });

        lastPt = pt;
        lastElev = elev;
      }
    }

    this.profilePoints = points;
    this.totalDistanceM = accDist;
    this.minElevation = minE === Infinity ? 0 : minE;
    this.maxElevation = maxE === -Infinity ? 0 : maxE;
    this.elevationGainM = Math.round(gain);

    setTimeout(() => this.drawProfileCanvas(), 50);
  }

  drawProfileCanvas() {
    if (!this.canvasRef || this.profilePoints.length < 2) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width = canvas.parentElement?.clientWidth || 750;
    const height = canvas.height = 140;

    ctx.clearRect(0, 0, width, height);

    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const graphW = width - paddingLeft - paddingRight;
    const graphH = height - paddingTop - paddingBottom;

    const minE = Math.max(0, this.minElevation - 10);
    const maxE = this.maxElevation + 10;
    const rangeE = maxE - minE || 1;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;

    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = paddingTop + (graphH * (1 - i / gridSteps));
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      const elevVal = Math.round(minE + (rangeE * i / gridSteps));
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${elevVal}м`, paddingLeft - 6, y + 3);
    }

    const gradient = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);

    this.profilePoints.forEach((pt) => {
      const x = paddingLeft + (pt.distanceM / this.totalDistanceM) * graphW;
      const y = paddingTop + (1 - (pt.elevationM - minE) / rangeE) * graphH;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(paddingLeft + graphW, height - paddingBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    this.profilePoints.forEach((pt, idx) => {
      const x = paddingLeft + (pt.distanceM / this.totalDistanceM) * graphW;
      const y = paddingTop + (1 - (pt.elevationM - minE) / rangeE) * graphH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (this.hoveredPoint) {
      const hx = paddingLeft + (this.hoveredPoint.distanceM / this.totalDistanceM) * graphW;
      const hy = paddingTop + (1 - (this.hoveredPoint.elevationM - minE) / rangeE) * graphH;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(hx, paddingTop);
      ctx.lineTo(hx, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.canvasRef || this.profilePoints.length < 2) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;

    const paddingLeft = 45;
    const paddingRight = 20;
    const graphW = canvas.width - paddingLeft - paddingRight;

    if (mouseX < paddingLeft || mouseX > canvas.width - paddingRight) {
      this.hoveredPoint = null;
      this.hoverPoint.emit(null);
      this.drawProfileCanvas();
      return;
    }

    const t = (mouseX - paddingLeft) / graphW;
    const targetDist = t * this.totalDistanceM;

    let closest = this.profilePoints[0];
    let minDiff = Infinity;
    for (const pt of this.profilePoints) {
      const diff = Math.abs(pt.distanceM - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }

    this.hoveredPoint = closest;
    this.hoverPoint.emit(closest.coord);
    this.drawProfileCanvas();
  }

  onCanvasMouseLeave() {
    this.hoveredPoint = null;
    this.hoverPoint.emit(null);
    this.drawProfileCanvas();
  }

  private getDistance(p1: [number, number], p2: [number, number]): number {
    const R = 6371000;
    const lat1 = p1[1] * Math.PI / 180;
    const lat2 = p2[1] * Math.PI / 180;
    const dLat = (p2[1] - p1[1]) * Math.PI / 180;
    const dLng = (p2[0] - p1[0]) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

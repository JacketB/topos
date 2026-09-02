import { Component, ElementRef, ViewChild, Input, OnChanges, SimpleChanges, inject, output } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TerrainService } from '../../services/terrain.service';

export interface ElevationPoint {
  distanceM: number;
  elevationM: number;
  slopePercent: number;
  slopeDegrees: number;
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
  protected readonly Math = Math;
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
  elevationLossM = 0;
  maxSlopePercent = 0;

  hoveredPoint: ElevationPoint | null = null;
  hoveredX = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['coordinates']) {
      this.generateProfileData();
    }
  }

  async generateProfileData() {
    if (!this.coordinates || this.coordinates.length < 2) {
      this.profilePoints = [];
      this.totalDistanceM = 0;
      this.minElevation = 0;
      this.maxElevation = 0;
      this.elevationGainM = 0;
      this.elevationLossM = 0;
      this.maxSlopePercent = 0;
      return;
    }

    const res = await this.terrainService.getElevationProfile(this.coordinates, 25);
    this.profilePoints = res.points;
    this.totalDistanceM = res.totalDistanceM;
    this.minElevation = res.minElevation;
    this.maxElevation = res.maxElevation;
    this.elevationGainM = res.elevationGainM;
    this.elevationLossM = res.elevationLossM;
    this.maxSlopePercent = res.maxSlopePercent;

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

    const minE = Math.max(0, Math.floor(this.minElevation - 5));
    const maxE = Math.ceil(this.maxElevation + 5);
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
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.30)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

    ctx.beginPath();
    ctx.moveTo(paddingLeft, height - paddingBottom);

    this.profilePoints.forEach((pt) => {
      const x = paddingLeft + (pt.distanceM / (this.totalDistanceM || 1)) * graphW;
      const y = paddingTop + (1 - (pt.elevationM - minE) / rangeE) * graphH;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(paddingLeft + graphW, height - paddingBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    for (let idx = 0; idx < this.profilePoints.length - 1; idx++) {
      const p1 = this.profilePoints[idx];
      const p2 = this.profilePoints[idx + 1];

      const x1 = paddingLeft + (p1.distanceM / (this.totalDistanceM || 1)) * graphW;
      const y1 = paddingTop + (1 - (p1.elevationM - minE) / rangeE) * graphH;
      const x2 = paddingLeft + (p2.distanceM / (this.totalDistanceM || 1)) * graphW;
      const y2 = paddingTop + (1 - (p2.elevationM - minE) / rangeE) * graphH;

      const isSteep = Math.abs(p2.slopePercent) > 8;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isSteep ? '#dc2626' : '#2563eb';
      ctx.lineWidth = isSteep ? 3.5 : 2.5;
      ctx.stroke();
    }

    if (this.hoveredPoint) {
      const hx = paddingLeft + (this.hoveredPoint.distanceM / (this.totalDistanceM || 1)) * graphW;
      const hy = paddingTop + (1 - (this.hoveredPoint.elevationM - minE) / rangeE) * graphH;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(hx, paddingTop);
      ctx.lineTo(hx, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = Math.abs(this.hoveredPoint.slopePercent) > 8 ? '#dc2626' : '#2563eb';
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

import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AreaService } from '../../services/area.service';
import { AreaDetail } from '../../models/area.model';
import { scoreColor } from '../../utils/color-scale';

@Component({
  selector: 'app-area-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './area-panel.component.html',
  styleUrl: './area-panel.component.css',
})
export class AreaPanelComponent implements OnChanges {
  @Input() slug: string | null = null;

  area: AreaDetail | null = null;
  loading = false;

  readonly metricLabels: Record<string, string> = {
    population_growth: 'Dân số',
    metro_growth: 'Hạ tầng Metro',
    apartment_growth: 'Chung cư mới',
    school_growth: 'Trường học',
    office_growth: 'Văn phòng',
  };

  constructor(private areaService: AreaService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slug'] && this.slug != null) {
      this.loading = true;
      this.area = null;
      this.areaService.getAreaDetail(this.slug).subscribe({
        next: (detail) => {
          this.area = detail;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
    }
  }

  metricEntries(): [string, number][] {
    if (!this.area) return [];
    return Object.entries(this.area.metrics) as [string, number][];
  }

  scoreColor(score: number): string {
    return scoreColor(score);
  }
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-legend',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './legend.component.html',
  styleUrl: './legend.component.css',
})
export class LegendComponent {
  readonly bands = [
    { color: '#1a9850', label: '80–100 · Cơ hội rất cao' },
    { color: '#91cf60', label: '60–79 · Cơ hội cao' },
    { color: '#fee08b', label: '40–59 · Trung bình' },
    { color: '#fc8d59', label: '20–39 · Thấp' },
    { color: '#d73027', label: '0–19 · Gần bão hòa' },
  ];
}

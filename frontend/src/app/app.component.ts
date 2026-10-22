import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PremiumPromptComponent } from './components/premium-prompt/premium-prompt.component';
import { SiteNavComponent } from './components/site-nav/site-nav.component';
import { startAnalytics } from './services/analytics';
import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SiteNavComponent, PremiumPromptComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  constructor() {
    inject(SeoService).start();
    startAnalytics();
  }
}

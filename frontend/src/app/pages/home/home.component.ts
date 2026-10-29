import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
import { SiteLangService } from '../../services/site-lang.service';
import { track } from '../../services/analytics';
import { LegalLinksComponent } from '../legal/legal-links.component';
import { HeroSkylineComponent } from './hero-skyline.component';
import { HOME_TEXT, ToolCard } from './home.i18n';

/** The three groups of tools and the cards in each. */
const GROUPS: { id: 'explore' | 'biz' | 'property'; cards: ToolCard['id'][] }[] = [
  { id: 'explore', cards: ['future', 'time'] },
  { id: 'biz', cards: ['biz', 'career'] },
  { id: 'property', cards: ['property', 'live'] },
];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent, HeroSkylineComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly account = inject(AccountService);
  protected readonly billing = inject(BillingService);
  /** The home page's words, in the site's language. */
  private readonly site = inject(SiteLangService);
  protected readonly tx = computed(() => HOME_TEXT[this.site.lang()]);
  protected readonly groups = GROUPS;
  private readonly router = inject(Router);

  /** Opens the list of wards and communes with the search already typed. */
  protected lookUp(q: string): void {
    const text = q.trim();
    track('ward_lookup');
    void this.router.navigate(['/phuong-xa'], { queryParams: text ? { q: text } : {} });
  }

  protected card(id: ToolCard['id']): ToolCard | undefined {
    return this.tx().cards.find((c) => c.id === id);
  }
}

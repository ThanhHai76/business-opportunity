import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
import { SiteLangService } from '../../services/site-lang.service';
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

  protected card(id: ToolCard['id']): ToolCard | undefined {
    return this.tx().cards.find((c) => c.id === id);
  }
}

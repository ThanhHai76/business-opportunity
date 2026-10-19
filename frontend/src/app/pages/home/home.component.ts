import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
import { LegalLinksComponent } from '../legal/legal-links.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, LegalLinksComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly account = inject(AccountService);
  protected readonly billing = inject(BillingService);
}

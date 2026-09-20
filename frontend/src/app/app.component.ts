import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteNavComponent } from './components/site-nav/site-nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SiteNavComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}

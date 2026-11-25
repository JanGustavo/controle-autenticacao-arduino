import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { NavbarComponent } from './components/navbar/navbar';
import { InsightsLauncher } from './components/insights-launcher/insights-launcher';
import { RfidAccessService } from './services/rfid-access.service';

@Component({
  imports: [RouterOutlet, NavbarComponent, InsightsLauncher],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  protected readonly layoutPublico = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        return route.data['layout'] === 'publico';
      }),
    ),
    { initialValue: false },
  );
  private readonly rfidAccess = inject(RfidAccessService);
  protected readonly title = signal('controle-acesso');
}

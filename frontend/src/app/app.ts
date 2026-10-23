import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
  private readonly rfidAccess = inject(RfidAccessService);
  protected readonly title = signal('controle-acesso');
}

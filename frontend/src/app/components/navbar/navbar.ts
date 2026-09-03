import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent implements OnInit {
  private router = inject(Router);

  darkMode = signal<boolean>(false);

  mockUser = {
    name: 'Administrador',
    role: 'Engenheiro de Sistema',
    email: 'admin@ardlock.local',
    status: 'Logado',
  };

  ngOnInit(): void {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkMode.set(true);
      document.body.classList.add('dark-mode');
    }
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('adm_token');
  }

  toggleDarkMode(): void {
    const newValue = !this.darkMode();
    this.darkMode.set(newValue);
    if (newValue) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }

  logoff(): void {
    localStorage.removeItem('adm_token');
    this.router.navigate(['/login']);
  }
}

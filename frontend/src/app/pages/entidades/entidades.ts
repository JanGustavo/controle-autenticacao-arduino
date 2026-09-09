import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  imports: [MatIconModule, RouterLink],
  selector: 'app-entidades-page',
  styleUrl: './entidades.scss',
  templateUrl: './entidades.html',
})
export class EntidadesPage {}
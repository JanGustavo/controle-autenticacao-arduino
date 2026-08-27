import { Routes } from '@angular/router';
import { AdmPage } from './pages/adm-page/adm-page';

export const routes: Routes = [
  { path: '', redirectTo: 'adm-page', pathMatch: 'full' },
  { path: 'adm-page', component: AdmPage },
];

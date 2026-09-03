import { Routes } from '@angular/router';
import { AdmPage } from './pages/adm-page/adm-page';
import { TuplePage } from './pages/tuple-page/tuple-page';
import {
  DASHBOARD_MOCK,
  CADASTRAR_MOCK,
  USUARIOS_MOCK,
  PERMISSOES_MOCK,
} from './models/tuple-page.model';

export const routes: Routes = [
  { path: '', redirectTo: 'adm-page', pathMatch: 'full' },
  { path: 'adm-page', component: AdmPage },
  {
    path: 'dashboard',
    component: TuplePage,
    data: { config: DASHBOARD_MOCK },
  },
  {
    path: 'cadastrar',
    component: TuplePage,
    data: { config: CADASTRAR_MOCK },
  },
  {
    path: 'usuarios',
    component: TuplePage,
    data: { config: USUARIOS_MOCK },
  },
  {
    path: 'permissoes',
    component: TuplePage,
    data: { config: PERMISSOES_MOCK },
  },
  { path: '**', redirectTo: 'adm-page' },
];

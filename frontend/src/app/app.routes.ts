import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { AdmPage } from './pages/adm-page/adm-page';
import { TuplePage } from './pages/tuple-page/tuple-page';
import { EntidadesPage } from './pages/entidades/entidades';
import { CadastrarPage } from './pages/cadastrar/cadastrar';
import { LocaisPage } from './pages/locais/locais';
import { authGuard } from './guards/auth.guard';
import {
  DASHBOARD_MOCK,
  USUARIOS_MOCK,
  PERMISSOES_MOCK,
} from './models/tuple-page.model';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'adm-page', component: AdmPage, canActivate: [authGuard] },
  { path: 'entidades', component: EntidadesPage, canActivate: [authGuard] },
  { path: 'locais', component: LocaisPage, canActivate: [authGuard] },
  {
    path: 'dashboard',
    component: TuplePage,
    canActivate: [authGuard],
    data: { config: DASHBOARD_MOCK },
  },
  {
    path: 'cadastrar',
    component: CadastrarPage,
    canActivate: [authGuard],
  },
  {
    path: 'usuarios',
    component: TuplePage,
    canActivate: [authGuard],
    data: { config: USUARIOS_MOCK },
  },
  {
    path: 'permissoes',
    component: TuplePage,
    canActivate: [authGuard],
    data: { config: PERMISSOES_MOCK },
  },
  { path: '**', redirectTo: 'login' },
];
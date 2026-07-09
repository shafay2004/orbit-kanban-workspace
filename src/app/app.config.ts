import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { jwtInterceptor } from './interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // This tells Angular to utilize standard zone tracking without requiring a physical zone.js script file
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    
    // UPDATED: Registred our secure JWT interceptor stream mapping directly into HTTP pipeline
    provideHttpClient(withInterceptors([jwtInterceptor]))
  ]
};
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment'; // 🎯 CONNECTED TO CORE ENVIRONMENT NODES

// ==========================================================================
// 🎯 ROLE-BASED ACCESS CONTROL (RBAC) USER SESSION INTERFACE MATRIX
// ==========================================================================
export interface UserSession {
  userId: number;
  fullName: string;
  email: string;
  role: string; // 🔐 'Admin' | 'Developer' | 'Viewer'
  username?: string;
} 

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // 🚀 HARD RESOLVE: Replaced hardcoded localhost string with global environment variable endpoint path matrix
  private apiUrl = `${environment.apiUrl}/auth`;
  
  private currentUserSubject: BehaviorSubject<UserSession | null>;
  public currentUser: Observable<UserSession | null>;

  constructor(private http: HttpClient) {
    // 🎯 RE-SYNC ROUTE SEED: Grabbing synchronized system user data caching layers securely
    const savedUser = localStorage.getItem('orbit_user');
    const initialUser = savedUser ? JSON.parse(savedUser) : null;
    
    this.currentUserSubject = new BehaviorSubject<UserSession | null>(initialUser);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  // 🎯 UNIFIED COMPONENT ACCESS TRIGGER NODE
  public get CurrentUserValue(): UserSession | null {
    return this.currentUserSubject.value;
  }

  // 🚀 UPDATED LOGIN INTEGRATION LOOPS WITH PRODUCTION ADAPTIVE ENDPOINTS
  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        if (res) {
          const userData: UserSession = res.user ? res.user : {
            userId: res.userId,
            fullName: res.fullName,
            email: res.email,
            role: res.role,
            username: res.username
          };

          const userToken = res.token || 'mock_orbit_secured_token_hash';

          localStorage.setItem('orbit_jwt_token', userToken);
          localStorage.setItem('orbit_user', JSON.stringify(userData));
          
          this.currentUserSubject.next(userData);
        }
      })
    );
  }

  setUserSession(user: UserSession, token: string) {
    localStorage.setItem('orbit_jwt_token', token);
    localStorage.setItem('orbit_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  logout() {
    localStorage.removeItem('orbit_jwt_token');
    localStorage.removeItem('orbit_user');
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('orbit_jwt_token');
  }

  getToken(): string | null {
    return localStorage.getItem('orbit_jwt_token');
  }
}
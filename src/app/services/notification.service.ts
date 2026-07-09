import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
// 🎯 ENVIRONMENT CONFIGURATION IMPORT DISPATCH PATH
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private hubConnection!: signalR.HubConnection;
  // Dynamic message pipeline trigger
  public notification$ = new Subject<{ message: string, type: string }>();

  constructor() {
    this.initSignalRConnection();
  }

  private initSignalRConnection() {
    // 🚀 ROOT DOMAIN PARSING PROTOCOL: 
    // Environment apiUrl se '/api' segment replace karke Base Hub URL slice nikalenge
    const hubBaseUrl = environment.apiUrl.replace('/api', '');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubBaseUrl}/orbitNotificationHub`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('🛰️ SignalR Connection Established Successfully Matrix Locked.'))
      .catch(err => console.error('Error while starting SignalR connection: ', err));

    // Listen to real-time broadcasts from .NET Controller
    this.hubConnection.on('ReceiveNotification', (message: string, type: string) => {
      this.notification$.next({ message, type });
    });
  }

  public switchProjectRoom(projectId: number): void {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      // Invokes exact backend signature name 'JoinProjectGroup' flawlessly
      this.hubConnection.invoke('JoinProjectGroup', projectId.toString())
        .then(() => console.log(`🔄 Securely shifted background signal channel matrix to: Project_${projectId}`))
        .catch(err => console.error('Error switching project group rooms: ', err));
    } else {
      console.warn('SignalR WebSocket connection is not in a connected state yet. Retrying context hook...');
    }
  }
}
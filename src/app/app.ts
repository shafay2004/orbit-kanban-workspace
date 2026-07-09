import { Component } from '@angular/core';
import { KanbanBoardComponent } from './components/kanban-board/kanban-board';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [KanbanBoardComponent],
  templateUrl: './app.html', // <-- Matches your exact file tree name!
  styleUrls: ['./app.css']    // <-- Matches your exact file tree name!
})
export class AppComponent {
  title = 'orbit-frontend';
} 
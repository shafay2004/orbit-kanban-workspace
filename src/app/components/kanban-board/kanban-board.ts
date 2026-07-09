import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Chart, registerables } from 'chart.js';
import { MarkdownPipe } from '../../pipes/markdown.pipe'; // Adjust path based on your exact file level
import { NotificationService } from '../../services/notification.service'; 
import { environment } from '../../../environments/environment';

// Register Chart.js components globally
Chart.register(...registerables);

export interface UserItem {
  userId: number;
  fullName: string;
  email: string;
  username: string; // 🎯 NET ARCHITECTURE LOCK: Globally unique user handle handle identifier
  role?: string;
}

export interface UserSession {
  newUserName: string;
  newUserEmail: string;
  newUserPass: string;
  newUserRoleSelected: string;
  newUserUsername: string; // Dynamic handle state track parameters
}

export interface ProjectItem {
  projectId: number;
  name: string;
  description?: string;
  orgId: number;
  isAssigned?: boolean;
  createdByUserId?: number;
}

export interface TaskItem {
  taskId: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId: number;
  assignedToUserId?: number;
  displayOrder: number;
  createdAt?: string;
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, DragDropModule, HttpClientModule, FormsModule, MarkdownPipe], // 🎯 ADD MarkdownPipe HERE
  templateUrl: './kanban-board.html',
  styleUrls: ['./kanban-board.css']
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  todoTasks: TaskItem[] = [];
  inProgressTasks: TaskItem[] = [];
  doneTasks: TaskItem[] = [];

  projectList: ProjectItem[] = [];
  userList: UserItem[] = [];
  currentProjectId: number = 1;

  // 🎯 ADD THESE CONTROL STRINGS INSIDE KANBANBOARDCOMPONENT CLASS VARIABLES:
  isUsernameChecking: boolean = false;
  usernameAvailabilityMsg: string = '';
  isUsernameAvailable: boolean | null = null;
  private usernameDebounceTimeout: any = null;

  // --- USER CREATION CONTROL ENGINE STATES ---
  isUserModalOpen: boolean = false;
  isUserModalClosing: boolean = false;

  taskComments: any[] = [];
  newCommentText: string = '';

  // 🎯 REFERENCE INPUT MODELS BOUND TO MODAL FIELD BINDINGS
  newUserName: string = '';
  newUserEmail: string = '';
  newUserUsername: string = ''; // 🎯 INTERACTIVE MODEL STATE: Unique tech username handle data track slot
  newUserPass: string = '';
  newUserConfirmPass: string = '';
  newUserRoleSelected: string = 'Developer';

  // KPI Metrics Counter Variables
  totalTasksCount: number = 0;
  pendingTasksCount: number = 0;
  completedTasksCount: number = 0;

  // --- COMPONENT STATE FLAGS ---
  isDarkMode: boolean = false;
  isModalOpen: boolean = false;
  isModalClosing: boolean = false;
  isEditProjectModalOpen: boolean = false;
  isEditProjectModalClosing: boolean = false;
  editProjectName: string = '';
  editProjectDescription: string = '';
  assigneeSearchText: string = '';
  editAssigneeSearchText: string = '';
  isDeleteAccountModalOpen: boolean = false;
  isDeleteAccountModalClosing: boolean = false;
  deleteAccountPassword: string = '';
  showDeletePassword: boolean = false;
  isAuthenticated: boolean = false;
  authErrorMessage: string | null = null;
  showLoginPassword: boolean = false;
  showRegisterPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isSignUpState: boolean = false;

  isProjectDropdownOpen: boolean = false;
  isOwnerDropdownOpen: boolean = false;
  isPriorityDropdownOpen: boolean = false;
  selectedPriorityCreation: string = 'Medium';
  isAssigneeDropdownOpen: boolean = false;
  selectedAssigneeCreationId: number | null = null;

  isEditPriorityDropdownOpen: boolean = false;
  isEditAssigneeDropdownOpen: boolean = false;

  // Live Activity Logs Buffer Array Matrix
  projectActivityLogs: any[] = [];
  private autoCloseAlertTimeout: any = null;
  ownerSearchText: string = '';

  // --- CHART REFERENCE TRACKING ---
  orbitChart: any = null;

  // --- FILTER STATE TRACKING VARIABLES ---
  searchText: string = '';
  selectedPriorityFilter: string = 'All';
  selectedUserFilter: number | string = 'All';
  projectSearchText: string = '';

  editingTask: TaskItem = { taskId: 0, title: '', description: '', status: 'To-Do', priority: 'Medium', projectId: 1, displayOrder: 0 };

  // --- CUSTOM ALERT DIALOG STATE ---
  customAlertOpen: boolean = false;
  customAlertClosing: boolean = false;
  customAlertTitle: string = 'Security Gateway Notice';
  customAlertMessage: string = '';
  customAlertIcon: string = '⚠️';
  customAlertConfirmOnly: boolean = true;
  private alertResolve: ((value: boolean) => void) | null = null;

  private logRefreshInterval: any = null;

  // Mouse-tracking glow properties
  private targetX: number = 0;
  private targetY: number = 0;
  private currentX: number = 0;
  private currentY: number = 0;
  private rafId: any = null;

  // 🎯 FIX LOAD NODE: Changing authService visibility scope from private to public for direct template binding
  constructor(
    private http: HttpClient, 
    private cdr: ChangeDetectorRef, 
    public authService: AuthService,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {

          // 🎯 ADD THIS INSIDE THE VERY TOP OF ngOnInit() IN kanban-board.ts:
      const urlParams = new URLSearchParams(window.location.search);
      const autoId = urlParams.get('autoId');
      const autoName = urlParams.get('autoName');
      const autoEmail = urlParams.get('autoEmail');
      const autoRole = urlParams.get('autoRole');
      const autoUsername = urlParams.get('autoUsername');

      if (autoId && autoName && autoEmail && autoRole) {
        console.log('⚡ AUTO LOGIN DISPATCH ACTIVE MATRIX RECEIVED:', autoName);
        
        // Directly set local session cache state manually matching authService structures
        const mockUserPayload = {
          userId: parseInt(autoId, 10),
          fullName: decodeURIComponent(autoName),
          email: autoEmail,
          role: autoRole,
          username: autoUsername ? decodeURIComponent(autoUsername) : autoEmail.split('@')[0]
        };
        
        this.authService.setUserSession(mockUserPayload, 'mock_orbit_secured_token_hash');
        
        // Clean clean URL path strings completely in the browser so parameters disappear nicely
        window.history.replaceState({}, document.title, "/");
        
        // Re-verify framework authentication variables
        this.isAuthenticated = true;
        this.loadAllProjects();
        this.loadAllUsers();
        this.startRealTimeLogPolling();
        this.cdr.detectChanges();
        return;
      }
    console.log('--- Kanban Board Component Initialized ---');

    // 🎯 ROUTE LOCKING: Live status checking from session cache
    this.isAuthenticated = this.authService.isLoggedIn();

    if (this.isAuthenticated) {
      // User logged in hai, toh data load karo
      this.loadAllProjects();
      this.loadAllUsers();
      this.startRealTimeLogPolling();
    } else {
      // 🔐 FORCE REDIRECT: Agar logged in nahi hai, toh force system to stay on login page state
      this.isAuthenticated = false;
      this.triggerSessionLogout(); // Safely clears any corrupted half-session parameters
    }

    const savedTheme = localStorage.getItem('orbit_theme');
    this.isDarkMode = savedTheme === 'dark';

    this.notificationService.notification$.subscribe(notif => {
      this.showCustomAlert(notif.message, '🔔', 'Live System Update Feed');
      if (this.isAuthenticated && this.currentProjectId) {
        this.loadProjectTasks(this.currentProjectId);
      }
    });
  }

  onBrandPanelMouseMove(event: MouseEvent, panel: HTMLElement) {
    const rect = panel.getBoundingClientRect();
    this.targetX = event.clientX - rect.left;
    this.targetY = event.clientY - rect.top;
    
    // Start the animation loop if not already running
    if (!this.rafId) {
      this.currentX = this.targetX;
      this.currentY = this.targetY;
      this.lerpGlow();
    }
  }

  onCardMouseMove(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  }

  private lerpGlow() {
    this.currentX += (this.targetX - this.currentX) * 0.07;
    this.currentY += (this.targetY - this.currentY) * 0.07;
    
    const glowEl = document.getElementById('glowFollow');
    if (glowEl) {
      glowEl.style.left = `${this.currentX}px`;
      glowEl.style.top = `${this.currentY}px`;
      this.rafId = requestAnimationFrame(() => this.lerpGlow());
    } else {
      this.rafId = null;
    }
  }

  ngOnDestroy(): void {
    if (this.logRefreshInterval) {
      clearInterval(this.logRefreshInterval);
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }

  startRealTimeLogPolling() {
    if (this.logRefreshInterval) {
      clearInterval(this.logRefreshInterval);
    }
    this.logRefreshInterval = setInterval(() => {
      if (this.isAuthenticated && this.currentProjectId) {
        this.loadProjectLogs();
      }
    }, 3000);
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('orbit_theme', this.isDarkMode ? 'dark' : 'light');

    if (this.isAuthenticated) {
      setTimeout(() => this.renderPremiumAnalyticsChart(), 50);
    }
    this.cdr.detectChanges();
  }

  loadAllUsers() {
    this.http.get<UserItem[]>(`${environment.apiUrl}/api/tasks/users`).subscribe({
      next: (users) => {
        this.userList = users;
        console.log('User Matrix Hydrated:', this.userList);
      },
      error: (err) => console.error('Failed to resolve users directory payload:', err)
    });
  }

  // 🎯 RECONFIGURED LOOKUP CONTEXT MODEL
  getUsernameById(userId?: number): string {
    if (!userId) return 'Unassigned';
    const foundUser = this.userList.find(u => u.userId === userId);
    
    // Returns exact structured professional username tag
    return foundUser ? `@${foundUser.username}` : 'Unassigned';
  }

  loadAllProjects() {
    const currentLoggedInUserId = this.authService.CurrentUserValue?.userId || 0;

    this.http.get<ProjectItem[]>(`http://localhost:5262/api/tasks/projects?userId=${currentLoggedInUserId}`).subscribe({
      next: (projects) => {
        if (projects && projects.length > 0) {
          this.projectList = projects;
          this.loadCachedData();
          this.loadProjectTasks(this.currentProjectId);
          
          // 🎯 INITIAL ROOM SUBSCRIPTION MATRIX: Locks the SignalR pipeline to the default loaded project right on boot
          this.notificationService.switchProjectRoom(this.currentProjectId);
          
          this.cdr.detectChanges();
        } else {
          this.runFallbackSequence();
        }
      },
      error: (err) => { this.runFallbackSequence(); }
    });
  }

  runFallbackSequence() {
    this.projectList = [];
    this.currentProjectId = 0;
    this.loadCachedData();
    this.loadProjectTasks(0);
    this.cdr.detectChanges();
  }

  getCurrentProjectName(): string {
    if (!this.projectList || this.projectList.length === 0) return 'Select Project';
    const currentProj = this.projectList.find(p => p.projectId === this.currentProjectId);
    return currentProj ? currentProj.name : 'Select Project';
  }

  isCurrentProjectOwner(): boolean {
    if (!this.projectList || this.projectList.length === 0) return false;
    const currentProj = this.projectList.find(p => p.projectId === this.currentProjectId);
    if (!currentProj) return false;
    return currentProj.createdByUserId === this.authService.CurrentUserValue?.userId;
  }

  getSelectedUserFilterName(): string {
    if (this.selectedUserFilter === 'All') return 'All Team Members';
    const foundUser = this.userList.find(u => u.userId === Number(this.selectedUserFilter));
    
    // Custom formatted visual string loop handle
    return foundUser ? `${foundUser.fullName} (@${foundUser.username})` : 'All Team Members';
  }

  getFilteredUserList(): any[] {
    if (!this.ownerSearchText || this.ownerSearchText.trim() === '') {
      return this.userList;
    }
    const query = this.ownerSearchText.toLowerCase();
    return this.userList.filter(usr => 
      usr.fullName.toLowerCase().includes(query) || 
      usr.username.toLowerCase().includes(query)
    );
  }

  toggleOwnerDropdown() {
    this.isOwnerDropdownOpen = !this.isOwnerDropdownOpen;
    if (!this.isOwnerDropdownOpen) {
      this.ownerSearchText = '';
    }
  }

  selectOwnerFilter(value: string) {
    this.selectedUserFilter = value;
    this.applyLiveFilters();
    this.isOwnerDropdownOpen = false;
    this.ownerSearchText = '';
  }

  getSelectedAssigneeCreationName(): string {
    if (!this.selectedAssigneeCreationId) return 'Assigned User';
    const foundUser = this.userList.find(u => u.userId === this.selectedAssigneeCreationId);
    return foundUser ? `${foundUser.fullName} (@${foundUser.username})` : 'Assigned User';
  }

  getSelectedPriorityEditName(): string {
    if (!this.editingTask || !this.editingTask.priority) return 'Select Priority';
    return this.editingTask.priority === 'High' ? 'High Priority 🔥' : `${this.editingTask.priority} Priority`;
  }

  getSelectedAssigneeEditName(): string {
    if (!this.editingTask || !this.editingTask.assignedToUserId) return 'Unassigned';
    const foundUser = this.userList.find(u => u.userId === Number(this.editingTask.assignedToUserId));
    return foundUser ? `${foundUser.fullName} (@${foundUser.username})` : 'Unassigned';
  }

  setEditingTaskAssignee(userId: number | null | undefined) {
    if (userId === null || userId === undefined) {
      this.editingTask.assignedToUserId = undefined;
    } else {
      this.editingTask.assignedToUserId = userId;
    }
  }

  getFilteredAssigneeCreationList(): UserItem[] {
    if (!this.assigneeSearchText || !this.assigneeSearchText.trim()) {
      return this.userList;
    }
    const filterText = this.assigneeSearchText.toLowerCase().trim();
    return this.userList.filter(u => 
      u.fullName.toLowerCase().includes(filterText) || 
      u.username.toLowerCase().includes(filterText)
    );
  }

  getFilteredAssigneeEditList(): UserItem[] {
    if (!this.editAssigneeSearchText || !this.editAssigneeSearchText.trim()) {
      return this.userList;
    }
    const filterText = this.editAssigneeSearchText.toLowerCase().trim();
    return this.userList.filter(u => 
      u.fullName.toLowerCase().includes(filterText) || 
      u.username.toLowerCase().includes(filterText)
    );
  }

  toggleAssigneeDropdown() {
    this.isAssigneeDropdownOpen = !this.isAssigneeDropdownOpen;
    if (!this.isAssigneeDropdownOpen) {
      this.assigneeSearchText = '';
    }
  }

  selectAssigneeCreation(userId: number | null) {
    this.selectedAssigneeCreationId = userId;
    this.isAssigneeDropdownOpen = false;
    this.assigneeSearchText = '';
  }

  toggleEditAssigneeDropdown() {
    if (this.authService.CurrentUserValue?.role !== 'Admin') return;
    this.isEditAssigneeDropdownOpen = !this.isEditAssigneeDropdownOpen;
    if (!this.isEditAssigneeDropdownOpen) {
      this.editAssigneeSearchText = '';
    }
  }

  selectAssigneeEdit(userId: number | null) {
    this.setEditingTaskAssignee(userId);
    this.isEditAssigneeDropdownOpen = false;
    this.editAssigneeSearchText = '';
  }

  getPendingPercentage(): number {
    if (!this.totalTasksCount) return 0;
    return Math.round((this.pendingTasksCount / this.totalTasksCount) * 100);
  }

  getCompletedPercentage(): number {
    if (!this.totalTasksCount) return 0;
    return Math.round((this.completedTasksCount / this.totalTasksCount) * 100);
  }

  // 🎯 FIX DROPDOWN LOCK ENGINE: Optimized HostListener to prevent instant closure and type errors
  // 🎯 FIX LIVE CLICK CONFLICT: Optimized HostListener to prevent user modal from instant closure
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target || typeof target.closest !== 'function') {
      return;
    }

    try {
      // 1. Project Dropdown Handler Check
      if (this.isProjectDropdownOpen && !target.closest('.project-selector-glass')) {
        this.isProjectDropdownOpen = false;
        this.projectSearchText = '';
      }
      
      // 2. Priority Dropdown Handler Check
      if (this.isPriorityDropdownOpen && !target.closest('.priority-creation-dropdown')) {
        this.isPriorityDropdownOpen = false;
      }
      
      // 3. Assignee Dropdown Handler Check
      if (this.isAssigneeDropdownOpen && !target.closest('.assignee-creation-dropdown')) {
        this.isAssigneeDropdownOpen = false;
      }

      // 4. Owner Dropdown Handler Check
      if (this.isOwnerDropdownOpen && !target.closest('.owner-block')) {
        this.isOwnerDropdownOpen = false;
      }

      // 5. Edit Priority Dropdown Handler Check
      if (this.isEditPriorityDropdownOpen && !target.closest('.edit-priority-dropdown')) {
        this.isEditPriorityDropdownOpen = false;
      }

      // 6. Edit Assignee Dropdown Handler Check
      if (this.isEditAssigneeDropdownOpen && !target.closest('.edit-assignee-dropdown')) {
        this.isEditAssigneeDropdownOpen = false;
      }

      // 👥 7. CRITICAL USER MODAL SAFETY CHECK: Prevent background clicks from locking the modal instantly
      if (this.isUserModalOpen && !target.closest('.user-registry-modal-container') && !target.closest('.manage-users-trigger-btn')) {
        this.isUserModalOpen = false;
      }
    } catch (e) {
      console.error('Error handling dropdown click-outside:', e);
    }
  }

  loadProjectTasks(projectId: number) {
    this.http.get<TaskItem[]>(`http://localhost:5262/api/tasks/project/${projectId}`).subscribe({
      next: (tasks) => {
        if (tasks) {
          localStorage.setItem(`orbit_tasks_cache_p${projectId}`, JSON.stringify(tasks));
          this.mapTasksToColumns(tasks);
          this.loadProjectLogs();
        }
      },
      error: (err) => { this.loadCachedData(); }
    });
  }

  loadProjectLogs() {
    this.http.get<any[]>(`http://localhost:5262/api/tasks/project/${this.currentProjectId}/logs`).subscribe({
      next: (logs) => {
        this.projectActivityLogs = logs;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to parse telemetry activity stream logs:', err)
    });
  }

  loadCachedData() {
    const saved = localStorage.getItem(`orbit_tasks_cache_p${this.currentProjectId}`);
    if (saved) {
      const tasks: TaskItem[] = JSON.parse(saved);
      this.mapTasksToColumns(tasks);
    }
  }

  mapTasksToColumns(tasks: TaskItem[]) {
    if (!tasks) return;

    let processedTasks = [...tasks].sort((a, b) => a.displayOrder - b.displayOrder);

    if (this.searchText.trim()) {
      const query = this.searchText.toLowerCase().trim();
      processedTasks = processedTasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }

    if (this.selectedPriorityFilter !== 'All') {
      processedTasks = processedTasks.filter(t => t.priority === this.selectedPriorityFilter);
    }

    if (this.selectedUserFilter !== 'All') {
      const targetUserId = Number(this.selectedUserFilter);
      processedTasks = processedTasks.filter(t => t.assignedToUserId === targetUserId);
    }

    this.todoTasks = processedTasks.filter(t => t.status && t.status.trim() === 'To-Do');
    this.inProgressTasks = processedTasks.filter(t => t.status && t.status.trim() === 'In-Progress');
    this.doneTasks = processedTasks.filter(t => t.status && t.status.trim() === 'Done');

    this.totalTasksCount = tasks.length;
    this.pendingTasksCount = tasks.filter(t => t.status !== 'Done').length;
    this.completedTasksCount = tasks.filter(t => t.status === 'Done').length;

    setTimeout(() => this.renderPremiumAnalyticsChart(), 50);

    this.cdr.detectChanges();
  }

  renderPremiumAnalyticsChart() {
    const canvas = document.getElementById('orbitAnalyticsChart') as HTMLCanvasElement;
    if (!canvas) {
      setTimeout(() => this.renderPremiumAnalyticsChart(), 150);
      return;
    }

    if (this.orbitChart) {
      this.orbitChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    let pendingColor: any = '#ffc107';
    let completedColor: any = '#198754';

    if (ctx) {
      const pendingGrad = ctx.createLinearGradient(0, 0, 0, 150);
      pendingGrad.addColorStop(0, '#f59e0b');
      pendingGrad.addColorStop(1, '#fbbf24');
      pendingColor = pendingGrad;

      const completedGrad = ctx.createLinearGradient(0, 0, 0, 150);
      completedGrad.addColorStop(0, '#10b981');
      completedGrad.addColorStop(1, '#059669');
      completedColor = completedGrad;
    }

    this.orbitChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Pending Work', 'Completed Items'],
        datasets: [{
          data: [this.pendingTasksCount, this.completedTasksCount],
          backgroundColor: [pendingColor, completedColor],
          borderWidth: this.isDarkMode ? 0 : 2,
          borderColor: this.isDarkMode ? 'transparent' : '#ffffff',
          borderRadius: 8,
          spacing: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.isDarkMode ? '#cbd5e1' : '#44403c',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
              font: {
                weight: 'bold',
                family: 'Inter, sans-serif',
                size: 11
              }
            }
          },
          tooltip: {
            backgroundColor: this.isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            titleColor: this.isDarkMode ? '#ffffff' : '#1c1917',
            bodyColor: this.isDarkMode ? '#cbd5e1' : '#44403c',
            borderColor: this.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(28, 25, 23, 0.08)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            boxPadding: 6,
            usePointStyle: true
          }
        },
        cutout: '72%'
      }
    });
  }

  applyLiveFilters() {
    const saved = localStorage.getItem(`orbit_tasks_cache_p${this.currentProjectId}`);
    if (saved) {
      this.mapTasksToColumns(JSON.parse(saved));
    }
  }

  onChartMouseMove(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
    
    const rotateY = ((x / rect.width) - 0.5) * 30;
    const rotateX = (0.5 - (y / rect.height)) * 30;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02) translateY(-4px)`;
    card.style.boxShadow = `0 35px 70px -15px rgba(99, 102, 241, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.15)`;
    card.style.borderColor = `rgba(99, 102, 241, 0.45)`;
    
    const header = card.querySelector('.chart-header-wrapper') as HTMLElement;
    if (header) {
      header.style.transform = `translateZ(30px)`;
    }
    const canvasContainer = card.querySelector('.canvas-relative-container') as HTMLElement;
    if (canvasContainer) {
      canvasContainer.style.transform = `translateZ(50px)`;
    }
  }

  onChartMouseLeave(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    card.style.transform = '';
    card.style.boxShadow = '';
    card.style.borderColor = '';
    
    const header = card.querySelector('.chart-header-wrapper') as HTMLElement;
    if (header) {
      header.style.transform = '';
    }
    const canvasContainer = card.querySelector('.canvas-relative-container') as HTMLElement;
    if (canvasContainer) {
      canvasContainer.style.transform = '';
    }
  }

  executeAuthLogin(email: string, pass: string) {
    this.authErrorMessage = null;

    if (!email.trim() || !pass.trim()) {
      this.authErrorMessage = 'Please fill out all required authentication parameters.';
      return;
    }

    this.authService.login({ email, password: pass }).subscribe({
      next: () => {
        this.isAuthenticated = true;
        this.showLoginPassword = false;
        this.loadAllProjects();
        this.loadAllUsers();
        this.startRealTimeLogPolling();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.authErrorMessage = 'Invalid email profile or incorrect security token password.';
        this.cdr.detectChanges();
      }
    });
  }

  // 🎯 PUBLIC REGISTRATION GATEWAY OVERHAUL WITH EXPLICIT HANDLE TRACK
  executePublicUserRegistration() {
  this.authErrorMessage = null;

  // 🛡️ Step 1: Strict Identity Field Null Verification Checks
  if (!this.newUserName.trim() || !this.newUserEmail.trim() || !this.newUserUsername.trim() || !this.newUserPass.trim() || !this.newUserConfirmPass.trim()) {
    this.authErrorMessage = 'Please fill out all identity configuration parameter fields, including a handle.';
    this.cdr.detectChanges();
    return;
  }

  const email = this.newUserEmail.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    this.authErrorMessage = 'Please enter a valid corporate email address (e.g. name@orbit.com).';
    this.cdr.detectChanges();
    return;
  }

  const pass = this.newUserPass.trim();
  const confirmPass = this.newUserConfirmPass.trim();

  if (pass !== confirmPass) {
    this.authErrorMessage = 'Passwords do not match.';
    this.cdr.detectChanges();
    return;
  }

  // 🛡️ Step 2: Password Complexity Constraint Verification Rules
  if (pass.length < 8 || pass.length > 16) {
    this.authErrorMessage = 'Password must be between 8 and 16 characters.';
    this.cdr.detectChanges();
    return;
  }

  if (!/[A-Z]/.test(pass)) {
    this.authErrorMessage = 'Password must contain at least one capital letter.';
    this.cdr.detectChanges();
    return;
  }

  if (!/[a-z]/.test(pass)) {
    this.authErrorMessage = 'Password must contain at least one small letter.';
    this.cdr.detectChanges();
    return;
  }

  if (!/[0-9]/.test(pass)) {
    this.authErrorMessage = 'Password must contain at least one number.';
    this.cdr.detectChanges();
    return;
  }

  if (!/[^a-zA-Z0-9]/.test(pass)) {
    this.authErrorMessage = 'Password must contain at least one special character.';
    this.cdr.detectChanges();
    return;
  }

  // 🛡️ Step 3: Staging Object Payload Assembly
  const registrationPayload = {
    fullName: this.newUserName.trim(),
    email: email,
    username: this.newUserUsername.replace('@', '').trim().toLowerCase(), // Auto strips handles prefix
    passwordHash: pass,
    role: 'Developer'
  };

  // 🚀 Step 4: Dispatch Deferred Gateway Call to .NET Core Server
  this.http.post(`${environment.apiUrl}/api/auth/register`, registrationPayload).subscribe({
    next: async (res: any) => {
      // Show native browser popup to ensure absolute visibility
      window.alert(`Confirm your email ID by clicking on the secure activation link we sent to your email address (${email}).`);

      // 🎯 FIXED POPUP NOTIFICATION INTERFACE ENGINE
      await this.showCustomAlert(
        `Confirm your email ID by clicking on the secure activation link we sent to your email address (${email}). Your account will be registered and logged in instantly upon verification!`, 
        '✉️', 
        'Confirm Email Address',
        false // do not auto close
      );
      
      // Clear forms context state values cleanly
      this.newUserName = '';
      this.newUserEmail = '';
      this.newUserUsername = '';
      this.newUserPass = '';
      this.newUserConfirmPass = '';
      this.showRegisterPassword = false;
      this.showConfirmPassword = false;
      
      // Strict Authentication Gate Lockdown: Keeps dashboard completely invisible until link click trace
      this.isAuthenticated = false; 
      this.isSignUpState = false; // Sends user gracefully back to Sign In template viewport block
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Registration token dispatch failure exception trace:', err);
      this.authErrorMessage = typeof err.error === 'string' ? err.error : 'Username handle or email allocation conflict.';
      this.cdr.detectChanges();
    }
  });
}

  toggleSignUpState(state: boolean) {
    this.isSignUpState = state;
    this.authErrorMessage = null;
    this.newUserName = '';
    this.newUserEmail = '';
    this.newUserUsername = '';
    this.newUserPass = '';
    this.newUserConfirmPass = '';
    this.showRegisterPassword = false;
    this.showConfirmPassword = false;
    this.cdr.detectChanges();
  }

  triggerSessionLogout() {
    this.authService.logout();
    this.isAuthenticated = false;
    this.showLoginPassword = false;
    this.showRegisterPassword = false;
    this.cdr.detectChanges();
  }

  onProjectChange(newProjectIdString: string) {
    this.currentProjectId = parseInt(newProjectIdString, 10);
    this.todoTasks = []; this.inProgressTasks = []; this.doneTasks = [];

    this.notificationService.switchProjectRoom(this.currentProjectId);

    this.loadCachedData();
    this.loadProjectTasks(this.currentProjectId);
  }

  addNewTask(title: string, description: string, priority: string = 'Medium', assignedToUserId: number | null = null, titleInput?: HTMLInputElement, descInput?: HTMLInputElement) {
    if (!title.trim() || !description.trim()) {
      this.showCustomAlert('Please fill out both fields before adding a task!');
      return;
    }

    if (assignedToUserId === null) {
      this.showCustomAlert('Please assign a user properly!');
      return;
    }

    const tempTaskId = Date.now();
    const newTask: TaskItem = {
      taskId: tempTaskId,
      title: title.trim(),
      description: description.trim(),
      status: 'To-Do',
      priority: priority,
      projectId: this.currentProjectId,
      assignedToUserId: assignedToUserId,
      displayOrder: this.todoTasks.length
    };

    this.todoTasks.push(newTask);
    this.updateLocalMetricCounts();

    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    this.selectedPriorityCreation = 'Medium';
    this.selectedAssigneeCreationId = null;

    const newTaskPayload = {
      title: title.trim(),
      description: description.trim(),
      status: 'To-Do',
      priority: priority,
      projectId: this.currentProjectId,
      assignedToUserId: assignedToUserId,
      displayOrder: this.todoTasks.length
    };

    this.http.post<TaskItem>(`${environment.apiUrl}/api/tasks`, newTaskPayload, {
      headers: {
        'X-Action-User': this.authService.CurrentUserValue?.username || this.authService.CurrentUserValue?.fullName || 'System User'
      }
    }).subscribe({
      next: () => { this.loadProjectTasks(this.currentProjectId); },
      error: (err) => {
        console.error('Failed to save nex task entry:', err);
        this.todoTasks = this.todoTasks.filter(t => t.taskId !== tempTaskId);
        this.updateLocalMetricCounts();
        this.showCustomAlert('Failed to save task card to the server.', '❌', 'Server Error');
      }
    });
  }

  openEditModal(task: TaskItem, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    this.editingTask = { ...task };

    if (this.editingTask.assignedToUserId) {
      this.editingTask.assignedToUserId = Number(this.editingTask.assignedToUserId);
    } else {
      this.editingTask.assignedToUserId = null as any;
    }

    this.isModalOpen = true;
    this.isEditPriorityDropdownOpen = false;
    this.isEditAssigneeDropdownOpen = false;
    this.loadTaskComments(task.taskId);
    this.cdr.detectChanges();
  }

  loadTaskComments(taskId: number) {
    this.http.get<any[]>(`http://localhost:5262/api/tasks/task/${taskId}/comments`).subscribe({
      next: (comments) => {
        if (comments) {
          // 🎯 HARD FIX: Parse string array and ensure exact UTC format indicator
          this.taskComments = comments.map(c => {
            let cleanDateStr = c.createdAt ? c.createdAt.trim() : '';
            
            // Agar end mein 'Z' nahi hai aur decimal dot hai, toh clean context sync karein
            if (cleanDateStr && !cleanDateStr.endsWith('Z') && !cleanDateStr.includes('+')) {
              cleanDateStr = cleanDateStr + 'Z';
            }

            return {
              ...c,
              createdAt: cleanDateStr ? new Date(cleanDateStr) : new Date() // Fallback to current local system time
            };
          });
        } else {
          this.taskComments = [];
        }
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to stream comments context matrix:', err)
    });
  }

  submitNewComment(taskId: number) {
    if (!this.newCommentText.trim()) return;

    const commentPayload = {
      message: this.newCommentText.trim(),
      taskId: taskId,
      userId: this.authService.CurrentUserValue?.userId || 0,
      userFullName: this.authService.CurrentUserValue?.fullName || 'System Node'
    };

    this.http.post(`${environment.apiUrl}/api/tasks/comment`, commentPayload).subscribe({
      next: () => {
        this.newCommentText = ''; // Clear input box
        this.loadTaskComments(taskId); // Refresh view stream
      }
    });
  }

  closeEditModal() {
    if (this.isModalClosing) return;
    this.isModalClosing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.isModalOpen = false;
      this.isModalClosing = false;
      this.isEditPriorityDropdownOpen = false;
      this.isEditAssigneeDropdownOpen = false;
      this.cdr.detectChanges();
    }, 200);
  }

  onModalOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-blur-viewport')) {
      this.closeEditModal();
    }
  }

  saveTaskEdits() {
    if (!this.editingTask.title.trim() || !this.editingTask.description.trim()) {
      this.showCustomAlert('Title and description cannot be completely empty!');
      return;
    }

    if (this.editingTask.assignedToUserId) {
      this.editingTask.assignedToUserId = parseInt(this.editingTask.assignedToUserId.toString(), 10);
    }

    this.http.put(`${environment.apiUrl}/api/tasks/edit`, this.editingTask).subscribe({
      next: () => {
        this.closeEditModal();
        this.loadProjectTasks(this.currentProjectId);
      },
      error: (err) => console.error('Failed to execute task edits:', err)
    });
  }

  async deleteSingleTask(taskId: number, event: Event) {
    event.stopPropagation();
    const confirmed = await this.showCustomConfirm(`Are you sure you want to delete task card #${taskId}?`, '🗑️', 'Delete Card');
    if (!confirmed) return;

    this.http.delete(`http://localhost:5262/api/tasks/${taskId}`, {
      headers: {
        'X-Action-User': this.authService.CurrentUserValue?.username || this.authService.CurrentUserValue?.fullName || 'System User'
      }
    }).subscribe({
      next: () => { this.loadProjectTasks(this.currentProjectId); },
      error: (err) => console.error('Failed to delete individual task card:', err)
    });
  }

  filteredProjectList(): ProjectItem[] {
    if (!this.projectSearchText || !this.projectSearchText.trim()) {
      return this.projectList;
    }
    const filterText = this.projectSearchText.toLowerCase().trim();
    return this.projectList.filter(p => p.name.toLowerCase().includes(filterText));
  }

  addNewProject(name: string, description: string) {
    if (!name || !name.trim()) {
      this.showCustomAlert('Please fill out the field! Project Name cannot be empty.', '📁', 'Project Creation');
      return;
    }

    const exists = this.projectList.some(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (exists) {
      this.showCustomAlert(`Conflict: A project board named '${name}' already exists in your infrastructure.`, '⚠️', 'Duplicate Workspace Identity');
      return;
    }

    const currentUserId = this.authService.CurrentUserValue?.userId || 0;

    const newProjectPayload = {
      name: name.trim(),
      description: description ? description.trim() : '',
      orgId: 1
    };

    this.http.post<ProjectItem>(`${environment.apiUrl}/api/tasks/project`, newProjectPayload, {
      headers: {
        'X-Action-User': this.authService.CurrentUserValue?.username || this.authService.CurrentUserValue?.fullName || 'System User',
        'X-Action-User-Id': currentUserId.toString()
      }
    }).subscribe({
      next: (createdProject) => {
        this.showCustomAlert(`Successfully created project: "${createdProject.name}"!`, '🎉', 'Project Registered');
        this.loadAllProjects();
        this.currentProjectId = createdProject.projectId;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to register project workspace:', err);
        
        let errorMessage = 'Conflict detected during global directory save sequence.';
        if (err.error) {
          if (typeof err.error === 'string') {
            errorMessage = err.error;
          } else if (err.error.message) {
            errorMessage = err.error.message;
          }
        }
        this.showCustomAlert(errorMessage, '⚠️', 'Duplicate Workspace Identity');
      }
    });
  }
  
  async deleteCurrentProject() {
    const confirmed = await this.showCustomConfirm(`Delete entire project?`, '🗑️', 'Delete Project');
    if (!confirmed) return;

    const currentUserId = this.authService.CurrentUserValue?.userId || 0;

    this.http.delete(`http://localhost:5262/api/tasks/project/${this.currentProjectId}`, {
      headers: {
        'X-Action-User-Id': currentUserId.toString(),
        'X-Action-User': this.authService.CurrentUserValue?.username || this.authService.CurrentUserValue?.fullName || 'System User'
      }
    }).subscribe({
      next: () => { 
        this.showCustomAlert('Project successfully deleted.', '🎉', 'Success');
        this.currentProjectId = 1; 
        this.loadAllProjects(); 
      },
      error: (err) => {
        console.error('RBAC Security Blocking Error:', err);
        this.showCustomAlert('Security Exception: You do not have permission to delete this project workspace!', '🔐', 'Access Denied');
      }
    });
  }

  openEditProjectModal() {
    const currentProj = this.projectList.find(p => p.projectId === this.currentProjectId);
    if (!currentProj) return;
    this.editProjectName = currentProj.name;
    this.editProjectDescription = currentProj.description || '';
    this.isEditProjectModalOpen = true;
    this.isEditProjectModalClosing = false;
    this.cdr.detectChanges();
  }

  closeEditProjectModal() {
    this.isEditProjectModalClosing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.isEditProjectModalOpen = false;
      this.isEditProjectModalClosing = false;
      this.cdr.detectChanges();
    }, 300);
  }

  saveProjectEdits() {
    if (!this.editProjectName || !this.editProjectName.trim()) {
      this.showCustomAlert('Project Name cannot be empty.', '⚠️', 'Validation Error');
      return;
    }

    const nameExists = this.projectList.some(
      p => p.projectId !== this.currentProjectId && p.name.toLowerCase().trim() === this.editProjectName.toLowerCase().trim()
    );

    if (nameExists) {
      this.showCustomAlert(`Conflict: A project board named '${this.editProjectName}' already exists.`, '⚠️', 'Duplicate Workspace Identity');
      return;
    }

    const currentUserId = this.authService.CurrentUserValue?.userId || 0;
    const payload = {
      name: this.editProjectName.trim(),
      description: this.editProjectDescription.trim()
    };

    this.http.put<ProjectItem>(`http://localhost:5262/api/tasks/project/${this.currentProjectId}`, payload, {
      headers: {
        'X-Action-User-Id': currentUserId.toString()
      }
    }).subscribe({
      next: (updatedProj) => {
        this.showCustomAlert('Project details successfully updated.', '🎉', 'Success');
        this.closeEditProjectModal();
        this.loadAllProjects();
      },
      error: (err) => {
        let errorMessage = 'Failed to save project edits.';
        if (err.error && typeof err.error === 'string') {
          errorMessage = err.error;
        }
        this.showCustomAlert(errorMessage, '❌', 'Error');
      }
    });
  }

  openDeleteAccountModal() {
    this.deleteAccountPassword = '';
    this.showDeletePassword = false;
    this.isDeleteAccountModalOpen = true;
    this.isDeleteAccountModalClosing = false;
    this.cdr.detectChanges();
  }

  closeDeleteAccountModal() {
    this.isDeleteAccountModalClosing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.isDeleteAccountModalOpen = false;
      this.isDeleteAccountModalClosing = false;
      this.cdr.detectChanges();
    }, 300);
  }

  executeAccountDeletion() {
    if (!this.deleteAccountPassword || !this.deleteAccountPassword.trim()) {
      this.showCustomAlert('Please enter your password to confirm.', '⚠️', 'Validation Error');
      return;
    }

    const currentUserId = this.authService.CurrentUserValue?.userId || 0;
    
    this.http.delete(`http://localhost:5262/api/auth/delete-account?password=${encodeURIComponent(this.deleteAccountPassword)}`, {
      headers: {
        'X-Action-User-Id': currentUserId.toString()
      }
    }).subscribe({
      next: () => {
        this.showCustomAlert('Your account has been permanently deleted.', '🎉', 'Purge Successful');
        this.closeDeleteAccountModal();
        this.triggerSessionLogout();
      },
      error: (err) => {
        let errorMessage = 'Failed to delete account. Incorrect password validation failed.';
        if (err.error && typeof err.error === 'string') {
          errorMessage = err.error;
        } else if (err.error && err.error.message) {
          errorMessage = err.error.message;
        }
        this.showCustomAlert(errorMessage, '❌', 'Authentication Error');
      }
    });
  }

  updateLocalMetricCounts() {
    this.totalTasksCount = this.todoTasks.length + this.inProgressTasks.length + this.doneTasks.length;
    this.pendingTasksCount = this.todoTasks.length + this.inProgressTasks.length;
    this.completedTasksCount = this.doneTasks.length;
    this.renderPremiumAnalyticsChart();
    this.cdr.detectChanges();
  }

  drop(event: CdkDragDrop<TaskItem[]>, newStatus: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }

    const movedTask = event.container.data[event.currentIndex];

    const targetColumnTasks = event.container.data;
    targetColumnTasks.forEach((task, index) => {
      task.status = newStatus;
      task.displayOrder = index;
    });

    this.updateLocalMetricCounts();

    this.http.put(`${environment.apiUrl}/api/tasks/update-orders`, targetColumnTasks, {
      headers: {
        'X-Moved-Task-Title': movedTask ? movedTask.title : 'Unknown Task',
        'X-Action-User': this.authService.CurrentUserValue?.username || this.authService.CurrentUserValue?.fullName || 'System User'
      }
    }).subscribe({
      next: () => { this.loadProjectTasks(this.currentProjectId); },
      error: (err) => console.error('Failed to persist drag reorder indexes:', err)
    });
  }

  showCustomAlert(message: string, icon: string = '⚠️', title: string = 'Security Gateway Notice', autoClose: boolean = true): Promise<boolean> {
    if (this.autoCloseAlertTimeout) {
      clearTimeout(this.autoCloseAlertTimeout);
      this.autoCloseAlertTimeout = null;
    }

    this.customAlertTitle = title;
    this.customAlertMessage = message;
    this.customAlertIcon = icon;
    this.customAlertConfirmOnly = true;
    this.customAlertClosing = false;
    this.customAlertOpen = true;
    this.cdr.detectChanges();

    if (autoClose) {
      this.autoCloseAlertTimeout = setTimeout(() => {
        this.handleCustomAlertResponse(true);
      }, 5000);
    }

    return new Promise((resolve) => {
      this.alertResolve = resolve;
    });
  }

  showCustomConfirm(message: string, icon: string = '🗑️', title: string = 'Confirm Operation', confirmOnly: boolean = false): Promise<boolean> {
    if (this.autoCloseAlertTimeout) {
      clearTimeout(this.autoCloseAlertTimeout);
      this.autoCloseAlertTimeout = null;
    }

    this.customAlertTitle = title;
    this.customAlertMessage = message;
    this.customAlertIcon = icon;
    this.customAlertConfirmOnly = confirmOnly;
    this.customAlertClosing = false;
    this.customAlertOpen = true;
    this.cdr.detectChanges();
    return new Promise((resolve) => {
      this.alertResolve = resolve;
    });
  }

  handleCustomAlertResponse(approved: boolean) {
    if (this.customAlertClosing) return;
    
    if (this.autoCloseAlertTimeout) {
      clearTimeout(this.autoCloseAlertTimeout);
      this.autoCloseAlertTimeout = null;
    }

    this.customAlertClosing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.customAlertOpen = false;
      this.customAlertClosing = false;
      if (this.alertResolve) {
        this.alertResolve(approved);
        this.alertResolve = null;
      }
      this.cdr.detectChanges();
    }, 200);
  }
 
  // 👥 REGISTRY ENGINE NESTED INSIDE COMPONENT CONTEXT GRID
  openUserManagementModal() {
    console.log('--- Manage Users Button Triggered Live ---'); // 🎯 Telemetry tracking print lagaya
    this.isUserModalOpen = true;
    this.isUserModalClosing = false;
    this.cdr.detectChanges(); // Force UI refresh loop
  }

  closeUserManagementModal() {
    this.isUserModalClosing = true;
    setTimeout(() => {
      this.isUserModalOpen = false;
      this.isUserModalClosing = false;
      this.newUserName = '';
      this.newUserEmail = '';
      this.newUserUsername = '';
      this.newUserPass = '';
      this.newUserConfirmPass = '';
      this.newUserRoleSelected = 'Developer';
      this.showRegisterPassword = false;
      this.showConfirmPassword = false;
      this.cdr.detectChanges();
    }, 200);
  }

  // 🎯 CORPORATE REGISTER ENDPOINT SYNC WITH UNIQUE USERNAME CONTROL
  executeCorporateUserRegistration() {
    if (!this.newUserName.trim() || !this.newUserEmail.trim() || !this.newUserUsername.trim() || !this.newUserPass.trim()) {
      this.showCustomAlert('Please fill out all identity configuration parameter text spaces including unique handle.', '⚠️', 'Validation Error');
      return;
    }

    const email = this.newUserEmail.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      this.showCustomAlert('Please enter a valid corporate email address.', '⚠️', 'Validation Error');
      return;
    }

    const registrationPayload = {
      fullName: this.newUserName.trim(),
      email: email,
      username: this.newUserUsername.replace('@', '').trim().toLowerCase(), // Auto strips handles prefix internally
      passwordHash: this.newUserPass.trim(),
      role: this.newUserRoleSelected
    };

    this.http.post(`${environment.apiUrl}/api/auth/register-peer`, registrationPayload).subscribe({
      next: (res: any) => {
        this.showCustomAlert(`Successfully registered corporate profile for @${registrationPayload.username}!`, '🎉', 'Account Created');
        this.loadAllUsers(); 
        this.closeUserManagementModal();
      },
      error: (err) => {
        console.error('Registration framework pipeline exception error:', err);
        const failMessage = typeof err.error === 'string' ? err.error : 'Handle allocation conflict node matching duplicate values.';
        this.showCustomAlert(failMessage, '❌', 'Identity Conflict');
      }
    });
  }
}
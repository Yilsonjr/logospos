import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class SidebarService {
    private isCollapsedSubject = new BehaviorSubject<boolean>(
        localStorage.getItem('sidebarCollapsed') === 'true'
    );

    public isCollapsed$ = this.isCollapsedSubject.asObservable();

    constructor() { }

    toggleSidebar(): void {
        const newState = !this.isCollapsedSubject.value;
        this.isCollapsedSubject.next(newState);
        localStorage.setItem('sidebarCollapsed', newState.toString());
    }

    setCollapsed(collapsed: boolean, persist: boolean = true): void {
        this.isCollapsedSubject.next(collapsed);
        if (persist) {
            localStorage.setItem('sidebarCollapsed', collapsed.toString());
        }
    }

    getCollapsed(): boolean {
        return this.isCollapsedSubject.value;
    }
}

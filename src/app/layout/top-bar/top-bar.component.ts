import { Component, inject, signal, HostListener, ElementRef, computed } from '@angular/core';
import { GraphStateService } from '../../core/services/graph-state.service';
import { ExportService } from '../../storage/export.service';
import { StorageService } from '../../storage/storage.service';
import { FormsModule } from '@angular/forms';
import { InfraNode } from '../../core/models/infra-graph.model';

@Component({
    selector: 'app-top-bar',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './top-bar.component.html',
    styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
    graphState = inject(GraphStateService);
    private exportService = inject(ExportService);
    private storageService = inject(StorageService);
    private elementRef = inject(ElementRef);

    showExportMenu = signal(false);
    isSaving = signal(false);
    saveError = signal<string | null>(null);
    
    // Search state
    searchQuery = signal('');
    showSearchResults = signal(false);
    
    // Computed search results
    searchResults = computed(() => {
        const query = this.searchQuery().toLowerCase().trim();
        if (!query) return [];
        
        return this.graphState.graph().nodes.filter(node => 
            node.name.toLowerCase().includes(query) ||
            node.kind.toLowerCase().includes(query)
        );
    });

    get saveStatus(): string {
        if (this.isSaving()) return 'Saving...';
        if (this.saveError()) return this.saveError()!;
        const last = this.graphState.lastSaved();
        if (!last) return 'Not saved';
        if (this.graphState.isDirty()) return 'Unsaved changes';
        return `Saved ${this.formatTime(last)}`;
    }

    private formatTime(date: Date): string {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Close export menu when clicking outside
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (this.showExportMenu() && !this.elementRef.nativeElement.contains(event.target)) {
            this.showExportMenu.set(false);
        }
    }

    // Keyboard shortcut: Ctrl+S to save, Ctrl+Z to undo, Ctrl+Y to redo, Ctrl+F to search
    @HostListener('document:keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.saveProject();
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
            event.preventDefault();
            this.undo();
        }
        if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
            event.preventDefault();
            this.redo();
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
            event.preventDefault();
            this.focusSearch();
        }
        if (event.key === 'Escape') {
            this.closeSearch();
        }
    }

    undo(): void {
        this.graphState.undo();
    }

    redo(): void {
        this.graphState.redo();
    }

    async saveProject(): Promise<void> {
        if (this.isSaving()) return;
        
        this.isSaving.set(true);
        this.saveError.set(null);
        
        try {
            const graph = this.graphState.graph();
            const name = this.graphState.projectName();
            const project = this.storageService.buildProjectData(graph, name);
            await this.storageService.saveProject(project);
            this.graphState.lastSaved.set(new Date());
            this.graphState.isDirty.set(false);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Failed to save project';
            this.saveError.set(errorMsg);
            console.error('Save failed:', e);
            // Clear error after 5 seconds
            setTimeout(() => this.saveError.set(null), 5000);
        } finally {
            this.isSaving.set(false);
        }
    }

    toggleExportMenu(event?: MouseEvent): void {
        event?.stopPropagation();
        this.showExportMenu.update(v => !v);
    }

    exportTerraform(): void {
        this.showExportMenu.set(false);
        this.exportService.exportTerraformZip(
            this.graphState.graph(),
            this.graphState.projectName()
        );
    }

    exportProjectJson(): void {
        this.showExportMenu.set(false);
        this.exportService.exportProjectJson(
            this.graphState.graph(),
            this.graphState.projectName()
        );
    }

    exportBundle(): void {
        this.showExportMenu.set(false);
        this.exportService.exportFullBundle(
            this.graphState.graph(),
            this.graphState.projectName()
        );
    }

    async saveAs(): Promise<void> {
        const newName = prompt('Enter new project name:', this.graphState.projectName() + ' - Copy');
        if (!newName || !newName.trim()) return;
        
        this.showExportMenu.set(false);
        this.graphState.projectName.set(newName.trim());
        await this.saveProject();
    }

    // Search functionality
    focusSearch(): void {
        const searchInput = this.elementRef.nativeElement.querySelector('.search-input');
        if (searchInput) {
            searchInput.focus();
            this.showSearchResults.set(true);
        }
    }

    closeSearch(): void {
        this.showSearchResults.set(false);
        this.searchQuery.set('');
    }

    onSearchFocus(): void {
        this.showSearchResults.set(true);
    }

    onSearchInput(query: string): void {
        this.searchQuery.set(query);
        this.showSearchResults.set(query.length > 0);
    }

    selectSearchResult(node: InfraNode): void {
        this.graphState.selectNode(node.id);
        this.closeSearch();
    }

    newProject(): void {
        if (this.graphState.isDirty()) {
            const proceed = confirm('You have unsaved changes. Create new project anyway?');
            if (!proceed) return;
        }
        this.graphState.clearGraph();
        this.graphState.projectName.set('Untitled Project');
        this.saveError.set(null);
    }

    async importProject(): Promise<void> {
        // Check for unsaved changes before import
        if (this.graphState.isDirty()) {
            const proceed = confirm('You have unsaved changes. Import will overwrite current project. Continue?');
            if (!proceed) return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const data = await this.exportService.importProjectJson(file);
                this.graphState.loadGraph(data.graph);
                this.graphState.projectName.set(data.metadata.name);
                this.saveError.set(null);
            } catch (e) {
                alert('Failed to import project: ' + (e instanceof Error ? e.message : 'Unknown error'));
            }
        };
        input.click();
    }
}

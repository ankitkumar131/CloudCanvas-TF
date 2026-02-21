import { Component, inject } from '@angular/core';
import { GraphStateService } from '../../core/services/graph-state.service';
import { ExportService } from '../../storage/export.service';
import { StorageService } from '../../storage/storage.service';
import { FormsModule } from '@angular/forms';

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

    showExportMenu = false;

    get saveStatus(): string {
        const last = this.graphState.lastSaved();
        if (!last) return 'Not saved';
        if (this.graphState.isDirty()) return 'Unsaved changes';
        return `Saved ${this.formatTime(last)}`;
    }

    private formatTime(date: Date): string {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async saveProject(): Promise<void> {
        const graph = this.graphState.graph();
        const name = this.graphState.projectName();
        const project = this.storageService.buildProjectData(graph, name);
        await this.storageService.saveProject(project);
        this.graphState.lastSaved.set(new Date());
        this.graphState.isDirty.set(false);
    }

    toggleExportMenu(): void {
        this.showExportMenu = !this.showExportMenu;
    }

    exportTerraform(): void {
        this.showExportMenu = false;
        this.exportService.exportTerraformZip(
            this.graphState.graph(),
            this.graphState.projectName()
        );
    }

    exportProjectJson(): void {
        this.showExportMenu = false;
        this.exportService.exportProjectJson(
            this.graphState.graph(),
            this.graphState.projectName()
        );
    }

    exportBundle(): void {
        this.showExportMenu = false;
        this.exportService.exportFullBundle(
            this.graphState.graph(),
            this.graphState.projectName()
        );
    }

    newProject(): void {
        if (this.graphState.isDirty()) {
            const proceed = confirm('You have unsaved changes. Create new project anyway?');
            if (!proceed) return;
        }
        this.graphState.clearGraph();
        this.graphState.projectName.set('Untitled Project');
    }

    async importProject(): Promise<void> {
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
            } catch (e) {
                alert('Failed to import project: ' + (e instanceof Error ? e.message : 'Unknown error'));
            }
        };
        input.click();
    }
}

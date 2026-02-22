import { Component, inject, OnInit, effect, untracked, DestroyRef, HostListener, signal } from '@angular/core';
import { TopBarComponent } from './top-bar/top-bar.component';
import { PaletteComponent } from '../palette/palette.component';
import { CanvasComponent } from '../canvas/canvas.component';
import { InspectorComponent } from '../inspector/inspector.component';
import { CodePreviewComponent } from '../code-preview/code-preview.component';
import { DiagnosticsComponent } from '../diagnostics/diagnostics.component';
import { GraphStateService } from '../core/services/graph-state.service';
import { ValidationService } from '../validation/validation.service';
import { TerraformGeneratorService } from '../terraform-engine/terraform-generator.service';
import { StorageService } from '../storage/storage.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        TopBarComponent,
        PaletteComponent,
        CanvasComponent,
        InspectorComponent,
        CodePreviewComponent,
        DiagnosticsComponent,
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
    private graphState = inject(GraphStateService);
    private validation = inject(ValidationService);
    private terraformGen = inject(TerraformGeneratorService);
    private storageService = inject(StorageService);
    private destroyRef = inject(DestroyRef);

    private validationTimeout: ReturnType<typeof setTimeout> | null = null;
    private generationTimeout: ReturnType<typeof setTimeout> | null = null;
    private autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly AUTO_SAVE_DELAY = 30000; // 30 seconds

    // Loading state
    isLoading = signal(false);

    constructor() {
        // React to graph changes: re-validate and re-generate
        // Use untracked to prevent circular dependencies when setting diagnostics/files
        effect(() => {
            const graph = this.graphState.graph();
            untracked(() => {
                // Debounce validation (300ms)
                if (this.validationTimeout) clearTimeout(this.validationTimeout);
                this.validationTimeout = setTimeout(() => {
                    const diags = this.validation.validateAll(graph);
                    this.graphState.diagnostics.set(diags);
                }, 300);

                // Debounce terraform generation (500ms)
                if (this.generationTimeout) clearTimeout(this.generationTimeout);
                this.generationTimeout = setTimeout(() => {
                    const files = this.terraformGen.generate(graph);
                    this.graphState.generatedFiles.set(files);
                }, 500);

                // Schedule auto-save if dirty
                this.scheduleAutoSave();
            });
        });

        // Cleanup timeouts on destroy
        this.destroyRef.onDestroy(() => {
            if (this.validationTimeout) clearTimeout(this.validationTimeout);
            if (this.generationTimeout) clearTimeout(this.generationTimeout);
            if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
        });
    }

    private scheduleAutoSave(): void {
        // Only auto-save if dirty
        if (!this.graphState.isDirty()) return;

        // Clear existing auto-save timeout
        if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);

        // Schedule new auto-save
        this.autoSaveTimeout = setTimeout(async () => {
            if (this.graphState.isDirty()) {
                await this.performAutoSave();
            }
        }, this.AUTO_SAVE_DELAY);
    }

    private async performAutoSave(): Promise<void> {
        try {
            const graph = this.graphState.graph();
            const name = this.graphState.projectName();
            const project = this.storageService.buildProjectData(graph, name);
            await this.storageService.saveProject(project);
            this.graphState.lastSaved.set(new Date());
            this.graphState.isDirty.set(false);
            console.log('Auto-saved at', new Date().toLocaleTimeString());
        } catch (e) {
            console.error('Auto-save failed:', e);
        }
    }

    ngOnInit(): void {
        // Initialize with empty graph - diagnostics will show "add your first resource"
        // Run initial validation synchronously
        const graph = this.graphState.graph();
        const diags = this.validation.validateAll(graph);
        this.graphState.diagnostics.set(diags);
    }

    // Warn before unload if there are unsaved changes
    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload(event: BeforeUnloadEvent): string | undefined {
        if (this.graphState.isDirty()) {
            event.preventDefault();
            return 'You have unsaved changes. Are you sure you want to leave?';
        }
        return undefined;
    }
}

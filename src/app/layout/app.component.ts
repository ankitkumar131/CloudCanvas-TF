import { Component, inject, OnInit, effect } from '@angular/core';
import { TopBarComponent } from './top-bar/top-bar.component';
import { PaletteComponent } from '../palette/palette.component';
import { CanvasComponent } from '../canvas/canvas.component';
import { InspectorComponent } from '../inspector/inspector.component';
import { CodePreviewComponent } from '../code-preview/code-preview.component';
import { DiagnosticsComponent } from '../diagnostics/diagnostics.component';
import { GraphStateService } from '../core/services/graph-state.service';
import { ValidationService } from '../validation/validation.service';
import { TerraformGeneratorService } from '../terraform-engine/terraform-generator.service';

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

    constructor() {
        // React to graph changes: re-validate and re-generate
        effect(() => {
            const graph = this.graphState.graph();
            // Run validation
            const diags = this.validation.validateAll(graph);
            this.graphState.diagnostics.set(diags);
            // Run terraform generation
            const files = this.terraformGen.generate(graph);
            this.graphState.generatedFiles.set(files);
        });
    }

    ngOnInit(): void {
        // Initialize with empty graph - diagnostics will show "add your first resource"
    }
}

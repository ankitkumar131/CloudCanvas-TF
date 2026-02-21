import { Component, inject, computed } from '@angular/core';
import { GraphStateService } from '../core/services/graph-state.service';
import { Diagnostic } from '../core/models/infra-graph.model';

@Component({
    selector: 'app-diagnostics',
    standalone: true,
    templateUrl: './diagnostics.component.html',
    styleUrl: './diagnostics.component.scss',
})
export class DiagnosticsComponent {
    private graphState = inject(GraphStateService);

    diagnostics = computed(() => this.graphState.diagnostics());

    errors = computed(() => this.diagnostics().filter((d) => d.severity === 'error'));
    warnings = computed(() => this.diagnostics().filter((d) => d.severity === 'warning'));
    infos = computed(() => this.diagnostics().filter((d) => d.severity === 'info'));

    errorCount = computed(() => this.errors().length);
    warningCount = computed(() => this.warnings().length);

    sortedDiagnostics = computed(() => {
        const all = this.diagnostics();
        const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
        return [...all].sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    });

    selectNode(diag: Diagnostic): void {
        if (diag.nodeId) {
            this.graphState.selectNode(diag.nodeId);
        }
    }

    getSeverityIcon(severity: string): string {
        switch (severity) {
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '❓';
        }
    }
}

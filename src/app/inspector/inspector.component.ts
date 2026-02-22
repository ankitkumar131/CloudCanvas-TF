import { Component, inject, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GraphStateService } from '../core/services/graph-state.service';
import { PluginRegistryService } from '../infra/plugin-registry.service';
import { JsonSchemaProperty } from '../core/models/resource-plugin.model';

interface FieldEntry {
    key: string;
    config: JsonSchemaProperty;
    value: unknown;
    group: string;
}

@Component({
    selector: 'app-inspector',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './inspector.component.html',
    styleUrl: './inspector.component.scss',
})
export class InspectorComponent {
    graphState = inject(GraphStateService);
    private registry = inject(PluginRegistryService);

    selectedNode = computed(() => this.graphState.selectedNode());

    fields = computed<FieldEntry[]>(() => {
        const node = this.selectedNode();
        if (!node) return [];
        const plugin = this.registry.getPlugin(node.kind);
        if (!plugin) return [];
        const entries: FieldEntry[] = [];
        for (const [key, config] of Object.entries(plugin.schema.properties)) {
            entries.push({
                key,
                config,
                value: node.properties[key] ?? config.default ?? '',
                group: config.group ?? 'General',
            });
        }
        return entries;
    });

    groups = computed(() => {
        const f = this.fields();
        const grouped = new Map<string, FieldEntry[]>();
        for (const field of f) {
            const list = grouped.get(field.group) ?? [];
            list.push(field);
            grouped.set(field.group, list);
        }
        return Array.from(grouped.entries()).map(([name, fields]) => ({ name, fields }));
    });

    nodeDiagnostics = computed(() => {
        const node = this.selectedNode();
        if (!node) return [];
        return this.graphState.diagnostics().filter((d) => d.nodeId === node.id);
    });

    displayName = computed(() => {
        const node = this.selectedNode();
        if (!node) return '';
        const plugin = this.registry.getPlugin(node.kind);
        return plugin?.displayName ?? node.kind;
    });

    icon = computed(() => {
        const node = this.selectedNode();
        if (!node) return '';
        const plugin = this.registry.getPlugin(node.kind);
        return plugin?.icon ?? '📦';
    });

    onFieldChange(key: string, value: unknown): void {
        const node = this.selectedNode();
        if (!node) return;
        this.graphState.updateNodeProperties(node.id, { [key]: value });
    }

    onNameChange(name: string): void {
        const node = this.selectedNode();
        if (!node) return;
        this.graphState.updateNodeName(node.id, name);
    }

    onBooleanChange(key: string, event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.onFieldChange(key, checked);
    }

    onNumberChange(key: string, event: Event): void {
        const val = Number((event.target as HTMLInputElement).value);
        this.onFieldChange(key, isNaN(val) ? 0 : val);
    }

    getFieldError(key: string): string | null {
        return this.nodeDiagnostics().find(
            (d) => d.field === key && d.severity === 'error'
        )?.message ?? null;
    }
}

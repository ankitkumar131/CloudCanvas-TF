import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GraphStateService } from '../core/services/graph-state.service';
import { PluginRegistryService } from '../infra/plugin-registry.service';
import { JsonSchemaProperty } from '../core/models/resource-plugin.model';

interface FieldEntry {
    key: string;
    config: JsonSchemaProperty;
    value: unknown;
    group: string;
    validationError?: string;
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
            const value = node.properties[key] ?? config.default ?? '';
            const validationError = this.validateField(key, value, config);
            entries.push({
                key,
                config,
                value,
                group: config.group ?? 'General',
                validationError,
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
        // Check for validation errors from the service
        const serviceError = this.nodeDiagnostics().find(
            (d) => d.field === key && d.severity === 'error'
        )?.message ?? null;
        if (serviceError) return serviceError;

        // Check for field-level validation errors
        const field = this.fields().find(f => f.key === key);
        return field?.validationError ?? null;
    }

    private validateField(key: string, value: unknown, config: JsonSchemaProperty): string | undefined {
        // Required field validation
        if (config.required) {
            if (value === undefined || value === null || value === '') {
                return `${config.label} is required`;
            }
        }

        // Type-specific validation
        if (config.type === 'number' && value !== undefined && value !== '') {
            const numVal = Number(value);
            if (isNaN(numVal)) {
                return `${config.label} must be a valid number`;
            }
            // Add specific validations based on field name
            if (key.includes('size') && numVal < 10) {
                return `${config.label} must be at least 10`;
            }
            if (key.includes('size') && numVal > 65536) {
                return `${config.label} cannot exceed 65536`;
            }
        }

        // String validation
        if (config.type === 'string' && typeof value === 'string') {
            // Zone format validation
            if (key === 'zone' && value && !/^[a-z]+-[a-z]+\d+-[a-z]$/.test(value)) {
                return 'Zone must be in format: region-zone (e.g., us-central1-a)';
            }
            // Name validation (Terraform resource name rules)
            if (key === 'name' && value && !/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(value)) {
                return 'Name must start with a letter and contain only letters, numbers, hyphens, and underscores';
            }
        }

        return undefined;
    }

    hasFieldError(key: string): boolean {
        return this.getFieldError(key) !== null;
    }
}

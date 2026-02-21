import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PluginRegistryService } from '../infra/plugin-registry.service';
import { GraphStateService } from '../core/services/graph-state.service';
import { ResourcePlugin } from '../core/models/resource-plugin.model';

@Component({
    selector: 'app-palette',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './palette.component.html',
    styleUrl: './palette.component.scss',
})
export class PaletteComponent {
    private registry = inject(PluginRegistryService);
    private graphState = inject(GraphStateService);

    searchTerm = signal('');
    expandedCategories = signal<Set<string>>(new Set(['Network', 'Compute', 'Storage', 'Kubernetes', 'Database', 'Serverless', 'Security', 'Messaging']));

    categories = computed(() => {
        const grouped = this.registry.getPluginsByCategory();
        const term = this.searchTerm().toLowerCase();
        const result: { name: string; plugins: ResourcePlugin[] }[] = [];

        for (const [name, plugins] of grouped.entries()) {
            const filtered = term
                ? plugins.filter(
                    (p) =>
                        p.displayName.toLowerCase().includes(term) ||
                        p.kind.toLowerCase().includes(term) ||
                        p.description.toLowerCase().includes(term)
                )
                : plugins;
            if (filtered.length > 0) {
                result.push({ name, plugins: filtered });
            }
        }
        return result;
    });

    toggleCategory(name: string): void {
        this.expandedCategories.update((set) => {
            const next = new Set(set);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }

    isCategoryExpanded(name: string): boolean {
        return this.expandedCategories().has(name);
    }

    onDragStart(event: DragEvent, plugin: ResourcePlugin): void {
        event.dataTransfer?.setData('application/cloudcanvas-kind', plugin.kind);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
        }
    }

    addToCanvas(plugin: ResourcePlugin): void {
        const defaults = plugin.defaults();
        // Spread nodes in a grid-like pattern to avoid overlap
        const existingCount = this.graphState.nodeCount();
        const cols = 3;
        const col = existingCount % cols;
        const row = Math.floor(existingCount / cols);
        const spacingX = 240;
        const spacingY = 130;
        const jitterX = Math.random() * 30 - 15;
        const jitterY = Math.random() * 30 - 15;
        const x = 200 + col * spacingX + jitterX;
        const y = 100 + row * spacingY + jitterY;
        const id = this.graphState.addNode(plugin.kind, { x, y }, defaults);
        this.graphState.selectNode(id);
    }

    updateSearch(value: string): void {
        this.searchTerm.set(value);
    }
}

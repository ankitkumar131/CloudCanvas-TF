import { Injectable, signal, computed } from '@angular/core';
import {
    InfraGraph,
    InfraNode,
    InfraEdge,
    Diagnostic,
    GeneratedFile,
    ResourceKind,
    EdgeRelationship,
} from '../models/infra-graph.model';

@Injectable({ providedIn: 'root' })
export class GraphStateService {
    readonly graph = signal<InfraGraph>({ nodes: [], edges: [] });
    readonly selectedNodeId = signal<string | null>(null);
    readonly diagnostics = signal<Diagnostic[]>([]);
    readonly generatedFiles = signal<GeneratedFile[]>([]);
    readonly projectName = signal<string>('Untitled Project');
    readonly lastSaved = signal<Date | null>(null);
    readonly isDirty = signal<boolean>(false);

    readonly selectedNode = computed<InfraNode | null>(() => {
        const id = this.selectedNodeId();
        if (!id) return null;
        return this.graph().nodes.find((n) => n.id === id) ?? null;
    });

    readonly hasBlockingErrors = computed(() =>
        this.diagnostics().some((d) => d.severity === 'error')
    );

    readonly nodeCount = computed(() => this.graph().nodes.length);
    readonly edgeCount = computed(() => this.graph().edges.length);

    private generateId(): string {
        return `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    addNode(kind: ResourceKind, position: { x: number; y: number }, defaults: Record<string, unknown>): string {
        const id = this.generateId();
        const kindLabel = kind.replace('google_', '').replace(/_/g, '-');
        const existingCount = this.graph().nodes.filter((n) => n.kind === kind).length;
        const name = `${kindLabel}-${existingCount + 1}`;

        const node: InfraNode = {
            id,
            kind,
            name,
            properties: { ...defaults },
            version: 1,
            position,
        };

        this.graph.update((g) => ({
            ...g,
            nodes: [...g.nodes, node],
        }));
        this.isDirty.set(true);
        return id;
    }

    removeNode(nodeId: string): void {
        this.graph.update((g) => ({
            nodes: g.nodes.filter((n) => n.id !== nodeId),
            edges: g.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
        }));
        if (this.selectedNodeId() === nodeId) {
            this.selectedNodeId.set(null);
        }
        this.isDirty.set(true);
    }

    updateNodeProperties(nodeId: string, properties: Record<string, unknown>): void {
        this.graph.update((g) => ({
            ...g,
            nodes: g.nodes.map((n) =>
                n.id === nodeId
                    ? { ...n, properties: { ...n.properties, ...properties }, version: n.version + 1 }
                    : n
            ),
        }));
        this.isDirty.set(true);
    }

    updateNodeName(nodeId: string, name: string): void {
        this.graph.update((g) => ({
            ...g,
            nodes: g.nodes.map((n) =>
                n.id === nodeId ? { ...n, name } : n
            ),
        }));
        this.isDirty.set(true);
    }

    updateNodePosition(nodeId: string, position: { x: number; y: number }): void {
        this.graph.update((g) => ({
            ...g,
            nodes: g.nodes.map((n) =>
                n.id === nodeId ? { ...n, position } : n
            ),
        }));
    }

    addEdge(from: string, to: string, relationship: EdgeRelationship): string | null {
        const exists = this.graph().edges.some(
            (e) => e.from === from && e.to === to
        );
        if (exists || from === to) return null;

        const id = `edge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const edge: InfraEdge = { id, from, to, relationship };

        this.graph.update((g) => ({
            ...g,
            edges: [...g.edges, edge],
        }));
        this.isDirty.set(true);
        return id;
    }

    removeEdge(edgeId: string): void {
        this.graph.update((g) => ({
            ...g,
            edges: g.edges.filter((e) => e.id !== edgeId),
        }));
        this.isDirty.set(true);
    }

    selectNode(nodeId: string | null): void {
        this.selectedNodeId.set(nodeId);
    }

    loadGraph(graph: InfraGraph): void {
        this.graph.set(graph);
        this.selectedNodeId.set(null);
        this.isDirty.set(false);
    }

    clearGraph(): void {
        this.graph.set({ nodes: [], edges: [] });
        this.selectedNodeId.set(null);
        this.diagnostics.set([]);
        this.generatedFiles.set([]);
        this.isDirty.set(false);
    }
}

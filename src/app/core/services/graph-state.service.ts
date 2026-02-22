import { Injectable, signal, computed, inject } from '@angular/core';
import {
    InfraGraph,
    InfraNode,
    InfraEdge,
    Diagnostic,
    GeneratedFile,
    ResourceKind,
    EdgeRelationship,
} from '../models/infra-graph.model';
import { HistoryService } from './history.service';

@Injectable({ providedIn: 'root' })
export class GraphStateService {
    private history = inject(HistoryService);
    
    readonly graph = signal<InfraGraph>({ nodes: [], edges: [] });
    readonly selectedNodeId = signal<string | null>(null);
    readonly selectedNodeIds = signal<Set<string>>(new Set());
    readonly diagnostics = signal<Diagnostic[]>([]);
    readonly generatedFiles = signal<GeneratedFile[]>([]);
    readonly projectName = signal<string>('Untitled Project');
    readonly lastSaved = signal<Date | null>(null);
    readonly isDirty = signal<boolean>(false);

    // Copy/paste buffer
    private clipboard = signal<{ nodes: InfraNode[]; edges: InfraEdge[] }>({ nodes: [], edges: [] });
    readonly hasClipboard = computed(() => this.clipboard().nodes.length > 0);

    // Expose history signals
    readonly canUndo = this.history.canUndo;
    readonly canRedo = this.history.canRedo;

    // Debounce timer for property update history pushes
    private propertyUpdateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly PROPERTY_DEBOUNCE_MS = 500;

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
        // Save current state for undo
        this.history.pushState(this.graph(), 'Add Node');
        
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
        // Save current state for undo
        this.history.pushState(this.graph(), 'Remove Node');
        
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
        // Debounce history push to avoid a new entry for every keystroke
        if (this.propertyUpdateDebounceTimer !== null) {
            clearTimeout(this.propertyUpdateDebounceTimer);
        } else {
            // Only push the state before the first change in this burst
            this.history.pushState(this.graph(), 'Update Properties');
        }
        this.propertyUpdateDebounceTimer = setTimeout(() => {
            this.propertyUpdateDebounceTimer = null;
        }, this.PROPERTY_DEBOUNCE_MS);
        
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
        this.history.pushState(this.graph(), 'Update Name');
        
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
        // Mark as dirty when position changes
        this.isDirty.set(true);
    }

    addEdge(from: string, to: string, relationship: EdgeRelationship): string | null {
        const exists = this.graph().edges.some(
            (e) => e.from === from && e.to === to
        );
        if (exists || from === to) return null;

        // Save current state for undo
        this.history.pushState(this.graph(), 'Add Edge');

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
        this.history.pushState(this.graph(), 'Remove Edge');
        
        this.graph.update((g) => ({
            ...g,
            edges: g.edges.filter((e) => e.id !== edgeId),
        }));
        this.isDirty.set(true);
    }

    selectNode(nodeId: string | null): void {
        this.selectedNodeId.set(nodeId);
        // Also update multi-select to sync
        if (nodeId) {
            this.selectedNodeIds.set(new Set([nodeId]));
        } else {
            this.selectedNodeIds.set(new Set());
        }
    }

    // Multi-select operations
    toggleNodeSelection(nodeId: string, addToSelection: boolean): void {
        if (addToSelection) {
            const currentSet = this.selectedNodeIds();
            const newSet = new Set(currentSet);
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
            } else {
                newSet.add(nodeId);
            }
            this.selectedNodeIds.set(newSet);
            // Update single selection to last toggled
            this.selectedNodeId.set(newSet.size > 0 ? nodeId : null);
        } else {
            this.selectedNodeId.set(nodeId);
            this.selectedNodeIds.set(new Set([nodeId]));
        }
    }

    selectMultipleNodes(nodeIds: string[]): void {
        this.selectedNodeIds.set(new Set(nodeIds));
        this.selectedNodeId.set(nodeIds.length > 0 ? nodeIds[0] : null);
    }

    clearSelection(): void {
        this.selectedNodeId.set(null);
        this.selectedNodeIds.set(new Set());
    }

    // Remove multiple nodes at once
    removeNodes(nodeIds: string[]): void {
        if (nodeIds.length === 0) return;
        
        this.history.pushState(this.graph(), 'Remove Nodes');
        
        const nodeIdSet = new Set(nodeIds);
        this.graph.update((g) => ({
            nodes: g.nodes.filter((n) => !nodeIdSet.has(n.id)),
            edges: g.edges.filter((e) => !nodeIdSet.has(e.from) && !nodeIdSet.has(e.to)),
        }));
        
        if (this.selectedNodeId() && nodeIdSet.has(this.selectedNodeId()!)) {
            this.clearSelection();
        }
        this.isDirty.set(true);
    }

    // Update multiple node positions (for multi-drag)
    updateMultipleNodePositions(updates: { nodeId: string; position: { x: number; y: number } }[]): void {
        this.graph.update((g) => {
            const updateMap = new Map(updates.map(u => [u.nodeId, u.position]));
            return {
                ...g,
                nodes: g.nodes.map((n) => {
                    const newPos = updateMap.get(n.id);
                    return newPos ? { ...n, position: newPos } : n;
                }),
            };
        });
        this.isDirty.set(true);
    }

    // Copy selected nodes to clipboard
    copySelectedNodes(): void {
        const selectedIds = this.selectedNodeIds();
        if (selectedIds.size === 0) return;

        const nodesToCopy = this.graph().nodes.filter(n => selectedIds.has(n.id));
        const edgesToCopy = this.graph().edges.filter(
            e => selectedIds.has(e.from) && selectedIds.has(e.to)
        );

        this.clipboard.set({ nodes: nodesToCopy, edges: edgesToCopy });
    }

    // Paste nodes from clipboard
    pasteNodes(offsetX: number = 50, offsetY: number = 50): string[] {
        const clipboard = this.clipboard();
        if (clipboard.nodes.length === 0) return [];

        this.history.pushState(this.graph(), 'Paste Nodes');

        // Create ID mapping for new nodes
        const idMapping = new Map<string, string>();
        const newNodes: InfraNode[] = [];

        for (const node of clipboard.nodes) {
            const newId = this.generateId();
            idMapping.set(node.id, newId);
            
            // Find unique name
            const baseName = node.name.replace(/-\d+$/, '');
            const existingCount = this.graph().nodes.filter(
                n => n.name.startsWith(baseName)
            ).length;
            const newName = `${baseName}-${existingCount + 1}`;

            newNodes.push({
                ...node,
                id: newId,
                name: newName,
                position: {
                    x: node.position.x + offsetX,
                    y: node.position.y + offsetY,
                },
            });
        }

        // Create new edges with mapped IDs
        const newEdges: InfraEdge[] = clipboard.edges.map((edge, idx) => ({
            id: `edge_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 9)}`,
            from: idMapping.get(edge.from)!,
            to: idMapping.get(edge.to)!,
            relationship: edge.relationship,
        }));

        this.graph.update((g) => ({
            nodes: [...g.nodes, ...newNodes],
            edges: [...g.edges, ...newEdges],
        }));

        // Select pasted nodes
        const newIds = newNodes.map(n => n.id);
        this.selectMultipleNodes(newIds);
        this.isDirty.set(true);
        
        return newIds;
    }

    loadGraph(graph: InfraGraph): void {
        this.history.clear();
        this.graph.set(graph);
        this.selectedNodeId.set(null);
        this.selectedNodeIds.set(new Set());
        this.isDirty.set(false);
    }

    clearGraph(): void {
        this.history.clear();
        this.graph.set({ nodes: [], edges: [] });
        this.selectedNodeId.set(null);
        this.selectedNodeIds.set(new Set());
        this.diagnostics.set([]);
        this.generatedFiles.set([]);
        this.isDirty.set(false);
    }

    // Undo/Redo operations
    undo(): void {
        const previousState = this.history.undo(this.graph());
        if (previousState) {
            this.graph.set(previousState);
            this.isDirty.set(true);
        }
    }

    redo(): void {
        const nextState = this.history.redo(this.graph());
        if (nextState) {
            this.graph.set(nextState);
            this.isDirty.set(true);
        }
    }
}

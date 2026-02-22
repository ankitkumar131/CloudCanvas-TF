import { Injectable, signal, computed } from '@angular/core';
import { InfraGraph } from '../models/infra-graph.model';

interface HistoryEntry {
    graph: InfraGraph;
    timestamp: number;
    description: string;
}

const MAX_HISTORY_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class HistoryService {
    private undoStack = signal<HistoryEntry[]>([]);
    private redoStack = signal<HistoryEntry[]>([]);
    private lastSavedGraph = signal<InfraGraph | null>(null);

    readonly canUndo = computed(() => this.undoStack().length > 0);
    readonly canRedo = computed(() => this.redoStack().length > 0);
    readonly undoCount = computed(() => this.undoStack().length);
    readonly redoCount = computed(() => this.redoStack().length);

    /**
     * Push a new state to the history stack
     * Call this before making changes to capture the previous state
     */
    pushState(graph: InfraGraph, description: string = 'Edit'): void {
        // Deep clone the graph to prevent reference issues
        const clonedGraph = this.cloneGraph(graph);
        
        const entry: HistoryEntry = {
            graph: clonedGraph,
            timestamp: Date.now(),
            description,
        };

        this.undoStack.update((stack) => {
            const newStack = [...stack, entry];
            // Limit history size
            if (newStack.length > MAX_HISTORY_SIZE) {
                return newStack.slice(-MAX_HISTORY_SIZE);
            }
            return newStack;
        });

        // Clear redo stack when new action is performed
        this.redoStack.set([]);
    }

    /**
     * Undo the last action and return the previous graph state
     */
    undo(currentGraph: InfraGraph): InfraGraph | null {
        const stack = this.undoStack();
        if (stack.length === 0) return null;

        const lastEntry = stack[stack.length - 1];
        
        // Push current state to redo stack
        this.redoStack.update((redoStack) => [
            ...redoStack,
            {
                graph: this.cloneGraph(currentGraph),
                timestamp: Date.now(),
                description: 'Redo',
            },
        ]);

        // Remove from undo stack
        this.undoStack.update((undoStack) => undoStack.slice(0, -1));

        return this.cloneGraph(lastEntry.graph);
    }

    /**
     * Redo the last undone action and return the graph state
     */
    redo(currentGraph: InfraGraph): InfraGraph | null {
        const stack = this.redoStack();
        if (stack.length === 0) return null;

        const lastEntry = stack[stack.length - 1];

        // Push current state to undo stack
        this.undoStack.update((undoStack) => [
            ...undoStack,
            {
                graph: this.cloneGraph(currentGraph),
                timestamp: Date.now(),
                description: 'Undo',
            },
        ]);

        // Remove from redo stack
        this.redoStack.update((redoStack) => redoStack.slice(0, -1));

        return this.cloneGraph(lastEntry.graph);
    }

    /**
     * Clear all history
     */
    clear(): void {
        this.undoStack.set([]);
        this.redoStack.set([]);
        this.lastSavedGraph.set(null);
    }

    /**
     * Mark the current state as saved (for dirty detection)
     */
    markAsSaved(graph: InfraGraph): void {
        this.lastSavedGraph.set(this.cloneGraph(graph));
    }

    /**
     * Check if the graph has been modified since last save
     */
    hasUnsavedChanges(currentGraph: InfraGraph): boolean {
        const saved = this.lastSavedGraph();
        if (!saved) return currentGraph.nodes.length > 0 || currentGraph.edges.length > 0;
        return JSON.stringify(saved) !== JSON.stringify(currentGraph);
    }

    private cloneGraph(graph: InfraGraph): InfraGraph {
        return {
            nodes: graph.nodes.map((n) => ({
                ...n,
                properties: { ...n.properties },
                position: { ...n.position },
                tags: n.tags ? [...n.tags] : undefined,
            })),
            edges: graph.edges.map((e) => ({ ...e })),
        };
    }
}

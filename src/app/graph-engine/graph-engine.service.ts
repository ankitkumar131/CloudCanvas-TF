import { Injectable } from '@angular/core';
import { InfraGraph, InfraNode, InfraEdge } from '../core/models/infra-graph.model';

export interface TopologicalResult {
    order: InfraNode[];
    hasCycle: boolean;
    cycleNodes?: string[];
}

@Injectable({ providedIn: 'root' })
export class GraphEngineService {

    buildAdjacencyMap(graph: InfraGraph): Map<string, Set<string>> {
        const adj = new Map<string, Set<string>>();
        for (const node of graph.nodes) {
            adj.set(node.id, new Set());
        }
        for (const edge of graph.edges) {
            const deps = adj.get(edge.from);
            if (deps) {
                deps.add(edge.to);
            }
        }
        return adj;
    }

    detectCycle(graph: InfraGraph): { hasCycle: boolean; cycleNodes: string[] } {
        const WHITE = 0, GRAY = 1, BLACK = 2;
        const color = new Map<string, number>();
        const parent = new Map<string, string | null>();
        const adj = this.buildAdjacencyMap(graph);
        const cycleNodes: string[] = [];

        for (const node of graph.nodes) {
            color.set(node.id, WHITE);
        }

        const dfs = (nodeId: string): boolean => {
            color.set(nodeId, GRAY);
            const neighbors = adj.get(nodeId) ?? new Set();
            for (const nbr of neighbors) {
                if (color.get(nbr) === GRAY) {
                    cycleNodes.push(nbr, nodeId);
                    return true;
                }
                if (color.get(nbr) === WHITE) {
                    parent.set(nbr, nodeId);
                    if (dfs(nbr)) return true;
                }
            }
            color.set(nodeId, BLACK);
            return false;
        };

        for (const node of graph.nodes) {
            if (color.get(node.id) === WHITE) {
                if (dfs(node.id)) {
                    return { hasCycle: true, cycleNodes: [...new Set(cycleNodes)] };
                }
            }
        }
        return { hasCycle: false, cycleNodes: [] };
    }

    topologicalSort(graph: InfraGraph): TopologicalResult {
        const cycleResult = this.detectCycle(graph);
        if (cycleResult.hasCycle) {
            return { order: [], hasCycle: true, cycleNodes: cycleResult.cycleNodes };
        }

        // Kahn's algorithm
        const adj = this.buildAdjacencyMap(graph);
        const inDegree = new Map<string, number>();
        const nodeMap = new Map<string, InfraNode>();

        for (const node of graph.nodes) {
            inDegree.set(node.id, 0);
            nodeMap.set(node.id, node);
        }

        for (const edge of graph.edges) {
            inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
        }

        // Use sorted queue for deterministic output (tie-break by ID)
        const queue: string[] = [];
        for (const [id, degree] of inDegree.entries()) {
            if (degree === 0) queue.push(id);
        }
        queue.sort();

        const result: InfraNode[] = [];
        while (queue.length > 0) {
            const current = queue.shift()!;
            const node = nodeMap.get(current);
            if (node) result.push(node);

            const neighbors = adj.get(current) ?? new Set();
            const newZero: string[] = [];
            for (const nbr of neighbors) {
                const newDeg = (inDegree.get(nbr) ?? 1) - 1;
                inDegree.set(nbr, newDeg);
                if (newDeg === 0) newZero.push(nbr);
            }
            newZero.sort();
            queue.push(...newZero);
        }

        return { order: result, hasCycle: false };
    }

    getConnectedNodes(graph: InfraGraph, nodeId: string): InfraNode[] {
        const connected = new Set<string>();
        for (const edge of graph.edges) {
            if (edge.from === nodeId) connected.add(edge.to);
            if (edge.to === nodeId) connected.add(edge.from);
        }
        return graph.nodes.filter((n) => connected.has(n.id));
    }

    getEdgesBetween(graph: InfraGraph, fromId: string, toId: string): InfraEdge[] {
        return graph.edges.filter(
            (e) => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
        );
    }
}

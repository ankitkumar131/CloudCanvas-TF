import { Injectable } from '@angular/core';
import { InfraGraph, Diagnostic } from '../core/models/infra-graph.model';
import { ValidationContext } from '../core/models/resource-plugin.model';
import { PluginRegistryService } from '../infra/plugin-registry.service';
import { GraphEngineService } from '../graph-engine/graph-engine.service';

@Injectable({ providedIn: 'root' })
export class ValidationService {
    constructor(
        private pluginRegistry: PluginRegistryService,
        private graphEngine: GraphEngineService
    ) { }

    validateAll(graph: InfraGraph): Diagnostic[] {
        const diags: Diagnostic[] = [];
        diags.push(...this.validateSchema(graph));
        diags.push(...this.validateGraph(graph));
        diags.push(...this.validatePolicies(graph));
        return diags;
    }

    private validateSchema(graph: InfraGraph): Diagnostic[] {
        const diags: Diagnostic[] = [];
        const ctx: ValidationContext = { graph, allNodes: graph.nodes };
        for (const node of graph.nodes) {
            const plugin = this.pluginRegistry.getPlugin(node.kind);
            if (plugin) {
                diags.push(...plugin.validate(node, ctx));
            } else {
                diags.push({
                    severity: 'error',
                    code: 'UNKNOWN_RESOURCE',
                    nodeId: node.id,
                    message: `Unknown resource type: ${node.kind}`,
                });
            }
        }
        return diags;
    }

    private validateGraph(graph: InfraGraph): Diagnostic[] {
        const diags: Diagnostic[] = [];
        const cycleResult = this.graphEngine.detectCycle(graph);
        if (cycleResult.hasCycle) {
            diags.push({
                severity: 'error',
                code: 'DEPENDENCY_CYCLE',
                message: 'Circular dependency detected in the graph. Please remove the cycle.',
                remediation: 'Check the edges between nodes and remove the circular reference.',
            });
        }

        const nodeIds = new Set(graph.nodes.map((n) => n.id));
        for (const edge of graph.edges) {
            if (!nodeIds.has(edge.from)) {
                diags.push({
                    severity: 'error', code: 'DANGLING_EDGE', message: `Edge references missing node: ${edge.from}`,
                });
            }
            if (!nodeIds.has(edge.to)) {
                diags.push({
                    severity: 'error', code: 'DANGLING_EDGE', message: `Edge references missing node: ${edge.to}`,
                });
            }
        }

        // Check for duplicate names - Terraform requires globally unique resource names
        // within the same type, but we'll warn on any duplicate name for clarity
        const namesByKind = new Map<string, Map<string, string>>();
        const allNames = new Map<string, { kind: string; id: string }>();
        
        for (const node of graph.nodes) {
            // Check for duplicate names within the same resource type (error)
            const kindKey = `${node.kind}:${node.name}`;
            if (!namesByKind.has(node.kind)) {
                namesByKind.set(node.kind, new Map());
            }
            const kindNames = namesByKind.get(node.kind)!;
            
            if (kindNames.has(node.name)) {
                diags.push({
                    severity: 'error', 
                    code: 'DUPLICATE_NAME', 
                    nodeId: node.id,
                    message: `Duplicate resource name "${node.name}" for type ${node.kind}`,
                    remediation: 'Each resource of the same type must have a unique name.',
                });
            }
            kindNames.set(node.name, node.id);
            
            // Check for duplicate names across different types (warning)
            if (allNames.has(node.name) && allNames.get(node.name)!.kind !== node.kind) {
                diags.push({
                    severity: 'warning',
                    code: 'DUPLICATE_NAME_CROSS_TYPE',
                    nodeId: node.id,
                    message: `Name "${node.name}" is also used by a ${allNames.get(node.name)!.kind} resource`,
                    remediation: 'Consider using unique names across all resources to avoid confusion.',
                });
            }
            allNames.set(node.name, { kind: node.kind, id: node.id });
        }

        return diags;
    }

    private validatePolicies(graph: InfraGraph): Diagnostic[] {
        const diags: Diagnostic[] = [];

        // empty graph suggestion
        if (graph.nodes.length === 0) {
            diags.push({
                severity: 'info', code: 'EMPTY_GRAPH',
                message: 'No resources added yet. Drag resources from the palette to get started.',
            });
        }

        // subnet without VPC check
        const subnets = graph.nodes.filter((n) => n.kind === 'google_compute_subnetwork');
        const vpcs = graph.nodes.filter((n) => n.kind === 'google_compute_network');
        if (subnets.length > 0 && vpcs.length === 0) {
            diags.push({
                severity: 'warning', code: 'SUBNET_WITHOUT_VPC',
                message: 'Subnets exist without a VPC Network. Add a VPC and connect your subnets.',
            });
        }

        return diags;
    }
}

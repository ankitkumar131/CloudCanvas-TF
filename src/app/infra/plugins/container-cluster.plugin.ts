import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext, EdgeSuggestion } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class ContainerClusterPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_container_cluster';
    readonly category = 'Kubernetes' as const;
    readonly displayName = 'GKE Cluster';
    readonly description = 'Google Kubernetes Engine cluster';
    readonly icon = '☸️';

    readonly schema: JsonSchema = {
        properties: {
            name: {
                type: 'string', label: 'Cluster Name', required: true, placeholder: 'my-gke-cluster',
            },
            location: {
                type: 'string', label: 'Location (region/zone)', required: true,
                default: 'us-central1', placeholder: 'us-central1',
            },
            initial_node_count: {
                type: 'number', label: 'Initial Node Count', default: 3,
            },
            remove_default_node_pool: {
                type: 'boolean', label: 'Remove Default Node Pool',
                description: 'Remove the default pool and use a custom one',
                default: true,
            },
            deletion_protection: {
                type: 'boolean', label: 'Deletion Protection', default: false,
            },
            node_machine_type: {
                type: 'select', label: 'Node Machine Type',
                options: ['e2-medium', 'e2-standard-2', 'e2-standard-4', 'n2-standard-2', 'n2-standard-4'],
                default: 'e2-medium', group: 'Node Config',
            },
            node_disk_size_gb: {
                type: 'number', label: 'Node Disk Size (GB)', default: 50, group: 'Node Config',
            },
            enable_autopilot: {
                type: 'boolean', label: 'Enable Autopilot',
                description: 'Use GKE Autopilot mode (managed node pools)',
                default: false, group: 'Advanced',
            },
            networking_mode: {
                type: 'select', label: 'Networking Mode',
                options: ['VPC_NATIVE', 'ROUTES'],
                default: 'VPC_NATIVE', group: 'Advanced',
            },
            description: {
                type: 'string', label: 'Description', placeholder: 'Production GKE cluster', group: 'Advanced',
            },
        },
    };

    defaults(): Record<string, unknown> {
        return {
            name: '', location: 'us-central1', initial_node_count: 3,
            remove_default_node_pool: true, deletion_protection: false,
            node_machine_type: 'e2-medium', node_disk_size_gb: 50,
            enable_autopilot: false, networking_mode: 'VPC_NATIVE', description: '',
        };
    }

    validate(node: InfraNode, ctx: ValidationContext): Diagnostic[] {
        const diags: Diagnostic[] = [];
        if (!node.properties['name']) {
            diags.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Cluster name is required.' });
        }
        if (!node.properties['location']) {
            diags.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'location', message: 'Location is required.' });
        }
        const nodeCount = (node.properties['initial_node_count'] as number) || 3;
        const machineType = (node.properties['node_machine_type'] as string) || 'e2-medium';
        if (nodeCount >= 5 && machineType.includes('standard-4')) {
            diags.push({
                severity: 'warning', code: 'HIGH_COST_CLUSTER', nodeId: node.id,
                message: `GKE cluster with ${nodeCount}× ${machineType} nodes may incur significant cost.`,
                remediation: 'Consider fewer nodes or smaller machines for dev/staging.',
            });
        }
        const hasSubnetEdge = ctx.graph.edges.some(
            (e) => e.from === node.id && ctx.graph.nodes.find((n) => n.id === e.to)?.kind === 'google_compute_subnetwork'
        );
        if (!hasSubnetEdge) {
            diags.push({
                severity: 'info', code: 'NO_CUSTOM_NETWORK', nodeId: node.id,
                message: 'GKE cluster will use default network. Consider attaching to a custom VPC subnet.',
            });
        }
        return diags;
    }

    toTerraform(node: InfraNode, ctx: GeneratorContext): TerraformBlock[] {
        const attrs: Record<string, unknown> = {
            name: node.properties['name'] || node.name,
            location: node.properties['location'] || 'us-central1',
            initial_node_count: node.properties['initial_node_count'] ?? 3,
            remove_default_node_pool: node.properties['remove_default_node_pool'] ?? true,
            deletion_protection: node.properties['deletion_protection'] ?? false,
        };
        if (node.properties['enable_autopilot']) {
            attrs['enable_autopilot'] = true;
        }
        if (node.properties['networking_mode']) {
            attrs['networking_mode'] = node.properties['networking_mode'];
        }
        if (node.properties['description']) {
            attrs['description'] = node.properties['description'];
        }

        const subnetEdge = ctx.graph.edges.find(
            (e) => e.from === node.id && ctx.graph.nodes.find((n) => n.id === e.to)?.kind === 'google_compute_subnetwork'
        );
        if (subnetEdge) {
            const vpcEdge = ctx.graph.edges.find(
                (e) => e.from === node.id && ctx.graph.nodes.find((n) => n.id === e.to)?.kind === 'google_compute_network'
            );
            if (vpcEdge) {
                attrs['network'] = { ref: ctx.getNodeReference(vpcEdge.to, 'name') };
            }
            attrs['subnetwork'] = { ref: ctx.getNodeReference(subnetEdge.to, 'name') };
        }

        return [{
            blockType: 'resource',
            resourceType: 'google_container_cluster',
            name: node.name,
            attributes: attrs as Record<string, import('../../core/models/infra-graph.model').TerraformValue>,
            nestedBlocks: [],
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph): EdgeSuggestion[] {
        return [
            { targetKind: 'google_compute_subnetwork', relationship: 'network_attachment', label: 'attach to subnet' },
            { targetKind: 'google_compute_network', relationship: 'network_attachment', label: 'attach to VPC' },
        ];
    }
}

import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext, EdgeSuggestion } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class ComputeSubnetworkPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_compute_subnetwork';
    readonly category = 'Network' as const;
    readonly displayName = 'Subnet';
    readonly description = 'Subnetwork within a VPC for resource isolation';
    readonly icon = '🔗';

    readonly schema: JsonSchema = {
        properties: {
            name: {
                type: 'string',
                label: 'Subnet Name',
                required: true,
                placeholder: 'my-subnet',
            },
            ip_cidr_range: {
                type: 'string',
                label: 'IP CIDR Range',
                description: 'The range of internal addresses (e.g., 10.0.0.0/24)',
                required: true,
                placeholder: '10.0.0.0/24',
            },
            region: {
                type: 'string',
                label: 'Region',
                required: true,
                default: 'us-central1',
                placeholder: 'us-central1',
            },
            private_ip_google_access: {
                type: 'boolean',
                label: 'Private Google Access',
                description: 'Allow VMs without external IP to reach Google APIs',
                default: true,
            },
            purpose: {
                type: 'select',
                label: 'Purpose',
                options: ['PRIVATE', 'INTERNAL_HTTPS_LOAD_BALANCER', 'REGIONAL_MANAGED_PROXY'],
                default: 'PRIVATE',
                group: 'Advanced',
            },
            description: {
                type: 'string',
                label: 'Description',
                placeholder: 'Production subnet',
                group: 'Advanced',
            },
        },
    };

    defaults(): Record<string, unknown> {
        return {
            name: '',
            ip_cidr_range: '10.0.0.0/24',
            region: 'us-central1',
            private_ip_google_access: true,
            purpose: 'PRIVATE',
            description: '',
        };
    }

    validate(node: InfraNode, ctx: ValidationContext): Diagnostic[] {
        const diags: Diagnostic[] = [];
        if (!node.properties['name']) {
            diags.push({
                severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name',
                message: 'Subnet name is required.',
            });
        }
        if (!node.properties['ip_cidr_range']) {
            diags.push({
                severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'ip_cidr_range',
                message: 'IP CIDR range is required.',
            });
        }
        if (!node.properties['region']) {
            diags.push({
                severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'region',
                message: 'Region is required.',
            });
        }
        const hasVpcEdge = ctx.graph.edges.some(
            (e) => e.from === node.id && ctx.graph.nodes.find((n) => n.id === e.to)?.kind === 'google_compute_network'
        );
        if (!hasVpcEdge) {
            diags.push({
                severity: 'warning', code: 'MISSING_VPC', nodeId: node.id,
                message: 'Subnet should be attached to a VPC Network.',
                remediation: 'Draw an edge from this subnet to a VPC Network node.',
            });
        }
        return diags;
    }

    toTerraform(node: InfraNode, ctx: GeneratorContext): TerraformBlock[] {
        const attrs: Record<string, unknown> = {
            name: node.properties['name'] || node.name,
            ip_cidr_range: node.properties['ip_cidr_range'] || '10.0.0.0/24',
            region: node.properties['region'] || 'us-central1',
        };
        const vpcEdge = ctx.graph.edges.find(
            (e) => e.from === node.id && ctx.graph.nodes.find((n) => n.id === e.to)?.kind === 'google_compute_network'
        );
        if (vpcEdge) {
            attrs['network'] = { ref: ctx.getNodeReference(vpcEdge.to, 'id') };
        }
        if (node.properties['private_ip_google_access']) {
            attrs['private_ip_google_access'] = true;
        }
        if (node.properties['description']) {
            attrs['description'] = node.properties['description'];
        }
        return [{
            blockType: 'resource',
            resourceType: 'google_compute_subnetwork',
            name: node.name,
            attributes: attrs as Record<string, import('../../core/models/infra-graph.model').TerraformValue>,
            nestedBlocks: [],
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph): EdgeSuggestion[] {
        return [{ targetKind: 'google_compute_network', relationship: 'network_attachment', label: 'attach to VPC' }];
    }
}

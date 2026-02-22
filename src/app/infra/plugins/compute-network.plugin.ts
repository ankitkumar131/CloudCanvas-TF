import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext, EdgeSuggestion } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class ComputeNetworkPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_compute_network';
    readonly category = 'Network' as const;
    readonly displayName = 'VPC Network';
    readonly description = 'Virtual Private Cloud network for isolating resources';
    readonly icon = '🌐';

    readonly schema: JsonSchema = {
        properties: {
            name: {
                type: 'string',
                label: 'Network Name',
                description: 'Name of the VPC network',
                required: true,
                placeholder: 'my-vpc-network',
            },
            auto_create_subnetworks: {
                type: 'boolean',
                label: 'Auto Create Subnetworks',
                description: 'When true, the network is created in auto subnet mode',
                default: false,
            },
            routing_mode: {
                type: 'select',
                label: 'Routing Mode',
                description: 'The network-wide routing mode',
                options: ['REGIONAL', 'GLOBAL'],
                default: 'REGIONAL',
            },
            mtu: {
                type: 'number',
                label: 'MTU',
                description: 'Maximum Transmission Unit in bytes (1460–8896)',
                default: 1460,
                group: 'Advanced',
            },
            delete_default_routes_on_create: {
                type: 'boolean',
                label: 'Delete Default Routes on Create',
                description: 'If true, default routes (0.0.0.0/0) are deleted immediately after network creation',
                default: false,
                group: 'Advanced',
            },
            description: {
                type: 'string',
                label: 'Description',
                description: 'An optional description of this resource',
                placeholder: 'Production VPC network',
                group: 'Advanced',
            },
        },
    };

    defaults(): Record<string, unknown> {
        return {
            name: '',
            auto_create_subnetworks: false,
            routing_mode: 'REGIONAL',
            mtu: 1460,
            delete_default_routes_on_create: false,
            description: '',
        };
    }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const diags: Diagnostic[] = [];
        if (!node.properties['name']) {
            diags.push({
                severity: 'error',
                code: 'REQUIRED_FIELD',
                nodeId: node.id,
                field: 'name',
                message: `VPC network name is required`,
                remediation: 'Enter a unique name for the VPC network.',
            });
        }
        const mtu = node.properties['mtu'] as number;
        if (mtu && (mtu < 1460 || mtu > 8896)) {
            diags.push({
                severity: 'error',
                code: 'INVALID_MTU',
                nodeId: node.id,
                field: 'mtu',
                message: 'MTU must be between 1460 and 8896',
            });
        }
        if (node.properties['auto_create_subnetworks'] === true) {
            diags.push({
                severity: 'info',
                code: 'AUTO_SUBNET_MODE',
                nodeId: node.id,
                message: 'Auto subnet mode will create subnets in all regions automatically.',
            });
        }
        return diags;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const attrs: Record<string, unknown> = {
            name: node.properties['name'] || node.name,
            auto_create_subnetworks: node.properties['auto_create_subnetworks'] ?? false,
            routing_mode: node.properties['routing_mode'] || 'REGIONAL',
        };
        if (node.properties['mtu'] && node.properties['mtu'] !== 1460) {
            attrs['mtu'] = node.properties['mtu'];
        }
        if (node.properties['delete_default_routes_on_create']) {
            attrs['delete_default_routes_on_create'] = true;
        }
        if (node.properties['description']) {
            attrs['description'] = node.properties['description'];
        }
        return [{
            blockType: 'resource',
            resourceType: 'google_compute_network',
            name: node.name,
            attributes: attrs as Record<string, import('../../core/models/infra-graph.model').TerraformValue>,
            nestedBlocks: [],
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph): EdgeSuggestion[] {
        return [];
    }
}

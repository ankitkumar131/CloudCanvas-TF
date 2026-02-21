import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext, EdgeSuggestion } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class ComputeInstancePlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_compute_instance';
    readonly category = 'Compute' as const;
    readonly displayName = 'VM Instance';
    readonly description = 'Compute Engine virtual machine instance';
    readonly icon = '🖥️';

    readonly schema: JsonSchema = {
        properties: {
            name: {
                type: 'string', label: 'Instance Name', required: true, placeholder: 'my-vm',
            },
            machine_type: {
                type: 'select', label: 'Machine Type', required: true,
                options: ['e2-micro', 'e2-small', 'e2-medium', 'e2-standard-2', 'e2-standard-4', 'e2-standard-8', 'n2-standard-2', 'n2-standard-4'],
                default: 'e2-medium',
            },
            zone: {
                type: 'string', label: 'Zone', required: true, default: 'us-central1-a', placeholder: 'us-central1-a',
            },
            boot_disk_image: {
                type: 'select', label: 'Boot Disk Image',
                options: ['debian-cloud/debian-12', 'ubuntu-os-cloud/ubuntu-2404-lts-amd64', 'centos-cloud/centos-stream-9', 'cos-cloud/cos-stable'],
                default: 'debian-cloud/debian-12',
            },
            boot_disk_size_gb: {
                type: 'number', label: 'Boot Disk Size (GB)', default: 20, group: 'Disk',
            },
            boot_disk_type: {
                type: 'select', label: 'Boot Disk Type',
                options: ['pd-standard', 'pd-balanced', 'pd-ssd'],
                default: 'pd-balanced', group: 'Disk',
            },
            can_ip_forward: {
                type: 'boolean', label: 'Can IP Forward', default: false, group: 'Advanced',
            },
            tags: {
                type: 'string', label: 'Network Tags', description: 'Comma-separated tags', placeholder: 'http-server,https-server', group: 'Advanced',
            },
            allow_stopping_for_update: {
                type: 'boolean', label: 'Allow Stopping for Update', default: true, group: 'Advanced',
            },
            description: {
                type: 'string', label: 'Description', placeholder: 'Web server VM', group: 'Advanced',
            },
        },
    };

    defaults(): Record<string, unknown> {
        return {
            name: '', machine_type: 'e2-medium', zone: 'us-central1-a',
            boot_disk_image: 'debian-cloud/debian-12', boot_disk_size_gb: 20,
            boot_disk_type: 'pd-balanced', can_ip_forward: false, tags: '',
            allow_stopping_for_update: true, description: '',
        };
    }

    validate(node: InfraNode, ctx: ValidationContext): Diagnostic[] {
        const diags: Diagnostic[] = [];
        if (!node.properties['name']) {
            diags.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Instance name is required.' });
        }
        if (!node.properties['zone']) {
            diags.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'zone', message: 'Zone is required.' });
        }
        const hasSubnetEdge = ctx.graph.edges.some(
            (e) => e.from === node.id && ctx.graph.nodes.find((n) => n.id === e.to)?.kind === 'google_compute_subnetwork'
        );
        if (!hasSubnetEdge) {
            diags.push({
                severity: 'warning', code: 'NO_SUBNET', nodeId: node.id,
                message: 'VM has no subnet — it will use the default network.',
                remediation: 'Connect this VM to a Subnet node.',
            });
        }
        return diags;
    }

    toTerraform(node: InfraNode, ctx: GeneratorContext): TerraformBlock[] {
        const attrs: Record<string, unknown> = {
            name: node.properties['name'] || node.name,
            machine_type: node.properties['machine_type'] || 'e2-medium',
            zone: node.properties['zone'] || 'us-central1-a',
        };
        if (node.properties['can_ip_forward']) attrs['can_ip_forward'] = true;
        if (node.properties['allow_stopping_for_update']) attrs['allow_stopping_for_update'] = true;
        if (node.properties['description']) attrs['description'] = node.properties['description'];
        if (node.properties['tags']) {
            const tagStr = node.properties['tags'] as string;
            if (tagStr) attrs['tags'] = tagStr.split(',').map((t: string) => t.trim()).filter(Boolean);
        }

        const nestedBlocks: import('../../core/models/infra-graph.model').TerraformNestedBlock[] = [];
        nestedBlocks.push({
            type: 'boot_disk',
            attributes: {
                initialize_params_image: (node.properties['boot_disk_image'] as string) || 'debian-cloud/debian-12',
                initialize_params_size: (node.properties['boot_disk_size_gb'] as number) || 20,
                initialize_params_type: (node.properties['boot_disk_type'] as string) || 'pd-balanced',
            },
        });

        const subnetEdge = ctx.graph.edges.find(
            (e) => e.from === node.id && ctx.graph.nodes.find((n) => n.id === e.to)?.kind === 'google_compute_subnetwork'
        );
        const niAttrs: Record<string, unknown> = {};
        if (subnetEdge) {
            niAttrs['subnetwork'] = { ref: ctx.getNodeReference(subnetEdge.to, 'id') };
        }
        nestedBlocks.push({ type: 'network_interface', attributes: niAttrs as Record<string, import('../../core/models/infra-graph.model').TerraformValue> });

        return [{
            blockType: 'resource',
            resourceType: 'google_compute_instance',
            name: node.name,
            attributes: attrs as Record<string, import('../../core/models/infra-graph.model').TerraformValue>,
            nestedBlocks,
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph): EdgeSuggestion[] {
        return [{ targetKind: 'google_compute_subnetwork', relationship: 'network_attachment', label: 'attach to subnet' }];
    }
}

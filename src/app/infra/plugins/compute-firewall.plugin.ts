import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class ComputeFirewallPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_compute_firewall';
    readonly category = 'Network' as const;
    readonly displayName = 'Firewall Rule';
    readonly description = 'VPC firewall rule for controlling network traffic';
    readonly icon = '🛡️';

    readonly schema: JsonSchema = {
        properties: {
            name: { type: 'string', label: 'Rule Name', required: true, default: '', placeholder: 'allow-http', group: 'General' },
            direction: { type: 'select', label: 'Direction', required: true, default: 'INGRESS', options: ['INGRESS', 'EGRESS'], group: 'General' },
            priority: { type: 'number', label: 'Priority', required: false, default: 1000, description: 'Lower number = higher priority (0-65535)', group: 'General' },
            protocol: { type: 'select', label: 'Protocol', required: true, default: 'tcp', options: ['tcp', 'udp', 'icmp', 'all'], group: 'Rules' },
            ports: { type: 'string', label: 'Ports', required: false, default: '80,443', placeholder: '80,443,8080', description: 'Comma-separated port numbers', group: 'Rules' },
            source_ranges: { type: 'string', label: 'Source IP Ranges', required: false, default: '0.0.0.0/0', placeholder: '0.0.0.0/0', description: 'Comma-separated CIDR ranges', group: 'Rules' },
        },
    };

    defaults(): Record<string, unknown> {
        return { name: '', direction: 'INGRESS', priority: 1000, protocol: 'tcp', ports: '80,443', source_ranges: '0.0.0.0/0' };
    }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const d: Diagnostic[] = [];
        if (!node.properties['name']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Firewall rule name is required.' });
        if (node.properties['source_ranges'] === '0.0.0.0/0') d.push({ severity: 'warning', code: 'OPEN_FIREWALL', nodeId: node.id, field: 'source_ranges', message: 'Firewall is open to the internet (0.0.0.0/0).', remediation: 'Restrict source ranges for production.' });
        return d;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const p = node.properties;
        return [{
            blockType: 'resource', resourceType: 'google_compute_firewall', name: node.name,
            attributes: { name: (p['name'] as string) || node.name, direction: (p['direction'] as string) || 'INGRESS', priority: (p['priority'] as number) ?? 1000 } as any,
            nestedBlocks: [{ type: 'allow', attributes: { protocol: (p['protocol'] as string) || 'tcp', ports: [`${p['ports'] || '80,443'}`] } as any }],
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph) {
        return [{ targetKind: 'google_compute_network' as ResourceKind, relationship: 'network_attachment' as const, label: 'Attach to VPC Network' }];
    }
}

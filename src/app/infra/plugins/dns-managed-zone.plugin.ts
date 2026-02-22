import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class DnsManagedZonePlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_dns_managed_zone';
    readonly category = 'Network' as const;
    readonly displayName = 'Cloud DNS Zone';
    readonly description = 'Managed DNS zone for domain name resolution';
    readonly icon = '🌍';

    readonly schema: JsonSchema = {
        properties: {
            name: { type: 'string', label: 'Zone Name', required: true, default: '', placeholder: 'my-zone', group: 'General' },
            dns_name: { type: 'string', label: 'DNS Name', required: true, default: '', placeholder: 'example.com.', description: 'Must end with a period', group: 'General' },
            visibility: { type: 'select', label: 'Visibility', required: false, default: 'public', options: ['public', 'private'], group: 'Settings' },
            zone_description: { type: 'string', label: 'Description', required: false, default: '', placeholder: 'Production DNS zone', group: 'General' },
        },
    };

    defaults(): Record<string, unknown> { return { name: '', dns_name: '', visibility: 'public', zone_description: '' }; }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const d: Diagnostic[] = [];
        if (!node.properties['name']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Zone name is required.' });
        if (!node.properties['dns_name']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'dns_name', message: 'DNS name is required.', remediation: 'Enter a domain ending with period (e.g., example.com.)' });
        return d;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const p = node.properties;
        const attrs: Record<string, any> = { name: (p['name'] as string) || node.name, dns_name: (p['dns_name'] as string) || 'example.com.' };
        if (p['visibility']) attrs['visibility'] = p['visibility'];
        if (p['zone_description']) attrs['description'] = p['zone_description'];
        return [{ blockType: 'resource', resourceType: 'google_dns_managed_zone', name: node.name, attributes: attrs }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph) { return []; }
}

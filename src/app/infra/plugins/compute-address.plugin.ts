import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class ComputeAddressPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_compute_address';
    readonly category = 'Network' as const;
    readonly displayName = 'Static IP';
    readonly description = 'Reserve a static external or internal IP address';
    readonly icon = '📍';

    readonly schema: JsonSchema = {
        properties: {
            name: { type: 'string', label: 'Address Name', required: true, default: '', placeholder: 'my-static-ip', group: 'General' },
            address_type: { type: 'select', label: 'Address Type', required: true, default: 'EXTERNAL', options: ['EXTERNAL', 'INTERNAL'], group: 'General' },
            region: { type: 'string', label: 'Region', required: true, default: 'us-central1', group: 'General' },
        },
    };

    defaults(): Record<string, unknown> { return { name: '', address_type: 'EXTERNAL', region: 'us-central1' }; }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const d: Diagnostic[] = [];
        if (!node.properties['name']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Address name is required.' });
        return d;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const p = node.properties;
        return [{
            blockType: 'resource', resourceType: 'google_compute_address', name: node.name,
            attributes: { name: (p['name'] as string) || node.name, address_type: (p['address_type'] as string) || 'EXTERNAL', region: (p['region'] as string) || 'us-central1' } as any,
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph) { return []; }
}

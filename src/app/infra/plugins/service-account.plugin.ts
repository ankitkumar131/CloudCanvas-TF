import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class ServiceAccountPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_service_account';
    readonly category = 'Security' as const;
    readonly displayName = 'Service Account';
    readonly description = 'IAM service account for workload identity';
    readonly icon = '🔑';

    readonly schema: JsonSchema = {
        properties: {
            account_id: { type: 'string', label: 'Account ID', required: true, default: '', placeholder: 'my-service-account', description: '6-30 chars, lowercase, digits, hyphens', group: 'General' },
            display_name: { type: 'string', label: 'Display Name', required: false, default: '', placeholder: 'My Service Account', group: 'General' },
            sa_description: { type: 'string', label: 'Description', required: false, default: '', placeholder: 'SA for application workloads', group: 'General' },
        },
    };

    defaults(): Record<string, unknown> { return { account_id: '', display_name: '', sa_description: '' }; }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const d: Diagnostic[] = [];
        if (!node.properties['account_id']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'account_id', message: 'Account ID is required.' });
        return d;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const p = node.properties;
        const attrs: Record<string, any> = { account_id: (p['account_id'] as string) || node.name };
        if (p['display_name']) attrs['display_name'] = p['display_name'];
        if (p['sa_description']) attrs['description'] = p['sa_description'];
        return [{ blockType: 'resource', resourceType: 'google_service_account', name: node.name, attributes: attrs }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph) { return []; }
}

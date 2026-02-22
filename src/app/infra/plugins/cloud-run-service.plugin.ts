import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class CloudRunServicePlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_cloud_run_v2_service';
    readonly category = 'Serverless' as const;
    readonly displayName = 'Cloud Run';
    readonly description = 'Serverless container execution service';
    readonly icon = '⚡';

    readonly schema: JsonSchema = {
        properties: {
            name: { type: 'string', label: 'Service Name', required: true, default: '', placeholder: 'my-api-service', group: 'General' },
            location: { type: 'string', label: 'Region', required: true, default: 'us-central1', group: 'General' },
            image: { type: 'string', label: 'Container Image', required: true, default: '', placeholder: 'gcr.io/PROJECT/IMAGE:TAG', group: 'Container' },
            port: { type: 'number', label: 'Container Port', required: false, default: 8080, group: 'Container' },
            max_instances: { type: 'number', label: 'Max Instances', required: false, default: 10, group: 'Scaling' },
            cpu: { type: 'select', label: 'CPU', required: false, default: '1', options: ['1', '2', '4', '8'], group: 'Resources' },
            memory: { type: 'select', label: 'Memory', required: false, default: '512Mi', options: ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi'], group: 'Resources' },
        },
    };

    defaults(): Record<string, unknown> {
        return { name: '', location: 'us-central1', image: '', port: 8080, max_instances: 10, cpu: '1', memory: '512Mi' };
    }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const d: Diagnostic[] = [];
        if (!node.properties['name']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Service name is required.' });
        if (!node.properties['image']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'image', message: 'Container image is required.', remediation: 'Specify a container image URL.' });
        return d;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const p = node.properties;
        return [{
            blockType: 'resource', resourceType: 'google_cloud_run_v2_service', name: node.name,
            attributes: { name: (p['name'] as string) || node.name, location: (p['location'] as string) || 'us-central1' } as any,
            nestedBlocks: [{ type: 'template', attributes: {} }],
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph) { return []; }
}

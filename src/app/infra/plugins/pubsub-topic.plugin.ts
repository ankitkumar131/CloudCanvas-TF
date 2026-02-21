import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class PubsubTopicPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_pubsub_topic';
    readonly category = 'Messaging' as const;
    readonly displayName = 'Pub/Sub Topic';
    readonly description = 'Messaging topic for asynchronous communication';
    readonly icon = '📨';

    readonly schema: JsonSchema = {
        properties: {
            name: { type: 'string', label: 'Topic Name', required: true, default: '', placeholder: 'my-events-topic', group: 'General' },
            message_retention_duration: { type: 'string', label: 'Message Retention', required: false, default: '86600s', placeholder: '86600s', description: 'Duration to retain messages', group: 'Settings' },
        },
    };

    defaults(): Record<string, unknown> { return { name: '', message_retention_duration: '86600s' }; }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const d: Diagnostic[] = [];
        if (!node.properties['name']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Topic name is required.' });
        return d;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const p = node.properties;
        const attrs: Record<string, any> = { name: (p['name'] as string) || node.name };
        if (p['message_retention_duration']) attrs['message_retention_duration'] = p['message_retention_duration'];
        return [{ blockType: 'resource', resourceType: 'google_pubsub_topic', name: node.name, attributes: attrs }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph) { return []; }
}

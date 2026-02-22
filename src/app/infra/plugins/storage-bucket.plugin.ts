import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class StorageBucketPlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_storage_bucket';
    readonly category = 'Storage' as const;
    readonly displayName = 'Cloud Storage';
    readonly description = 'Google Cloud Storage bucket for object storage';
    readonly icon = '🪣';

    readonly schema: JsonSchema = {
        properties: {
            name: {
                type: 'string', label: 'Bucket Name', required: true,
                description: 'Globally unique bucket name',
                placeholder: 'my-project-bucket',
            },
            location: {
                type: 'select', label: 'Location', required: true,
                options: ['US', 'EU', 'ASIA', 'us-central1', 'us-east1', 'us-west1', 'europe-west1', 'asia-east1'],
                default: 'US',
            },
            storage_class: {
                type: 'select', label: 'Storage Class',
                options: ['STANDARD', 'NEARLINE', 'COLDLINE', 'ARCHIVE'],
                default: 'STANDARD',
            },
            uniform_bucket_level_access: {
                type: 'boolean', label: 'Uniform Bucket-Level Access',
                description: 'Enables uniform bucket-level access (recommended)',
                default: true,
            },
            versioning: {
                type: 'boolean', label: 'Object Versioning',
                description: 'Enable object versioning for data protection',
                default: false,
                group: 'Advanced',
            },
            force_destroy: {
                type: 'boolean', label: 'Force Destroy',
                description: 'Allow bucket deletion even with objects inside',
                default: false,
                group: 'Advanced',
            },
            public_access_prevention: {
                type: 'select', label: 'Public Access Prevention',
                options: ['enforced', 'inherited'],
                default: 'enforced',
                group: 'Security',
            },
        },
    };

    defaults(): Record<string, unknown> {
        return {
            name: '', location: 'US', storage_class: 'STANDARD',
            uniform_bucket_level_access: true, versioning: false,
            force_destroy: false, public_access_prevention: 'enforced',
        };
    }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const diags: Diagnostic[] = [];
        if (!node.properties['name']) {
            diags.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Bucket name is required.' });
        }
        if (node.properties['public_access_prevention'] === 'inherited') {
            diags.push({
                severity: 'warning', code: 'PUBLIC_BUCKET_RISK', nodeId: node.id,
                message: 'Public access prevention is not enforced — objects may be publicly accessible.',
                remediation: 'Set public_access_prevention to "enforced" unless public access is intentional.',
            });
        }
        if (!node.properties['uniform_bucket_level_access']) {
            diags.push({
                severity: 'warning', code: 'ACL_MODE', nodeId: node.id,
                message: 'Fine-grained ACL mode is less secure than uniform bucket-level access.',
            });
        }
        return diags;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const attrs: Record<string, unknown> = {
            name: node.properties['name'] || node.name,
            location: node.properties['location'] || 'US',
            storage_class: node.properties['storage_class'] || 'STANDARD',
            uniform_bucket_level_access: node.properties['uniform_bucket_level_access'] ?? true,
            force_destroy: node.properties['force_destroy'] ?? false,
            public_access_prevention: node.properties['public_access_prevention'] || 'enforced',
        };
        const nestedBlocks: import('../../core/models/infra-graph.model').TerraformNestedBlock[] = [];
        if (node.properties['versioning']) {
            nestedBlocks.push({ type: 'versioning', attributes: { enabled: true } });
        }
        return [{
            blockType: 'resource',
            resourceType: 'google_storage_bucket',
            name: node.name,
            attributes: attrs as Record<string, import('../../core/models/infra-graph.model').TerraformValue>,
            nestedBlocks,
        }];
    }
}

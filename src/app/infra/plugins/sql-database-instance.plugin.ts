import { ResourcePlugin, JsonSchema, ValidationContext, GeneratorContext } from '../../core/models/resource-plugin.model';
import { InfraNode, InfraGraph, Diagnostic, TerraformBlock, ResourceKind } from '../../core/models/infra-graph.model';

export class SqlDatabaseInstancePlugin implements ResourcePlugin {
    readonly kind: ResourceKind = 'google_sql_database_instance';
    readonly category = 'Database' as const;
    readonly displayName = 'Cloud SQL';
    readonly description = 'Managed relational database (MySQL, PostgreSQL, SQL Server)';
    readonly icon = '🗃️';

    readonly schema: JsonSchema = {
        properties: {
            name: { type: 'string', label: 'Instance Name', required: true, default: '', placeholder: 'my-db-instance', group: 'General' },
            database_version: { type: 'select', label: 'Database Version', required: true, default: 'POSTGRES_15', options: ['POSTGRES_15', 'POSTGRES_14', 'MYSQL_8_0', 'MYSQL_5_7', 'SQLSERVER_2022_STANDARD'], group: 'General' },
            tier: { type: 'select', label: 'Machine Tier', required: true, default: 'db-f1-micro', options: ['db-f1-micro', 'db-g1-small', 'db-custom-2-7680', 'db-custom-4-15360'], group: 'Performance' },
            region: { type: 'string', label: 'Region', required: true, default: 'us-central1', group: 'General' },
            deletion_protection: { type: 'boolean', label: 'Deletion Protection', required: false, default: true, description: 'Prevent accidental deletion', group: 'Security' },
            availability_type: { type: 'select', label: 'Availability', required: false, default: 'ZONAL', options: ['ZONAL', 'REGIONAL'], description: 'REGIONAL for high availability', group: 'Performance' },
        },
    };

    defaults(): Record<string, unknown> {
        return { name: '', database_version: 'POSTGRES_15', tier: 'db-f1-micro', region: 'us-central1', deletion_protection: true, availability_type: 'ZONAL' };
    }

    validate(node: InfraNode, _ctx: ValidationContext): Diagnostic[] {
        const d: Diagnostic[] = [];
        if (!node.properties['name']) d.push({ severity: 'error', code: 'REQUIRED_FIELD', nodeId: node.id, field: 'name', message: 'Instance name is required.' });
        if (!node.properties['deletion_protection']) d.push({ severity: 'warning', code: 'NO_DELETION_PROTECTION', nodeId: node.id, message: 'Deletion protection is disabled.', remediation: 'Enable for production databases.' });
        return d;
    }

    toTerraform(node: InfraNode, _ctx: GeneratorContext): TerraformBlock[] {
        const p = node.properties;
        return [{
            blockType: 'resource', resourceType: 'google_sql_database_instance', name: node.name,
            attributes: {
                name: (p['name'] as string) || node.name,
                database_version: (p['database_version'] as string) || 'POSTGRES_15',
                region: (p['region'] as string) || 'us-central1',
                deletion_protection: p['deletion_protection'] !== false,
            } as any,
            nestedBlocks: [{ type: 'settings', attributes: { tier: (p['tier'] as string) || 'db-f1-micro', availability_type: (p['availability_type'] as string) || 'ZONAL' } as any }],
        }];
    }

    suggestEdges(_node: InfraNode, _graph: InfraGraph) { return []; }
}

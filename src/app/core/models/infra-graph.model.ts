export type ResourceKind =
    | 'google_compute_network'
    | 'google_compute_subnetwork'
    | 'google_compute_instance'
    | 'google_compute_firewall'
    | 'google_storage_bucket'
    | 'google_container_cluster'
    | 'google_sql_database_instance'
    | 'google_compute_address'
    | 'google_cloud_run_v2_service'
    | 'google_pubsub_topic'
    | 'google_service_account'
    | 'google_dns_managed_zone';

export type ResourceCategory = 'Network' | 'Compute' | 'Storage' | 'Kubernetes' | 'Database' | 'Serverless' | 'Security' | 'Messaging';

export interface InfraNode {
    id: string;
    kind: ResourceKind;
    name: string;
    properties: Record<string, unknown>;
    tags?: string[];
    version: number;
    position: { x: number; y: number };
}

export type EdgeRelationship = 'depends_on' | 'network_attachment' | 'contains';

export interface InfraEdge {
    id: string;
    from: string;
    to: string;
    relationship: EdgeRelationship;
}

export interface InfraGraph {
    nodes: InfraNode[];
    edges: InfraEdge[];
}

export interface Diagnostic {
    severity: 'error' | 'warning' | 'info';
    code: string;
    nodeId?: string;
    field?: string;
    message: string;
    remediation?: string;
}

export interface TerraformBlock {
    blockType: 'resource' | 'variable' | 'output' | 'provider' | 'terraform';
    resourceType?: string;
    name: string;
    attributes: Record<string, TerraformValue>;
    nestedBlocks?: TerraformNestedBlock[];
}

export type TerraformValue =
    | string
    | number
    | boolean
    | string[]
    | TerraformReference;

export interface TerraformReference {
    ref: string;
}

export interface TerraformNestedBlock {
    type: string;
    attributes: Record<string, TerraformValue>;
}

export interface GeneratedFile {
    filename: string;
    content: string;
}

export interface ProjectData {
    schemaVersion: number;
    graph: InfraGraph;
    metadata: ProjectMetadata;
}

export interface ProjectMetadata {
    name: string;
    createdAt: string;
    updatedAt: string;
    terraformVersion: string;
    providerVersion: string;
}

export const RESOURCE_CATEGORIES: Record<ResourceCategory, ResourceKind[]> = {
    Network: ['google_compute_network', 'google_compute_subnetwork', 'google_compute_firewall', 'google_compute_address'],
    Compute: ['google_compute_instance'],
    Storage: ['google_storage_bucket'],
    Kubernetes: ['google_container_cluster'],
    Database: ['google_sql_database_instance'],
    Serverless: ['google_cloud_run_v2_service'],
    Security: ['google_service_account'],
    Messaging: ['google_pubsub_topic'],
};

export const RESOURCE_ICONS: Record<ResourceKind, string> = {
    google_compute_network: '🌐',
    google_compute_subnetwork: '🔗',
    google_compute_instance: '🖥️',
    google_compute_firewall: '🛡️',
    google_storage_bucket: '🪣',
    google_container_cluster: '☸️',
    google_sql_database_instance: '🗃️',
    google_compute_address: '📍',
    google_cloud_run_v2_service: '⚡',
    google_pubsub_topic: '📨',
    google_service_account: '🔑',
    google_dns_managed_zone: '🌍',
};

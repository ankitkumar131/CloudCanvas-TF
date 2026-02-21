import {
    InfraNode,
    InfraGraph,
    InfraEdge,
    Diagnostic,
    TerraformBlock,
    ResourceKind,
    ResourceCategory,
} from './infra-graph.model';

export interface JsonSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'select';
    label: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    options?: string[];
    placeholder?: string;
    group?: string;
}

export interface JsonSchema {
    properties: Record<string, JsonSchemaProperty>;
}

export interface EdgeSuggestion {
    targetKind: ResourceKind;
    relationship: InfraEdge['relationship'];
    label: string;
}

export interface ValidationContext {
    graph: InfraGraph;
    allNodes: InfraNode[];
}

export interface GeneratorContext {
    graph: InfraGraph;
    nodeMap: Map<string, InfraNode>;
    getNodeReference(nodeId: string, attribute: string): string;
}

export interface ResourcePlugin {
    kind: ResourceKind;
    category: ResourceCategory;
    displayName: string;
    description: string;
    icon: string;
    schema: JsonSchema;
    defaults(): Record<string, unknown>;
    validate(node: InfraNode, ctx: ValidationContext): Diagnostic[];
    toTerraform(node: InfraNode, ctx: GeneratorContext): TerraformBlock[];
    suggestEdges?(node: InfraNode, graph: InfraGraph): EdgeSuggestion[];
}

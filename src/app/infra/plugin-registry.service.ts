import { Injectable } from '@angular/core';
import { ResourcePlugin } from '../core/models/resource-plugin.model';
import { ResourceKind } from '../core/models/infra-graph.model';
import { ComputeNetworkPlugin } from './plugins/compute-network.plugin';
import { ComputeSubnetworkPlugin } from './plugins/compute-subnetwork.plugin';
import { ComputeInstancePlugin } from './plugins/compute-instance.plugin';
import { ComputeFirewallPlugin } from './plugins/compute-firewall.plugin';
import { ComputeAddressPlugin } from './plugins/compute-address.plugin';
import { StorageBucketPlugin } from './plugins/storage-bucket.plugin';
import { ContainerClusterPlugin } from './plugins/container-cluster.plugin';
import { SqlDatabaseInstancePlugin } from './plugins/sql-database-instance.plugin';
import { CloudRunServicePlugin } from './plugins/cloud-run-service.plugin';
import { PubsubTopicPlugin } from './plugins/pubsub-topic.plugin';
import { ServiceAccountPlugin } from './plugins/service-account.plugin';
import { DnsManagedZonePlugin } from './plugins/dns-managed-zone.plugin';

@Injectable({ providedIn: 'root' })
export class PluginRegistryService {
    private readonly plugins = new Map<ResourceKind, ResourcePlugin>();

    constructor() {
        // Network
        this.register(new ComputeNetworkPlugin());
        this.register(new ComputeSubnetworkPlugin());
        this.register(new ComputeFirewallPlugin());
        this.register(new ComputeAddressPlugin());
        this.register(new DnsManagedZonePlugin());
        // Compute
        this.register(new ComputeInstancePlugin());
        // Storage
        this.register(new StorageBucketPlugin());
        // Kubernetes
        this.register(new ContainerClusterPlugin());
        // Database
        this.register(new SqlDatabaseInstancePlugin());
        // Serverless
        this.register(new CloudRunServicePlugin());
        // Security
        this.register(new ServiceAccountPlugin());
        // Messaging
        this.register(new PubsubTopicPlugin());
    }

    private register(plugin: ResourcePlugin): void {
        this.plugins.set(plugin.kind, plugin);
    }

    getPlugin(kind: ResourceKind): ResourcePlugin | undefined {
        return this.plugins.get(kind);
    }

    getAllPlugins(): ResourcePlugin[] {
        return Array.from(this.plugins.values());
    }

    getPluginsByCategory(): Map<string, ResourcePlugin[]> {
        const order = ['Network', 'Compute', 'Storage', 'Kubernetes', 'Database', 'Serverless', 'Security', 'Messaging'];
        const grouped = new Map<string, ResourcePlugin[]>();
        // Initialize in order
        for (const cat of order) grouped.set(cat, []);
        for (const plugin of this.plugins.values()) {
            const list = grouped.get(plugin.category) ?? [];
            list.push(plugin);
            grouped.set(plugin.category, list);
        }
        // Remove empty categories
        for (const [key, val] of grouped) {
            if (val.length === 0) grouped.delete(key);
        }
        return grouped;
    }
}

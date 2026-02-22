import { Injectable } from '@angular/core';
import { ProjectData, InfraGraph, ProjectMetadata } from '../core/models/infra-graph.model';

const DB_NAME = 'cloudcanvas_tf';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

@Injectable({ providedIn: 'root' })
export class StorageService {
    private dbPromise: Promise<IDBDatabase> | null = null;

    private openDb(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'metadata.name' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.dbPromise;
    }

    async saveProject(project: ProjectData): Promise<void> {
        const db = await this.openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(project);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async loadProject(name: string): Promise<ProjectData | undefined> {
        const db = await this.openDb();
        return new Promise<ProjectData | undefined>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(name);
            request.onsuccess = () => resolve(request.result as ProjectData | undefined);
            request.onerror = () => reject(request.error);
        });
    }

    async listProjects(): Promise<ProjectData[]> {
        const db = await this.openDb();
        return new Promise<ProjectData[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(request.result as ProjectData[]);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteProject(name: string): Promise<void> {
        const db = await this.openDb();
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(name);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    buildProjectData(graph: InfraGraph, name: string): ProjectData {
        const now = new Date().toISOString();
        return {
            schemaVersion: 1,
            graph,
            metadata: {
                name,
                createdAt: now,
                updatedAt: now,
                terraformVersion: '>= 1.0',
                providerVersion: '~> 6.0',
            },
        };
    }
}

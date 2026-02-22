import { Injectable } from '@angular/core';
import { GeneratedFile, InfraGraph, ProjectData } from '../core/models/infra-graph.model';
import { TerraformGeneratorService } from '../terraform-engine/terraform-generator.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ExportService {
    constructor(
        private terraformGenerator: TerraformGeneratorService,
        private storageService: StorageService
    ) { }

    /**
     * Generate Terraform files and download as ZIP.
     * IMPORTANT: This must run synchronously from the user click
     * to preserve the user-gesture context for the download.
     */
    exportTerraformZip(graph: InfraGraph, projectName: string): void {
        try {
            const files = this.terraformGenerator.generate(graph, 'my-gcp-project', 'us-central1');
            const paths = files.map(f => ({ path: f.filename, content: f.content }));
            const zipBlob = this.createZipBlobSync(paths);
            this.triggerDownload(zipBlob, `${this.sanitizeName(projectName)}-terraform.zip`);
        } catch (e) {
            console.error('Terraform ZIP export failed:', e);
            alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
        }
    }

    exportProjectJson(graph: InfraGraph, projectName: string): void {
        try {
            const projectData = this.storageService.buildProjectData(graph, projectName);
            const json = JSON.stringify(projectData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            this.triggerDownload(blob, `${this.sanitizeName(projectName)}.json`);
        } catch (e) {
            console.error('Project JSON export failed:', e);
            alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
        }
    }

    exportFullBundle(graph: InfraGraph, projectName: string): void {
        try {
            const files = this.terraformGenerator.generate(graph, 'my-gcp-project', 'us-central1');
            const projectData = this.storageService.buildProjectData(graph, projectName);

            const allFiles: { path: string; content: string }[] = [];
            for (const f of files) {
                allFiles.push({ path: `terraform/${f.filename}`, content: f.content });
            }
            allFiles.push({ path: 'project.json', content: JSON.stringify(projectData, null, 2) });

            const zipBlob = this.createZipBlobSync(allFiles);
            this.triggerDownload(zipBlob, `${this.sanitizeName(projectName)}-bundle.zip`);
        } catch (e) {
            console.error('Bundle export failed:', e);
            alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
        }
    }

    importProjectJson(file: File): Promise<ProjectData> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result as string) as ProjectData;
                    if (!data.graph || !data.metadata) {
                        reject(new Error('Invalid project file format'));
                        return;
                    }
                    resolve(data);
                } catch {
                    reject(new Error('Failed to parse project file'));
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // ========== SYNCHRONOUS ZIP CREATION ==========

    private createZipBlobSync(files: { path: string; content: string }[]): Blob {
        const encoder = new TextEncoder();
        const centralDir: Uint8Array[] = [];
        const localFiles: Uint8Array[] = [];
        let offset = 0;

        for (const file of files) {
            const nameBytes = encoder.encode(file.path);
            const contentBytes = encoder.encode(file.content);
            const crc = this.crc32(contentBytes);
            const now = new Date();
            const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
            const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

            // Local file header (30 bytes + filename)
            const localHeader = new Uint8Array(30 + nameBytes.length);
            const lv = new DataView(localHeader.buffer);
            lv.setUint32(0, 0x04034b50, true);
            lv.setUint16(4, 20, true);
            lv.setUint16(6, 0, true);
            lv.setUint16(8, 0, true);
            lv.setUint16(10, dosTime, true);
            lv.setUint16(12, dosDate, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, contentBytes.length, true);
            lv.setUint32(22, contentBytes.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);
            localHeader.set(nameBytes, 30);

            localFiles.push(localHeader);
            localFiles.push(contentBytes);

            // Central directory entry (46 bytes + filename)
            const cdEntry = new Uint8Array(46 + nameBytes.length);
            const cv = new DataView(cdEntry.buffer);
            cv.setUint32(0, 0x02014b50, true);
            cv.setUint16(4, 20, true);
            cv.setUint16(6, 20, true);
            cv.setUint16(8, 0, true);
            cv.setUint16(10, 0, true);
            cv.setUint16(12, dosTime, true);
            cv.setUint16(14, dosDate, true);
            cv.setUint32(16, crc, true);
            cv.setUint32(20, contentBytes.length, true);
            cv.setUint32(24, contentBytes.length, true);
            cv.setUint16(28, nameBytes.length, true);
            cv.setUint16(30, 0, true);
            cv.setUint16(32, 0, true);
            cv.setUint16(34, 0, true);
            cv.setUint16(36, 0, true);
            cv.setUint32(38, 0, true);
            cv.setUint32(42, offset, true);
            cdEntry.set(nameBytes, 46);
            centralDir.push(cdEntry);

            offset += localHeader.length + contentBytes.length;
        }

        const centralDirSize = centralDir.reduce((s, e) => s + e.length, 0);

        // End of central directory (22 bytes)
        const eocd = new Uint8Array(22);
        const ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054b50, true);
        ev.setUint16(4, 0, true);
        ev.setUint16(6, 0, true);
        ev.setUint16(8, files.length, true);
        ev.setUint16(10, files.length, true);
        ev.setUint32(12, centralDirSize, true);
        ev.setUint32(16, offset, true);
        ev.setUint16(20, 0, true);

        // Concat all parts
        const allParts = [...localFiles, ...centralDir, eocd];
        const totalLength = allParts.reduce((s, p) => s + p.length, 0);
        const combined = new Uint8Array(totalLength);
        let pos = 0;
        for (const part of allParts) {
            combined.set(part, pos);
            pos += part.length;
        }

        return new Blob([combined.buffer], { type: 'application/zip' });
    }

    private crc32(data: Uint8Array): number {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
            }
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Trigger a file download — MUST be called synchronously from the user gesture.
     * No setTimeout, no async — just create the link, click it, clean up.
     */
    private triggerDownload(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        // Clean up after a brief delay (download already initiated)
        requestAnimationFrame(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    private sanitizeName(name: string): string {
        return name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase() || 'cloudcanvas';
    }
}

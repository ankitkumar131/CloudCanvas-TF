import { Component, inject, signal, computed, ElementRef, viewChild } from '@angular/core';
import { GraphStateService } from '../core/services/graph-state.service';
import { PluginRegistryService } from '../infra/plugin-registry.service';
import { InfraNode, RESOURCE_ICONS } from '../core/models/infra-graph.model';

@Component({
    selector: 'app-canvas',
    standalone: true,
    templateUrl: './canvas.component.html',
    styleUrl: './canvas.component.scss',
})
export class CanvasComponent {
    graphState = inject(GraphStateService);
    private registry = inject(PluginRegistryService);

    private svgRef = viewChild<ElementRef<SVGSVGElement>>('svgCanvas');

    viewBox = signal({ x: 0, y: 0, w: 1600, h: 900 });
    isPanning = signal(false);
    panStart = signal({ x: 0, y: 0 });

    // Edge drawing state
    isDrawingEdge = signal(false);
    edgeStartNodeId = signal<string | null>(null);
    edgeCursorPos = signal({ x: 0, y: 0 });

    // Drag state
    draggingNodeId = signal<string | null>(null);
    dragOffset = signal({ x: 0, y: 0 });

    // Track if we've handled interaction (prevent canvas click from deselecting)
    private nodeInteracted = false;

    nodes = computed(() => this.graphState.graph().nodes);
    edges = computed(() => this.graphState.graph().edges);

    nodeMap = computed(() => {
        const m = new Map<string, InfraNode>();
        for (const n of this.nodes()) m.set(n.id, n);
        return m;
    });

    isEmpty = computed(() => this.nodes().length === 0);

    readonly NODE_WIDTH = 200;
    readonly NODE_HEIGHT = 72;

    getIcon(node: InfraNode): string {
        return RESOURCE_ICONS[node.kind] ?? '📦';
    }

    getDisplayName(node: InfraNode): string {
        const plugin = this.registry.getPlugin(node.kind);
        return plugin?.displayName ?? node.kind;
    }

    isSelected(node: InfraNode): boolean {
        return this.graphState.selectedNodeId() === node.id;
    }

    hasError(node: InfraNode): boolean {
        return this.graphState.diagnostics().some(
            (d) => d.nodeId === node.id && d.severity === 'error'
        );
    }

    hasWarning(node: InfraNode): boolean {
        return this.graphState.diagnostics().some(
            (d) => d.nodeId === node.id && d.severity === 'warning'
        );
    }

    // ========== CANVAS BACKGROUND CLICK ==========
    onCanvasClick(_event: MouseEvent): void {
        // Skip if a node/connector/delete was just interacted with
        if (this.nodeInteracted) {
            this.nodeInteracted = false;
            return;
        }
        // Cancel edge drawing if in progress
        if (this.isDrawingEdge()) {
            this.isDrawingEdge.set(false);
            this.edgeStartNodeId.set(null);
            return;
        }
        // Deselect all
        this.graphState.selectNode(null);
    }

    onCanvasDrop(event: DragEvent): void {
        event.preventDefault();
        const kind = event.dataTransfer?.getData('application/cloudcanvas-kind');
        if (!kind) return;
        const plugin = this.registry.getPlugin(kind as import('../core/models/infra-graph.model').ResourceKind);
        if (!plugin) return;
        const pt = this.screenToSvg(event.clientX, event.clientY);
        const id = this.graphState.addNode(plugin.kind, pt, plugin.defaults());
        this.graphState.selectNode(id);
    }

    onCanvasDragOver(event: DragEvent): void {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }

    // ========== NODE CLICK (select or complete edge) ==========
    onNodeClick(event: MouseEvent, node: InfraNode): void {
        event.stopPropagation();
        this.nodeInteracted = true;

        // If drawing an edge, complete it
        if (this.isDrawingEdge() && this.edgeStartNodeId()) {
            const from = this.edgeStartNodeId()!;
            if (from !== node.id) {
                this.graphState.addEdge(from, node.id, 'depends_on');
            }
            this.isDrawingEdge.set(false);
            this.edgeStartNodeId.set(null);
            this.graphState.selectNode(node.id);
            return;
        }

        // Normal select
        this.graphState.selectNode(node.id);
    }

    // ========== NODE DRAG (mousedown) ==========
    onNodeMouseDown(event: MouseEvent, node: InfraNode): void {
        // Don't start drag if drawing an edge
        if (this.isDrawingEdge()) return;
        // Don't start drag on right-click
        if (event.button !== 0) return;

        event.preventDefault();
        this.graphState.selectNode(node.id);
        this.draggingNodeId.set(node.id);
        const pt = this.screenToSvg(event.clientX, event.clientY);
        this.dragOffset.set({ x: pt.x - node.position.x, y: pt.y - node.position.y });

        const onMove = (e: MouseEvent): void => {
            const mvPt = this.screenToSvg(e.clientX, e.clientY);
            this.graphState.updateNodePosition(node.id, {
                x: mvPt.x - this.dragOffset().x,
                y: mvPt.y - this.dragOffset().y,
            });
        };
        const onUp = (): void => {
            this.draggingNodeId.set(null);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }

    deleteNode(event: MouseEvent, nodeId: string): void {
        event.stopPropagation();
        event.preventDefault();
        this.nodeInteracted = true;
        this.graphState.removeNode(nodeId);
    }

    // ========== EDGE DRAWING ==========
    startEdge(event: MouseEvent, nodeId: string): void {
        event.stopPropagation();
        event.preventDefault();
        this.nodeInteracted = true;
        this.isDrawingEdge.set(true);
        this.edgeStartNodeId.set(nodeId);
        const node = this.nodeMap().get(nodeId);
        if (node) {
            this.edgeCursorPos.set({
                x: node.position.x + this.NODE_WIDTH / 2,
                y: node.position.y + this.NODE_HEIGHT,
            });
        }
    }

    onCanvasMouseMove(event: MouseEvent): void {
        if (this.isDrawingEdge()) {
            this.edgeCursorPos.set(this.screenToSvg(event.clientX, event.clientY));
        }
        if (this.isPanning()) {
            const dx = event.clientX - this.panStart().x;
            const dy = event.clientY - this.panStart().y;
            this.panStart.set({ x: event.clientX, y: event.clientY });
            this.viewBox.update((vb) => ({
                ...vb,
                x: vb.x - dx * (vb.w / this.getContainerWidth()),
                y: vb.y - dy * (vb.h / this.getContainerHeight()),
            }));
        }
    }

    // ========== PAN & ZOOM ==========
    onPanStart(event: MouseEvent): void {
        if (event.button === 1 || (event.button === 0 && event.ctrlKey)) {
            this.isPanning.set(true);
            this.panStart.set({ x: event.clientX, y: event.clientY });
            event.preventDefault();
        }
    }

    onPanEnd(): void {
        this.isPanning.set(false);
    }

    onWheel(event: WheelEvent): void {
        event.preventDefault();
        const scale = event.deltaY > 0 ? 1.1 : 0.9;
        const pt = this.screenToSvg(event.clientX, event.clientY);
        this.viewBox.update((vb) => ({
            x: pt.x - (pt.x - vb.x) * scale,
            y: pt.y - (pt.y - vb.y) * scale,
            w: vb.w * scale,
            h: vb.h * scale,
        }));
    }

    // ========== EDGE RENDERING ==========
    getEdgePath(fromId: string, toId: string): string {
        const from = this.nodeMap().get(fromId);
        const to = this.nodeMap().get(toId);
        if (!from || !to) return '';
        const x1 = from.position.x + this.NODE_WIDTH / 2;
        const y1 = from.position.y + this.NODE_HEIGHT;
        const x2 = to.position.x + this.NODE_WIDTH / 2;
        const y2 = to.position.y;
        const dy = Math.abs(y2 - y1);
        const controlOffset = Math.max(dy * 0.4, 50);
        return `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${x2} ${y2 - controlOffset}, ${x2} ${y2}`;
    }

    getDrawingEdgePath(): string {
        const fromNode = this.nodeMap().get(this.edgeStartNodeId()!);
        if (!fromNode) return '';
        const x1 = fromNode.position.x + this.NODE_WIDTH / 2;
        const y1 = fromNode.position.y + this.NODE_HEIGHT;
        const cursor = this.edgeCursorPos();
        const dy = Math.abs(cursor.y - y1);
        const controlOffset = Math.max(dy * 0.4, 50);
        return `M ${x1} ${y1} C ${x1} ${y1 + controlOffset}, ${cursor.x} ${cursor.y - controlOffset}, ${cursor.x} ${cursor.y}`;
    }

    removeEdge(event: MouseEvent, edgeId: string): void {
        event.stopPropagation();
        this.nodeInteracted = true;
        this.graphState.removeEdge(edgeId);
    }

    getEdgeMidpoint(fromId: string, toId: string): { x: number; y: number } {
        const from = this.nodeMap().get(fromId);
        const to = this.nodeMap().get(toId);
        if (!from || !to) return { x: 0, y: 0 };
        const x1 = from.position.x + this.NODE_WIDTH / 2;
        const y1 = from.position.y + this.NODE_HEIGHT;
        const x2 = to.position.x + this.NODE_WIDTH / 2;
        const y2 = to.position.y;
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    }

    viewBoxStr = computed(() => {
        const vb = this.viewBox();
        return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
    });

    private screenToSvg(clientX: number, clientY: number): { x: number; y: number } {
        const svg = this.svgRef()?.nativeElement;
        if (!svg) return { x: clientX, y: clientY };
        const rect = svg.getBoundingClientRect();
        const vb = this.viewBox();
        return {
            x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
            y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
        };
    }

    private getContainerWidth(): number {
        return this.svgRef()?.nativeElement.clientWidth ?? 800;
    }

    private getContainerHeight(): number {
        return this.svgRef()?.nativeElement.clientHeight ?? 600;
    }
}

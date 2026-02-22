import { Component, inject, signal, computed, ElementRef, viewChild, DestroyRef, HostListener } from '@angular/core';
import { GraphStateService } from '../core/services/graph-state.service';
import { PluginRegistryService } from '../infra/plugin-registry.service';
import { InfraNode, RESOURCE_ICONS, EdgeRelationship } from '../core/models/infra-graph.model';

@Component({
    selector: 'app-canvas',
    standalone: true,
    templateUrl: './canvas.component.html',
    styleUrl: './canvas.component.scss',
})
export class CanvasComponent {
    graphState = inject(GraphStateService);
    private registry = inject(PluginRegistryService);
    private destroyRef = inject(DestroyRef);

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
    
    // Multi-drag state - tracks initial positions of all dragged nodes
    private multiDragStartPositions = new Map<string, { x: number; y: number }>();

    // Track active event listeners for cleanup
    private activeMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    private activeMouseUpHandler: (() => void) | null = null;

    nodes = computed(() => this.graphState.graph().nodes);
    edges = computed(() => this.graphState.graph().edges);

    nodeMap = computed(() => {
        const m = new Map<string, InfraNode>();
        for (const n of this.nodes()) m.set(n.id, n);
        return m;
    });

    isEmpty = computed(() => this.nodes().length === 0);
    
    // Zoom percentage for display
    zoomPercent = computed(() => {
        const baseWidth = 1600;
        return Math.round((baseWidth / this.viewBox().w) * 100);
    });

    readonly NODE_WIDTH = 200;
    readonly NODE_HEIGHT = 72;

    constructor() {
        // Cleanup event listeners on destroy
        this.destroyRef.onDestroy(() => {
            this.cleanupDragListeners();
        });
    }

    private cleanupDragListeners(): void {
        if (this.activeMouseMoveHandler) {
            window.removeEventListener('mousemove', this.activeMouseMoveHandler);
            this.activeMouseMoveHandler = null;
        }
        if (this.activeMouseUpHandler) {
            window.removeEventListener('mouseup', this.activeMouseUpHandler);
            this.activeMouseUpHandler = null;
        }
    }

    // Keyboard shortcuts
    @HostListener('document:keydown', ['$event'])
    onKeydown(event: KeyboardEvent): void {
        // Delete selected nodes (supports multi-select)
        if (event.key === 'Delete' || event.key === 'Backspace') {
            const selectedIds = this.graphState.selectedNodeIds();
            if (selectedIds.size > 0 && !this.isInputFocused()) {
                event.preventDefault();
                this.graphState.removeNodes([...selectedIds]);
            }
        }
        
        // Escape to cancel edge drawing or deselect
        if (event.key === 'Escape') {
            if (this.isDrawingEdge()) {
                this.isDrawingEdge.set(false);
                this.edgeStartNodeId.set(null);
            } else {
                this.graphState.clearSelection();
            }
        }

        // Ctrl+A to select all nodes
        if ((event.ctrlKey || event.metaKey) && event.key === 'a' && !this.isInputFocused()) {
            event.preventDefault();
            const nodes = this.nodes();
            if (nodes.length > 0) {
                this.graphState.selectMultipleNodes(nodes.map(n => n.id));
            }
        }

        // Ctrl+C to copy selected nodes
        if ((event.ctrlKey || event.metaKey) && event.key === 'c' && !this.isInputFocused()) {
            event.preventDefault();
            this.graphState.copySelectedNodes();
        }

        // Ctrl+V to paste nodes
        if ((event.ctrlKey || event.metaKey) && event.key === 'v' && !this.isInputFocused()) {
            event.preventDefault();
            this.graphState.pasteNodes();
        }

        // Ctrl+D to duplicate selected nodes
        if ((event.ctrlKey || event.metaKey) && event.key === 'd' && !this.isInputFocused()) {
            event.preventDefault();
            this.graphState.copySelectedNodes();
            this.graphState.pasteNodes();
        }

        // Arrow keys to nudge selected nodes
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            const selectedIds = this.graphState.selectedNodeIds();
            if (selectedIds.size > 0 && !this.isInputFocused()) {
                event.preventDefault();
                const step = event.shiftKey ? 20 : 5;
                let dx = 0, dy = 0;
                if (event.key === 'ArrowUp') dy = -step;
                if (event.key === 'ArrowDown') dy = step;
                if (event.key === 'ArrowLeft') dx = -step;
                if (event.key === 'ArrowRight') dx = step;
                
                const updates = [...selectedIds].map(nodeId => {
                    const node = this.nodeMap().get(nodeId);
                    return node ? {
                        nodeId,
                        position: { x: node.position.x + dx, y: node.position.y + dy }
                    } : null;
                }).filter((u): u is NonNullable<typeof u> => u !== null);
                
                if (updates.length > 0) {
                    this.graphState.updateMultipleNodePositions(updates);
                }
            }
        }
    }

    private isInputFocused(): boolean {
        const active = document.activeElement;
        return active instanceof HTMLInputElement || 
               active instanceof HTMLTextAreaElement || 
               active instanceof HTMLSelectElement;
    }

    getIcon(node: InfraNode): string {
        return RESOURCE_ICONS[node.kind] ?? '📦';
    }

    getDisplayName(node: InfraNode): string {
        const plugin = this.registry.getPlugin(node.kind);
        return plugin?.displayName ?? node.kind;
    }

    isSelected(node: InfraNode): boolean {
        return this.graphState.selectedNodeIds().has(node.id);
    }

    isMultiSelected(): boolean {
        return this.graphState.selectedNodeIds().size > 1;
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

        // If drawing an edge, complete it with proper relationship and validation
        if (this.isDrawingEdge() && this.edgeStartNodeId()) {
            const from = this.edgeStartNodeId()!;
            if (from !== node.id) {
                // Validate connection before creating
                const validationResult = this.validateEdgeConnection(from, node.id);
                if (validationResult.valid) {
                    this.graphState.addEdge(from, node.id, validationResult.relationship);
                }
                // If invalid, just cancel without creating edge
            }
            this.isDrawingEdge.set(false);
            this.edgeStartNodeId.set(null);
            this.graphState.selectNode(node.id);
            return;
        }

        // Multi-select with Shift or Ctrl/Cmd
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            this.graphState.toggleNodeSelection(node.id, true);
        } else {
            // Normal select (clears multi-selection)
            this.graphState.selectNode(node.id);
        }
    }

    // ========== NODE DRAG (mousedown) ==========
    onNodeMouseDown(event: MouseEvent, node: InfraNode): void {
        // Don't start drag if drawing an edge
        if (this.isDrawingEdge()) return;
        // Don't start drag on right-click
        if (event.button !== 0) return;

        event.preventDefault();
        
        // Handle selection logic
        const selectedIds = this.graphState.selectedNodeIds();
        const isAlreadySelected = selectedIds.has(node.id);
        
        // If clicking on unselected node without modifier, select only it
        if (!isAlreadySelected && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
            this.graphState.selectNode(node.id);
        } else if (!isAlreadySelected) {
            // Add to selection with modifier
            this.graphState.toggleNodeSelection(node.id, true);
        }
        // If already selected, keep current selection (for multi-drag)

        this.draggingNodeId.set(node.id);
        const pt = this.screenToSvg(event.clientX, event.clientY);
        this.dragOffset.set({ x: pt.x - node.position.x, y: pt.y - node.position.y });

        // Store initial positions of all selected nodes for multi-drag
        this.multiDragStartPositions.clear();
        const currentSelectedIds = this.graphState.selectedNodeIds();
        for (const nodeId of currentSelectedIds) {
            const n = this.nodeMap().get(nodeId);
            if (n) {
                this.multiDragStartPositions.set(nodeId, { ...n.position });
            }
        }

        // Clean up any existing listeners first
        this.cleanupDragListeners();

        const onMove = (e: MouseEvent): void => {
            const mvPt = this.screenToSvg(e.clientX, e.clientY);
            const currentSelectedIds = this.graphState.selectedNodeIds();
            
            // Calculate delta from dragged node's starting position
            const startPos = this.multiDragStartPositions.get(node.id);
            if (!startPos) return;
            
            const dx = mvPt.x - this.dragOffset().x - startPos.x;
            const dy = mvPt.y - this.dragOffset().y - startPos.y;
            
            // Update all selected nodes
            if (currentSelectedIds.size > 1) {
                const updates = [...currentSelectedIds].map(nodeId => {
                    const originalPos = this.multiDragStartPositions.get(nodeId);
                    if (!originalPos) return null;
                    return {
                        nodeId,
                        position: {
                            x: originalPos.x + dx,
                            y: originalPos.y + dy,
                        },
                    };
                }).filter((u): u is NonNullable<typeof u> => u !== null);
                
                this.graphState.updateMultipleNodePositions(updates);
            } else {
                // Single node drag
                this.graphState.updateNodePosition(node.id, {
                    x: mvPt.x - this.dragOffset().x,
                    y: mvPt.y - this.dragOffset().y,
                });
            }
        };
        const onUp = (): void => {
            this.draggingNodeId.set(null);
            this.multiDragStartPositions.clear();
            this.cleanupDragListeners();
        };

        this.activeMouseMoveHandler = onMove;
        this.activeMouseUpHandler = onUp;
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

    // ========== ZOOM CONTROLS ==========
    zoomIn(): void {
        this.viewBox.update((vb) => {
            const centerX = vb.x + vb.w / 2;
            const centerY = vb.y + vb.h / 2;
            const scale = 0.8;
            return {
                x: centerX - (vb.w * scale) / 2,
                y: centerY - (vb.h * scale) / 2,
                w: vb.w * scale,
                h: vb.h * scale,
            };
        });
    }

    zoomOut(): void {
        this.viewBox.update((vb) => {
            const centerX = vb.x + vb.w / 2;
            const centerY = vb.y + vb.h / 2;
            const scale = 1.25;
            return {
                x: centerX - (vb.w * scale) / 2,
                y: centerY - (vb.h * scale) / 2,
                w: vb.w * scale,
                h: vb.h * scale,
            };
        });
    }

    resetZoom(): void {
        this.viewBox.set({ x: 0, y: 0, w: 1600, h: 900 });
    }

    fitToView(): void {
        const nodes = this.nodes();
        if (nodes.length === 0) {
            this.resetZoom();
            return;
        }

        const padding = 100;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (const node of nodes) {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + this.NODE_WIDTH);
            maxY = Math.max(maxY, node.position.y + this.NODE_HEIGHT);
        }

        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;
        
        // Maintain aspect ratio
        const containerWidth = this.getContainerWidth();
        const containerHeight = this.getContainerHeight();
        const aspectRatio = containerWidth / containerHeight;
        
        let viewW = contentWidth;
        let viewH = contentHeight;
        
        if (viewW / viewH > aspectRatio) {
            viewH = viewW / aspectRatio;
        } else {
            viewW = viewH * aspectRatio;
        }

        this.viewBox.set({
            x: minX - padding - (viewW - contentWidth) / 2,
            y: minY - padding - (viewH - contentHeight) / 2,
            w: viewW,
            h: viewH,
        });
    }

    // Validate edge connection and get appropriate relationship
    validateEdgeConnection(fromId: string, toId: string): { valid: boolean; relationship: EdgeRelationship; reason?: string } {
        const fromNode = this.nodeMap().get(fromId);
        const toNode = this.nodeMap().get(toId);
        
        if (!fromNode || !toNode) {
            return { valid: false, relationship: 'depends_on', reason: 'Node not found' };
        }

        // Prevent self-connections
        if (fromId === toId) {
            return { valid: false, relationship: 'depends_on', reason: 'Cannot connect to self' };
        }

        // Check for existing edge
        const existingEdge = this.edges().find(e => e.from === fromId && e.to === toId);
        if (existingEdge) {
            return { valid: false, relationship: 'depends_on', reason: 'Connection already exists' };
        }

        // Check for reverse edge (circular dependency)
        const reverseEdge = this.edges().find(e => e.from === toId && e.to === fromId);
        if (reverseEdge) {
            return { valid: false, relationship: 'depends_on', reason: 'Would create circular dependency' };
        }

        // Get suggestions from source plugin for relationship type
        const fromPlugin = this.registry.getPlugin(fromNode.kind);
        if (fromPlugin?.suggestEdges) {
            const suggestions = fromPlugin.suggestEdges(fromNode, this.graphState.graph());
            const matchingSuggestion = suggestions.find(s => s.targetKind === toNode.kind);
            if (matchingSuggestion) {
                return { valid: true, relationship: matchingSuggestion.relationship };
            }
        }

        // Default to depends_on for any valid connection
        return { valid: true, relationship: 'depends_on' };
    }

    // Check if a potential target is valid during edge drawing
    isValidDropTarget(targetNodeId: string): boolean {
        const startNodeId = this.edgeStartNodeId();
        if (!startNodeId || !this.isDrawingEdge()) return false;
        
        const validation = this.validateEdgeConnection(startNodeId, targetNodeId);
        return validation.valid;
    }

    // Get valid edge relationship based on source and target nodes (deprecated, use validateEdgeConnection)
    getValidRelationship(fromId: string, toId: string): EdgeRelationship {
        const result = this.validateEdgeConnection(fromId, toId);
        return result.relationship;
    }
}

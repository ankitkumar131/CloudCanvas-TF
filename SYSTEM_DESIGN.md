# CloudCanvas-TF — Detailed Product + System Design (Angular, GCP, Terraform)

## 0) Executive Summary

CloudCanvas-TF is a **visual infrastructure design studio** for Google Cloud that outputs **clean, editable Terraform**. It is designed for developers who want Terraform outcomes without manually authoring every block from scratch.

This document answers in detail:
- **What** should be built.
- **Why** each piece is necessary.
- **How** the full system works end-to-end.
- **UI/UX behavior** and screen-by-screen interactions.
- **Final outputs/download experience** and what users receive.

---

## 1) Product Vision, Target Users, and Why This Product Exists

## 1.1 Vision
Enable anyone on a dev team to model GCP infrastructure visually and produce reproducible Terraform that advanced users can still edit and commit to Git.

## 1.2 Target Users
1. **Application developers** with basic cloud knowledge but low Terraform confidence.
2. **DevOps/platform engineers** who need rapid prototyping and team collaboration.
3. **Founders/startups** needing quick cloud architecture drafts with cost/safety guidance.

## 1.3 Core Pain Points (Why)
- Terraform has a learning curve (provider syntax, references, dependencies).
- Cloud console clicking is fast but non-reproducible and hard to review in PRs.
- Existing visual tools may lock users into black-box output.

## 1.4 Product Outcomes
- Faster first working architecture draft.
- Higher IaC adoption among non-specialists.
- Better security/cost posture via built-in warnings.
- Team-friendly deliverables (.tf + project JSON + diagrams).

---

## 2) Scope: What We Build in MVP vs Later

## 2.1 MVP Scope (Must Build)
### Resource coverage
- `google_compute_network`
- `google_compute_subnetwork`
- `google_compute_instance`
- `google_storage_bucket`
- `google_container_cluster` (basic)

### Core capabilities
- Drag/drop resources onto a canvas.
- Connect resources and infer dependency links.
- Edit resource properties in a schema-driven form panel.
- Real-time validation (field errors + architecture warnings).
- Real-time Terraform preview.
- Export/download Terraform files and project package.
- Local project save/load.

## 2.2 Deferred (Post-MVP)
- Full Terraform language parity (`for_each`, dynamic blocks everywhere).
- Multi-cloud providers.
- In-browser `terraform apply` with state backends.
- Team RBAC and real-time multi-user editing.

**Why this scope split?** It keeps delivery realistic while still giving meaningful value quickly.

---

## 3) Functional Requirements — What and Why (Feature-by-Feature)

## 3.1 Canvas Builder
### What
A central visual graph area where users add resources and connect relationships.

### Why
Visual composition lowers cognitive load compared to raw HCL for beginners and accelerates architecture thinking.

### Acceptance checks
- Users can add nodes from palette to canvas.
- Users can pan/zoom, select, move, and delete nodes.
- Users can connect valid edges.

## 3.2 Resource Palette
### What
Searchable list/grouped catalog of available resource types.

### Why
Quick discovery and insertion speed are essential for usability and prototype velocity.

### Acceptance checks
- Group by categories (Network, Compute, Storage, Kubernetes).
- Fuzzy search by resource name.

## 3.3 Property Inspector (Dynamic Form)
### What
Right-side panel displaying fields for selected node from resource schema.

### Why
Schema-driven forms make resource support extensible and consistent.

### Acceptance checks
- Required fields show immediate validation.
- Field descriptions and sensible defaults appear.
- Invalid values show clear remediation text.

## 3.4 Real-Time Terraform Code Preview
### What
Bottom code panel rendering generated Terraform files with syntax highlighting.

### Why
Users need transparency and trust in generated output; experts need direct readability.

### Acceptance checks
- Update on every graph/form change.
- Deterministic ordering to avoid noisy diffs.
- Copy-to-clipboard and download actions.

## 3.5 Validation + Advisor Engine
### What
Diagnostic engine with schema checks, graph checks, and policy advisories.

### Why
Prevent invalid infrastructure and surface risky patterns early.

### Acceptance checks
- Errors block export if structurally invalid.
- Warnings show security/cost advice (non-blocking by default).
- Diagnostics link back to affected node.

## 3.6 Save/Load + Export/Download
### What
Local persistence and file packaging.

### Why
Users must keep work between sessions and hand off Terraform outputs to CI/CD.

### Acceptance checks
- Auto-save project snapshot locally.
- Export ZIP with expected file structure.
- Import prior project JSON with migration handling.

---

## 4) Non-Functional Requirements (NFRs)

## 4.1 Performance
- 200–500 nodes should remain interactive on a typical developer laptop.
- Heavy operations (sort/validate/generate) must run in Web Worker.

## 4.2 Reliability
- Auto-save every few seconds (debounced).
- Recovery prompt on unexpected browser reload.

## 4.3 Security
- Default mode stores no cloud credentials.
- XSS-safe rendering for markdown/code descriptions.

## 4.4 Maintainability
- Plugin contract per resource type.
- Strict TypeScript + unit-tested generator modules.

## 4.5 Determinism
- Same input graph always yields same output files/ordering.

---

## 5) End-to-End User Workflow (How Everything Works)

## 5.1 Flow A — New Project to Download
1. User clicks **New Project**.
2. App initializes empty graph + metadata.
3. User drags `VPC`, `Subnet`, `VM` onto canvas.
4. User connects subnet to VPC, VM to subnet.
5. Inspector shows selected node fields; user edits values.
6. Validation engine runs (schema + graph + policy).
7. Terraform panel updates with generated code.
8. User resolves critical errors.
9. User clicks **Export**.
10. App packages files into ZIP and downloads.

## 5.2 Flow B — Return Later
1. User opens app.
2. Recent local projects list appears.
3. User opens saved project from IndexedDB.
4. Graph and code regenerate from canonical state.

## 5.3 Flow C — Import Existing Project JSON
1. User clicks **Import Project**.
2. App parses schema version.
3. Migration adapter upgrades old shape if needed.
4. Graph loads and diagnostics recalculate.

---

## 6) UI/UX Design Specification

## 6.1 Primary Layout
```text
+-----------------------------------------------------------------------+
| Top Bar: Project Name | Save State | Validate | Export | Settings     |
+----------------------+--------------------------------+---------------+
| Resource Palette     | Canvas (zoom/pan graph)        | Inspector     |
| - Search             |                                | - Fields      |
| - Categories         |                                | - Validation  |
+----------------------+--------------------------------+---------------+
| Diagnostics panel (errors/warnings/info) | Code Preview (tabs by file) |
+-----------------------------------------------------------------------+
```

## 6.2 UX Principles
- **Progressive disclosure**: show basics first; advanced options collapsed.
- **Immediate feedback**: validation and code updates in near real-time.
- **Traceability**: selecting a diagnostic highlights the target node/field.
- **Low surprise**: consistent actions and reversible edits (undo/redo later phase).

## 6.3 Interaction Details
- Clicking a node selects it and opens inspector.
- Double-click node title to rename logical label.
- Invalid fields show inline error under control.
- Hovering edge shows relationship type and inferred Terraform reference.

## 6.4 Accessibility
- Keyboard navigation for palette and inspector controls.
- WCAG-aware contrast and focus outlines.
- ARIA labels for icon-only buttons.

## 6.5 Empty and Error States
- Empty canvas illustration + “Add your first resource”.
- Worker failure fallback: show “generation failed” with retry.
- Import parse errors with line-level reason if possible.

---

## 7) Technical Architecture (Detailed)

## 7.1 Frontend Technology Stack
- Angular 21 (standalone-first, signals-based architecture).
- TypeScript strict mode.
- Angular Signals for app state.
- RxJS for async pipelines/worker orchestration.
- Angular CDK for DnD primitives.
- Monaco editor for code preview.
- Dexie.js for IndexedDB persistence.
- Web Workers for CPU-intensive operations.

## 7.2 Angular Module Boundaries
```text
src/app/
  core/                 # app bootstrap, config, global services
  shared/               # reusable UI atoms, pipes, utility helpers
  layout/               # shell and panel containers
  palette/              # resource list/search
  canvas/               # graph surface, node widgets, edge widgets
  inspector/            # schema-driven form rendering
  infra/                # resource schemas + plugin implementations
  graph-engine/         # graph model ops and dependency analysis
  terraform-engine/     # AST model + serializer
  validation/           # validators and policy checks
  storage/              # indexeddb repo + import/export
  code-preview/         # monaco integration, file tabs
  diagnostics/          # issue list and navigation hooks
  workers/              # worker bridges and message contracts
```

## 7.3 Source-of-Truth Data Model
```ts
export type ResourceKind =
  | 'google_compute_network'
  | 'google_compute_subnetwork'
  | 'google_compute_instance'
  | 'google_storage_bucket'
  | 'google_container_cluster';

export interface InfraNode {
  id: string;
  kind: ResourceKind;
  name: string;
  properties: Record<string, unknown>;
  tags?: string[];
  version: number;
}

export interface InfraEdge {
  id: string;
  from: string;
  to: string;
  relationship: 'depends_on' | 'network_attachment' | 'contains';
}

export interface InfraGraph {
  nodes: InfraNode[];
  edges: InfraEdge[];
}
```

**Why this model?**
- Simple enough for UI speed.
- Explicit enough for deterministic generation.
- Extensible for future edge semantics.

## 7.4 Resource Plugin Contract
```ts
export interface ResourcePlugin {
  kind: ResourceKind;
  displayName: string;
  schema: JsonSchema;
  defaults(): Record<string, unknown>;
  validate(node: InfraNode, ctx: ValidationContext): ValidationMessage[];
  toTerraform(node: InfraNode, ctx: GeneratorContext): TerraformBlock[];
  suggestEdges?(node: InfraNode, graph: InfraGraph): EdgeSuggestion[];
}
```

**Why plugin architecture?**
- Isolates complexity per resource.
- Supports incremental rollout.
- Avoids giant brittle central switch blocks.

---

## 8) State Management and Data Flow

## 8.1 Signals
Primary writable signals:
- `graphSignal`
- `selectedNodeIdSignal`
- `diagnosticsSignal`
- `generatedFilesSignal`
- `uiPreferencesSignal`

Computed signals:
- `selectedNodeSignal`
- `hasBlockingErrorsSignal`
- `terraformTextByFileSignal`

## 8.2 Effects
- Graph change -> debounce -> worker validate/generate.
- Graph change -> debounce -> persist snapshot.
- Selection change -> inspector form rebuild.

## 8.3 Event Flow Example
`Form control change` -> `updateNodeProperties` -> `graphSignal.set(...)` -> `worker job` -> `diagnosticsSignal` + `generatedFilesSignal` update -> UI rerender.

---

## 9) Graph Engine (Dependency Intelligence)

## 9.1 Responsibilities
- Build adjacency map.
- Ensure referenced node IDs exist.
- Detect cycles.
- Produce stable topological order.

## 9.2 Algorithms
- Cycle detection: DFS (white/gray/black sets).
- Topological sort: Kahn’s algorithm.
- Tie-break: lexical by node ID to ensure deterministic order.

## 9.3 Why it matters
Terraform resources must appear in predictable dependency-aware ordering for readability and stable code reviews.

---

## 10) Terraform Generation Engine

## 10.1 Generation Pipeline
1. Read canonical graph.
2. Normalize links into explicit dependency references.
3. Invoke resource plugins to build Terraform AST blocks.
4. Assemble file groups (`providers.tf`, `main.tf`, `variables.tf`, `outputs.tf`).
5. Stringify with canonical formatting.

## 10.2 Why AST-first (not string templates)
- Reduces quoting/escaping bugs.
- Enforces canonical field ordering.
- Easier future transforms and linting.

## 10.3 Output Conventions
- Provider block pinned in `providers.tf`.
- Resource blocks in deterministic order in `main.tf`.
- Reused or user-set inputs promoted to `variables.tf` (configurable policy).

---

## 11) Validation and Policy Engine

## 11.1 Validation Layers
1. **Schema validation** (required/type/enums).
2. **Graph semantic validation** (invalid connections, region mismatch, missing dependency).
3. **Policy advisories** (security/cost best-practice warnings).

## 11.2 Diagnostic Shape
```ts
interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  nodeId?: string;
  message: string;
  remediation?: string;
}
```

## 11.3 Example policies
- Compute instance with public IP + no restrictive firewall => warning.
- Storage bucket public ACL => warning.
- GKE node count and machine type cost heuristic => info/warning.

---

## 12) Storage, Versioning, and Downloads (End Results)

## 12.1 Local Save Strategy
- IndexedDB with Dexie schema versioning.
- Auto-save every N seconds (debounced).
- Manual named snapshots (optional MVP+).

## 12.2 Project File (`project.json`)
Contains:
- app schema version
- graph data
- metadata (timestamps, preferred Terraform/provider versions)

## 12.3 Download / Export UX
### Export button options
1. **Terraform ZIP** (default)
2. **Project JSON**
3. **Terraform + Project Bundle**

### Terraform ZIP contents
```text
cloudcanvas-project/
  providers.tf
  main.tf
  variables.tf
  outputs.tf
  README.generated.md
```

### Full bundle contents
```text
cloudcanvas-project-bundle/
  terraform/
    providers.tf
    main.tf
    variables.tf
    outputs.tf
  project.json
  architecture-diagram.json
  diagnostics-report.json
```

## 12.4 Why these outputs
- Terraform files go directly into Git/CI.
- Project JSON enables round-trip editing in app.
- Diagnostics report helps reviews and audits.

---

## 13) Error Handling and Recovery

- Worker timeouts: retry once, then show actionable fallback.
- Corrupted local project: safe-open with partial recovery mode.
- Import mismatches: migration attempt + preview before overwrite.
- Export failures: notify user and provide plain-text file fallback.

---

## 14) Security and Compliance Considerations

- No secret material embedded into generated Terraform by default.
- Inputs flagged when they resemble credentials.
- Sanitize user-entered labels before rendering in HTML contexts.
- CSP headers for deployed web app.
- Dependency vulnerability scanning in CI.

---

## 15) Observability and Quality Plan

## 15.1 Client telemetry (opt-in)
- Generation duration.
- Validation duration.
- Canvas node count and FPS sampling.

## 15.2 Testing layers
- Unit tests per plugin generator/validator.
- Graph-engine algorithm tests (cycles/order determinism).
- Snapshot tests for generated Terraform outputs.
- E2E flows for create/edit/export/import.

---

## 16) Delivery Roadmap (8 Weeks)

## Phase 1 (Weeks 1–2)
- App shell, canvas primitives, domain model.
- Plugin registry foundation.

## Phase 2 (Weeks 3–4)
- Inspector dynamic forms from schemas.
- Graph engine with deterministic topo sort.

## Phase 3 (Weeks 5–6)
- Terraform AST generation and Monaco preview.
- Validation engine (schema + graph + basic policy).

## Phase 4 (Weeks 7–8)
- IndexedDB persistence + import/export downloads.
- UX polish, accessibility pass, doc hardening.

---

## 17) Risks and Mitigations

1. **Terraform complexity creep**
   - Mitigation: strict MVP boundary + plugin roadmap.
2. **Output trust issues**
   - Mitigation: readable code preview + deterministic generation + docs.
3. **Performance degradation on large graphs**
   - Mitigation: Web Workers + viewport culling + profiling budget.
4. **Fast-changing GCP resources**
   - Mitigation: schema versioning + regular plugin update cadence.

---

## 18) Definition of Done (MVP)

A release is MVP-complete when all are true:
- User can design an architecture with the five MVP resources.
- Form validation and graph validation are functional.
- Deterministic Terraform files are generated and downloadable.
- Local save/load works across browser sessions.
- Basic accessibility and error states are implemented.
- Documentation includes setup + user flow + export instructions.

---

## 19) Final Recommendation

The best design for this project is a **schema-driven, plugin-based Angular SPA** centered on a canonical **InfraGraph DAG**, with **worker-offloaded validation and Terraform AST generation**, plus a robust **download/export workflow** that produces practical handoff artifacts.

This balances:
- beginner-friendly UX,
- expert-acceptable output quality,
- maintainable architecture,
- and realistic MVP delivery.

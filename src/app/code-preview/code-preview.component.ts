import { Component, inject, computed, signal, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { GraphStateService } from '../core/services/graph-state.service';

@Pipe({ name: 'hclHighlight', standalone: true })
export class HclHighlightPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) { }

    transform(content: string): SafeHtml {
        if (!content) return '';
        const lines = content.split('\n');
        const highlighted = lines.map((line) => this.highlightLine(line)).join('\n');
        return this.sanitizer.bypassSecurityTrustHtml(highlighted);
    }

    private highlightLine(line: string): string {
        // Escape HTML entities first
        let escaped = line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Comment line — highlight entire line
        if (/^\s*#/.test(escaped)) {
            return `<span class="hl-comment">${escaped}</span>`;
        }

        // Tokenize and rebuild the line
        const result: string[] = [];
        let remaining = escaped;

        while (remaining.length > 0) {
            // Match string literals
            const stringMatch = remaining.match(/^"([^"]*)"/);
            if (stringMatch) {
                result.push(`<span class="hl-string">"${stringMatch[1]}"</span>`);
                remaining = remaining.substring(stringMatch[0].length);
                continue;
            }

            // Match interpolation ${...}
            const refMatch = remaining.match(/^\$\{([^}]+)\}/);
            if (refMatch) {
                result.push(`<span class="hl-ref">\${${refMatch[1]}}</span>`);
                remaining = remaining.substring(refMatch[0].length);
                continue;
            }

            // Match keywords and identifiers
            const wordMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (wordMatch) {
                const word = wordMatch[1];
                const keywords = new Set([
                    'resource', 'variable', 'output', 'provider', 'terraform',
                    'data', 'locals', 'module', 'required_version', 'required_providers',
                ]);
                const booleans = new Set(['true', 'false']);

                if (keywords.has(word)) {
                    result.push(`<span class="hl-keyword">${word}</span>`);
                } else if (booleans.has(word)) {
                    result.push(`<span class="hl-bool">${word}</span>`);
                } else {
                    // Check if this is an attribute name (followed by spaces then =)
                    const afterWord = remaining.substring(word.length);
                    if (/^\s*=/.test(afterWord)) {
                        result.push(`<span class="hl-attr">${word}</span>`);
                    } else {
                        result.push(word);
                    }
                }
                remaining = remaining.substring(word.length);
                continue;
            }

            // Match numbers
            const numMatch = remaining.match(/^(\d+)/);
            if (numMatch) {
                result.push(`<span class="hl-number">${numMatch[1]}</span>`);
                remaining = remaining.substring(numMatch[0].length);
                continue;
            }

            // Match inline comment
            if (remaining.startsWith('#')) {
                result.push(`<span class="hl-comment">${remaining}</span>`);
                remaining = '';
                continue;
            }

            // Any other character (whitespace, braces, operators, etc.)
            result.push(remaining[0]);
            remaining = remaining.substring(1);
        }

        return result.join('');
    }
}

@Component({
    selector: 'app-code-preview',
    standalone: true,
    imports: [HclHighlightPipe],
    templateUrl: './code-preview.component.html',
    styleUrl: './code-preview.component.scss',
})
export class CodePreviewComponent {
    private graphState = inject(GraphStateService);

    files = computed(() => this.graphState.generatedFiles());
    activeTab = signal(0);
    copyFeedback = signal<string | null>(null);

    activeFile = computed(() => {
        const f = this.files();
        const idx = this.activeTab();
        return f[idx] ?? f[0] ?? null;
    });

    setActiveTab(index: number): void {
        this.activeTab.set(index);
    }

    async copyToClipboard(): Promise<void> {
        const file = this.activeFile();
        if (!file) return;
        try {
            await navigator.clipboard.writeText(file.content);
            this.copyFeedback.set('Copied!');
            setTimeout(() => this.copyFeedback.set(null), 2000);
        } catch {
            this.copyFeedback.set('Copy failed');
            setTimeout(() => this.copyFeedback.set(null), 2000);
        }
    }
}

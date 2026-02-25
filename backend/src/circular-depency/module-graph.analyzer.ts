import { Injectable, Logger, Type } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface DependencyNode {
  name: string;
  imports: string[];
  providers: string[];
  exports: string[];
  filePath?: string;
}

export interface CircularChain {
  chain: string[];
  severity: 'critical' | 'warning' | 'info';
  suggestion: RefactorStrategy;
}

export type RefactorStrategy =
  | 'intermediate-service'
  | 'extract-shared-domain'
  | 'reverse-dependency'
  | 'event-driven'
  | 'forward-ref';

export interface DependencyReport {
  totalModules: number;
  totalProviders: number;
  circularChains: CircularChain[];
  dependencyGraph: Map<string, DependencyNode>;
  mermaidDiagram: string;
  analysisTimestamp: Date;
}

@Injectable()
export class ModuleGraphAnalyzer {
  private readonly logger = new Logger(ModuleGraphAnalyzer.name);
  private graph: Map<string, DependencyNode> = new Map();

  /**
   * Scans a source directory and builds the module dependency graph.
   */
  async buildGraphFromDirectory(srcDir: string): Promise<Map<string, DependencyNode>> {
    this.graph.clear();
    const moduleFiles = await this.findModuleFiles(srcDir);

    for (const file of moduleFiles) {
      const node = await this.parseModuleFile(file);
      if (node) {
        this.graph.set(node.name, node);
      }
    }

    return this.graph;
  }

  /**
   * Registers a module node directly (for runtime analysis).
   */
  registerModule(name: string, node: Partial<DependencyNode>): void {
    this.graph.set(name, {
      name,
      imports: node.imports ?? [],
      providers: node.providers ?? [],
      exports: node.exports ?? [],
      filePath: node.filePath,
    });
  }

  /**
   * Detects all circular dependency chains using DFS.
   */
  detectCircularDependencies(): CircularChain[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const chains: CircularChain[] = [];

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);

      const nodeData = this.graph.get(node);
      if (!nodeData) return;

      for (const dep of nodeData.imports) {
        if (!visited.has(dep)) {
          dfs(dep, [...path, node]);
        } else if (recursionStack.has(dep)) {
          const cycleStart = path.indexOf(dep);
          const cycle = cycleStart >= 0
            ? [...path.slice(cycleStart), node, dep]
            : [...path, node, dep];

          chains.push({
            chain: cycle,
            severity: cycle.length <= 2 ? 'critical' : 'warning',
            suggestion: this.suggestStrategy(cycle),
          });
        }
      }

      recursionStack.delete(node);
    };

    for (const [name] of this.graph) {
      if (!visited.has(name)) {
        dfs(name, []);
      }
    }

    return chains;
  }

  /**
   * Generates a full dependency report including Mermaid diagram.
   */
  generateReport(): DependencyReport {
    const circularChains = this.detectCircularDependencies();
    const mermaidDiagram = this.generateMermaidDiagram(circularChains);

    const report: DependencyReport = {
      totalModules: this.graph.size,
      totalProviders: [...this.graph.values()].reduce((acc, n) => acc + n.providers.length, 0),
      circularChains,
      dependencyGraph: new Map(this.graph),
      mermaidDiagram,
      analysisTimestamp: new Date(),
    };

    if (circularChains.length > 0) {
      this.logger.warn(
        `Found ${circularChains.length} circular dependency chain(s). Review the report.`,
      );
    } else {
      this.logger.log('No circular dependencies detected.');
    }

    return report;
  }

  /**
   * Generates Mermaid diagram markup for the dependency graph.
   */
  private generateMermaidDiagram(circularChains: CircularChain[]): string {
    const circularEdges = new Set<string>();
    for (const chain of circularChains) {
      for (let i = 0; i < chain.chain.length - 1; i++) {
        circularEdges.add(`${chain.chain[i]}->${chain.chain[i + 1]}`);
      }
    }

    const lines: string[] = ['graph TD'];

    for (const [name, node] of this.graph) {
      for (const dep of node.imports) {
        const edge = `${name}->${dep}`;
        if (circularEdges.has(edge)) {
          lines.push(`  ${name} -->|"⚠️ CIRCULAR"| ${dep}`);
        } else {
          lines.push(`  ${name} --> ${dep}`);
        }
      }
    }

    // Style circular nodes
    const circularNodes = new Set<string>(
      circularChains.flatMap((c) => c.chain),
    );
    for (const node of circularNodes) {
      lines.push(`  style ${node} fill:#ff6b6b,stroke:#c0392b`);
    }

    return lines.join('\n');
  }

  private suggestStrategy(chain: string[]): RefactorStrategy {
    if (chain.length === 2) return 'forward-ref';
    if (chain.length === 3) return 'intermediate-service';
    if (chain.length >= 4) return 'event-driven';
    return 'extract-shared-domain';
  }

  private async findModuleFiles(dir: string): Promise<string[]> {
    const results: string[] = [];

    if (!fs.existsSync(dir)) return results;

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.module.ts')) {
          results.push(fullPath);
        }
      }
    };

    walk(dir);
    return results;
  }

  private async parseModuleFile(filePath: string): Promise<DependencyNode | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const name = this.extractModuleName(content, filePath);
      if (!name) return null;

      return {
        name,
        imports: this.extractArrayField(content, 'imports'),
        providers: this.extractArrayField(content, 'providers'),
        exports: this.extractArrayField(content, 'exports'),
        filePath,
      };
    } catch {
      return null;
    }
  }

  private extractModuleName(content: string, filePath: string): string | null {
    const match = content.match(/export\s+class\s+(\w+Module)/);
    if (match) return match[1];
    return path.basename(filePath, '.module.ts')
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('') + 'Module';
  }

  private extractArrayField(content: string, field: string): string[] {
    const regex = new RegExp(`${field}\\s*:\\s*\\[([^\\]]*?)\\]`, 's');
    const match = content.match(regex);
    if (!match) return [];

    return match[1]
      .split(',')
      .map((s) => s.trim().replace(/\/\/.*/, '').replace(/forwardRef\(\(\)\s*=>\s*(\w+)\)/, '$1'))
      .filter((s) => s && /^[A-Z]/.test(s));
  }
}

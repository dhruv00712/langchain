// src/circuitLoader.ts - Load circuit projects from data/circuits/
import { Document } from "@langchain/core/documents";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CircuitData {
  name: string;
  description: string;
  category: string;
  svgPath?: string;
  svgContent?: string;
  
  // Your new circuit format
  componentsUsed: string[];
  connections: string[];
  howItWorks: string;
  powerNotes?: string;
  safetyNotes?: string[];
}

export class CircuitLoader {
  private circuitsPath: string;
  private circuits: CircuitData[] = [];

  constructor(circuitsPath: string) {
    this.circuitsPath = circuitsPath;
  }

  /**
   * Load all circuit documents from data/circuits/
   */
  async loadCircuits(): Promise<Document[]> {
    await this.ensureCircuitsDirectory();
    
    const existingCircuits = await this.loadExistingCircuits();
    
    if (existingCircuits.length === 0) {
      console.log("⚠️  No circuits found in data/circuits/ folder!");
      return [];
    }

    this.circuits = existingCircuits;
    console.log(`✅ Loaded ${this.circuits.length} circuit documents`);
    
    // Convert to LangChain documents with FLAT metadata
    return this.circuits.map(circuit => {
      const content = this.formatCircuitContent(circuit);
      
      const metadata = {
        name: circuit.name,
        description: circuit.description,
        category: circuit.category,
        type: "circuit", // Mark as circuit (not component)
        components: circuit.componentsUsed.join(", "),
        connections: circuit.connections.slice(0, 3).join(" | "), // First 3 only
        hasSvg: circuit.svgPath ? "yes" : "no",
        svgPath: circuit.svgPath || ""
      };

      return new Document({
        pageContent: content,
        metadata: metadata
      });
    });
  }

  /**
   * Format circuit data into readable text for RAG
   */
  private formatCircuitContent(circuit: CircuitData): string {
    let content = `# ${circuit.name}\n\n`;
    content += `**Type:** Circuit Project\n`;
    content += `**Description:** ${circuit.description}\n`;
    content += `**Category:** ${circuit.category}\n\n`;
    
    // Components section
    content += `## Components Used:\n`;
    circuit.componentsUsed.forEach((comp, idx) => {
      content += `  ${idx + 1}. ${comp}\n`;
    });
    content += `\n`;
    
    // Connections section
    content += `## Wiring Connections:\n`;
    circuit.connections.forEach((conn, idx) => {
      content += `  ${idx + 1}. ${conn}\n`;
    });
    content += `\n`;
    
    // How it works
    content += `## How It Works:\n${circuit.howItWorks}\n\n`;
    
    // Power notes
    if (circuit.powerNotes) {
      content += `## Power Requirements:\n${circuit.powerNotes}\n\n`;
    }
    
    // Safety notes
    if (circuit.safetyNotes && circuit.safetyNotes.length > 0) {
      content += `## Safety Precautions:\n`;
      circuit.safetyNotes.forEach((note, idx) => {
        content += `  ${idx + 1}. ${note}\n`;
      });
      content += `\n`;
    }
    
    // SVG diagram indicator
    if (circuit.svgPath) {
      content += `## Circuit Diagram:\nSVG diagram available at: ${circuit.svgPath}\n`;
    }
    
    return content;
  }

  /**
   * Ensure circuits directory exists
   */
  private async ensureCircuitsDirectory(): Promise<void> {
    try {
      await fs.access(this.circuitsPath);
    } catch {
      await fs.mkdir(this.circuitsPath, { recursive: true });
      console.log(`📁 Created circuits directory: ${this.circuitsPath}`);
    }
  }

  /**
   * Load existing circuit JSON files from data/circuits/
   */
  private async loadExistingCircuits(): Promise<CircuitData[]> {
    try {
      const files = await fs.readdir(this.circuitsPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      console.log(`📂 Found ${jsonFiles.length} JSON files in circuits folder`);
      
      const circuits: CircuitData[] = [];
      for (const file of jsonFiles) {
        const filePath = path.join(this.circuitsPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const circuit = JSON.parse(content);
        
        // Validate circuit has required fields
        if (!circuit.name || !circuit.description || !circuit.componentsUsed) {
          console.log(`  ⚠️  Skipping ${file} - Missing required fields`);
          continue;
        }
        
        // Load SVG if path is provided
        if (circuit.svgPath) {
          try {
            const svgPath = path.join(this.circuitsPath, path.basename(circuit.svgPath));
            circuit.svgContent = await fs.readFile(svgPath, 'utf-8');
            console.log(`  ✅ Loaded circuit: ${circuit.name} (with SVG)`);
          } catch (err) {
            console.log(`  ✅ Loaded circuit: ${circuit.name} (no SVG)`);
          }
        } else {
          console.log(`  ✅ Loaded circuit: ${circuit.name}`);
        }
        
        circuits.push(circuit);
      }
      
      return circuits;
    } catch (error) {
      console.error("Error loading circuits:", error);
      return [];
    }
  }

  /**
   * Get all circuits (for API)
   */
  async getAllCircuits(): Promise<CircuitData[]> {
    if (this.circuits.length === 0) {
      await this.loadCircuits();
    }
    return this.circuits;
  }

  /**
   * Get specific circuit by name
   */
  async getCircuitByName(name: string): Promise<CircuitData | null> {
    if (this.circuits.length === 0) {
      await this.loadCircuits();
    }
    return this.circuits.find(c => 
      c.name.toLowerCase().includes(name.toLowerCase())
    ) || null;
  }
}
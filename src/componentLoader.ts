// src/componentLoader.ts - Load individual components from data/components/
import { Document } from "@langchain/core/documents";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ComponentData {
  name: string;
  category: string;
  description: string;
  svgPath?: string;
  svgContent?: string;
  pinout?: Array<{
    pin: string;
    voltage?: string;
    type: string;
    description?: string;
  }>;
  technicalSpecifications?: Record<string, any>;
  operatingVoltage?: string;
  operatingTemperature?: string;
  connections?: string[];
  applications?: string[];
  safetyNotes?: string[];
}

export class ComponentLoader {
  private componentsPath: string;
  private components: ComponentData[] = [];

  constructor(componentsPath: string) {
    this.componentsPath = componentsPath;
  }

  /**
   * Load all component documents from data/components/
   */
  async loadComponents(): Promise<Document[]> {
    await this.ensureComponentsDirectory();
    
    const existingComponents = await this.loadExistingComponents();
    
    if (existingComponents.length === 0) {
      console.log("⚠️  No components found in data/components/ folder!");
      return [];
    }

    this.components = existingComponents;
    console.log(`✅ Loaded ${this.components.length} component documents`);
    
    // Convert to LangChain documents
    return this.components.map(component => {
      const content = this.formatComponentContent(component);
      
      // Flatten metadata
      const metadata = {
        name: component.name,
        category: component.category,
        description: component.description,
        type: "component", // Mark as component (not circuit)
        operatingVoltage: component.operatingVoltage || "",
        operatingTemperature: component.operatingTemperature || "",
        hasSvg: component.svgPath ? "yes" : "no",
        svgPath: component.svgPath || ""
      };

      return new Document({
        pageContent: content,
        metadata: metadata
      });
    });
  }

  /**
   * Format component data into readable text for RAG
   */
  private formatComponentContent(component: ComponentData): string {
    let content = `# ${component.name}\n\n`;
    content += `**Type:** Component (${component.category})\n`;
    content += `**Description:** ${component.description}\n\n`;
    
    // Technical Specifications
    if (component.technicalSpecifications) {
      content += `## Technical Specifications:\n`;
      Object.entries(component.technicalSpecifications).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
        content += `  • ${formattedKey}: ${value}\n`;
      });
      content += `\n`;
    }
    
    // Operating conditions
    if (component.operatingVoltage) {
      content += `**Operating Voltage:** ${component.operatingVoltage}\n`;
    }
    if (component.operatingTemperature) {
      content += `**Operating Temperature:** ${component.operatingTemperature}\n\n`;
    }
    
    // Pinout
    if (component.pinout && component.pinout.length > 0) {
      content += `## Pinout:\n`;
      component.pinout.forEach((pin) => {
        content += `  • **${pin.pin}** (${pin.type})`;
        if (pin.voltage) content += ` - ${pin.voltage}`;
        if (pin.description) content += ` - ${pin.description}`;
        content += `\n`;
      });
      content += `\n`;
    }
    
    // Connections
    if (component.connections && component.connections.length > 0) {
      content += `## Typical Connections:\n`;
      component.connections.forEach((conn, idx) => {
        content += `  ${idx + 1}. ${conn}\n`;
      });
      content += `\n`;
    }
    
    // Applications
    if (component.applications && component.applications.length > 0) {
      content += `## Common Applications:\n`;
      component.applications.forEach((app, idx) => {
        content += `  ${idx + 1}. ${app}\n`;
      });
      content += `\n`;
    }
    
    // Safety Notes
    if (component.safetyNotes && component.safetyNotes.length > 0) {
      content += `## Safety Notes:\n`;
      component.safetyNotes.forEach((note, idx) => {
        content += `  ${idx + 1}. ${note}\n`;
      });
      content += `\n`;
    }
    
    // SVG
    if (component.svgPath) {
      content += `## Component Diagram:\nSVG diagram available at: ${component.svgPath}\n`;
    }
    
    return content;
  }

  /**
   * Ensure components directory exists
   */
  private async ensureComponentsDirectory(): Promise<void> {
    try {
      await fs.access(this.componentsPath);
    } catch {
      await fs.mkdir(this.componentsPath, { recursive: true });
      console.log(`📁 Created components directory: ${this.componentsPath}`);
    }
  }

  
  private async loadExistingComponents(): Promise<ComponentData[]> {
    try {
      const folders = await fs.readdir(this.componentsPath);
      const components: ComponentData[] = [];
      
      console.log(`📂 Scanning ${folders.length} folders in components directory...`);
      
      for (const folder of folders) {
        const folderPath = path.join(this.componentsPath, folder);
        
        // Check if it's a directory
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) continue;
        
        // Look for JSON file in this folder
        const files = await fs.readdir(folderPath);
        const jsonFile = files.find(f => f.endsWith('.json'));
        
        if (!jsonFile) {
          console.log(`  ⚠️  No JSON file in ${folder}/`);
          continue;
        }
        
        // Load component JSON
        const jsonPath = path.join(folderPath, jsonFile);
        const content = await fs.readFile(jsonPath, 'utf-8');
        const component = JSON.parse(content);
        
        // Validate component
        if (!component.name || !component.description) {
          console.log(`  ⚠️  Skipping ${folder}/ - Missing name or description`);
          continue;
        }
        
        // Load SVG if it exists
        if (component.svgPath) {
          const svgFileName = path.basename(component.svgPath);
          const svgPath = path.join(folderPath, svgFileName);
          
          try {
            component.svgContent = await fs.readFile(svgPath, 'utf-8');
            console.log(`  ✅ Loaded component: ${component.name} (with SVG)`);
          } catch (err) {
            console.log(`  ✅ Loaded component: ${component.name} (no SVG)`);
          }
        } else {
          console.log(`  ✅ Loaded component: ${component.name}`);
        }
        
        components.push(component);
      }
      
      return components;
    } catch (error) {
      console.error("Error loading components:", error);
      return [];
    }
  }

  /**
   * Get all components (for API)
   */
  async getAllComponents(): Promise<ComponentData[]> {
    if (this.components.length === 0) {
      await this.loadComponents();
    }
    return this.components;
  }

  /**
   * Get component by name
   */
  async getComponentByName(name: string): Promise<ComponentData | null> {
    if (this.components.length === 0) {
      await this.loadComponents();
    }
    return this.components.find(c => 
      c.name.toLowerCase().includes(name.toLowerCase())
    ) || null;
  }
}
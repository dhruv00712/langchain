// src/advancedCircuitAssembler.ts - Advanced Circuit Assembler using REAL component SVGs
import fs from "fs/promises";
import path from "path";

interface ComponentSVGData {
  name: string;
  svgContent: string;
  width: number;
  height: number;
  pins: Map<string, { x: number; y: number }>;
}

interface ConnectionWire {
  from: { component: string; pin: string; x: number; y: number };
  to: { component: string; pin: string; x: number; y: number };
  color: string;
  label: string;
}

export class AdvancedCircuitAssembler {
  private componentsBasePath: string;
  private loadedComponents: Map<string, ComponentSVGData> = new Map();

  constructor(componentsBasePath: string = "") {
    this.componentsBasePath = componentsBasePath || path.join(process.cwd(), "data", "components");
  }

  /**
   * Main method: Generate complete circuit SVG from connection data
   */
  async generateCircuit(
    circuitName: string,
    componentsUsed: string[],
    connections: string[],
    outputPath: string
  ): Promise<string> {
    console.log(`\n🎨 Assembling circuit: ${circuitName}`);
    
    // Step 1: Load all component SVGs
    await this.loadComponentSVGs(componentsUsed);
    
    // Step 2: Layout components on canvas
    const layout = this.layoutComponents(componentsUsed);
    
    // Step 3: Parse connections and create wires
    const wires = this.parseConnections(connections, layout);
    
    // Step 4: Generate final SVG
    const finalSVG = this.assembleFinalSVG(circuitName, layout, wires);
    
    // Step 5: Save to file
    await fs.writeFile(outputPath, finalSVG, "utf-8");
    console.log(`✅ Circuit diagram saved: ${outputPath}`);
    
    return finalSVG;
  }

  /**
   * Load actual SVG files from component folders
   */
  private async loadComponentSVGs(componentsUsed: string[]): Promise<void> {
    console.log(`📦 Loading ${componentsUsed.length} component SVGs...`);
    
    for (const componentName of componentsUsed) {
      try {
        // Find component folder (case-insensitive search)
        const componentFolderName = await this.findComponentFolder(componentName);
        
        if (!componentFolderName) {
          console.log(`  ⚠️  Component folder not found for: ${componentName}`);
          continue;
        }
        
        const componentPath = path.join(this.componentsBasePath, componentFolderName);
        
        // Load SVG file
        const files = await fs.readdir(componentPath);
        const svgFile = files.find(f => f.endsWith('.svg'));
        
        if (!svgFile) {
          console.log(`  ⚠️  No SVG file found in: ${componentFolderName}`);
          continue;
        }
        
        const svgPath = path.join(componentPath, svgFile);
        const svgContent = await fs.readFile(svgPath, 'utf-8');
        
        // Parse SVG to get dimensions and pins
        const svgData = this.parseSVG(componentName, svgContent);
        
        this.loadedComponents.set(componentName, svgData);
        console.log(`  ✅ Loaded: ${componentName} (${svgData.width}x${svgData.height})`);
        
      } catch (error) {
        console.error(`  ❌ Error loading ${componentName}:`, error);
      }
    }
  }

  /**
   * Find component folder (case-insensitive)
   */
  private async findComponentFolder(componentName: string): Promise<string | null> {
    try {
      const folders = await fs.readdir(this.componentsBasePath);
      
      // Try exact match first
      const normalized = componentName.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
      
      for (const folder of folders) {
        const folderNormalized = folder.toLowerCase();
        
        if (folderNormalized.includes(normalized) || normalized.includes(folderNormalized)) {
          return folder;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse SVG content to extract dimensions and pin locations
   */
  private parseSVG(componentName: string, svgContent: string): ComponentSVGData {
    // Extract viewBox or width/height
    const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
    const widthMatch = svgContent.match(/width=["'](\d+)/);
    const heightMatch = svgContent.match(/height=["'](\d+)/);
    
    let width = 150;
    let height = 150;
    
    if (viewBoxMatch) {
      const [, , , w, h] = viewBoxMatch[1].split(/\s+/);
      width = parseFloat(w) || 150;
      height = parseFloat(h) || 150;
    } else if (widthMatch && heightMatch) {
      width = parseFloat(widthMatch[1]) || 150;
      height = parseFloat(heightMatch[1]) || 150;
    }
    
    // Define pin positions based on component type
    const pins = this.getComponentPinPositions(componentName, width, height);
    
    return {
      name: componentName,
      svgContent,
      width,
      height,
      pins
    };
  }

  /**
   * Get pin positions for different component types
   */
  private getComponentPinPositions(
    componentName: string,
    width: number,
    height: number
  ): Map<string, { x: number; y: number }> {
    const pins = new Map();
    const name = componentName.toLowerCase();
    
    if (name.includes('arduino')) {
      // Arduino pins on left and right sides
      pins.set('VIN', { x: 0, y: height * 0.2 });
      pins.set('GND', { x: 0, y: height * 0.4 });
      pins.set('5V', { x: 0, y: height * 0.3 });
      pins.set('3.3V', { x: 0, y: height * 0.35 });
      pins.set('D13', { x: width, y: height * 0.3 });
      pins.set('D12', { x: width, y: height * 0.4 });
      pins.set('D11', { x: width, y: height * 0.5 });
      pins.set('D10', { x: width, y: height * 0.6 });
      pins.set('A0', { x: width, y: height * 0.7 });
      pins.set('A1', { x: width, y: height * 0.8 });
      
    } else if (name.includes('led')) {
      // LED pins top and bottom
      pins.set('Anode', { x: width / 2, y: 0 });
      pins.set('+', { x: width / 2, y: 0 });
      pins.set('Cathode', { x: width / 2, y: height });
      pins.set('-', { x: width / 2, y: height });
      
    } else if (name.includes('resistor')) {
      // Resistor pins left and right
      pins.set('A', { x: 0, y: height / 2 });
      pins.set('B', { x: width, y: height / 2 });
      pins.set('1', { x: 0, y: height / 2 });
      pins.set('2', { x: width, y: height / 2 });
      
    } else if (name.includes('battery')) {
      // Battery terminals
      pins.set('+', { x: width / 2, y: 0 });
      pins.set('positive', { x: width / 2, y: 0 });
      pins.set('-', { x: width / 2, y: height });
      pins.set('negative', { x: width / 2, y: height });
      
    } else if (name.includes('hc-sr04') || name.includes('ultrasonic')) {
      // Ultrasonic sensor pins
      pins.set('VCC', { x: 0, y: height * 0.2 });
      pins.set('TRIG', { x: 0, y: height * 0.4 });
      pins.set('ECHO', { x: 0, y: height * 0.6 });
      pins.set('GND', { x: 0, y: height * 0.8 });
      
    } else if (name.includes('switch') || name.includes('button')) {
      // Switch/Button pins
      pins.set('1', { x: 0, y: height / 2 });
      pins.set('2', { x: width, y: height / 2 });
      pins.set('A', { x: 0, y: height / 2 });
      pins.set('B', { x: width, y: height / 2 });
      
    } else {
      // Generic component - pins on all sides
      pins.set('TOP', { x: width / 2, y: 0 });
      pins.set('BOTTOM', { x: width / 2, y: height });
      pins.set('LEFT', { x: 0, y: height / 2 });
      pins.set('RIGHT', { x: width, y: height / 2 });
    }
    
    return pins;
  }

  /**
   * Layout components on canvas with intelligent positioning
   */
  private layoutComponents(componentsUsed: string[]): Map<string, any> {
    const layout = new Map();
    
    // Find Arduino (main component) - place it in center-left
    const arduinoComponent = componentsUsed.find(c => 
      c.toLowerCase().includes('arduino')
    );
    
    let currentX = 150;
    let currentY = 200;
    const spacingX = 250;
    const spacingY = 200;
    
    // Place Arduino first
    if (arduinoComponent && this.loadedComponents.has(arduinoComponent)) {
      const arduinoData = this.loadedComponents.get(arduinoComponent)!;
      layout.set(arduinoComponent, {
        component: arduinoData,
        x: currentX,
        y: currentY,
        absolutePins: this.calculateAbsolutePins(arduinoData.pins, currentX, currentY)
      });
      currentX += spacingX;
    }
    
    // Place other components
    let row = 0;
    for (const componentName of componentsUsed) {
      if (componentName === arduinoComponent) continue;
      
      const componentData = this.loadedComponents.get(componentName);
      if (!componentData) continue;
      
      layout.set(componentName, {
        component: componentData,
        x: currentX,
        y: currentY + (row * spacingY),
        absolutePins: this.calculateAbsolutePins(componentData.pins, currentX, currentY + (row * spacingY))
      });
      
      row++;
      if (row >= 3) {
        row = 0;
        currentX += spacingX;
      }
    }
    
    return layout;
  }

  /**
   * Calculate absolute pin positions on canvas
   */
  private calculateAbsolutePins(
    pins: Map<string, { x: number; y: number }>,
    offsetX: number,
    offsetY: number
  ): Map<string, { x: number; y: number }> {
    const absolutePins = new Map();
    
    for (const [pinName, position] of pins.entries()) {
      absolutePins.set(pinName, {
        x: offsetX + position.x,
        y: offsetY + position.y
      });
    }
    
    return absolutePins;
  }

  /**
   * Parse connections and create wire data
   */
  private parseConnections(
    connections: string[],
    layout: Map<string, any>
  ): ConnectionWire[] {
    const wires: ConnectionWire[] = [];
    
    for (const connection of connections) {
      // Skip non-connection lines
      if (connection.toLowerCase().includes('upload') || 
          connection.toLowerCase().includes('code') ||
          connection.toLowerCase().includes('program')) {
        continue;
      }
      
      // Parse: "Arduino D13 → LED Anode" or "Battery + → Arduino VIN"
      const parts = connection.split('→').map(s => s.trim());
      if (parts.length !== 2) continue;
      
      const fromPoint = this.findConnectionPoint(parts[0], layout);
      const toPoint = this.findConnectionPoint(parts[1], layout);
      
      if (fromPoint && toPoint) {
        wires.push({
          from: fromPoint,
          to: toPoint,
          color: this.getWireColor(connection),
          label: connection
        });
      }
    }
    
    return wires;
  }

  /**
   * Find connection point from string like "Arduino D13"
   */
  private findConnectionPoint(
    pointStr: string,
    layout: Map<string, any>
  ): { component: string; pin: string; x: number; y: number } | null {
    
    for (const [componentName, layoutData] of layout.entries()) {
      if (pointStr.includes(componentName)) {
        // Extract pin name
        const pinName = pointStr.replace(componentName, '').trim();
        
        // Try to find exact pin
        const absolutePins = layoutData.absolutePins;
        
        for (const [pin, position] of absolutePins.entries()) {
          if (pinName.includes(pin) || pin.includes(pinName)) {
            return {
              component: componentName,
              pin: pin,
              x: position.x,
              y: position.y
            };
          }
        }
        
        // If pin not found, use first available pin
        const firstPin = Array.from(absolutePins.entries())[0] as [string, { x: number; y: number }] | undefined;
        if (firstPin) {
          return {
            component: componentName,
            pin: firstPin[0],
            x: firstPin[1].x,
            y: firstPin[1].y
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Determine wire color based on connection type
   */
  private getWireColor(connection: string): string {
    const conn = connection.toLowerCase();
    
    if (conn.includes('vin') || conn.includes('5v') || conn.includes('3.3v') || 
        conn.includes('vcc') || conn.includes('power') || conn.includes('+')) {
      return '#FF0000'; // Red for power
    }
    if (conn.includes('gnd') || conn.includes('ground') || conn.includes('-')) {
      return '#000000'; // Black for ground
    }
    if (conn.includes('signal') || conn.includes('trig') || conn.includes('echo')) {
      return '#FFFF00'; // Yellow for signal
    }
    if (conn.match(/d\d+/i)) { // Digital pins (D13, D12, etc.)
      return '#00FF00'; // Green for digital
    }
    if (conn.match(/a\d+/i)) { // Analog pins (A0, A1, etc.)
      return '#0088FF'; // Blue for analog
    }
    
    return '#888888'; // Gray for other
  }

  /**
   * Assemble final SVG with all components and wires
   */
  private assembleFinalSVG(
    circuitName: string,
    layout: Map<string, any>,
    wires: ConnectionWire[]
  ): string {
    // Calculate canvas size
    let maxX = 0;
    let maxY = 0;
    
    for (const layoutData of layout.values()) {
      maxX = Math.max(maxX, layoutData.x + layoutData.component.width);
      maxY = Math.max(maxY, layoutData.y + layoutData.component.height);
    }
    
    const canvasWidth = maxX + 100;
    const canvasHeight = maxY + 150;
    
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="#FAFAFA"/>
  
  <!-- Grid Pattern -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E0E0E0" stroke-width="0.5"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  
  <!-- Title -->
  <rect x="10" y="10" width="${canvasWidth - 20}" height="60" fill="#FFFFFF" stroke="#333" stroke-width="2" rx="10"/>
  <text x="${canvasWidth / 2}" y="45" font-size="28" font-family="Arial, sans-serif" 
        font-weight="bold" text-anchor="middle" fill="#333">
    ${circuitName}
  </text>
  
  <!-- Wires Layer -->
  <g id="wires">
`;

    // Draw wires
    for (const wire of wires) {
      svg += this.drawWire(wire);
    }

    svg += `  </g>
  
  <!-- Components Layer -->
  <g id="components">
`;

    // Draw components using their actual SVGs
    for (const [componentName, layoutData] of layout.entries()) {
      svg += this.embedComponentSVG(componentName, layoutData);
    }

    svg += `  </g>
  
  <!-- Pin Labels -->
  <g id="pin-labels">
`;

    // Add pin labels for debugging/reference
    for (const [componentName, layoutData] of layout.entries()) {
      for (const [pinName, position] of layoutData.absolutePins.entries()) {
        svg += `    <circle cx="${position.x}" cy="${position.y}" r="4" fill="#FF6B6B" stroke="#FFF" stroke-width="1.5"/>
    <text x="${position.x + 10}" y="${position.y - 5}" font-size="10" fill="#666">${pinName}</text>
`;
      }
    }

    svg += `  </g>
  
  <!-- Legend -->
  <g id="legend" transform="translate(20, ${canvasHeight - 120})">
    <rect x="-10" y="-10" width="400" height="110" fill="#FFFFFF" stroke="#333" stroke-width="2" rx="5"/>
    <text x="0" y="5" font-size="14" font-weight="bold" fill="#333">Wire Color Guide:</text>
    
    <line x1="0" y1="25" x2="50" y2="25" stroke="#FF0000" stroke-width="4"/>
    <text x="60" y="30" font-size="12" fill="#333">Power (VIN, 5V, VCC)</text>
    
    <line x1="0" y1="45" x2="50" y2="45" stroke="#000000" stroke-width="4"/>
    <text x="60" y="50" font-size="12" fill="#333">Ground (GND)</text>
    
    <line x1="200" y1="25" x2="250" y2="25" stroke="#00FF00" stroke-width="4"/>
    <text x="260" y="30" font-size="12" fill="#333">Digital Pins</text>
    
    <line x1="200" y1="45" x2="250" y2="45" stroke="#0088FF" stroke-width="4"/>
    <text x="260" y="50" font-size="12" fill="#333">Analog Pins</text>
    
    <line x1="0" y1="65" x2="50" y2="65" stroke="#FFFF00" stroke-width="4"/>
    <text x="60" y="70" font-size="12" fill="#333">Signal</text>
    
    <line x1="200" y1="65" x2="250" y2="65" stroke="#888888" stroke-width="4"/>
    <text x="260" y="70" font-size="12" fill="#333">Other</text>
  </g>
  
  <!-- Footer -->
  <text x="${canvasWidth / 2}" y="${canvasHeight - 10}" font-size="10" 
        font-family="Arial" text-anchor="middle" fill="#999">
    Generated by Advanced Circuit Assembler • Using Real Component SVGs
  </text>
  
</svg>`;

    return svg;
  }

  /**
   * Draw wire connection
   */
  private drawWire(wire: ConnectionWire): string {
    const { from, to, color } = wire;
    
    // Calculate smooth curve path
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Control points for bezier curve
    const curvature = Math.min(distance * 0.3, 100);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    
    let path = '';
    
    // Use curved path for better aesthetics
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal dominant
      path = `M ${from.x} ${from.y} C ${from.x + curvature} ${from.y}, ${to.x - curvature} ${to.y}, ${to.x} ${to.y}`;
    } else {
      // Vertical dominant
      path = `M ${from.x} ${from.y} C ${from.x} ${from.y + curvature}, ${to.x} ${to.y - curvature}, ${to.x} ${to.y}`;
    }
    
    return `
    <!-- Wire: ${wire.label} -->
    <path d="${path}" 
          stroke="${color}" 
          stroke-width="3" 
          fill="none"
          stroke-linecap="round"
          opacity="0.9"/>
    <circle cx="${from.x}" cy="${from.y}" r="5" fill="${color}" stroke="#FFF" stroke-width="2"/>
    <circle cx="${to.x}" cy="${to.y}" r="5" fill="${color}" stroke="#FFF" stroke-width="2"/>
`;
  }

  /**
   * Embed actual component SVG at specified position
   */
  private embedComponentSVG(componentName: string, layoutData: any): string {
    const { component, x, y } = layoutData;
    
    // Extract SVG content without the outer <svg> tags
    let svgContent = component.svgContent;
    
    // Remove XML declaration, DOCTYPE, and outer svg tags
    svgContent = svgContent.replace(/<\?xml[^>]*\?>/g, '');
    svgContent = svgContent.replace(/<!DOCTYPE[^>]*>/g, '');
    svgContent = svgContent.replace(/<svg[^>]*>/g, '');
    svgContent = svgContent.replace(/<\/svg>/g, '');
    svgContent = svgContent.trim();
    
    return `
  <!-- Component: ${componentName} -->
  <g id="${componentName.replace(/\s+/g, '_')}" transform="translate(${x}, ${y})">
    <!-- Component Background -->
    <rect x="-5" y="-5" width="${component.width + 10}" height="${component.height + 10}" 
          fill="#FFFFFF" stroke="#333" stroke-width="2" rx="5" opacity="0.9"/>
    
    <!-- Actual Component SVG -->
    <g>
      ${svgContent}
    </g>
    
    <!-- Component Label -->
    <text x="${component.width / 2}" y="${component.height + 20}" 
          font-size="12" font-family="Arial" font-weight="bold"
          text-anchor="middle" fill="#333">
      ${componentName}
    </text>
  </g>
`;
  }
}

/**
 * USAGE EXAMPLE:
 * 
 * const assembler = new AdvancedCircuitAssembler();
 * 
 * await assembler.generateCircuit(
 *   "Arduino LED Blink Circuit",
 *   ["Arduino Nano", "LED (Red)", "Resistor (220Ω)", "9V Battery"],
 *   [
 *     "Battery + → Arduino VIN",
 *     "Battery - → Arduino GND",
 *     "Arduino D13 → Resistor A",
 *     "Resistor B → LED Anode",
 *     "LED Cathode → Arduino GND"
 *   ],
 *   "./output/advanced_circuit.svg"
 * );
 */
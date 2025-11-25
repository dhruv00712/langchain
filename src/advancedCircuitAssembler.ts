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
    private componentNameMap: Record<string, string | null> = {
      // Arduino variations
      "Arduino Nano": "arduino_nano",
      "Arduino": "arduino_nano",
      "Arduino Uno": "arduino_uno",
      
      // Sensors
      "HC-SR04 Ultrasonic Sensor": "hc_sr04",
      "HC-SR04": "hc_sr04",
      "Ultrasonic Sensor": "hc_sr04",
      
      // LEDs - Red
      "LED (Red)": "led_red",
      "Red LED": "led_red",
      "LED Red": "led_red",
      
      // LEDs - Green
      "LED (Green)": "led_green",
      "Green LED": "led_green",
      "LED Green": "led_green",
      
      // Resistors
      "Two 220Ω Resistors": "resistor_220",
      "Resistor (220Ω)": "resistor_220",
      "220Ω Resistor": "resistor_220",
      "220 Ohm Resistor": "resistor_220",
      "Resistor": "resistor_220",
      
      // Battery
      "9V Battery": "battery_9v",
      "Battery": "battery_9v",
      "9V": "battery_9v",
      
      // Skip these
      "Jumper Wires": null,
      "Wires": null,
      "Connecting Wires": null
    };


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
      // Skip if explicitly mapped to null (like "Jumper Wires")
      if (componentName in this.componentNameMap && this.componentNameMap[componentName] === null) {
        console.log(`  ⏭️  Skipping: ${componentName} (wires drawn automatically)`);
        continue;
      }
      
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
    // Check mapping first
    if (componentName in this.componentNameMap) {
      const mappedName = this.componentNameMap[componentName];
      if (!mappedName) return null; // Explicitly skip this component
      componentName = mappedName;
    }
    
    const folders = await fs.readdir(this.componentsBasePath);
    
    // Normalize: lowercase, replace hyphens/spaces with underscores, remove special chars
    const normalized = componentName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')         // Convert hyphens to underscores
      .replace(/[()ω]/g, '')      // Remove parentheses and omega
      .replace(/_+/g, '_')        // Collapse multiple underscores
      .trim();
    
    for (const folder of folders) {
      const folderNormalized = folder
        .toLowerCase()
        .replace(/-/g, '_')
        .replace(/_+/g, '_');
      
      // Try exact match or contains
      if (folderNormalized === normalized ||
          folderNormalized.includes(normalized) || 
          normalized.includes(folderNormalized)) {
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
      let pins = this.getComponentPinPositions(componentName, width, height);

  // NORMALIZE OVERSIZED COMPONENTS
  const MAX_WIDTH = 200;
  const MAX_HEIGHT = 200;

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    // Calculate scale factor
    const scaleX = width > MAX_WIDTH ? MAX_WIDTH / width : 1;
    const scaleY = height > MAX_HEIGHT ? MAX_HEIGHT / height : 1;
    const scale = Math.min(scaleX, scaleY);
    
    console.log(`  📏 Scaling ${componentName} from ${width.toFixed(0)}x${height.toFixed(0)} to ${(width * scale).toFixed(0)}x${(height * scale).toFixed(0)}`);
    
    // Scale dimensions
    width = width * scale;
    height = height * scale;
    
    // Scale pin positions
    const scaledPins = new Map();
    for (const [pinName, pos] of pins.entries()) {
      scaledPins.set(pinName, {
        x: pos.x * scale,
        y: pos.y * scale
      });
    }
    pins = scaledPins;
  }

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
  
  console.log(`\n🔌 Parsing ${connections.length} connections...`);
  console.log(`📦 Available components in layout:`, Array.from(layout.keys()));
  
  for (const connection of connections) {
    // Skip non-connection lines
    if (connection.toLowerCase().includes('upload') || 
        connection.toLowerCase().includes('code') ||
        connection.toLowerCase().includes('program')) {
      console.log(`  ⏭️  Skipping non-connection: ${connection}`);
      continue;
    }
    
    console.log(`\n  📍 Processing: "${connection}"`);
    
    // Parse: "Arduino D13 → LED Anode" or "Battery + → Arduino VIN"
    const parts = connection.split('→').map(s => s.trim());
    
    if (parts.length !== 2) {
      console.log(`  ⚠️  Invalid format (no → arrow found), skipping`);
      continue;
    }
    
    console.log(`     From: "${parts[0]}"`);
    console.log(`     To: "${parts[1]}"`);
    
    const fromPoint = this.findConnectionPoint(parts[0], layout);
    const toPoint = this.findConnectionPoint(parts[1], layout);
    
    if (fromPoint) {
      console.log(`     ✅ Found FROM: ${fromPoint.component}.${fromPoint.pin} at (${fromPoint.x}, ${fromPoint.y})`);
    } else {
      console.log(`     ❌ Could not find FROM point`);
    }
    
    if (toPoint) {
      console.log(`     ✅ Found TO: ${toPoint.component}.${toPoint.pin} at (${toPoint.x}, ${toPoint.y})`);
    } else {
      console.log(`     ❌ Could not find TO point`);
    }
    
    if (fromPoint && toPoint) {
      wires.push({
        from: fromPoint,
        to: toPoint,
        color: this.getWireColor(connection),
        label: connection
      });
      console.log(`     ✅ Wire created with color: ${this.getWireColor(connection)}`);
    } else {
      console.log(`     ❌ Skipped - missing connection point(s)`);
    }
  }
  
  console.log(`\n✅ Total wires created: ${wires.length}\n`);
  
  return wires;
}

  /**
   * Find connection point from string like "Arduino D13"
   */
  private findConnectionPoint(
  pointStr: string,
  layout: Map<string, any>
): { component: string; pin: string; x: number; y: number } | null {
  
  console.log(`       🔍 Searching for: "${pointStr}"`);
  
  // Try to match component names more flexibly
  for (const [componentName, layoutData] of layout.entries()) {
    
    // Extract key words from both the search string and component name
    const searchWords = pointStr.toLowerCase().split(/\s+/);
    const componentWords = componentName.toLowerCase().split(/\s+/);
    
    // Check if ANY word from the search matches ANY word from the component
    let foundMatch = false;
    
    // Strategy 1: Check if component name appears in search string
    if (pointStr.toLowerCase().includes(componentName.toLowerCase())) {
      foundMatch = true;
    }
    
    // Strategy 2: Check if any significant word matches
    const significantWords = ['arduino', 'nano', 'led', 'resistor', 'battery', 'sensor', 'hc-sr04', 'ultrasonic'];
    for (const word of significantWords) {
      if (pointStr.toLowerCase().includes(word) && componentName.toLowerCase().includes(word)) {
        foundMatch = true;
        break;
      }
    }
    
    // Strategy 3: Remove parentheses and check
    const cleanSearch = pointStr.toLowerCase().replace(/[()]/g, '');
    const cleanComponent = componentName.toLowerCase().replace(/[()]/g, '');
    if (cleanSearch.includes(cleanComponent.split(' ')[0]) || cleanComponent.includes(cleanSearch.split(' ')[0])) {
      foundMatch = true;
    }
    
    if (foundMatch) {
      console.log(`       ✓ Matched component: "${componentName}"`);
      
      // Extract pin name by removing component-related words
      let pinName = pointStr;
      
      // Remove component name variations
      pinName = pinName.replace(new RegExp(componentName, 'gi'), '').trim();
      pinName = pinName.replace(/arduino\s*/gi, '').trim();
      pinName = pinName.replace(/nano\s*/gi, '').trim();
      pinName = pinName.replace(/led\s*/gi, '').trim();
      pinName = pinName.replace(/\(red\)\s*/gi, '').trim();
      pinName = pinName.replace(/\(green\)\s*/gi, '').trim();
      pinName = pinName.replace(/red\s*/gi, '').trim();
      pinName = pinName.replace(/green\s*/gi, '').trim();
      
      console.log(`       🔌 Looking for pin: "${pinName}"`);
      
      const absolutePins = layoutData.absolutePins;
      
      // Try to find exact pin match (case-insensitive)
      for (const [pin, position] of absolutePins.entries()) {
        if (pinName.toLowerCase() === pin.toLowerCase() ||
            pinName.toLowerCase().includes(pin.toLowerCase()) || 
            pin.toLowerCase().includes(pinName.toLowerCase())) {
          console.log(`       ✅ Found pin: ${pin}`);
          return {
            component: componentName,
            pin: pin,
            x: position.x,
            y: position.y
          };
        }
      }
      
      // Try partial match (for pins like "D13" matching "13")
      for (const [pin, position] of absolutePins.entries()) {
        const pinDigits = pin.match(/\d+/);
        const searchDigits = pinName.match(/\d+/);
        if (pinDigits && searchDigits && pinDigits[0] === searchDigits[0]) {
          console.log(`       ✅ Found pin by number: ${pin}`);
          return {
            component: componentName,
            pin: pin,
            x: position.x,
            y: position.y
          };
        }
      }
      
      // If no pin found, use first available pin as fallback
      const firstPin = Array.from((absolutePins as Map<string, { x: number; y: number }>).entries())[0] as [string, { x: number; y: number }] | undefined;
      if (firstPin) {
        console.log(`       ⚠️  Using default pin: ${firstPin[0]}`);
        return {
          component: componentName,
          pin: firstPin[0],
          x: firstPin[1].x,
          y: firstPin[1].y
        };
      }
    }
  }
  
  console.log(`       ❌ No component matched for: "${pointStr}"`);
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
    
    // Add more padding and set reasonable limits
    const canvasWidth = Math.min(maxX + 200, 2000);  // Max 2000px
    const canvasHeight = Math.min(maxY + 250, 1500); // Max 1500px
    
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
  
  <!-- Components Layer -->
  <g id="components">
  `;
  
    // Draw components using their actual SVGs
    for (const [componentName, layoutData] of layout.entries()) {
      svg += this.embedComponentSVG(componentName, layoutData);
    }
  
    svg += `  </g>
  
  <!-- Wires Layer -->
  <g id="wires">
  `;

    // Draw wires
    for (const wire of wires) {
      svg += this.drawWire(wire);
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
  /**
 * Draw wire connection
 */
private drawWire(wire: ConnectionWire): string {
  const { from, to, color } = wire;
  
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  let path = '';
  
  // Smart routing based on relative positions
  if (Math.abs(dy) < 50) {
    // Nearly horizontal - use gentle curve
    const curvature = distance * 0.25;
    path = `M ${from.x} ${from.y} C ${from.x + curvature} ${from.y}, ${to.x - curvature} ${to.y}, ${to.x} ${to.y}`;
  } else if (Math.abs(dx) < 50) {
    // Nearly vertical - use gentle curve
    const curvature = distance * 0.25;
    path = `M ${from.x} ${from.y} C ${from.x} ${from.y + curvature}, ${to.x} ${to.y - curvature}, ${to.x} ${to.y}`;
  } else {
    // Diagonal - use orthogonal routing (right angles)
    const midY = (from.y + to.y) / 2;
    path = `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;
  }
  
  const safeLabel = wire.label
    .replace(/&/g, '&amp;')
    .replace(/Ω/g, '&#937;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  
  return `
    <!-- Wire: ${safeLabel} -->
    
    <!-- Wire glow effect -->
    <path d="${path}" 
          stroke="${color}" 
          stroke-width="8" 
          fill="none"
          stroke-linecap="round"
          opacity="0.15"
          filter="blur(3px)"/>
    
    <!-- Wire shadow -->
    <path d="${path}" 
          stroke="#00000020" 
          stroke-width="5" 
          fill="none"
          stroke-linecap="round"
          transform="translate(2, 2)"/>
    
    <!-- Main wire -->
    <path d="${path}" 
          stroke="${color}" 
          stroke-width="4" 
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"/>
    
    <!-- Connection dots with glow -->
    <circle cx="${from.x}" cy="${from.y}" r="8" fill="${color}" opacity="0.3"/>
    <circle cx="${from.x}" cy="${from.y}" r="5" fill="${color}" stroke="#FFF" stroke-width="2"/>
    
    <circle cx="${to.x}" cy="${to.y}" r="8" fill="${color}" opacity="0.3"/>
    <circle cx="${to.x}" cy="${to.y}" r="5" fill="${color}" stroke="#FFF" stroke-width="2"/>
`;
}

  /**
   * Embed actual component SVG at specified position
   */
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
  
  // Escape special characters in component name for XML safety
  const safeComponentName = componentName
    .replace(/&/g, '&amp;')
    .replace(/Ω/g, '&#937;')  // Omega symbol
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  
  // Clean ID (remove ALL special characters)
  const cleanId = componentName
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '');  // Only keep word characters and underscores
  
  return `
  <!-- Component: ${safeComponentName} -->
  <g id="${cleanId}" transform="translate(${x}, ${y})">
    <!-- Component Background (subtle) -->
    <rect x="-5" y="-5" width="${component.width + 10}" height="${component.height + 10}" 
          fill="#FFFFFF" stroke="#DDD" stroke-width="1" rx="5" opacity="0.5"/>
    
    <!-- Actual Component SVG -->
   <!-- Actual Component SVG (scaled if needed) -->
    <g transform="scale(${component.width / component.originalWidth || 1}, ${component.height / component.originalHeight || 1})">
      ${svgContent}
    </g>
    <!-- Component Label -->
    <text x="${component.width / 2}" y="${component.height + 20}" 
          font-size="12" font-family="Arial" font-weight="bold"
          text-anchor="middle" fill="#333">
      ${safeComponentName}
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
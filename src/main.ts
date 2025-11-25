// FILE: src/main.ts
import dotenv from "dotenv";
import { VectorStoreManager } from "./vectorStore.js";
import { CircuitLoader } from "./circuitLoader.js";
import { ComponentLoader } from "./componentLoader.js";
import { CircuitRAGChain } from "./ragChain.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ES Module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

class CircuitRAGSystem {
  private vectorStore: VectorStoreManager;
  private circuitLoader: CircuitLoader;
  private componentLoader: ComponentLoader;
  private ragChain: CircuitRAGChain;

  constructor() {
    const circuitsPath = path.join(__dirname, "..", "data", "circuits");
    const componentsPath = path.join(__dirname, "..", "data", "components");
    
    this.vectorStore = new VectorStoreManager();
    this.circuitLoader = new CircuitLoader(circuitsPath);
    this.componentLoader = new ComponentLoader(componentsPath);
    this.ragChain = new CircuitRAGChain(this.vectorStore);
  }

  async initialize(): Promise<void> {
    console.log("\n🚀 Starting Circuit RAG System...\n");

    try {
      console.log("📦 Step 1: Initializing vector store...");
      await this.vectorStore.initialize();

      console.log("\n📚 Step 2: Loading circuit projects...");
      const circuitDocs = await this.circuitLoader.loadCircuits();

      console.log("\n🔧 Step 3: Loading components library...");
      const componentDocs = await this.componentLoader.loadComponents();

      const totalDocs = circuitDocs.length + componentDocs.length;
      
      if (totalDocs > 0) {
        console.log("\n💾 Step 4: Adding to vector store...");
        const allDocs = [...circuitDocs, ...componentDocs];
        await this.vectorStore.addCircuitDocuments(allDocs);
        console.log(`   ✅ Loaded ${circuitDocs.length} circuits + ${componentDocs.length} components`);
      } else {
        console.log("\n⚠️  WARNING: No circuits or components loaded!");
      }

      console.log("\n🔗 Step 5: Initializing RAG chain...");
      await this.ragChain.initialize();

      console.log("\n✅ Circuit RAG System is ready!\n");
      console.log("=".repeat(50));
    } catch (error) {
      console.error("\n❌ Error initializing system:", error);
      throw error;
    }
  }

  async runTests(): Promise<void> {
    console.log("\n🧪 Running Test Queries...\n");

    const testQueries = [
      "How do I make an LED blink with Arduino?",
      "What is Arduino Nano?",
      "Build an ultrasonic distance detector",
      "What components does HC-SR04 have?",
      "Show me a circuit with red and green LEDs",
      "Tell me about 220 ohm resistor",
    ];

    for (const query of testQueries) {
      console.log(`\n${"=".repeat(70)}`);
      console.log(`❓ QUESTION: ${query}`);
      console.log("=".repeat(70));

      try {
        const result = await this.ragChain.query(query);
        
        console.log("\n💡 ANSWER:");
        console.log(result.answer);
        
        console.log("\n📋 RELEVANT ITEMS:");
        result.relevantCircuits.forEach((item, idx) => {
          const type = item.metadata?.type || 'unknown';
          console.log(`  ${idx + 1}. [${type.toUpperCase()}] ${item.name}`);
          if (item.category) {
            console.log(`     Category: ${item.category}`);
          }
          if (item.svgPath) {
            console.log(`     📊 Diagram: ${item.svgPath}`);
          }
        });
      } catch (error) {
        console.error("Error processing query:", error);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async query(question: string): Promise<any> {
    return await this.ragChain.query(question);
  }

  async getAllCircuits() {
    return await this.circuitLoader.getAllCircuits();
  }

  async getAllComponents() {
    return await this.componentLoader.getAllComponents();
  }

  async getAll() {
    const circuits = await this.circuitLoader.getAllCircuits();
    const components = await this.componentLoader.getAllComponents();
    return { circuits, components };
  }

  async *streamQuery(question: string): AsyncGenerator<string> {
    yield* this.ragChain.streamQuery(question);
  }
}

async function main() {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
      console.error("\n❌ ERROR: Please set your OPENAI_API_KEY in the .env file\n");
      console.log("1. Copy .env.example to .env");
      console.log("2. Add your OpenAI API key to the .env file");
      console.log("3. Run the application again\n");
      process.exit(1);
    }

    const system = new CircuitRAGSystem();
    await system.initialize();
    // await system.runTests();

    console.log("\n\n✅ System is running! You can now:");
    console.log("  • Connect the frontend to query this backend");
    console.log("  • Add more circuit data to data/circuits/");
    console.log("  • Modify the RAG chain for better responses\n");

  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

export { CircuitRAGSystem };

// Always run main when this file is executed
main();
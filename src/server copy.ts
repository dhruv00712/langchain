// src/server.ts - Express API Server for Arduino Circuit RAG System
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { CircuitRAGSystem } from "./main.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from output directory
app.use('/output', express.static(path.join(process.cwd(), 'output')));

// Initialize the RAG system
let ragSystem: CircuitRAGSystem | null = null;

async function initializeSystem() {
  console.log("🚀 Initializing Arduino Circuit RAG System...");
  ragSystem = new CircuitRAGSystem();
  await ragSystem.initialize();
  console.log("✅ System ready!");
}

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Arduino Circuit RAG API is running",
    timestamp: new Date().toISOString(),
  });
});

// Query endpoint - Main RAG query
app.post("/api/query", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
        message: "Please wait for the system to start",
      });
    }

    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Please provide a 'question' field in the request body",
      });
    }

    console.log(`\n📝 Query received: ${question}`);

    const result = await ragSystem.query(question);

    // AUTO-GENERATE CIRCUIT DIAGRAM if circuit is found!
    if (result.relevantCircuits && result.relevantCircuits.length > 0) {
      const firstItem = result.relevantCircuits[0];
      
      // Check if it's a circuit (not component)
      if (firstItem.type === "circuit" && firstItem.metadata) {
        try {
          // Import the ADVANCED assembler (uses real component SVGs!)
          const { AdvancedCircuitAssembler } = await import("./advancedCircuitAssembler.js");
          const componentsPath = path.join(process.cwd(), 'data', 'components');
          const assembler = new AdvancedCircuitAssembler(componentsPath);
          
          // Get full circuit data
          const circuits = await ragSystem.getAllCircuits();
          const circuit = circuits.find(c => c.name === firstItem.name);
          
          if (circuit && circuit.componentsUsed && circuit.connections) {
            // Generate diagram filename
            const diagramFilename = circuit.name.replace(/\s+/g, '_').replace(/[()]/g, '') + '.svg';
            const diagramPath = path.join(process.cwd(), 'output', diagramFilename);
            
            // Ensure output directory exists
            await fs.mkdir(path.join(process.cwd(), 'output'), { recursive: true });
            
            // Generate the diagram using REAL component SVGs!
            await assembler.generateCircuit(
              circuit.name,
              circuit.componentsUsed,
              circuit.connections,
              diagramPath
            );
            
            // Add diagram path to result
            result.generatedDiagram = `/output/${diagramFilename}`;
            console.log(`✅ Generated circuit diagram with real component SVGs: ${diagramFilename}`);
          }
        } catch (error) {
          console.error("Error generating diagram:", error);
          // Continue anyway - diagram generation is optional
        }
      }
    }

    res.json({
      success: true,
      question,
      answer: result.answer,
      relevantCircuits: result.relevantCircuits,
      generatedDiagram: result.generatedDiagram || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error processing query:", error);
    res.status(500).json({
      error: "Query processing failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Streaming query endpoint
app.post("/api/query/stream", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
      });
    }

    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Invalid request",
      });
    }

    // Set headers for SSE (Server-Sent Events)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    console.log(`\n📝 Streaming query: ${question}`);

    // Stream the response
    for await (const chunk of ragSystem.streamQuery(question)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Error in streaming query:", error);
    res.status(500).json({
      error: "Streaming failed",
    });
  }
});

// Get all circuits
app.get("/api/circuits", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
      });
    }

    const circuits = await ragSystem.getAllCircuits();

    res.json({
      success: true,
      count: circuits.length,
      circuits: circuits.map(circuit => ({
        name: circuit.name,
        description: circuit.description,
        category: circuit.category,
        componentsUsed: circuit.componentsUsed,
        svgPath: circuit.svgPath,
      })),
    });
  } catch (error) {
    console.error("Error getting circuits:", error);
    res.status(500).json({
      error: "Failed to retrieve circuits",
    });
  }
});

// Get all components
app.get("/api/components", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
      });
    }

    const components = await ragSystem.getAllComponents();

    res.json({
      success: true,
      count: components.length,
      components: components.map(comp => ({
        name: comp.name,
        description: comp.description,
        category: comp.category,
        svgPath: comp.svgPath,
        technicalSpecifications: comp.technicalSpecifications,
      })),
    });
  } catch (error) {
    console.error("Error getting components:", error);
    res.status(500).json({
      error: "Failed to retrieve components",
    });
  }
});

// Get all (circuits + components)
app.get("/api/all", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
      });
    }

    const data = await ragSystem.getAll();

    res.json({
      success: true,
      circuits: data.circuits.length,
      components: data.components.length,
      total: data.circuits.length + data.components.length,
      data: data,
    });
  } catch (error) {
    console.error("Error getting all data:", error);
    res.status(500).json({
      error: "Failed to retrieve data",
    });
  }
});

// Get specific circuit by name
app.get("/api/circuits/:name", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
      });
    }

    const circuits = await ragSystem.getAllCircuits();
    const circuit = circuits.find(c =>
      c.name.toLowerCase().includes(req.params.name.toLowerCase())
    );

    if (!circuit) {
      return res.status(404).json({
        error: "Circuit not found",
        message: `No circuit found matching: ${req.params.name}`,
      });
    }

    res.json({
      success: true,
      circuit,
    });
  } catch (error) {
    console.error("Error getting circuit:", error);
    res.status(500).json({
      error: "Failed to retrieve circuit",
    });
  }
});

// Get circuit categories
app.get("/api/categories", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
      });
    }

    const circuits = await ragSystem.getAllCircuits();
    const categories = [...new Set(circuits.map(c => c.category))];

    res.json({
      success: true,
      categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({
      error: "Failed to retrieve categories",
    });
  }
});

// Search circuits by keyword
app.get("/api/search", async (req: Request, res: Response) => {
  try {
    if (!ragSystem) {
      return res.status(503).json({
        error: "System not initialized",
      });
    }

    const { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Please provide a 'q' query parameter",
      });
    }

    const circuits = await ragSystem.getAllCircuits();
    const results = circuits.filter(circuit =>
      circuit.name.toLowerCase().includes(q.toLowerCase()) ||
      circuit.description.toLowerCase().includes(q.toLowerCase()) ||
      circuit.category.toLowerCase().includes(q.toLowerCase())
    );

    res.json({
      success: true,
      query: q,
      count: results.length,
      results: results.map(circuit => ({
        name: circuit.name,
        description: circuit.description,
        category: circuit.category,
      })),
    });
  } catch (error) {
    console.error("Error searching circuits:", error);
    res.status(500).json({
      error: "Search failed",
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Start server
async function startServer() {
  try {
    // Initialize the RAG system first
    await initializeSystem();

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`\n🌐 Server running on http://localhost:${PORT}`);
      console.log(`\n📚 API Endpoints:`);
      console.log(`   GET  /api/health          - Health check`);
      console.log(`   POST /api/query           - Ask a question`);
      console.log(`   POST /api/query/stream    - Streaming query`);
      console.log(`   GET  /api/circuits        - Get all circuits`);
      console.log(`   GET  /api/circuits/:name  - Get specific circuit`);
      console.log(`   GET  /api/categories      - Get all categories`);
      console.log(`   GET  /api/search?q=...    - Search circuits`);
      console.log(`\n✅ Ready to accept requests!\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();

export { app };
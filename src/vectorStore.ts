// src/vectorStore.ts - Embedded ChromaDB Version
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

export class VectorStoreManager {
  private vectorStore: Chroma | null = null;
  private embeddings: OpenAIEmbeddings;
  private collectionName: string = "circuit_knowledge";

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });
  }

  /**
   * Initialize ChromaDB vector store (embedded mode - no server needed!)
   */
  async initialize(): Promise<void> {
    try {
      console.log("Initializing embedded ChromaDB...");
      
      // Use embedded ChromaDB - no server required!
      this.vectorStore = await Chroma.fromExistingCollection(
        this.embeddings,
        {
          collectionName: this.collectionName,
          // Remove URL - uses embedded mode
        }
      );

      console.log("✅ Vector store initialized (embedded mode)");
    } catch (error) {
      console.log("Creating new ChromaDB collection (embedded)...");
      
      // Create new collection in embedded mode
      this.vectorStore = await Chroma.fromDocuments(
        [new Document({ pageContent: "Circuit knowledge base initialized" })],
        this.embeddings,
        {
          collectionName: this.collectionName,
          // No URL needed - uses local storage
        }
      );
      
      console.log("✅ New vector store created (embedded mode)");
    }
  }

  /**
   * Add circuit documents to vector store
   */
  async addCircuitDocuments(documents: Document[]): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized. Call initialize() first.");
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(documents);
    await this.vectorStore.addDocuments(splitDocs);
    
    console.log(`✅ Added ${splitDocs.length} document chunks to vector store`);
  }

  /**
   * Search for relevant circuit information
   */
  async searchCircuits(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }

    const results = await this.vectorStore.similaritySearch(query, k);
    return results;
  }

  /**
   * Get vector store instance
   */
  getVectorStore(): Chroma {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized");
    }
    return this.vectorStore;
  }
}
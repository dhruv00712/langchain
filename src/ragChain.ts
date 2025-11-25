import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import { VectorStoreManager } from "./vectorStore.js";

export class CircuitRAGChain {
  private llm: ChatOpenAI;
  private vectorStore: VectorStoreManager;
  private chain: RunnableSequence | null = null;

  constructor(vectorStore: VectorStoreManager) {
    this.vectorStore = vectorStore;

    this.llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Initialize the RAG chain with electrical/electronics-focused prompt
   */
  async initialize(): Promise<void> {
    const promptTemplate = PromptTemplate.fromTemplate(`
You are **ElectroGPT**, a highly knowledgeable electrical and electronics expert.

🧠 BEHAVIOR RULES:
- Be conversational, friendly, and professional.
- If the question is casual (like greetings or personal questions) → reply normally.
- If it's technical → provide step-by-step expert guidance using ONLY the provided context.
- If required context is missing → reply with:  
  "I don’t have enough information in my knowledge base to answer that."
- Never hallucinate or guess.
- Include wiring, safety, formulas, Arduino code, etc., when relevant.

📘 CONTEXT:
{context}

❓ USER QUESTION:
{question}

🛠 EXPERT RESPONSE:
`);

    this.chain = RunnableSequence.from([
      {
        context: async (input: { question: string }) => {
          const docs = await this.vectorStore.searchCircuits(input.question, 4);
          return this.formatDocuments(docs);
        },
        question: new RunnablePassthrough(),
      },
      promptTemplate,
      this.llm,
      new StringOutputParser(),
    ]);

    console.log("🚀 ElectroGPT RAG chain initialized successfully!");
  }

  /**
   * Format documents into readable context
   */
  private formatDocuments(docs: Document[]): string {
    if (!docs.length) return "No relevant documents found in knowledge base.";
    return docs
      .map((doc, index) => {
        const metadata = doc.metadata;
        return `
============================================================
ITEM ${index + 1}: ${metadata.name || "Unknown"}
Type: ${metadata.type || "Unknown"}
Category: ${metadata.category || "General"}
SVG: ${metadata.svgPath || "Not available"}
============================================================

${doc.pageContent}
        `;
      })
      .join("\n\n");
  }

  /**
   * Query with intent detection (technical vs general)
   */
  async query(question: string): Promise<{ answer: string; relevantCircuits: any[] }> {
    if (!this.chain) {
      throw new Error("RAG chain not initialized. Call initialize() first.");
    }

    try {
      // STEP 1: Classify question
      const intentCheck = await this.llm.invoke([
        {
          role: "system",
          content:
            "Classify this user message. Reply only with 'technical' if it's related to electronics, Arduino, circuits, wiring, sensors, engineering. If it's a general/casual question, reply 'casual'.",
        },
        { role: "user", content: question },
      ]);

      const intent = intentCheck.content?.toString().trim().toLowerCase();
      const isTechnical = intent.includes("technical");

      // STEP 2: General question (not technical)
      if (!isTechnical) {
        const generalResponse = await this.llm.invoke([
          {
            role: "system",
            content:
              "Respond as a friendly AI assistant without technical depth. Keep it simple and conversational.",
          },
          { role: "user", content: question },
        ]);

        return {
          answer: `${generalResponse.content}\n\n⚡ *Note:* I specialize in electrical and electronics engineering.`,
          relevantCircuits: [],
        };
      }

      // STEP 3: Technical → RAG with knowledge base
      const answer = await this.chain.invoke({ question });
      const answerText = typeof answer === "string" ? answer : (answer as any)?.content ?? "Error processing answer.";

      const relevantDocs = await this.vectorStore.searchCircuits(question, 3);

      if (!relevantDocs.length) {
        return {
          answer:
            "🔎 I tried to find relevant technical details in your knowledge base, but none were available.\n" +
            "You may need to provide more information or update the knowledge base.",
          relevantCircuits: [],
        };
      }

      return {
        answer: answerText,
        relevantCircuits: relevantDocs.map((doc) => ({
          name: doc.metadata.name || "Unknown",
          type: doc.metadata.type || "unknown",
          category: doc.metadata.category || "General",
          svgPath: doc.metadata.svgPath || null, // ⚠ Helps you display circuit image
          description: doc.metadata.description || "",
          metadata: doc.metadata,
        })),
      };
    } catch (error) {
      console.error("❌ Error in RAG query:", error);
      throw error;
    }
  }

  /**
   * Streaming response for chat UI
   */
  async *streamQuery(question: string): AsyncGenerator<string> {
    if (!this.chain) throw new Error("RAG chain not initialized.");

    try {
      const stream = await this.chain.stream({ question });
      for await (const chunk of stream) yield chunk;
    } catch (error) {
      console.error("⚠ Error in streaming response:", error);
      throw error;
    }
  }
}

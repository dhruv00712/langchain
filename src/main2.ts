// main.ts - Interactive LangChain Chatbot
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";
import * as readline from "readline";

// Load environment variables
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY not found in .env file");
}

// Define tools
const getWeatherTool = new DynamicStructuredTool({
  name: "get_weather",
  description: "Get the weather for a given city",
  schema: z.object({
    city: z.string().describe("The city name to get weather for"),
  }),
  func: async ({ city }: { city: string }) => {
    return `The weather in ${city} is sunny with a temperature of 25°C! ☀️`;
  },
});

const calculatorTool = new DynamicStructuredTool({
  name: "calculator",
  description: "Perform basic math calculations",
  schema: z.object({
    expression: z.string().describe("The math expression to calculate (e.g., '5 + 3')"),
  }),
  func: async ({ expression }: { expression: string }) => {
    try {
      // Simple eval for basic math (in production, use a proper math parser)
      const result = eval(expression);
      return `The result is: ${result}`;
    } catch (error) {
      return "Sorry, I couldn't calculate that.";
    }
  },
});

// Initialize model with tools
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const modelWithTools = model.bindTools([getWeatherTool, calculatorTool]);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to ask question and get answer
function askQuestion(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// Process user message
async function processMessage(userMessage: string) {
  try {
    console.log("\n🤖 AI is thinking...\n");

    const response = await modelWithTools.invoke([
      {
        role: "user",
        content: userMessage,
      },
    ]);

    // Check if AI wants to use tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log("🔧 Using tools...\n");

      // Execute all tool calls
      for (const toolCall of response.tool_calls) {
        let result = "";

        if (toolCall.name === "get_weather") {
          result = await getWeatherTool.invoke({
            city: toolCall.args.city as string,
          });
        } else if (toolCall.name === "calculator") {
          result = await calculatorTool.invoke({
            expression: toolCall.args.expression as string,
          });
        }

        console.log(`📍 Tool: ${toolCall.name}`);
        console.log(`📊 Result: ${result}\n`);

        // Get final response with tool results
        const finalResponse = await model.invoke([
          {
            role: "user",
            content: userMessage,
          },
          {
            role: "assistant",
            content: response.content,
            tool_calls: response.tool_calls,
          },
          {
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          },
        ]);

        console.log("💬 AI:", finalResponse.content, "\n");
      }
    } else {
      // Direct response without tools
      console.log("💬 AI:", response.content, "\n");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Main interactive loop
async function main() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   🤖 Interactive AI Chatbot          ║");
  console.log("║   Type 'exit' or 'quit' to stop      ║");
  console.log("╚═══════════════════════════════════════╝\n");

  console.log("Available commands:");
  console.log("  • Ask about weather: 'What's the weather in Paris?'");
  console.log("  • Do math: 'Calculate 25 * 4'");
  console.log("  • General chat: 'Tell me a joke'\n");

  while (true) {
    const userInput = await askQuestion("You: ");

    // Check for exit commands
    if (
      userInput.toLowerCase() === "exit" ||
      userInput.toLowerCase() === "quit"
    ) {
      console.log("\n👋 Goodbye! Thanks for chatting!\n");
      rl.close();
      break;
    }

    // Check for empty input
    if (!userInput.trim()) {
      console.log("⚠️  Please enter a message.\n");
      continue;
    }

    // Process the message
    await processMessage(userInput);
  }
}

// Run the chatbot
main();
#!/bin/bash

echo "🚀 Starting Circuit RAG System..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env 2>/dev/null || echo "OPENAI_API_KEY=your_key_here" > .env
    echo "⚠️  Please edit .env and add your OpenAI API key"
    echo ""
fi

# Check if ChromaDB is running
echo "🔍 Checking if ChromaDB is running on port 8000..."
if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
    echo "✅ ChromaDB is running!"
else
    echo "❌ ChromaDB is not running!"
    echo ""
    echo "Please start ChromaDB first:"
    echo "  Option 1 (Docker): docker run -p 8000:8000 chromadb/chroma"
    echo "  Option 2 (Python): chroma run --path ./data/vector-db"
    echo ""
    exit 1
fi

echo ""
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo ""
echo "🏃 Starting the backend..."
npm run dev
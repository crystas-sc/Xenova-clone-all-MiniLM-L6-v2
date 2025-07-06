// Import required dependencies
const { ChromaClient } = require('chromadb'); // ChromaDB for vector storage
const fs = require('fs').promises; // File system for reading files
const path = require('path'); // Path utilities for file handling

// Configuration constants
const CODE_DIR = './code_files'; // Directory containing code files to index
const COLLECTION_NAME = 'code_vectors'; // Name of the ChromaDB collection
const MODEL_NAME = 'all-MiniLM-L6-v2'; // Local transformer model for embeddings
const MAX_RESULTS = 5; // Number of search results to return

// Initialize ChromaDB client for vector database operations
const client = new ChromaClient({ host: 'localhost', port: 8000, ssl: false });

// Function to read code files and split into lines with metadata
async function readCodeFiles(directory) {
  try {
    // Read all files in the directory
    const files = await fs.readdir(directory);
    const codeData = [];

    // Process each file
    for (const file of files) {
      // Filter for .js, .py, and .txt files (modify as needed)
      if (file.endsWith('.js') || file.endsWith('.py') || file.endsWith('.txt')) {
        const filePath = path.join(directory, file);
        // Read file content
        const content = await fs.readFile(filePath, 'utf-8');
        // Split into lines and create metadata
        const lines = content.split('\n').map((line, index) => ({
          content: line.trim(), // Trim whitespace
          file,
          lineNumber: index + 1 // Line numbers start at 1
        }));
        // Add non-empty lines to codeData
        codeData.push(...lines.filter(line => line.content));
      }
    }
    return codeData;
  } catch (error) {
    console.error('Error reading code files:', error);
    return [];
  }
}

// Function to generate embeddings using HTTP API (curl equivalent)
async function generateEmbeddings(texts) {
  try {
    const embeddings = [];
    for (const text of texts) {
      const response = await fetch(
        'http://127.0.0.1:8080/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: [text] })
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Always take the first embedding from the batch
      const embedding = Array.isArray(data) ? data[0] : data.embeddings[0];
      embeddings.push(embedding);
    }
    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

// Function to store code lines in ChromaDB
async function storeCodeInVectorDB() {
  try {
    // Create or get the ChromaDB collection
    const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });

    // Read code files and extract lines
    const codeData = await readCodeFiles(CODE_DIR);
    if (codeData.length === 0) {
      console.log('No code files found to index.');
      return;
    }

    // Extract text content for embeddings
    const texts = codeData.map(data => data.content);
    console.log(` Texts:  ${texts}`); // Log first 5 lines for debugging

    // Generate embeddings for all lines
    const embeddings = await generateEmbeddings(texts);
    // Flatten embeddings to 1D arrays if needed
    const flatEmbeddings = embeddings.map(e =>
      Array.isArray(e[0]) && Array.isArray(e[0][0]) ? e[0][0] : Array.isArray(e[0]) ? e[0] : e
    );
    // Debug: log embedding length and example
    console.log('Stored embedding length:', flatEmbeddings[0]?.length);
    console.log('Stored embedding example:', flatEmbeddings[0]);

    // Prepare data for ChromaDB
    const ids = codeData.map((_, index) => `line_${index}`);
    const metadatas = codeData.map(data => ({
      file: data.file,
      lineNumber: data.lineNumber
    }));

    // Debug: log lengths
    console.log('ids:', ids.length, 'embeddings:', embeddings.length, 'texts:', texts.length, 'metadatas:', metadatas.length);
    if (
      ids.length !== embeddings.length ||
      ids.length !== texts.length ||
      ids.length !== metadatas.length
    ) {
      throw new Error(
        `Mismatched lengths: ids=${ids.length}, embeddings=${embeddings.length}, texts=${texts.length}, metadatas=${metadatas.length}`
      );
    }

    // Store embeddings, metadata, and documents in ChromaDB
    await collection.add({
      ids,
      embeddings: flatEmbeddings,
      metadatas,
      documents: texts
    });

    console.log(`Stored ${codeData.length} lines in vector database.`);
  } catch (error) {
    console.error('Error storing code in vector DB:', error);
  }
}

// Function to search for code matches
async function searchCode(query, nResults = MAX_RESULTS) {
  try {
    // Generate embedding for the query
    const queryEmbeddingArr = await generateEmbeddings([query]);
    const flatQueryEmbedding = [
      Array.isArray(queryEmbeddingArr[0][0]) && Array.isArray(queryEmbeddingArr[0][0][0])
        ? queryEmbeddingArr[0][0][0]
        : Array.isArray(queryEmbeddingArr[0][0])
          ? queryEmbeddingArr[0][0]
          : queryEmbeddingArr[0]
    ];
    console.log('Query embedding length:', flatQueryEmbedding[0]?.length);
    console.log('Query embedding example:', flatQueryEmbedding[0]);

    // Get the ChromaDB collection
    const collection = await client.getCollection({ name: COLLECTION_NAME });

    // Query the vector database
    const results = await collection.query({
      queryEmbeddings: flatQueryEmbedding,
      nResults
    });

    // Format results with filename, line number, content, and similarity score
    const matches = results.metadatas[0].map((metadata, index) => ({
      file: metadata.file,
      lineNumber: metadata.lineNumber,
      content: results.documents[0][index],
      distance: results.distances[0][index] // Lower distance = better match
    }));

    return matches;
  } catch (error) {
    console.error('Error searching code:', error);
    return [];
  }
}

// Main function to demonstrate indexing and searching
async function main() {
  // Step 1: Index code files
  console.log('Indexing code files...');
  await storeCodeInVectorDB();

  // Step 2: Perform a sample search
  const query = 'function factorial'; // Example query
  console.log(`\nSearching for: "${query}"`);
  const matches = await searchCode(query);

  // Step 3: Display results
  if (matches.length === 0) {
    console.log('No matches found.');
  } else {
    console.log('\nSearch Results:');
    matches.forEach(match => {
      console.log(`File: ${match.file}, Line: ${match.lineNumber}, Content: ${match.content}, Distance: ${match.distance.toFixed(3)}`);
    });
  }
}

// Run the main function and handle errors
main().catch(error => {
  console.error('Main function error:', error);
});
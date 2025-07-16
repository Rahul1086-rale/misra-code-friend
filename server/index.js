const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const { VertexAI } = require('@google-cloud/vertexai');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: 'rock-range-464908-g5',
  location: 'global'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// Storage configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const projectId = req.body.projectId || uuidv4();
    const uploadPath = path.join(__dirname, 'uploads', 'projects', projectId);
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// In-memory session storage
const sessions = new Map();

// Utility function to run Python scripts
function runPythonScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const python = spawn('python', [scriptPath, ...args]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Python script failed: ${stderr}`));
      }
    });
  });
}

// API Routes

// Upload C++ file
app.post('/api/upload/cpp-file', upload.single('file'), async (req, res) => {
  try {
    const projectId = req.body.projectId || uuidv4();
    const filePath = req.file.path;
    const fileName = req.file.filename;
    
    // Create numbered version
    const numberedPath = path.join(path.dirname(filePath), `numbered_${fileName}`);
    await runPythonScript(path.join(__dirname, 'python', 'numbering.py'), [filePath, numberedPath]);
    
    // Create working version
    const workingPath = path.join(path.dirname(filePath), 'working_v0.cpp');
    await fs.copyFile(numberedPath, workingPath);
    
    // Update session
    const session = {
      projectId,
      originalFile: fileName,
      numberedFile: `numbered_${fileName}`,
      currentVersion: 'v0',
      workingFile: 'working_v0.cpp',
      violations: [],
      chatHistory: [],
      appliedFixes: []
    };
    
    sessions.set(projectId, session);
    
    res.json({
      success: true,
      projectId,
      session,
      numberedContent: await fs.readFile(numberedPath, 'utf-8')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload MISRA report
app.post('/api/upload/misra-report', upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.body;
    const session = sessions.get(projectId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const filePath = req.file.path;
    const targetFile = session.originalFile;
    
    // Parse violations using Python script
    const violationsStr = await runPythonScript(
      path.join(__dirname, 'python', 'excel_utils.py'), 
      [filePath, targetFile]
    );
    
    const violations = JSON.parse(violationsStr);
    session.violations = violations;
    session.excelReport = req.file.filename;
    
    sessions.set(projectId, session);
    
    res.json({
      success: true,
      violations,
      session
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize Gemini chat
app.post('/api/gemini/init-file', async (req, res) => {
  try {
    const { projectId, modelSettings = {} } = req.body;
    const session = sessions.get(projectId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const projectPath = path.join(__dirname, 'uploads', 'projects', projectId);
    const workingFilePath = path.join(projectPath, session.workingFile);
    const fileContent = await fs.readFile(workingFilePath, 'utf-8');
    
    // Initialize Gemini model
    const model = vertexAI.getGenerativeModel({
      model: modelSettings.modelName || 'gemini-1.5-flash',
      generationConfig: {
        temperature: modelSettings.temperature || 0.5,
        topP: modelSettings.topP || 0.95,
        maxOutputTokens: modelSettings.maxTokens || 65535,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
      ],
    });
    
    const chat = model.startChat({
      history: session.chatHistory,
    });
    
    const introPrompt = `You are an expert C++ developer specializing in MISRA C++ compliance for AUTOSAR embedded systems. I am providing you with the complete content of a C++ source file. Each line of the file is prefixed with its original line number followed by a colon. Please acknowledge that you have received and processed this entire file. Do not start fixing anything yet. Just confirm its reception and readiness for the next input, by saying: 'FILE RECEIVED. READY FOR VIOLATIONS.'`;
    
    const result = await chat.sendMessage(introPrompt);
    const response1 = await chat.sendMessage(fileContent);
    
    // Update chat history
    session.chatHistory.push(
      { role: 'user', parts: [{ text: introPrompt }] },
      { role: 'model', parts: [{ text: result.response.text() }] },
      { role: 'user', parts: [{ text: fileContent }] },
      { role: 'model', parts: [{ text: response1.response.text() }] }
    );
    
    session.chatSession = chat;
    sessions.set(projectId, session);
    
    res.json({
      success: true,
      response: response1.response.text(),
      session
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix violations with streaming
app.post('/api/gemini/fix-violations', async (req, res) => {
  try {
    const { projectId, selectedViolations, feedback = '', modelSettings = {} } = req.body;
    const session = sessions.get(projectId);
    
    if (!session || !session.chatSession) {
      return res.status(404).json({ error: 'Session or chat not found' });
    }
    
    // Prepare violations text
    const violationsText = selectedViolations.map(v => 
      `File: ${v.File}\nPath: ${v.Path}\nLine: ${v.Line}\nRule: ${v.Misra}\nMessage: ${v.Warning}\n`
    ).join('\n');
    
    const prompt = `Thank you for confirming. The C++ file content you received previously is the current state of the file, which may have already undergone some fixes.

Now, I am providing you with a list of **specific, currently unresolved MISRA C++ violations** that need to be addressed in the file. **For each violation in this list, I require a fixed code snippet.**

Your task is to:
1. **Identify the specific code location** for each violation in the CURRENT MISRA Violations to Fix list within the C++ file you previously received.
2. **Apply the necessary MISRA C++ compliant fix** to that code.
3. **Provide ONLY the fixed C++ code snippet** for each violation. This snippet should be a small, relevant section of the code including the fix and enough surrounding context to clearly identify its position.

**Important Note on Previous Fixes:**
If a violation listed below is related to an issue you have previously fixed (e.g., a change to a macro definition that impacts multiple usage sites), and your analysis indicates that the *same type of fix* is still applicable for this new reported instance, please **re-provide the appropriate fixed code snippet** for this specific line. Do not state that it is "already addressed"; instead, act as if it's a new instance requiring the same solution.

Ensure all fixes:
* Strictly adhere to MISRA C++ guidelines.
* Preserve the original functionality.
* Maintain the existing coding style and formatting (indentation, braces, comments, etc.).
* **Do NOT introduce any new MISRA violations.**
* **Crucially, maintain the original line numbering prefix for each line in the fixed snippet.** Only modify the C++ code *after* the colon.
* **If you insert new lines, append lowercase letters to the line number (e.g., 123a:, 123b:).**
* **If a line's content should be removed or made empty as part of a fix, output only its line number followed by a colon (e.g., 123:). Do NOT omit the line number itself.**

${feedback ? `\n**Additional Feedback:**\n${feedback}\n` : ''}

---

**Output Instructions:**
Don't add \`...\` for non-fixed parts.
Give all changed/fixed lines in a single snippet for all violations.
If there are too many fixed snippets to fit into a single response due to output token limits, provide a partial set. After each response, if more snippets are remaining, explicitly state: \`--- CONTINUED ---\` and wait for my 'next' command to provide the next batch. Do not provide any more output until I type 'next'.
If you have provided all requested fixed snippets for this batch of violations, simply stop. Do NOT output \`--- CONTINUED ---\`.

---

Here is the list of violations to fix:

${violationsText}

---

Please begin`;

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
      const result = await session.chatSession.sendMessageStream(prompt);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      
      const response = await result.response;
      const fullText = response.text();
      
      // Update chat history
      session.chatHistory.push(
        { role: 'user', parts: [{ text: prompt }] },
        { role: 'model', parts: [{ text: fullText }] }
      );
      
      sessions.set(projectId, session);
      
      res.write(`data: ${JSON.stringify({ done: true, fullResponse: fullText })}\n\n`);
      res.end();
      
    } catch (streamError) {
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
      res.end();
    }
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply fixes
app.post('/api/apply-fixes', async (req, res) => {
  try {
    const { projectId, fixedSnippets } = req.body;
    const session = sessions.get(projectId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const projectPath = path.join(__dirname, 'uploads', 'projects', projectId);
    const currentVersion = parseInt(session.currentVersion.replace('v', ''));
    const newVersion = currentVersion + 1;
    
    const currentWorkingFile = path.join(projectPath, session.workingFile);
    const newWorkingFile = path.join(projectPath, `working_v${newVersion}.cpp`);
    
    // Create fixed snippets JSON file
    const snippetsPath = path.join(projectPath, 'temp_snippets.json');
    await fs.writeFile(snippetsPath, JSON.stringify(fixedSnippets, null, 2));
    
    // Apply fixes using Python script
    await runPythonScript(
      path.join(__dirname, 'python', 'replace.py'),
      [currentWorkingFile, snippetsPath, newWorkingFile]
    );
    
    // Update session
    session.currentVersion = `v${newVersion}`;
    session.workingFile = `working_v${newVersion}.cpp`;
    session.appliedFixes.push({
      version: `v${newVersion}`,
      fixes: fixedSnippets,
      timestamp: new Date().toISOString()
    });
    
    sessions.set(projectId, session);
    
    res.json({
      success: true,
      newVersion: `v${newVersion}`,
      session
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session state
app.get('/api/session-state/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const session = sessions.get(projectId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get file content
app.get('/api/project/:projectId/file-content/:filename', async (req, res) => {
  try {
    const { projectId, filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', 'projects', projectId, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Denumber file
app.post('/api/denumber-file', async (req, res) => {
  try {
    const { projectId } = req.body;
    const session = sessions.get(projectId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const projectPath = path.join(__dirname, 'uploads', 'projects', projectId);
    const workingFile = path.join(projectPath, session.workingFile);
    const finalFile = path.join(projectPath, 'final_output.cpp');
    
    await runPythonScript(
      path.join(__dirname, 'python', 'denumbering.py'),
      [workingFile, finalFile]
    );
    
    res.json({
      success: true,
      finalFile: 'final_output.cpp',
      downloadUrl: `/projects/${projectId}/final_output.cpp`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all sessions (for debugging)
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    projectId: session.projectId,
    originalFile: session.originalFile,
    currentVersion: session.currentVersion
  }));
  res.json({ sessions: sessionList });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
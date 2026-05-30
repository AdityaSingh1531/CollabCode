import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { code, language, prompt } = await req.json();

    if (!code || !code.trim()) {
      return NextResponse.json({ response: "📝 The code cell is empty. Please enter some code first to analyze!" });
    }

    const mistralKey = process.env.MISTRAL_API_KEY;
    
    // If the user has entered their Mistral API key, route to the real Codestral model!
    if (mistralKey && mistralKey !== 'your_mistral_api_key_here') {
      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${mistralKey}`
          },
          body: JSON.stringify({
            model: 'codestral-latest',
            messages: [
              {
                role: 'system',
                content: `You are an expert AI code analyzer embedded in a collaborative IDE. Your goal is to analyze, explain, debug, or optimize the provided code cell block. Respond concisely in Markdown format. The user's active code environment language is ${language || 'unknown'}.`
              },
              {
                role: 'user',
                content: `Here is the current code block:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nUser request regarding this code:\n${prompt || 'Please explain what this code does.'}`
              }
            ],
            temperature: 0.2
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiResponseText = data.choices?.[0]?.message?.content;
          if (aiResponseText) {
            return NextResponse.json({ response: aiResponseText });
          }
        } else {
          const errorMsg = await response.text();
          console.warn('Mistral API error, falling back to heuristic engine:', errorMsg);
        }
      } catch (apiErr) {
        console.error('Failed to query Mistral API, using local fallback:', apiErr);
      }
    }

    // Fallback heuristic engine if no API key is specified or call fails
    const responseText = generateAnalysis(code, language, prompt);
    return NextResponse.json({ response: responseText });
  } catch (err: any) {
    console.error('[/api/analyze] Error:', err);
    return NextResponse.json({ error: 'Failed to analyze code.' }, { status: 500 });
  }
}

function generateAnalysis(code: string, language: string, userPrompt?: string): string {
  const lines = code.split('\n');
  const importLines = lines.filter(l => l.includes('import') || l.includes('require'));
  const functions = lines.filter(l => l.includes('def ') || l.includes('function ') || l.includes('=>') || l.includes('class '));
  const loops = lines.filter(l => l.includes('for ') || l.includes('while ') || l.includes('.map(') || l.includes('.forEach('));
  const conditionals = lines.filter(l => l.includes('if ') || l.includes('else ') || l.includes('switch'));

  const promptText = userPrompt ? userPrompt.trim().toLowerCase() : '';

  // Tailored responses for common developer requests
  if (promptText.includes('bug') || promptText.includes('error') || promptText.includes('fix') || promptText.includes('issue')) {
    let feedback = `### Code Debugging Report (${language || 'unknown'})\n\n`;
    
    // Simple syntax checks
    const openBrackets = (code.match(/\{/g) || []).length;
    const closeBrackets = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    if (openBrackets !== closeBrackets) {
      feedback += `⚠️ **Syntax Warning**: Brackets are unbalanced! Found ${openBrackets} open \`{\` and ${closeBrackets} closed \`}\`.\n\n`;
    }
    if (openParens !== closeParens) {
      feedback += `⚠️ **Syntax Warning**: Parentheses are unbalanced! Found ${openParens} open \`(\` and ${closeParens} closed \`)\`.\n\n`;
    }

    if (code.includes('undefined') && !code.includes('typeof')) {
      feedback += `💡 **Tip**: Be careful when comparing directly against \`undefined\`. Use \`typeof x === "undefined"\` to prevent ReferenceErrors.\n\n`;
    }

    feedback += `**Logic & Structure Analysis**:\n`;
    feedback += `- The cell contains **${lines.length} lines** of code.\n`;
    if (loops.length > 0) {
      feedback += `- Identified ${loops.length} iteration loop(s). Check loop conditions to avoid infinite loops or out-of-bounds exceptions.\n`;
    }
    if (functions.length === 0) {
      feedback += `- *Advice*: The code is written as a flat script. Wrapping code in functions helps isolate variables and scope.\n`;
    }
    feedback += `\n**AI Recommendation**:\nReview variable scopes and outputs. Run the cell to confirm output details and ensure dependencies are imported correctly.`;
    return feedback;
  }

  if (promptText.includes('explain') || promptText.includes('how') || promptText.includes('what') || promptText === '') {
    let explanation = `### Code Walkthrough (${language || 'unknown'})\n\n`;
    
    explanation += `Here is a step-by-step breakdown of your code:\n\n`;
    if (importLines.length > 0) {
      explanation += `1. **Libraries**: You import external dependencies:\n\`\`\`\n${importLines.join('\n')}\n\`\`\`\n`;
    } else {
      explanation += `1. **Execution**: Starts direct execution without external imports.\n`;
    }

    if (functions.length > 0) {
      explanation += `2. **Definitions**: You define structural logic or utilities:\n${functions.map(f => `   - \`${f.trim()}\``).join('\n')}\n`;
    }

    if (loops.length > 0 || conditionals.length > 0) {
      explanation += `3. **Control Flow**: The cell uses loops or branch conditionals:\n`;
      if (loops.length > 0) explanation += `   - **Loops**: \`${loops.length}\` loop controls.\n`;
      if (conditionals.length > 0) explanation += `   - **Conditionals**: \`${conditionals.length}\` conditional check paths.\n`;
    }

    explanation += `\n**Overall Purpose**:\nBased on structural features, this cell appears to perform data processing, utility definition, or operations in \`${language}\`.`;
    return explanation;
  }

  if (promptText.includes('optimize') || promptText.includes('fast') || promptText.includes('slow') || promptText.includes('performance')) {
    let opt = `### Performance & Optimization Insights\n\n`;
    if (loops.length > 1) {
      opt += `⚠️ **Nested Loops / Iterations**: Found ${loops.length} loops. If nested, this could result in O(N²) or higher time complexity. Consider memoization, dictionaries, or maps if mapping lookups.\n\n`;
    }
    if (code.includes('var ')) {
      opt += `💡 **Modern Syntax**: Replace \`var\` with \`let\` or \`const\` to avoid variable hoisting issues and define block scope correctly.\n\n`;
    }
    opt += `**Current Metrics**:\n- Code lines: ${lines.length}\n- Functions declared: ${functions.length}\n\n**Optimization Tip**: Try caching repeated operations outside of iterations or using native array functions (like \`filter\`, \`reduce\`) which are highly optimized.`;
    return opt;
  }

  // Generic Prompt Fallback Response
  return `### AI Code Helper Response\n\n**Question**: "${userPrompt}"\n\n**Code Cell Analysis**:\n- **Language**: ${language}\n- **Lines**: ${lines.length} lines of code.\n\n**Response**:\nThis cell defines ${functions.length || 'no'} functions, has ${conditionals.length || 'no'} conditionals, and has ${loops.length || 'no'} loops. \n\nTo address your query regarding "${userPrompt}": please ensure you run the cell and review execution logs to trace specific outputs. You can also ask me to **"explain"** the code, check for **"bugs"**, or **"optimize"** performance!`;
}

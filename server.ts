import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

// Lazy initialization for Gemini Client to prevent crash on startup if API key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured. Please add it to your environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper utility to handle retries for Gemini API on 503 or transient/rate-limiting errors
async function executeWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const errorMessage = error.message || "";
    const errorStatus = error.status || error.statusCode || (error.error?.code) || 0;
    
    const isTransient = 
      errorStatus === 503 || 
      errorStatus === 429 ||
      errorStatus === 504 ||
      errorStatus === 500 ||
      errorMessage.includes("503") || 
      errorMessage.includes("429") || 
      errorMessage.includes("UNAVAILABLE") ||
      errorMessage.toLowerCase().includes("high demand") ||
      errorStr.includes("503") || 
      errorStr.includes("429") || 
      errorStr.includes("UNAVAILABLE") ||
      errorStr.toLowerCase().includes("high demand");

    if (retries > 0 && isTransient) {
      console.warn(`[Gemini API] Falha temporária (Status: ${errorStatus}). Retentando em ${delay}ms... Re-tentativas restantes: ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return executeWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

const app = express();
const PORT = 3000;

// Configure multer for file handling in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max limit
  }
});

app.use(express.json());

// API route for health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// GET endpoint to check whether GEMINI_API_KEY is configured
app.get("/api/gemini/status", (req, res) => {
  res.json({ configured: !!process.env.GEMINI_API_KEY });
});

// API route to perform document analysis with Gemini
app.post("/api/verify-document", upload.fields([
  { name: "document", maxCount: 1 },
  { name: "documentBack", maxCount: 1 }
]), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY is not configured. Please add it to your environment variables." 
      });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const docFront = files?.["document"]?.[0];
    const docBack = files?.["documentBack"]?.[0];

    if (!docFront && !docBack) {
      return res.status(400).json({ error: "Nenhum arquivo enviado para análise." });
    }

    const { clientName, clientCpf } = req.body;
    if (!clientName || !clientCpf) {
      return res.status(400).json({ error: "Nome e CPF do cliente são obrigatórios para a análise." });
    }

    const contents: any[] = [];

    // Add front document part if present
    if (docFront) {
      contents.push({
        inlineData: {
          data: docFront.buffer.toString("base64"),
          mimeType: docFront.mimetype
        }
      });
    }

    // Add back document part if present
    if (docBack) {
      contents.push({
        inlineData: {
          data: docBack.buffer.toString("base64"),
          mimeType: docBack.mimetype
        }
      });
    }

    const promptText = `
Você é uma inteligência artificial especialista em perícia grafotécnica e documental de mesa para o setor bancário/consigaçoes.
Analise as imagens/pdfs anexados do documento de identificação oficial do cliente (Frente e/ou Verso do RG, CNH ou Identidade Funcional de qualquer ano) e cruze os dados com as informações do cliente informado abaixo:

INFORMAÇÕES CADASTRADAS DO CLIENTE:
- Nome do Cliente: ${clientName}
- CPF do Cliente: ${clientCpf}

SUAS TAREFAS:
1. Verifique se o(s) documento(s) fornecido(s) é um documento de identidade válido (RG, CNH, Passaporte ou Identidade de Órgão de Classe/Funcional) de qualquer ano.
2. Identifique se algum dos documentos está ilegível (borrado, baixa resolução, sem foco, reflexos fortes impedindo a leitura).
3. Identifique se algum dos documentos está fisicamente deteriorado (rasgado, danificado, molhado, indícios físicos de violação, plástico danificado).
4. Identifique se o documento na imagem de selfie ou foto de documento está cortado (faltando informações essenciais, margens cruciais cortadas, ou apenas metade visível).
5. Compare o CPF e o Nome extraídos dos documentos (Frente e/ou Verso) com o CPF e Nome cadastrados. Diga se há divergência de titularidade (nome ou CPF completamente diferentes do titular cadastrado - ignore pequenas grafias diferentes ou acentos, mas atente para discrepância de pessoa).
6. Sugira o motivo técnico de decisão baseado nestas regras:
   - Se houver divergência grave de titularidade: "DIVERGÊNCIA DE TITULARIDADE" (Status sugerido: "PENDENCIA")
   - Se estiver ilegível: "DOCUMENTO ILEGÍVEL" (Status sugerido: "PENDENCIA")
   - Se estiver deteriorado: "DOCUMENTO DETERIORADO" (Status sugerido: "PENDENCIA")
   - Se estiver cortado ou incompleto: "FOTO CORTADA / INCOMPLETA" (Status sugerido: "PENDENCIA")
   - Se o documento for de outro tipo não aceito ou inválido: "DOCUMENTO ILEGÍVEL" ou similar.
   - Se estiver tudo correto: "Selecione o motivo..." (Status sugerido: "ANALISE")
`;

    contents.push({ text: promptText });

    const response = await executeWithRetry(() => getGeminiClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidDocument: { 
              type: Type.BOOLEAN, 
              description: "True se for um documento de identificação oficial (RG, CNH, Identidade Funcional) de qualquer ano, False caso contrário." 
            },
            isIlegivel: { 
              type: Type.BOOLEAN, 
              description: "True se a imagem está borrada, ilegível, sem foco ou com reflexo forte que impede a leitura de dados essenciais." 
            },
            isDeteriorated: { 
              type: Type.BOOLEAN, 
              description: "True se o documento apresenta rasgos graves, danos físicos, indícios de adulteração ou deterioração física." 
            },
            isCortado: { 
              type: Type.BOOLEAN, 
              description: "True se as extremidades do documento estão cortadas ou se faltam partes cruciais de dados na imagem." 
            },
            matchesTitularidade: { 
              type: Type.BOOLEAN, 
              description: "True se o nome ou CPF no documento combinam de forma correspondente com o cliente fornecido." 
            },
            detectedName: { 
              type: Type.STRING, 
              description: "Nome identificado no documento por extenso." 
            },
            detectedCpf: { 
              type: Type.STRING, 
              description: "CPF identificado no documento (somente números ou formatado)." 
            },
            summary: { 
              type: Type.STRING, 
              description: "Breve explicação sobre os resultados contendo o porquê das notas dadas em português de forma profissional." 
            },
            suggestedStatus: { 
              type: Type.STRING, 
              description: "Status recomendado. Opções: 'ANALISE', 'PENDENCIA', 'REPROVADO'." 
            },
            suggestedReason: { 
              type: Type.STRING, 
              description: "Categoria de decisão correspondente. Opções: 'DOCUMENTO ILEGÍVEL', 'DOCUMENTO DETERIORADO', 'FOTO CORTADA / INCOMPLETA', 'DIVERGÊNCIA DE TITULARIDADE', ou 'Selecione o motivo...'." 
            }
          },
          required: [
            "isValidDocument", 
            "isIlegivel", 
            "isDeteriorated", 
            "isCortado", 
            "matchesTitularidade", 
            "detectedName", 
            "detectedCpf", 
            "summary", 
            "suggestedStatus", 
            "suggestedReason"
          ]
        }
      }
    }));

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response received from Gemini.");
    }

    const payload = JSON.parse(resultText);
    return res.json(payload);

  } catch (error: any) {
    console.error("Erro na perícia de documentos:", error);
    return res.status(500).json({ 
      error: "Houve um erro ao processar o documento via inteligência artificial. Verifique se o arquivo está corrompido ou tente novamente.",
      details: error.message 
    });
  }
});

async function startServer() {
  // Vite integration middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

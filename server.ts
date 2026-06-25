import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as db from "./db";
import nodemailer from "nodemailer";

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

// In-memory store for webhook responses from the analysis company
// Map of proposalId/ade -> { status, parecer_detalhado }
const webhookUpdates: Record<string, { status: string; parecer_detalhado: string }> = {};

// Endpoint for frontend to send document to partner in background
app.post("/api/send-to-partner", upload.single("document"), async (req, res) => {
  try {
    const { proposalId, ade } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Nenhum documento anexado." });
    }

    const partnerUrl = process.env.ANALYSIS_COMPANY_URL || `http://localhost:${PORT}/api/mock-analysis-partner`;

    console.log(`[Server] Redirecionando documento para empresa de análise (${partnerUrl})...`);

    // Forward the file and fields to the external analysis company
    const formData = new FormData();
    formData.append("proposalId", proposalId || "");
    formData.append("ade", ade || "");
    
    // Convert buffer to Blob/File for FormData
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append("document", blob, file.originalname);

    // Call the external partner API
    const response = await fetch(partnerUrl, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Partner API returned status ${response.status}`);
    }

    const data = await response.json();
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Erro ao enviar documento para empresa de análise:", error);
    return res.status(500).json({ error: "Falha ao encaminhar documento.", details: error.message });
  }
});

// Incoming Webhook from analysis company
app.post("/api/webhook/analysis-return", (req, res) => {
  const { proposalId, status, parecer_detalhado } = req.body;
  
  if (!proposalId) {
    return res.status(400).json({ error: "ID da proposta (proposalId) é obrigatório." });
  }
  if (!parecer_detalhado) {
    return res.status(400).json({ error: "parecer_detalhado é obrigatório." });
  }

  // Register in memory using proposalId/ade
  webhookUpdates[proposalId] = { status, parecer_detalhado };
  console.log(`[Server Webhook] Atualização registrada para proposta/ADE ${proposalId}. Status: ${status}`);

  res.json({ success: true, message: "Retorno registrado com sucesso." });
});

// Fetch pending webhook updates for a specific proposal
app.get("/api/webhook-updates/:idOrAde", (req, res) => {
  const { idOrAde } = req.params;
  const update = webhookUpdates[idOrAde];
  
  if (update) {
    // Consume the update so it's only retrieved once
    delete webhookUpdates[idOrAde];
    return res.json({ found: true, ...update });
  }
  
  res.json({ found: false });
});

// Mock external analysis company endpoint
app.post("/api/mock-analysis-partner", upload.single("document"), (req, res) => {
  const { proposalId, ade } = req.body;
  const file = req.file;
  console.log(`[Mock Analysis Partner] Recebido documento para proposta ID: ${proposalId}, ADE: ${ade}. Nome do arquivo: ${file?.originalname || "N/A"}`);
  
  // Simulate asynchronous analysis and call webhook back in 4 seconds
  setTimeout(async () => {
    try {
      const webhookUrl = `http://localhost:${PORT}/api/webhook/analysis-return`;
      const payload = {
        proposalId: ade || proposalId,
        status: "CONCLUIDO",
        parecer_detalhado: `[MOCK PARTNER ANÁLISE] Parecer detalhado para o documento '${file?.originalname || "documento.pdf"}'. Assinatura validada com sucesso. Sem indícios de adulteração física. Documentação em total conformidade.`
      };
      
      console.log(`[Mock Analysis Partner] Enviando webhook de retorno para ${webhookUrl}...`);
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      console.error("[Mock Analysis Partner] Erro ao disparar webhook de retorno:", err.message);
    }
  }, 4000);

  res.json({ success: true, message: "Documento recebido para processamento de análise." });
});

// --- BASE DE DADOS ENDPOINTS ---

// proposals
app.get("/api/proposals", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM proposals ORDER BY createdAt DESC");
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/proposals", async (req, res) => {
  try {
    const body = req.body;
    const proposalsArray = Array.isArray(body) ? body : [body];

    for (const p of proposalsArray) {
      await db.query(
        `INSERT INTO proposals (
          id, ade, nomeCliente, banco, convenio, produto, corretor, valor, valorFinanciado, cpf, 
          sla, obs, status, originalStatus, faseAtuacao, dataSistema, documentacao, lockedBy, 
          createdAt, lastUpdatedStatusAt, slaRemainingMs, fraudCategory, fraudSubMotive
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          nomeCliente = VALUES(nomeCliente), banco = VALUES(banco), convenio = VALUES(convenio), 
          produto = VALUES(produto), corretor = VALUES(corretor), valor = VALUES(valor), 
          valorFinanciado = VALUES(valorFinanciado), cpf = VALUES(cpf), sla = VALUES(sla), 
          obs = VALUES(obs), status = VALUES(status), originalStatus = VALUES(originalStatus), 
          faseAtuacao = VALUES(faseAtuacao), dataSistema = VALUES(dataSistema), 
          documentacao = VALUES(documentacao), lockedBy = VALUES(lockedBy), 
          createdAt = VALUES(createdAt), lastUpdatedStatusAt = VALUES(lastUpdatedStatusAt), 
          slaRemainingMs = VALUES(slaRemainingMs), fraudCategory = VALUES(fraudCategory), 
          fraudSubMotive = VALUES(fraudSubMotive)`,
        [
          p.id, p.ade, p.nomeCliente, p.banco, p.convenio, p.produto, p.corretor, p.valor, p.valorFinanciado, p.cpf,
          p.sla || "NORMAL", p.obs || "", p.status, p.originalStatus || null, p.faseAtuacao || null, p.dataSistema, 
          p.documentacao || "OK", p.lockedBy || null, p.createdAt, p.lastUpdatedStatusAt, p.slaRemainingMs, 
          p.fraudCategory || null, p.fraudSubMotive || null
        ]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao salvar proposta:", error);
    res.status(500).json({ error: error.message });
  }
});

async function checkAndSendAutomatedEmail(proposalId: string, status: string, motive?: string) {
  if (status !== "WAITING_DOCS") return;

  try {
    // 1. Fetch template settings
    const templateRows = await db.query("SELECT * FROM templates_email ORDER BY id ASC LIMIT 1");
    if (templateRows.length === 0) return;
    const t = templateRows[0];

    if (!t.envio_automatico) {
      console.log(`[Auto Email] Envio automático desativado.`);
      return;
    }
    if (!t.smtp_host || !t.smtp_user || !t.smtp_pass || !t.remetente) {
      console.warn(`[Auto Email] Configurações de SMTP incompletas.`);
      return;
    }

    // 2. Fetch proposal details
    const propRows = await db.query("SELECT * FROM proposals WHERE id = ?", [proposalId]);
    if (propRows.length === 0) return;
    const prop = propRows[0];

    // 3. Fetch partner email
    const partnerRows = await db.query("SELECT email_parceiro FROM partners WHERE codigo_parceiro = ?", [prop.corretor]);
    if (partnerRows.length === 0 || !partnerRows[0].email_parceiro) {
      console.log(`[Auto Email] Parceiro '${prop.corretor}' sem e-mail cadastrado.`);
      return;
    }
    const destEmail = partnerRows[0].email_parceiro;

    // 4. Interpolate tags
    const valFormatted = parseFloat(prop.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const tags: Record<string, string> = {
      "{codigo_parceiro}": prop.corretor || "",
      "{numero_proposta}": prop.ade || "",
      "{cpf_cliente}": prop.cpf || "",
      "{nome_cliente}": prop.nomeCliente || "",
      "{valor_operacao}": valFormatted,
      "{motivo_pendencia}": motive || prop.obs || "Conferência de documentação pendente."
    };

    let subject = t.assunto;
    let body = t.corpo;

    for (const [tag, val] of Object.entries(tags)) {
      subject = subject.replace(new RegExp(tag, "g"), val);
      body = body.replace(new RegExp(tag, "g"), val);
    }

    // 5. Setup nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: t.smtp_host,
      port: parseInt(t.smtp_port, 10) || 587,
      secure: parseInt(t.smtp_port, 10) === 465,
      auth: {
        user: t.smtp_user,
        pass: t.smtp_pass
      }
    });

    // 6. Send
    console.log(`[Auto Email] Enviando e-mail para ${destEmail}...`);
    await transporter.sendMail({
      from: `"${t.remetente}" <${t.smtp_user}>`,
      to: destEmail,
      subject: subject,
      text: body
    });
    console.log(`[Auto Email] E-mail de pendência enviado com sucesso para ${destEmail}!`);
  } catch (err: any) {
    console.error("[Auto Email] Erro ao disparar e-mail automático:", err.message);
  }
}

app.put("/api/proposals/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, lastUpdatedStatusAt, slaRemainingMs, fraudCategory, fraudSubMotive, obs } = req.body;
    
    let queryStr = "UPDATE proposals SET ";
    const params: any[] = [];
    const sets: string[] = [];

    if (status !== undefined) {
      sets.push("status = ?");
      params.push(status);
    }
    if (lastUpdatedStatusAt !== undefined) {
      sets.push("lastUpdatedStatusAt = ?");
      params.push(lastUpdatedStatusAt);
    }
    if (slaRemainingMs !== undefined) {
      sets.push("slaRemainingMs = ?");
      params.push(slaRemainingMs);
    }
    if (fraudCategory !== undefined) {
      sets.push("fraudCategory = ?");
      params.push(fraudCategory);
    }
    if (fraudSubMotive !== undefined) {
      sets.push("fraudSubMotive = ?");
      params.push(fraudSubMotive);
    }
    if (obs !== undefined) {
      sets.push("obs = ?");
      params.push(obs);
    }

    if (sets.length === 0) {
      return res.json({ success: true, message: "Nenhum campo para atualizar." });
    }

    queryStr += sets.join(", ") + " WHERE id = ?";
    params.push(id);

    await db.query(queryStr, params);
    
    if (status === "WAITING_DOCS") {
      checkAndSendAutomatedEmail(id, status, obs);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/proposals/:id/lock", async (req, res) => {
  try {
    const { id } = req.params;
    const { lockedBy } = req.body;
    await db.query("UPDATE proposals SET lockedBy = ? WHERE id = ?", [lockedBy || null, id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/proposals/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM proposals WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// users
app.get("/api/users", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM users");
    const users = rows.map((r: any) => ({
      ...r,
      active: !!r.active,
      actingAreas: JSON.parse(r.actingAreas),
      permissions: JSON.parse(r.permissions)
    }));
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { id, username, password, role, actingAreas, permissions, active, status } = req.body;
    await db.query(
      "INSERT INTO users (id, username, password, role, actingAreas, permissions, active, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, username, password, role, JSON.stringify(actingAreas), JSON.stringify(permissions), active ? 1 : 0, status || "Offline"]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role, actingAreas, permissions, active, status } = req.body;
    await db.query(
      `UPDATE users SET username = ?, password = ?, role = ?, actingAreas = ?, permissions = ?, active = ?, status = ? WHERE id = ?`,
      [username, password, role, JSON.stringify(actingAreas), JSON.stringify(permissions), active ? 1 : 0, status, id]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// decision history
app.get("/api/decision-history", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM decision_history ORDER BY timestamp DESC");
    const history = rows.map((r: any) => ({
      ...r,
      aiAnalysisResult: r.aiAnalysisResult ? JSON.parse(r.aiAnalysisResult) : undefined,
      contactAttachment: r.contactAttachment ? JSON.parse(r.contactAttachment) : undefined
    }));
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/decision-history", async (req, res) => {
  try {
    const { id, timestamp, ade, cliente, banco, decisao, motivo, analista, acao, aiAnalysisResult, contactAttachment, fraudCategory, fraudSubMotive } = req.body;
    await db.query(
      `INSERT INTO decision_history (
        id, timestamp, ade, cliente, banco, decisao, motivo, analista, acao, 
        aiAnalysisResult, contactAttachment, fraudCategory, fraudSubMotive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, timestamp, ade, cliente, banco, decisao, motivo || null, analista, acao || null,
        aiAnalysisResult ? JSON.stringify(aiAnalysisResult) : null,
        contactAttachment ? JSON.stringify(contactAttachment) : null,
        fraudCategory || null, fraudSubMotive || null
      ]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// agenda
app.get("/api/agenda", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM agenda ORDER BY id DESC");
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/agenda", async (req, res) => {
  try {
    const { id, ade, contato, data, hora, motivo, analista, status } = req.body;
    await db.query(
      "INSERT INTO agenda (id, ade, contato, data, hora, motivo, analista, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, ade, contato, data, hora, motivo || null, analista, status]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/agenda/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.query("UPDATE agenda SET status = ? WHERE id = ?", [status, id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// rules
app.get("/api/rules", async (req, res) => {
  try {
    const covenantsRow = await db.query("SELECT * FROM rules WHERE rule_key = 'covenants'");
    const partnersRows = await db.query("SELECT * FROM partners");
    const usersRows = await db.query("SELECT * FROM parceiro_usuarios");

    const partnersUsers: Record<string, string[]> = {};
    for (const u of usersRows) {
      if (!partnersUsers[u.codigo_parceiro]) {
        partnersUsers[u.codigo_parceiro] = [];
      }
      partnersUsers[u.codigo_parceiro].push(u.usuario);
    }

    const partners: Record<string, any> = {};
    for (const row of partnersRows) {
      partners[row.codigo_parceiro] = {
        name: row.nome_parceiro,
        email_parceiro: row.email_parceiro || "",
        classification: row.regua,
        selfie: !!row.selfie,
        doc: !!row.doc,
        sla: row.sla,
        limite: parseFloat(row.limite) || 0,
        status: row.status,
        score: row.score || 100,
        driveUrl: row.driveUrl || "",
        usuarios_vinculados: partnersUsers[row.codigo_parceiro] || [],
        contato_telefonico: !!row.contato_telefonico
      };
    }

    res.json({
      partners,
      covenants: covenantsRow.length > 0 ? JSON.parse(covenantsRow[0].rule_data) : {}
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/rules", async (req, res) => {
  try {
    const { rule_key, rule_data } = req.body;
    
    if (rule_key === "partners") {
      const incomingCodes = Object.keys(rule_data);

      for (const [code, p] of Object.entries(rule_data as Record<string, any>)) {
        await db.query(
          `INSERT INTO partners (codigo_parceiro, nome_parceiro, email_parceiro, regua, selfie, doc, sla, limite, status, score, driveUrl, contato_telefonico) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
             nome_parceiro = VALUES(nome_parceiro), 
             email_parceiro = VALUES(email_parceiro), 
             regua = VALUES(regua), 
             selfie = VALUES(selfie), 
             doc = VALUES(doc), 
             sla = VALUES(sla), 
             limite = VALUES(limite), 
             status = VALUES(status), 
             score = VALUES(score), 
             driveUrl = VALUES(driveUrl),
             contato_telefonico = VALUES(contato_telefonico)`,
          [
            code,
            p.name || p.nome_parceiro || 'Sem Nome',
            p.email_parceiro || null,
            p.classification || p.regua || 'Ouro',
            p.selfie !== false ? 1 : 0,
            p.doc === true ? 1 : 0,
            p.sla || 'Normal',
            p.limite ?? 4000.00,
            p.status || 'ACTING',
            p.score ?? 100,
            p.driveUrl || null,
            p.contato_telefonico === true ? 1 : 0
          ]
        );

        await db.query("DELETE FROM parceiro_usuarios WHERE codigo_parceiro = ?", [code]);
        
        let usersToInsert: string[] = [];
        if (p.usuarios_vinculados && Array.isArray(p.usuarios_vinculados)) {
          usersToInsert = p.usuarios_vinculados.filter(Boolean);
        } else if (p.username) {
          usersToInsert = [p.username];
        }

        for (const user of usersToInsert) {
          await db.query("INSERT INTO parceiro_usuarios (codigo_parceiro, usuario) VALUES (?, ?)", [code, user]);
        }
      }

      if (incomingCodes.length > 0) {
        const placeholders = incomingCodes.map(() => "?").join(",");
        await db.query(`DELETE FROM parceiro_usuarios WHERE codigo_parceiro NOT IN (${placeholders})`, incomingCodes);
        await db.query(`DELETE FROM partners WHERE codigo_parceiro NOT IN (${placeholders})`, incomingCodes);
      } else {
        await db.query("DELETE FROM parceiro_usuarios");
        await db.query("DELETE FROM partners");
      }
    } else {
      await db.query(
        "INSERT INTO rules (rule_key, rule_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE rule_data = ?",
        [rule_key, JSON.stringify(rule_data), JSON.stringify(rule_data)]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// email templates
app.get("/api/email-template", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM templates_email ORDER BY id ASC LIMIT 1");
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: "Template não encontrado." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/email-template", async (req, res) => {
  try {
    const { assunto, corpo, remetente, smtp_host, smtp_port, smtp_user, smtp_pass, envio_automatico } = req.body;
    const rows = await db.query("SELECT id FROM templates_email ORDER BY id ASC LIMIT 1");
    if (rows.length > 0) {
      await db.query(
        `UPDATE templates_email 
         SET assunto = ?, corpo = ?, remetente = ?, smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, envio_automatico = ? 
         WHERE id = ?`,
        [assunto, corpo, remetente || null, smtp_host || null, smtp_port ? parseInt(smtp_port, 10) : 587, smtp_user || null, smtp_pass || null, envio_automatico ? 1 : 0, rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO templates_email (assunto, corpo, remetente, smtp_host, smtp_port, smtp_user, smtp_pass, envio_automatico) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [assunto, corpo, remetente || null, smtp_host || null, smtp_port ? parseInt(smtp_port, 10) : 587, smtp_user || null, smtp_pass || null, envio_automatico ? 1 : 0]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// bank layouts
app.get("/api/layouts", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM bank_layouts");
    const layouts: Record<string, any> = {};
    for (const row of rows) {
      layouts[row.bank_name] = JSON.parse(row.layout_data);
    }
    res.json(layouts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/layouts", async (req, res) => {
  try {
    const { bank_name, layout_data } = req.body;
    await db.query(
      "INSERT INTO bank_layouts (bank_name, layout_data) VALUES (?, ?) ON DUPLICATE KEY UPDATE layout_data = ?",
      [bank_name, JSON.stringify(layout_data), JSON.stringify(layout_data)]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// imported bases
app.get("/api/imported-bases", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM imported_bases ORDER BY importedAt DESC");
    const bases = rows.map((r: any) => ({
      ...r,
      proposalIds: JSON.parse(r.proposalIds)
    }));
    res.json(bases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/imported-bases", async (req, res) => {
  try {
    const { id, bankName, fileName, importedAt, importedBy, newCount, dupCount, rawContent, proposalIds } = req.body;
    await db.query(
      `INSERT INTO imported_bases (id, bankName, fileName, importedAt, importedBy, newCount, dupCount, rawContent, proposalIds) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         bankName = VALUES(bankName), fileName = VALUES(fileName), importedAt = VALUES(importedAt), 
         importedBy = VALUES(importedBy), newCount = VALUES(newCount), dupCount = VALUES(dupCount), 
         rawContent = VALUES(rawContent), proposalIds = VALUES(proposalIds)`,
      [id, bankName, fileName, importedAt, importedBy, newCount, dupCount, rawContent, JSON.stringify(proposalIds)]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE endpoints for syncing deletes from settings/base management
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/layouts/:bankName", async (req, res) => {
  try {
    const { bankName } = req.params;
    await db.query("DELETE FROM bank_layouts WHERE bank_name = ?", [bankName]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/decision-history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM decision_history WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/agenda/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM agenda WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/imported-bases/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM imported_bases WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/proposals/clear-all", async (req, res) => {
  try {
    await db.query("DELETE FROM proposals");
    await db.query("DELETE FROM imported_bases");
    await db.query("DELETE FROM agenda");
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  // Initialize MySQL pool on startup
  try {
    await db.getPool();
  } catch (err) {
    console.error("[Server] Erro ao conectar ao MySQL no início:", err);
  }

  // Vite integration middleware
  if (process.env.NODE_ENV === "development") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

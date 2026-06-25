import React, { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import {
  Proposal,
  AppRules,
  PartnerRule,
  UserAccount,
  BankMapping,
  DecisionEntry,
  UserPermissions,
  CovenantRule,
  PartnerStatus,
  PartnerClassification,
  UserStatus,
  AgendaEntry,
} from "../types";
import {
  Settings,
  Landmark,
  Users,
  UserPlus,
  User,
  ShieldCheck,
  TrendingUp,
  Snowflake,
  ClipboardList,
  Zap,
  Wrench,
  Database,
  Trash2,
  Layers,
  Key,
  X,
  Lock,
  Unlock,
  UserMinus,
  UserCheck,
  DollarSign,
  Clock,
  FileText,
  Plus,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Power,
  PowerOff,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  HeartPulse,
  Folder,
  ExternalLink,
  Download,
} from "lucide-react";
import {
  calcularSaudeParceiro,
  REGRAS_SCORE,
  obterRegrasScore,
  salvarRegrasScore,
  GovernanceAction,
} from "../src/services/governanceService";
import { PartnerHealthReport } from "./PartnerHealthReport";
import { decodeArrayBuffer } from "../utils";

interface SettingsViewProps {
  proposals: Proposal[];
  onUpdateProposals: (proposals: Proposal[]) => void;
  rules: AppRules;
  onUpdateRules: (rules: AppRules) => void;
  users: UserAccount[];
  onUpdateUsers: (users: UserAccount[]) => void;
  bankLayouts: Record<string, BankMapping>;
  onUpdateBankLayouts: (layouts: Record<string, BankMapping>) => void;
  history: DecisionEntry[];
  onUpdateHistory: (history: DecisionEntry[]) => void;
  addToast: (
    message: string,
    type: "success" | "error" | "warning" | "info",
    icon?: string,
  ) => void;
  currentUser: UserAccount;
  isDarkMode?: boolean;
  activeTab: "partner" | "covenant" | "access" | "governance" | "email" | "";
  onTabChange: (tab: "partner" | "covenant" | "access" | "governance" | "email" | "") => void;
}

// Test comment
// Test comment 2
export const SettingsView: React.FC<SettingsViewProps> = ({
  proposals,
  onUpdateProposals,
  rules,
  onUpdateRules,
  users,
  onUpdateUsers,
  bankLayouts,
  onUpdateBankLayouts,
  history,
  onUpdateHistory,
  addToast,
  currentUser,
  isDarkMode,
  activeTab,
  onTabChange,
}) => {
  const canEditLimit =
    currentUser.role === "Master" ||
    currentUser.permissions?.editPartnerLimit === true;
  const canEditSla =
    currentUser.role === "Master" ||
    currentUser.permissions?.editPartnerSla === true;
  const canEditBehavior =
    currentUser.role === "Master" ||
    currentUser.permissions?.editPartnerBehavior === true;
  const canEditSecurity =
    currentUser.role === "Master" ||
    currentUser.permissions?.editPartnerSecurity === true;

  const [selectedPartner, setSelectedPartner] = useState("");
  const [partnerEditName, setPartnerEditName] = useState("");
  const [partnerEditCode, setPartnerEditCode] = useState("");
  const [partnerEditUsername, setPartnerEditUsername] = useState("");
  const [partnerEditEmail, setPartnerEditEmail] = useState("");
  const [partnerEditUsersRaw, setPartnerEditUsersRaw] = useState("");

  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSender, setEmailSender] = useState("");
  const [emailSmtpHost, setEmailSmtpHost] = useState("");
  const [emailSmtpPort, setEmailSmtpPort] = useState(587);
  const [emailSmtpUser, setEmailSmtpUser] = useState("");
  const [emailSmtpPass, setEmailSmtpPass] = useState("");
  const [emailAutoSend, setEmailAutoSend] = useState(false);

  useEffect(() => {
    if (activeTab === "email") {
      fetch("/api/email-template")
        .then((res) => {
          if (!res.ok) throw new Error("Erro ao carregar template");
          return res.json();
        })
        .then((data) => {
          setEmailSubject(data.assunto || "");
          setEmailBody(data.corpo || "");
          setEmailSender(data.remetente || "");
          setEmailSmtpHost(data.smtp_host || "");
          setEmailSmtpPort(data.smtp_port || 587);
          setEmailSmtpUser(data.smtp_user || "");
          setEmailSmtpPass(data.smtp_pass || "");
          setEmailAutoSend(!!data.envio_automatico);
        })
        .catch((err) => {
          console.error(err);
          addToast("Não foi possível carregar o template de e-mail.", "error");
        });
    }
  }, [activeTab]);

  const handleSaveEmailTemplate = async () => {
    try {
      const response = await fetch("/api/email-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          assunto: emailSubject, 
          corpo: emailBody,
          remetente: emailSender,
          smtp_host: emailSmtpHost,
          smtp_port: emailSmtpPort,
          smtp_user: emailSmtpUser,
          smtp_pass: emailSmtpPass,
          envio_automatico: emailAutoSend
        }),
      });
      if (!response.ok) throw new Error("Falha ao salvar template");
      addToast("Configuração de e-mail salva com sucesso!", "success", "📧");
    } catch (error: any) {
      addToast(`Erro ao salvar configuração: ${error.message}`, "error");
    }
  };

  useEffect(() => {
    if (selectedPartner) {
      const partnerData = rules.partners[selectedPartner];
      setPartnerEditName(partnerData?.name || "");
      setPartnerEditCode(selectedPartner);
      setPartnerEditUsername(partnerData?.username || "");
      setPartnerEditEmail(partnerData?.email_parceiro || "");
      setPartnerEditUsersRaw((partnerData?.usuarios_vinculados || []).join(";"));
    } else {
      setPartnerEditName("");
      setPartnerEditCode("");
      setPartnerEditUsername("");
      setPartnerEditEmail("");
      setPartnerEditUsersRaw("");
    }
  }, [selectedPartner, rules.partners]);
  const [mapping, setMapping] = useState({
    bankName: "C6",
    ade: "PROPOSTA",
    cliente: "CLIENTE",
    cpf: "CPF",
    valor: "VLR PARCELA",
    valorFinanciado: "VALOR SOLICITADO",
    convenio: "CONVENIO",
    corretor: "CORRESPONDENTE",
    atividade: "ATIVIDADE",
    fase: "ATIVIDADE",
  });
  const [selectedCovenant, setSelectedCovenant] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [tempUsername, setTempUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedPermsUser, setSelectedPermsUser] =
    useState<UserAccount | null>(null);
  const [tempPerms, setTempPerms] = useState<UserPermissions>({
    viewFullCpf: false,
    viewValues: true,
    editRules: false,
    deleteProposals: false,
    fullAnalyticalControl: false,
    viewFraudPreventionChart: true,
  });

  const [partnerForm, setPartnerForm] = useState({
    code: "",
    name: "",
    classification: "Ouro" as PartnerClassification,
    email_parceiro: "",
    usuarios_vinculados_raw: "",
  });
  const [viewingReportPartner, setViewingReportPartner] = useState<
    string | null
  >(null);

  const partnerFileInputRef = useRef<HTMLInputElement>(null);

  const [newUser, setNewUser] = useState<Partial<UserAccount>>({
    username: "",
    password: "",
    role: "Analista",
    actingAreas: ["TODAS"],
    permissions: {
      viewFullCpf: false,
      viewValues: true,
      editRules: false,
      deleteProposals: false,
    },
  });

  const [localUsers, setLocalUsers] = useState<UserAccount[]>(users);

  // Sync localUsers when users prop changes
  React.useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  const handleUpdateLocalUser = (
    id: string,
    field: keyof UserAccount,
    value: any,
  ) => {
    setLocalUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)),
    );
  };

  const handleSaveUsers = () => {
    onUpdateUsers(localUsers);
    addToast("Configurações de usuários atualizadas!", "success", "💾");
  };

  // --- DICIONÁRIO DE GOVERNANÇA DE RISCO/REGRAS ---
  const [govRules, setGovRules] = useState<Record<string, { pontos: number; acao: string }>>({});
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePoints, setNewRulePoints] = useState<number>(-10);
  const [newRuleAction, setNewRuleAction] = useState<string>("AVISO_OPERACIONAL");
  const [editingRuleKey, setEditingRuleKey] = useState<string | null>(null);
  const [editingRulePoints, setEditingRulePoints] = useState<number>(0);
  const [editingRuleAction, setEditingRuleAction] = useState<string>("AVISO_OPERACIONAL");

  React.useEffect(() => {
    setGovRules(obterRegrasScore());
  }, [activeTab]);

  const handleSaveRule = (key: string, updatedRule: { pontos: number; acao: any }) => {
    const updated = { ...govRules, [key]: updatedRule };
    setGovRules(updated);
    salvarRegrasScore(updated);
    addToast(`Regra "${key}" atualizada com sucesso!`, "success", "⚖️");
    setEditingRuleKey(null);
  };

  const handleDeleteRule = (key: string) => {
    if (window.confirm(`Deseja realmente excluir a regra de governança "${key}"?`)) {
      const updated = { ...govRules };
      delete updated[key];
      setGovRules(updated);
      salvarRegrasScore(updated);
      addToast(`Regra "${key}" removida do dicionário!`, "success", "🗑️");
    }
  };

  const handleAddRule = () => {
    if (!newRuleName.trim()) {
      addToast("Insira o nome da regra", "error", "⚠️");
      return;
    }
    const ruleKey = newRuleName.toUpperCase().trim();
    if (govRules[ruleKey]) {
      addToast(`A regra "${ruleKey}" já existe!`, "error", "⚠️");
      return;
    }
    const updated = {
      ...govRules,
      [ruleKey]: { pontos: Number(newRulePoints), acao: newRuleAction }
    };
    setGovRules(updated);
    salvarRegrasScore(updated);
    setNewRuleName("");
    setNewRulePoints(-10);
    setNewRuleAction("AVISO_OPERACIONAL");
    addToast(`Regra "${ruleKey}" adicionada com sucesso!`, "success", "➕");
  };

  const handleResetGovRules = () => {
    if (window.confirm("ATENÇÃO CRIÍTICA: Deseja redefinir TODO o Dicionário de Governança para as regras originais de fábrica?")) {
      setGovRules({ ...REGRAS_SCORE });
      salvarRegrasScore(REGRAS_SCORE);
      addToast("Dicionário de governança redefinido com sucesso!", "success", "🔄");
    }
  };

  const detectedPartners = useMemo(
    () =>
      Array.from(new Set(proposals.map((p) => p.corretor)))
        .filter(Boolean)
        .sort(),
    [proposals],
  );
  const registeredPartners = useMemo(
    () => Object.keys(rules.partners).sort(),
    [rules.partners],
  );
  const allPartners = useMemo(
    () =>
      Array.from(new Set([...detectedPartners, ...registeredPartners])).sort(),
    [detectedPartners, registeredPartners],
  );

  const covenants = useMemo(
    () =>
      Array.from(new Set(proposals.map((p) => p.convenio)))
        .filter(Boolean)
        .sort(),
    [proposals],
  );

  const handleSyncPartnerHealth = () => {
    const nextPartners = { ...rules.partners };
    let changes = 0;

    Object.keys(nextPartners).forEach((code) => {
      const partnerProposals = proposals.filter(
        (prop) => prop.corretor === code,
      );
      const partnerAdes = new Set(partnerProposals.map((prop) => prop.ade));
      const partnerMotivos = history
        .filter((h) => partnerAdes.has(h.ade) && h.motivo)
        .map((h) => h.motivo);

      const health = calcularSaudeParceiro(partnerMotivos);
      const current = nextPartners[code];

      let nextStatus = current.status;
      if (health.bloqueioAtivo) {
        nextStatus = "NON_ACTING";
      } else if (health.analiseTotal) {
        nextStatus = "ANALYSIS_100";
      } else if (nextStatus === "NON_ACTING" && health.score >= 50) {
        // Se estava bloqueado mas o score subiu, volta para ACTING
        nextStatus = "ACTING";
      }

      if (nextStatus !== current.status || health.score !== current.score) {
        nextPartners[code] = {
          ...current,
          status: nextStatus,
          score: health.score,
        };
        changes++;
      }
    });

    if (changes > 0) {
      onUpdateRules({ ...rules, partners: nextPartners });
      addToast(
        `${changes} parceiros tiveram o status atualizado pela saúde!`,
        "success",
        "🛡️",
      );
    } else {
      addToast(
        "Todos os parceiros já estão com o status sincronizado.",
        "info",
      );
    }
  };

  const handleSyncGoogleSheets = async () => {
    const SHEET_ID = "12_5s5nhi-KD2-hZmf3iycNNQn7nXPjWYPlXNXxex2s0";
    const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

    addToast("Conectando à Planilha Google...", "info", "🌐");

    try {
      const response = await fetch(URL);
      if (!response.ok) throw new Error("Falha ao baixar dados da planilha.");

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          const nextPartners = { ...rules.partners };
          let changes = 0;

          // Agrupar motivos por parceiro (usando CNPJ como chave primária, se não houver, Nome)
          const partnerData: Record<
            string,
            { motivos: string[]; monitoramento: boolean; name: string }
          > = {};

          data.forEach((row) => {
            // Limpeza de dados (Blindagem conforme Python)
            const nomeParceiro = (row.NOME_PARCEIRO || "")
              .toString()
              .trim()
              .toUpperCase();
            const cnpjParceiro = (row.CNPJ_PARCEIRO || "")
              .toString()
              .trim()
              .toUpperCase();
            const motivoDetalhado = (row.MOTIVO_DETALHADO || "")
              .toString()
              .trim()
              .toUpperCase();
            const monitoramento = (row.MONITORAMENTO || "")
              .toString()
              .trim()
              .toUpperCase();

            const key = cnpjParceiro || nomeParceiro;
            if (!key) return;

            if (!partnerData[key]) {
              partnerData[key] = {
                motivos: [],
                monitoramento: false,
                name: nomeParceiro,
              };
            }

            if (motivoDetalhado) {
              partnerData[key].motivos.push(motivoDetalhado);
            }

            if (monitoramento === "SIM") {
              partnerData[key].monitoramento = true;
            }
          });

          // Atualizar parceiros no sistema
          Object.entries(partnerData).forEach(([code, info]) => {
            const health = calcularSaudeParceiro(info.motivos);

            // Se houver monitoramento na planilha, força bloqueio ou análise total
            if (info.monitoramento) {
              health.analiseTotal = true;
              health.bloqueioAtivo = true; // No Python: row['MONITORAMENTO'] or row['SCORE_FINAL'] < 50
            }

            const current = nextPartners[code] || {
              selfie: true,
              doc: false,
              sla: "Normal",
              limite: 4000,
              status: "ACTING",
              name: info.name,
              classification: "Ouro",
            };

            let nextStatus = current.status;
            if (health.bloqueioAtivo) {
              nextStatus = "NON_ACTING";
            } else if (health.analiseTotal) {
              nextStatus = "ANALYSIS_100";
            } else if (nextStatus === "NON_ACTING" && health.score >= 50) {
              nextStatus = "ACTING";
            }

            if (
              nextStatus !== current.status ||
              health.score !== current.score ||
              !nextPartners[code]
            ) {
              nextPartners[code] = {
                ...current,
                status: nextStatus,
                score: health.score,
              };
              changes++;
            }
          });

          if (changes > 0) {
            onUpdateRules({ ...rules, partners: nextPartners });
            addToast(
              `${changes} parceiros sincronizados com a Planilha Google!`,
              "success",
              "📊",
            );
          } else {
            addToast("Dados da planilha já estão sincronizados.", "info");
          }
        },
        error: (err: any) => {
          addToast(`Erro ao processar CSV: ${err.message}`, "error");
        },
      });
    } catch (error: any) {
      addToast(`Erro de conexão: ${error.message}`, "error", "❌");
    }
  };

  const handleSaveManualPartner = () => {
    if (!partnerForm.code || !partnerForm.name) {
      addToast("Preencha Código e Nome do parceiro.", "error");
      return;
    }
    const code = partnerForm.code.toUpperCase().trim();
    const current = rules.partners[code] || {
      selfie: true,
      doc: false,
      sla: "Normal" as any,
      limite: 4000.0,
      status: "ACTING" as any,
    };

    const linkedUsers = partnerForm.usuarios_vinculados_raw
      ? partnerForm.usuarios_vinculados_raw.split(";").map(u => u.trim()).filter(Boolean)
      : [];

    onUpdateRules({
      ...rules,
      partners: {
        ...rules.partners,
        [code]: {
          ...current,
          name: partnerForm.name,
          classification: partnerForm.classification,
          email_parceiro: partnerForm.email_parceiro.trim(),
          usuarios_vinculados: linkedUsers,
        },
      },
    });
    addToast(
      `Parceiro ${partnerForm.name} cadastrado com sucesso!`,
      "success",
      "✅",
    );
    setPartnerForm({ code: "", name: "", classification: "Ouro", email_parceiro: "", usuarios_vinculados_raw: "" });
  };

  const handleSavePartnerIdentification = () => {
    if (!selectedPartner) return;
    const oldCode = selectedPartner;
    const newCode = partnerEditCode.toUpperCase().trim();
    const newName = partnerEditName.trim();
    const newUsername = partnerEditUsername.trim();
    const newEmail = partnerEditEmail.trim();
    const newLinkedUsers = partnerEditUsersRaw
      ? partnerEditUsersRaw.split(";").map(u => u.trim()).filter(Boolean)
      : [];

    if (!newCode) {
      addToast("O código do parceiro não pode ser vazio.", "error", "⚠️");
      return;
    }
    if (!newName) {
      addToast("O nome do parceiro não pode ser vazio.", "error", "⚠️");
      return;
    }

    const currentRule = rules.partners[oldCode] || {
      selfie: true,
      doc: false,
      sla: "Normal" as any,
      limite: 4000.0,
      status: "ACTING" as any,
    };

    const updatedRule = {
      ...currentRule,
      name: newName,
      username: newUsername,
      email_parceiro: newEmail,
      usuarios_vinculados: newLinkedUsers
    };

    if (newCode !== oldCode) {
      if (rules.partners[newCode]) {
        addToast(`Erro: O código "${newCode}" já está sendo usado por outro parceiro.`, "error", "⚠️");
        return;
      }

      const updatedPartners = { ...rules.partners };
      delete updatedPartners[oldCode];
      updatedPartners[newCode] = updatedRule;

      onUpdateRules({
        ...rules,
        partners: updatedPartners,
      });
      setSelectedPartner(newCode);
    } else {
      onUpdateRules({
        ...rules,
        partners: {
          ...rules.partners,
          [oldCode]: updatedRule,
        },
      });
    }

    addToast("Dados de identificação salvos com sucesso!", "success", "💾");
  };

  const handleDownloadPartnerTemplate = () => {
    const csvContent = "codigo_parceiro;nome_parceiro;regua;email_parceiro;usuarios_vinculados;teto_operacional\n" +
                       "AD01;Parceiro Exemplo Master;Master;master@email.com;\"USR001;USR002;USR003\";50000\n" +
                       "AD02;Parceiro Exemplo Ouro;Ouro;ouro@email.com;\"USR004;USR005\";25000\n" +
                       "AD03;Parceiro Exemplo Prata;Prata;prata@email.com;\"USR006\";10000\n" +
                       "AD04;Parceiro Exemplo Bronze;Bronze;bronze@email.com;\"USR007\";4000";
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_parceiros.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Modelo de planilha baixado com sucesso!", "success", "📥");
  };

  const handleImportPartnerCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const text = decodeArrayBuffer(buffer);
        
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as any[];
            const newPartners = { ...rules.partners };
            let count = 0;

            data.forEach((row) => {
              const code = (row.codigo_parceiro || row.CODIGO_PARCEIRO || row.codigo || row.CODIGO || "").toString().toUpperCase().trim();
              const name = (row.nome_parceiro || row.NOME_PARCEIRO || row.nome || row.NOME || "").toString().trim();
              const classification = (row.regua || row.REGUA || "Ouro").toString().trim() as PartnerClassification;
              const email = (row.email_parceiro || row.EMAIL_PARCEIRO || row.email || row.EMAIL || "").toString().trim();
              
              const linkedUsersRaw = (row.usuarios_vinculados || row.USUARIOS_VINCULADOS || row.usuario || row.USUARIO || "").toString().trim();
              const linkedUsers = linkedUsersRaw
                ? linkedUsersRaw.split(";").map((u: string) => u.trim()).filter(Boolean)
                : [];

              if (code && name) {
                const current = newPartners[code] || {
                  selfie: true,
                  doc: false,
                  sla: "Normal" as any,
                  limite: 4000.0,
                  status: "ACTING" as any,
                };

                const limitRaw = row.limite || row.LIMITE || row.teto || row.TETO || row.teto_operacional || row.TETO_OPERACIONAL || "";
                let parsedLimite = current.limite ?? 4000.0;
                if (limitRaw) {
                  let normalized = limitRaw.toString().trim();
                  if (normalized.includes(",") && normalized.includes(".")) {
                    normalized = normalized.replace(/\./g, "").replace(",", ".");
                  } else if (normalized.includes(",")) {
                    normalized = normalized.replace(",", ".");
                  }
                  const val = parseFloat(normalized);
                  if (!isNaN(val)) {
                    parsedLimite = val;
                  }
                }

                newPartners[code] = { 
                  ...current, 
                  name, 
                  classification, 
                  email_parceiro: email,
                  usuarios_vinculados: linkedUsers,
                  limite: parsedLimite 
                };
                count++;
              }
            });

            onUpdateRules({ ...rules, partners: newPartners });
            addToast(
              `Régua atualizada! ${count} parceiros carregados.`,
              "success",
              "📂",
            );
          },
          error: (err: any) => {
            addToast(`Erro ao processar CSV: ${err.message}`, "error");
          }
        });
      } catch (err: any) {
        addToast(`Erro na importação: ${err.message}`, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDeletePartner = (code: string) => {
    if (
      confirm(
        `Deseja realmente excluir o parceiro ${code} da régua e apagar todas as suas propostas associadas do sistema?`,
      )
    ) {
      const nextPartners = { ...rules.partners };
      delete nextPartners[code];
      onUpdateRules({ ...rules, partners: nextPartners });

      const nextProposals = proposals.filter(
        (p) =>
          (p.corretor || "").toUpperCase().trim() !== code.toUpperCase().trim(),
      );
      onUpdateProposals(nextProposals);

      if (selectedPartner === code) setSelectedPartner("");
      addToast(
        `Parceiro ${code} e todas as suas propostas foram removidos do sistema.`,
        "info",
        "🗑️",
      );
    }
  };

  const handleSystemReset = () => {
    if (
      confirm(
        "⚠️ ATENÇÃO CRÍTICA: Deseja realmente resetar o sistema?\n\nEsta ação irá EXCLUIR PERMANENTEMENTE todos os Parceiros Registrados na Régua (exceto o código SISTEMA - Direto Loja) e todas as propostas vinculadas a eles no sistema.\n\nEsta operação NÃO poderá ser desfeita!",
      )
    ) {
      const newPartners: Record<string, PartnerRule> = {};
      const sistemaKey = Object.keys(rules.partners).find(
        (k) => k.trim().toUpperCase() === "SISTEMA",
      );
      if (sistemaKey && rules.partners[sistemaKey]) {
        newPartners[sistemaKey] = rules.partners[sistemaKey];
      } else {
        newPartners["SISTEMA"] = {
          name: "Direto Loja",
          classification: "Master",
          selfie: true,
          doc: false,
          sla: "Urgente",
          limite: 50000.0,
          status: "ACTING",
        };
      }

      onUpdateRules({
        ...rules,
        partners: newPartners,
      });

      const nextProposals = proposals.filter(
        (p) => (p.corretor || "").toUpperCase().trim() === "SISTEMA",
      );
      onUpdateProposals(nextProposals);

      setViewingReportPartner(null);
      setSelectedPartner("");
      addToast(
        "Reset do sistema concluído com sucesso. Todos os parceiros (exceto SISTEMA) e suas propostas foram excluídos.",
        "success",
        "♻️",
      );
    }
  };

  const togglePartnerStatus = (code: string) => {
    const current = rules.partners[code];
    if (!current) return;

    const newStatus: PartnerStatus =
      current.status === "NON_ACTING" ? "ACTING" : "NON_ACTING";
    onUpdateRules({
      ...rules,
      partners: {
        ...rules.partners,
        [code]: { ...current, status: newStatus },
      },
    });

    addToast(
      `Parceiro ${code} ${newStatus === "NON_ACTING" ? "inativado (Stand-by)" : "ativado"}.`,
      newStatus === "NON_ACTING" ? "warning" : "success",
      newStatus === "NON_ACTING" ? "❄️" : "⚡",
    );
  };

  const updatePartnerRule = (
    partner: string,
    field: keyof PartnerRule,
    value: any,
  ) => {
    const current = rules.partners[partner] || {
      selfie: true,
      doc: false,
      sla: "Normal",
      limite: 4000.0,
      status: "ACTING",
    };
    onUpdateRules({
      ...rules,
      partners: {
        ...rules.partners,
        [partner]: { ...current, [field]: value },
      },
    });
    addToast("Regra de parceiro atualizada com sucesso.", "success", "⚙️");
  };

  const updateCovenantRule = (
    covenant: string,
    field: keyof CovenantRule,
    value: any,
  ) => {
    const current = rules.covenants[covenant] || {
      documents: ["RG/CNH"],
      teto: 4000.0,
    };
    onUpdateRules({
      ...rules,
      covenants: {
        ...rules.covenants,
        [covenant]: { ...current, [field]: value },
      },
    });
    addToast("Régua de convênio atualizada.", "success", "🏛️");
  };

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.password) {
      addToast("Preencha usuário e senha.", "error");
      return;
    }
    const account: UserAccount = {
      id: `user-${Date.now()}`,
      username: newUser.username!,
      password: newUser.password!,
      role: newUser.role as any,
      actingAreas: newUser.actingAreas!,
      permissions: newUser.permissions as UserPermissions,
      active: true,
    };
    onUpdateUsers([...users, account]);
    setNewUser({
      username: "",
      password: "",
      role: "Analista",
      actingAreas: ["TODAS"],
      permissions: {
        viewFullCpf: false,
        viewValues: true,
        editRules: false,
        deleteProposals: false,
      },
    });
    addToast("Novo usuário criado com sucesso.", "success", "👤");
  };

  const handleEditUser = (user: UserAccount) => {
    setEditingUser(user);
    setTempUsername(user.username);
    setTempPassword(user.password || "");
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = () => {
    if (editingUser) {
      onUpdateUsers(
        users.map((u) =>
          u.id === editingUser.id
            ? { ...u, username: tempUsername, password: tempPassword }
            : u,
        ),
      );
      setIsPasswordModalOpen(false);
      setEditingUser(null);
      addToast("Dados do usuário atualizados!", "success", "🔐");
    }
  };

  const handleOpenPermissions = (user: UserAccount) => {
    setSelectedPermsUser(user);
    setTempPerms({
      viewFullCpf: user.permissions.viewFullCpf,
      viewValues: user.permissions.viewValues,
      editRules: user.permissions.editRules,
      deleteProposals: user.permissions.deleteProposals,
      fullAnalyticalControl: user.permissions.fullAnalyticalControl || false,
      viewDailyPerfSummary: user.permissions.viewDailyPerfSummary ?? true,
      viewActivitySummaryGov: user.permissions.viewActivitySummaryGov ?? true,
      viewProductionReportPeriod: user.permissions.viewProductionReportPeriod ?? true,
      viewPerformanceChartsPeriod: user.permissions.viewPerformanceChartsPeriod ?? true,
      viewQtyActionsDistChart: user.permissions.viewQtyActionsDistChart ?? true,
      viewOperationalReportCsv: user.permissions.viewOperationalReportCsv ?? true,
      viewActionsAnalystBank: user.permissions.viewActionsAnalystBank ?? true,
      viewAuditGuideSidebar: user.permissions.viewAuditGuideSidebar ?? true,
      editPartnerLimit: user.permissions.editPartnerLimit ?? true,
      editPartnerSla: user.permissions.editPartnerSla ?? true,
      editPartnerBehaviorRegua: user.permissions.editPartnerBehaviorRegua ?? true,
      editPartnerSecurityVerify: user.permissions.editPartnerSecurityVerify ?? true,
      viewFraudPreventionChart: user.permissions.viewFraudPreventionChart ?? true,
    });
    setIsPermissionsModalOpen(true);
  };

  const handleSavePermissions = () => {
    if (selectedPermsUser) {
      const updatedUsers = users.map((u) =>
        u.id === selectedPermsUser.id
          ? { ...u, permissions: { ...tempPerms } }
          : u,
      );
      onUpdateUsers(updatedUsers);
      setLocalUsers(updatedUsers);
      setIsPermissionsModalOpen(false);
      setSelectedPermsUser(null);
      addToast(
        `Permissões do usuário ${selectedPermsUser.username} atualizadas com sucesso!`,
        "success",
        "⚙️",
      );
    }
  };

  if (viewingReportPartner) {
    const p = rules.partners[viewingReportPartner];
    return (
      <PartnerHealthReport
        partnerCode={viewingReportPartner}
        partnerRule={
          p || {
            selfie: true,
            doc: false,
            sla: "Normal",
            limite: 4000,
            status: "ACTING",
          }
        }
        proposals={proposals}
        history={history}
        onBack={() => setViewingReportPartner(null)}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="header-riskflow">
        <h1 className="titulo-pagina">Governança Master</h1>
        <div className="contador-quantidade">
          QUANTIDADE: {users.length} USUÁRIOS
        </div>
      </div>

      <div
        className={`rounded-[2.5rem] shadow-xl border overflow-hidden ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}
      >
        <div
          className={`p-10 text-white flex items-center justify-between ${isDarkMode ? "bg-slate-900/80" : "bg-slate-900"}`}
        >
          <div className="flex items-center gap-6">
            <div
              className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 ${isDarkMode ? "bg-blue-600" : "bg-blue-600"}`}
            >
              <Settings size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tighter">
                Governança Master
              </h2>
              <p className="text-slate-400 font-medium">
                Controle central de réguas de risco, parceiros e segurança.
              </p>
            </div>
          </div>
        </div>



        <div className="p-10">
          {activeTab === "" && (
            <div className="py-20 text-center space-y-4 animate-in fade-in duration-700">
              <div
                className={`w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center shadow-inner ${isDarkMode ? "bg-slate-800/50 text-slate-700" : "bg-slate-50 text-slate-200"}`}
              >
                <ShieldCheck size={48} />
              </div>
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                Selecione uma categoria no menu lateral para visualizar as ferramentas de
                gestão.
              </p>
            </div>
          )}
          {activeTab === "partner" && (
            <div className="space-y-12 animate-in fade-in duration-300">
              {/* CONFIGURAÇÃO MANUAL DE PARCEIROS */}
              <section
                className={`p-8 rounded-[2rem] border space-y-6 ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}
              >
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <h3
                    className={`text-xl font-black flex items-center gap-2 uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}
                  >
                    <Settings size={24} className="text-blue-600" />
                    ⚙️ Configuração Manual de Parceiros
                  </h3>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => partnerFileInputRef.current?.click()}
                      className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600"}`}
                    >
                      <FileSpreadsheet size={16} /> Importar Régua CSV
                    </button>
                    <button
                      onClick={handleDownloadPartnerTemplate}
                      className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${isDarkMode ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"}`}
                    >
                      <Download size={16} /> Baixar Modelo de Planilha (CSV)
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={partnerFileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleImportPartnerCSV}
                  />
                </div>

                <div
                  className={`grid grid-cols-1 md:grid-cols-6 gap-4 items-end p-6 rounded-2xl shadow-sm border ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-100"}`}
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Código (ID)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: AD01"
                      className={`w-full p-3 border rounded-xl text-xs font-bold uppercase outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                      value={partnerForm.code}
                      onChange={(e) =>
                        setPartnerForm({ ...partnerForm, code: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Nome do Parceiro
                    </label>
                    <input
                      type="text"
                      placeholder="Nome da Loja"
                      className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                      value={partnerForm.name}
                      onChange={(e) =>
                        setPartnerForm({ ...partnerForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      E-mail do Parceiro
                    </label>
                    <input
                      type="email"
                      placeholder="Ex: email@parceiro.com"
                      className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                      value={partnerForm.email_parceiro}
                      onChange={(e) =>
                        setPartnerForm({ ...partnerForm, email_parceiro: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Usuários Vinculados
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: USR001;USR002"
                      className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                      value={partnerForm.usuarios_vinculados_raw}
                      onChange={(e) =>
                        setPartnerForm({ ...partnerForm, usuarios_vinculados_raw: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Classificação (Régua)
                    </label>
                    <select
                      className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900"}`}
                      value={partnerForm.classification}
                      onChange={(e) =>
                        setPartnerForm({
                          ...partnerForm,
                          classification: e.target.value as any,
                        })
                      }
                    >
                      <option value="Master">Master</option>
                      <option value="Ouro">Ouro</option>
                      <option value="Prata">Prata</option>
                      <option value="Bronze">Bronze</option>
                      <option value="Restrito">Restrito</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSaveManualPartner}
                    className={`p-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${isDarkMode ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                  >
                    <CheckCircle2 size={16} /> Salvar Parceiro
                  </button>
                </div>

                {/* Lista de Parceiros Cadastrados */}
                <div
                  className={`border rounded-2xl overflow-x-auto shadow-sm ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}
                >
                  <div
                    className={`p-4 border-b flex items-center justify-between ${isDarkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-200"}`}
                  >
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      📋 Parceiros Registrados na Régua
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSyncPartnerHealth}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                          isDarkMode
                            ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      >
                        <HeartPulse size={14} /> Sincronizar Saúde Local
                      </button>
                      <button
                        id="btn-reset-parceiros-sistema"
                        onClick={handleSystemReset}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                          isDarkMode
                            ? "bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
                            : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                        }`}
                        title="Reset completo: Exclui parceiros e propostas exceto SISTEMA"
                      >
                        <Trash2 size={14} /> Reset do Sistema
                      </button>
                    </div>
                  </div>
                  <table className="w-full text-center text-xs min-w-[700px]">
                    <thead>
                      <tr
                        className={`font-black text-slate-500 uppercase tracking-tight border-b ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}
                      >
                        <th className="px-6 py-3 text-center min-w-[90px]">CÓDIGO</th>
                        <th className="px-6 py-3 text-center min-w-[200px]">
                          NOME DO PARCEIRO
                        </th>
                        <th className="px-6 py-3 text-center min-w-[90px]">SAÚDE</th>
                        <th className="px-6 py-3 text-center min-w-[90px]">RÉGUA</th>
                        <th className="px-6 py-3 text-center min-w-[120px]">TETO OPERACIONAL</th>
                        <th className="px-6 py-3 text-center min-w-[100px]">STATUS</th>
                        <th className="px-6 py-3 text-center min-w-[130px]">
                          AÇÕES DE GESTÃO
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${isDarkMode ? "divide-slate-800" : "divide-slate-100"}`}
                    >
                      {Object.entries(rules.partners).map(
                        ([code, p]: [string, PartnerRule]) => (
                          <tr
                            key={code}
                            className={`transition-all ${p.status === "NON_ACTING" ? "opacity-60 grayscale" : ""} ${isDarkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50/50"}`}
                          >
                            <td
                              className={`px-6 py-4 text-center font-mono font-black ${isDarkMode ? "text-blue-400" : "text-slate-900"}`}
                            >
                              {code}
                            </td>
                            <td
                              className={`px-6 py-4 text-center ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
                            >
                              <div className="font-bold">{p.name || "N/I"}</div>
                              {p.email_parceiro && (
                                <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                                  ✉️ {p.email_parceiro}
                                </div>
                              )}
                              {p.usuarios_vinculados && p.usuarios_vinculados.length > 0 && (
                                <div className="text-[9px] font-mono text-blue-500 font-bold mt-1 bg-blue-500/10 px-2 py-0.5 rounded-lg inline-block">
                                  👥 {p.usuarios_vinculados.join(", ")}
                                </div>
                              )}
                              {p.username && (!p.usuarios_vinculados || p.usuarios_vinculados.length === 0) && (
                                <div className="text-[9px] font-mono text-blue-500 font-bold mt-1 bg-blue-500/10 px-2 py-0.5 rounded-lg inline-block">
                                  👤 @{p.username}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {(() => {
                                // Filter history for this partner's proposals
                                const partnerProposals = proposals.filter(
                                  (prop) => prop.corretor === code,
                                );
                                const partnerAdes = new Set(
                                  partnerProposals.map((prop) => prop.ade),
                                );
                                const partnerMotivos = history
                                  .filter(
                                    (h) => partnerAdes.has(h.ade) && h.motivo,
                                  )
                                  .map((h) => h.motivo);

                                const health =
                                  calcularSaudeParceiro(partnerMotivos);

                                return (
                                  <div className="flex flex-col items-center gap-1">
                                    <div
                                      className={`text-xs font-black ${
                                        health.score >= 80
                                          ? "text-emerald-500"
                                          : health.score >= 50
                                            ? "text-yellow-500"
                                            : "text-red-500"
                                      }`}
                                    >
                                      {health.score} pts
                                    </div>
                                    <div className="flex gap-1">
                                      {health.bloqueioAtivo && (
                                        <span
                                          className="bg-red-500 text-white text-[8px] px-1 rounded font-bold"
                                          title="Bloqueio Ativo"
                                        >
                                          BLOQ
                                        </span>
                                      )}
                                      {health.analiseTotal && (
                                        <span
                                          className="bg-orange-500 text-white text-[8px] px-1 rounded font-bold"
                                          title="Análise 100%"
                                        >
                                          100%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${
                                  p.classification === "Master"
                                    ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                                    : p.classification === "Ouro"
                                      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                      : p.classification === "Restrito"
                                        ? "bg-red-100 text-red-700 border-red-200"
                                        : "bg-blue-50 text-blue-700 border-blue-100"
                                }`}
                              >
                                {p.classification || "N/I"}
                              </span>
                            </td>
                            <td className={`px-6 py-4 text-center font-bold font-mono ${isDarkMode ? "text-blue-400" : "text-slate-700"}`}>
                              {p.limite ? `R$ ${p.limite.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 4.000,00"}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`flex items-center justify-center gap-1.5 text-[10px] font-black uppercase ${p.status === "NON_ACTING" ? "text-red-500" : "text-emerald-500"}`}
                              >
                                {p.status === "NON_ACTING"
                                  ? "🔴 RESTRITO"
                                  : "🟢 ATIVO"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  onClick={() => setViewingReportPartner(code)}
                                  className={`p-2 rounded-xl transition-all ${isDarkMode ? "hover:bg-blue-500/20 text-blue-400" : "hover:bg-blue-50 text-blue-600"}`}
                                  title="Ver Relatório de Saúde"
                                >
                                  <BarChart3 size={18} />
                                </button>
                                <button
                                  onClick={() => setSelectedPartner(code)}
                                  className={`p-2 rounded-xl transition-all ${isDarkMode ? "hover:bg-slate-700 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`}
                                  title="Configurar Regras"
                                >
                                  <Settings size={18} />
                                </button>
                                <button
                                  onClick={() => togglePartnerStatus(code)}
                                  className={`p-2 rounded-xl transition-all ${p.status === "NON_ACTING" ? "text-emerald-500 hover:bg-emerald-50" : "text-orange-500 hover:bg-orange-50"}`}
                                  title={
                                    p.status === "NON_ACTING"
                                      ? "Ativar Parceiro"
                                      : "Bloquear Parceiro"
                                  }
                                >
                                  {p.status === "NON_ACTING" ? (
                                    <CheckCircle2 size={18} />
                                  ) : (
                                    <PowerOff size={18} />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDeletePartner(code)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                  title="Excluir Parceiro"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                      {Object.keys(rules.partners).length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-10 text-center text-slate-400 font-bold italic"
                          >
                            Nenhum parceiro na base técnica.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* DETALHAMENTO DE REGRAS OPERACIONAIS */}
              <section className="space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                    Configurar Regras Detalhadas:
                  </label>
                  <select
                    className="w-full max-w-md p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-slate-800 shadow-inner"
                    value={selectedPartner}
                    onChange={(e) => setSelectedPartner(e.target.value)}
                  >
                    <option value="">
                      -- Escolha um parceiro para editar regras --
                    </option>
                    {allPartners.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPartner && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in zoom-in-95">
                    <div className="lg:col-span-8 space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div
                          className={`p-8 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                              <DollarSign size={20} />
                            </div>
                            <h4
                              className={`text-sm font-black uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                            >
                              Teto Operacional (R$)
                            </h4>
                          </div>
                          <input
                            disabled={!canEditLimit}
                            type="number"
                            className={`w-full p-5 border rounded-2xl font-black text-2xl text-blue-600 outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 focus:border-blue-500" : "bg-slate-50 border-slate-100"} ${!canEditLimit ? "opacity-50 cursor-not-allowed" : ""}`}
                            value={
                              rules.partners[selectedPartner]?.limite || 4000
                            }
                            onChange={(e) =>
                              updatePartnerRule(
                                selectedPartner,
                                "limite",
                                parseFloat(e.target.value),
                              )
                            }
                          />
                          <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                            Propostas acima deste valor enviadas por este
                            parceiro cairão automaticamente em Análise Humana
                            (Mesa).
                          </p>
                        </div>

                        <div
                          className={`p-8 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                              <Clock size={20} />
                            </div>
                            <h4
                              className={`text-sm font-black uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                            >
                              Prioridade de SLA
                            </h4>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {["Baixa", "Normal", "Urgente"].map((s) => (
                              <button
                                disabled={!canEditSla}
                                key={s}
                                onClick={() =>
                                  updatePartnerRule(selectedPartner, "sla", s)
                                }
                                className={`py-4 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${rules.partners[selectedPartner]?.sla === s ? "bg-slate-900 text-white border-slate-900" : isDarkMode ? "bg-slate-800 text-slate-400 border-transparent hover:border-slate-700" : "bg-slate-50 text-slate-400 border-transparent hover:border-slate-200"} ${!canEditSla ? "opacity-40 cursor-not-allowed" : ""}`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`p-8 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}
                      >
                        <h4
                          className={`text-sm font-black uppercase flex items-center gap-2 ${isDarkMode ? "text-white" : "text-slate-800"}`}
                        >
                          <TrendingUp size={18} className="text-blue-500" />{" "}
                          Régua de Comportamento Operacional
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <StatusCard
                            disabled={!canEditBehavior}
                            active={
                              (rules.partners[selectedPartner]?.status ||
                                "ACTING") === "ACTING"
                            }
                            onClick={() =>
                              updatePartnerRule(
                                selectedPartner,
                                "status",
                                "ACTING",
                              )
                            }
                            icon={<Zap size={20} />}
                            label="Fluxo Fast-Track"
                            desc="Habilita liberação automática baseada em tetos."
                            isDarkMode={isDarkMode}
                          />
                          <StatusCard
                            disabled={!canEditBehavior}
                            active={
                              rules.partners[selectedPartner]?.status ===
                              "NON_ACTING"
                            }
                            onClick={() =>
                              updatePartnerRule(
                                selectedPartner,
                                "status",
                                "NON_ACTING",
                              )
                            }
                            icon={<Snowflake size={20} />}
                            label="Stand-by"
                            desc="Propostas ficam retidas sem atuação imediata."
                            isDarkMode={isDarkMode}
                          />
                          <StatusCard
                            disabled={!canEditBehavior}
                            active={
                              rules.partners[selectedPartner]?.status ===
                              "ANALYSIS_100"
                            }
                            onClick={() =>
                              updatePartnerRule(
                                selectedPartner,
                                "status",
                                "ANALYSIS_100",
                              )
                            }
                            icon={<ClipboardList size={20} />}
                            label="Análise 100%"
                            desc="Exige conferência manual de toda a produção."
                            isDarkMode={isDarkMode}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                      {/* CARD DE IDENTIFICAÇÃO DO PARCEIRO */}
                      <div
                        className={`rounded-3xl p-8 space-y-6 border ${isDarkMode ? "bg-slate-900/40 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
                      >
                        <h4 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                          📝 Identificação do Parceiro
                        </h4>
                        
                        <div className="space-y-4 text-left">
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                              Nome do Parceiro
                            </label>
                            <input
                              type="text"
                              value={partnerEditName}
                              onChange={(e) => setPartnerEditName(e.target.value)}
                              className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"}`}
                              placeholder="Nome do Parceiro"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                              Código (ID)
                            </label>
                            <input
                              type="text"
                              value={partnerEditCode}
                              onChange={(e) => setPartnerEditCode(e.target.value)}
                              className={`w-full p-3 border rounded-xl text-xs font-bold uppercase outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"}`}
                              placeholder="Ex: AD01"
                            />
                          </div>

                           <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                              E-mail do Parceiro
                            </label>
                            <input
                              type="email"
                              value={partnerEditEmail}
                              onChange={(e) => setPartnerEditEmail(e.target.value)}
                              className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"}`}
                              placeholder="Ex: email@parceiro.com"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                              Usuários Vinculados (Separados por ;)
                            </label>
                            <input
                              type="text"
                              value={partnerEditUsersRaw}
                              onChange={(e) => setPartnerEditUsersRaw(e.target.value)}
                              className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"}`}
                              placeholder="Ex: USR001;USR002"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-2 pt-2">
                            <button
                              type="button"
                              onClick={handleSavePartnerIdentification}
                              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-550 transition-all text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md cursor-pointer active:scale-95"
                            >
                              <CheckCircle2 size={14} /> Salvar Alterações
                            </button>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`rounded-3xl p-8 space-y-6 ${isDarkMode ? "bg-slate-800/80 text-white border border-slate-700" : "bg-slate-900 text-white"}`}
                      >
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                          Verificações de Segurança
                        </h4>
                        <div className="space-y-4">
                          <ToggleItem
                            disabled={!canEditSecurity}
                            label="Exigir Selfie"
                            active={
                              rules.partners[selectedPartner]?.selfie ?? true
                            }
                            onToggle={() =>
                              updatePartnerRule(
                                selectedPartner,
                                "selfie",
                                !(
                                  rules.partners[selectedPartner]?.selfie ??
                                  true
                                ),
                              )
                            }
                          />
                          <ToggleItem
                            disabled={!canEditSecurity}
                            label="Exigir Documentos"
                            active={
                              rules.partners[selectedPartner]?.doc ?? false
                            }
                            onToggle={() =>
                              updatePartnerRule(
                                selectedPartner,
                                "doc",
                                !(
                                  rules.partners[selectedPartner]?.doc ?? false
                                ),
                              )
                            }
                          />
                          <ToggleItem
                            disabled={!canEditSecurity}
                            label="Exigir Contato Telefônico"
                            active={
                              rules.partners[selectedPartner]?.contato_telefonico ?? false
                            }
                            onToggle={() =>
                              updatePartnerRule(
                                selectedPartner,
                                "contato_telefonico",
                                !(
                                  rules.partners[selectedPartner]?.contato_telefonico ?? false
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="pt-4 border-t border-white/10 space-y-2">
                          <p className="text-[10px] font-black uppercase text-blue-400">
                            Dados do Parceiro:
                          </p>
                          <p className="text-xs font-bold">
                            {rules.partners[selectedPartner]?.name || "N/C"}
                          </p>
                          <p className="text-[10px] opacity-60">
                            Régua:{" "}
                            {rules.partners[selectedPartner]?.classification ||
                              "Padrão"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
              {/* DICIONÁRIO DE REGRAS DE GOVERNANÇA */}
              <section
                className={`p-8 rounded-[2rem] border space-y-6 ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}
              >
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <h3
                    className={`text-xl font-black flex items-center gap-2 uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}
                  >
                    <HeartPulse size={24} className="text-red-500" />
                    🛡️ Dicionário de Regras do Sistema
                  </h3>
                  <p className="text-xs text-slate-500 font-medium max-w-2xl">
                    As regras abaixo definem a pontuação automática de saúde dos
                    parceiros com base nos motivos de decisão registrados pelos
                    analistas.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(REGRAS_SCORE).map(([motivo, regra]) => (
                    <div
                      key={motivo}
                      className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        isDarkMode
                          ? "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                          : "bg-white border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div className="space-y-1">
                        <p
                          className={`text-[11px] font-bold leading-tight ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
                        >
                          {motivo}
                        </p>
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">
                          {regra.acao.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div
                        className={`text-sm font-black px-2 py-1 rounded-lg ${
                          regra.pontos > 0
                            ? "bg-emerald-500/10 text-emerald-500"
                            : regra.pontos < 0
                              ? "bg-red-500/10 text-red-500"
                              : "bg-slate-500/10 text-slate-500"
                        }`}
                      >
                        {regra.pontos > 0 ? `+${regra.pontos}` : regra.pontos}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === "email" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className={`p-8 rounded-[2rem] border ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-6`}>
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                      📧 Configuração do Layout do E-mail de Pendências
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Configure o assunto e o corpo do e-mail de pendências enviado para os parceiros.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Form fields */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* Automated sending toggle */}
                    <div className={`p-6 rounded-2xl border ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-100"} flex items-center justify-between`}>
                      <div>
                        <h4 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                          🤖 Envio Automático de Pendências
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                          Quando ativado, o sistema enviará automaticamente um e-mail ao parceiro correspondente assim que uma proposta for colocada em status "Pendente" na mesa.
                        </p>
                      </div>
                      <button
                        onClick={() => setEmailAutoSend(!emailAutoSend)}
                        className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${emailAutoSend ? "bg-emerald-600" : "bg-slate-450 dark:bg-slate-700"}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${emailAutoSend ? "left-6.5" : "left-0.5"}`} />
                      </button>
                    </div>

                    {/* SMTP Configuration */}
                    <div className={`p-8 rounded-[2rem] border ${isDarkMode ? "bg-slate-900/20 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-4`}>
                      <h4 className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? "text-indigo-400" : "text-indigo-600"}`}>
                        ⚙️ Configurações do Servidor de Envio (SMTP)
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Forneça as credenciais de SMTP para que o sistema consiga realizar os disparos automáticos.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                            Nome do Remetente
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Portal Riskflow"
                            value={emailSender}
                            onChange={(e) => setEmailSender(e.target.value)}
                            className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                            Host SMTP
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: smtp.hostinger.com"
                            value={emailSmtpHost}
                            onChange={(e) => setEmailSmtpHost(e.target.value)}
                            className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                            Porta SMTP
                          </label>
                          <input
                            type="number"
                            placeholder="Ex: 587"
                            value={emailSmtpPort || ""}
                            onChange={(e) => setEmailSmtpPort(parseInt(e.target.value, 10))}
                            className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"}`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                            Usuário SMTP
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: notificacoes@riskflow.com"
                            value={emailSmtpUser}
                            onChange={(e) => setEmailSmtpUser(e.target.value)}
                            className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"}`}
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                            Senha SMTP / Chave de Aplicativo
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••••••"
                            value={emailSmtpPass}
                            onChange={(e) => setEmailSmtpPass(e.target.value)}
                            className={`w-full p-3 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-900 focus:border-blue-500"}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                        Assunto do E-mail
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className={`w-full p-4 border rounded-2xl outline-none text-sm font-bold transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100"}`}
                        placeholder="Ex: Pendência Identificada - Parceiro {codigo_parceiro} - Proposta {numero_proposta}"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                        Corpo do E-mail
                      </label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        rows={12}
                        className={`w-full p-4 border rounded-2xl outline-none text-sm font-semibold transition-all resize-y ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100"}`}
                        placeholder="Escreva a mensagem do e-mail..."
                      />
                    </div>

                    <button
                      onClick={handleSaveEmailTemplate}
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-550 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 size={16} /> Salvar Configurações de E-mail
                    </button>
                  </div>

                  {/* Sidebar instructions */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className={`p-6 rounded-2xl border ${isDarkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-100"} space-y-4`}>
                      <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400">
                        🏷️ Tags Dinâmicas Disponíveis
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Você pode usar as seguintes tags dinâmicas no assunto ou no corpo do e-mail. Elas serão substituídas automaticamente pelos dados reais da operação:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg self-start">
                            {`{codigo_parceiro}`}
                          </span>
                          <span className="text-[10px] text-slate-400 pl-1 font-medium">Código único de identificação do parceiro</span>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg self-start">
                            {`{numero_proposta}`}
                          </span>
                          <span className="text-[10px] text-slate-400 pl-1 font-medium">Número de proposta/ADE do cliente</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg self-start">
                            {`{cpf_cliente}`}
                          </span>
                          <span className="text-[10px] text-slate-400 pl-1 font-medium">CPF completo do cliente cadastrado</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg self-start">
                            {`{nome_cliente}`}
                          </span>
                          <span className="text-[10px] text-slate-400 pl-1 font-medium">Nome completo do cliente</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg self-start">
                            {`{valor_operacao}`}
                          </span>
                          <span className="text-[10px] text-slate-400 pl-1 font-medium">Valor da operação/financiamento</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-lg self-start">
                            {`{motivo_pendencia}`}
                          </span>
                          <span className="text-[10px] text-slate-400 pl-1 font-medium">Motivo detalhado da pendência</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "covenant" && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <div
                className={`p-8 rounded-3xl border ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}
              >
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                  Órgão / Convênio Público
                </label>
                <select
                  className={`w-full max-w-md p-5 border rounded-2xl outline-none font-black shadow-sm transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-800"}`}
                  value={selectedCovenant}
                  onChange={(e) => setSelectedCovenant(e.target.value)}
                >
                  <option value="">-- Selecione o Convênio --</option>
                  {covenants.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCovenant && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in slide-in-from-top-4">
                  <div
                    className={`p-8 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <DollarSign size={20} />
                      </div>
                      <h4
                        className={`text-sm font-black uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                      >
                        Teto Máximo do Convênio (R$)
                      </h4>
                    </div>
                    <input
                      type="number"
                      className={`w-full p-5 border rounded-2xl font-black text-3xl text-emerald-600 outline-none transition-all ${isDarkMode ? "bg-slate-800 border-slate-700 focus:border-emerald-500" : "bg-slate-50 border-slate-100"}`}
                      value={rules.covenants[selectedCovenant]?.teto || 4000}
                      onChange={(e) =>
                        updateCovenantRule(
                          selectedCovenant,
                          "teto",
                          parseFloat(e.target.value),
                        )
                      }
                    />
                    <p className="text-[10px] text-slate-400 font-bold">
                      Restrição técnica para propostas no convênio{" "}
                      {selectedCovenant}.
                    </p>
                  </div>

                  <div
                    className={`p-8 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <FileText size={20} />
                      </div>
                      <h4
                        className={`text-sm font-black uppercase ${isDarkMode ? "text-white" : "text-slate-800"}`}
                      >
                        Documentação Obrigatória
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "RG/CNH",
                        "Extrato INSS",
                        "Contracheque",
                        "Residência",
                        "Selfie",
                        "Contrato",
                      ].map((doc) => {
                        const currentDocs =
                          rules.covenants[selectedCovenant]?.documents || [];
                        const isSelected = currentDocs.includes(doc);
                        return (
                          <button
                            key={doc}
                            onClick={() => {
                              const next = isSelected
                                ? currentDocs.filter((d) => d !== doc)
                                : [...currentDocs, doc];
                              updateCovenantRule(
                                selectedCovenant,
                                "documents",
                                next,
                              );
                            }}
                            className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${isSelected ? "bg-blue-600 border-blue-600 text-white" : isDarkMode ? "bg-slate-800 text-slate-400 border-transparent hover:border-slate-700" : "bg-slate-50 text-slate-400 border-transparent hover:border-slate-200"}`}
                          >
                            {doc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "access" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full min-w-0">
              {/* CARD DE PROVISIONAMENTO AMPLIADO */}
              <div
                className={`lg:col-span-4 p-8 rounded-[3rem] border space-y-8 shadow-inner ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"}`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-2xl shadow-blue-500/30">
                    <UserPlus size={28} />
                  </div>
                  <h3
                    className={`text-2xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}
                  >
                    Provisionar Analista
                  </h3>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                        Usuário / Identificação
                      </label>
                      <div className="relative group">
                        <User
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                          size={20}
                        />
                        <input
                          type="text"
                          className={`w-full pl-12 pr-4 py-5 border rounded-2xl outline-none text-sm font-bold shadow-sm transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500/10 focus:border-blue-500" : "bg-white border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100"}`}
                          placeholder="ex: andrey.risk"
                          value={newUser.username}
                          onChange={(e) =>
                            setNewUser({ ...newUser, username: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                        Senha de Acesso Inicial
                      </label>
                      <div className="relative group">
                        <Lock
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-600 transition-colors"
                          size={20}
                        />
                        <input
                          type="password"
                          className={`w-full pl-12 pr-4 py-5 border rounded-2xl outline-none text-sm font-bold shadow-sm transition-all ${isDarkMode ? "bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500/10 focus:border-blue-500" : "bg-white border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100"}`}
                          placeholder="••••••••"
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser({ ...newUser, password: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                      Atribuição Funcional
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {["Analista", "Supervisor", "Master"].map((role) => (
                        <button
                          key={role}
                          onClick={() =>
                            setNewUser({ ...newUser, role: role as any })
                          }
                          className={`py-4 rounded-2xl text-[11px] font-black uppercase border-2 transition-all ${newUser.role === role ? "bg-slate-900 text-white border-slate-900 shadow-xl" : isDarkMode ? "bg-slate-800 text-slate-400 border-transparent hover:border-slate-700" : "bg-white text-slate-400 border-transparent hover:border-slate-200"}`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleCreateUser}
                      className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 size={20} /> Validar e Ativar Analista
                    </button>
                  </div>
                </div>
              </div>

              {/* TABELA DE GESTÃO DE ACESSOS */}
              <div
                className={`lg:col-span-8 min-w-0 w-full rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col ${isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"}`}
              >
                <div
                  className={`p-8 border-b flex items-center justify-between ${isDarkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50/50"}`}
                >
                  <div className="flex items-center gap-4">
                    <h3
                      className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? "text-white" : "text-slate-800"}`}
                    >
                      <Users size={18} className="text-slate-400" /> Ativos no
                      Sistema
                    </h3>
                    <span
                      className={`px-3 py-1 border rounded-lg text-[10px] font-black ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-white border-slate-200 text-slate-400"}`}
                    >
                      {localUsers.length} ANALISTAS
                    </span>
                  </div>
                  <button
                    onClick={handleSaveUsers}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg ${isDarkMode ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-900 text-white hover:bg-black"}`}
                  >
                    <CheckCircle2 size={16} /> Salvar Alterações
                  </button>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-auto w-full min-w-0 show-scrollbar">
                  <table className="w-full text-left min-w-[600px]">
                    <thead
                      className={`text-[10px] font-black text-slate-400 uppercase tracking-widest border-b ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50"}`}
                    >
                      <tr>
                        <th className="px-4 py-3 w-[35%] min-w-[180px]">Usuário</th>
                        <th className="px-3 py-3 w-[30%] min-w-[160px]">Perfil (Cargo)</th>
                        <th className="px-3 py-3 w-[15%] min-w-[90px]">Status</th>
                        <th className="px-4 py-3 w-[20%] min-w-[110px] text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${isDarkMode ? "divide-slate-800" : "divide-slate-100"}`}
                    >
                      {localUsers.map((u) => (
                        <tr
                          key={u.id}
                          className={`${u.active ? "transition-all" : "opacity-40 grayscale"} ${isDarkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50/50"}`}
                        >
                          <td className="px-4 py-3 min-w-[180px]">
                            <input
                              type="text"
                              className={`bg-transparent border-none outline-none font-bold text-sm tracking-tight w-full min-w-[140px] text-left ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}
                              value={u.username}
                              onChange={(e) =>
                                handleUpdateLocalUser(
                                  u.id,
                                  "username",
                                  e.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-3 min-w-[160px]">
                            <select
                              className={`bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-tighter cursor-pointer ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                              value={u.role}
                              onChange={(e) =>
                                handleUpdateLocalUser(
                                  u.id,
                                  "role",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="Analista">
                                Operacional (Analista)
                              </option>
                              <option value="Supervisor">Supervisor</option>
                              <option value="Master">Master (Auditoria)</option>
                            </select>
                          </td>
                          <td className="px-3 py-3 min-w-[90px]">
                            <select
                              className={`bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-tighter cursor-pointer ${u.status === "Online" ? "text-emerald-500" : u.status === "Offline" ? "text-slate-400" : "text-red-500"}`}
                              value={u.status || "Offline"}
                              onChange={(e) =>
                                handleUpdateLocalUser(
                                  u.id,
                                  "status",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="Online">Online</option>
                              <option value="Offline">Offline</option>
                              <option value="Suspenso">Suspenso</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 min-w-[110px] text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => handleEditUser(u)}
                                className={`p-2 border rounded-xl transition-all hover:shadow-lg ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400" : "bg-white border-slate-100 text-slate-400 hover:text-blue-600"}`}
                                title="Reset de Senha Técnica"
                              >
                                <Key size={16} />
                              </button>
                              <button
                                onClick={() => handleOpenPermissions(u)}
                                className={`p-2 border rounded-xl transition-all hover:shadow-lg ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-indigo-400" : "bg-white border-slate-100 text-slate-400 hover:text-indigo-600"}`}
                                title="Acessos e Permissões do Sistema"
                              >
                                <Settings size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateLocalUser(
                                    u.id,
                                    "active",
                                    !u.active,
                                  )
                                }
                                className={`p-2 border rounded-xl transition-all hover:shadow-lg ${u.active ? "text-red-400 hover:text-red-600" : "text-emerald-400 hover:text-emerald-600"} ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"}`}
                                title={
                                  u.active
                                    ? "Revogar Acesso"
                                    : "Restaurar Acesso"
                                }
                              >
                                {u.active ? (
                                  <UserMinus size={16} />
                                ) : (
                                  <UserCheck size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* END TABLE */}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE RESET DE SENHA AMPLIADO */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div
            className={`rounded-[3rem] p-12 max-w-lg w-full shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] space-y-10 border ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white/20"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl">
                  <Key size={28} />
                </div>
                <div>
                  <h3
                    className={`text-2xl font-black uppercase tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}
                  >
                    Reset de Senha
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase mt-2">
                    Segurança Técnica Master
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className={`p-3 rounded-full transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
              >
                <X size={24} />
              </button>
            </div>

            <div
              className={`p-6 rounded-3xl border border-dashed space-y-2 ${isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`}
            >
              <p className="text-xs font-bold text-slate-500">
                Provisionando nova chave para o analista:
              </p>
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${isDarkMode ? "bg-blue-600 text-white" : "bg-slate-900 text-white"}`}
                >
                  {editingUser?.username.charAt(0).toUpperCase()}
                </div>
                <p
                  className={`font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}
                >
                  {editingUser?.username}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                  Nome de Usuário
                </label>
                <div className="relative group">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                    size={20}
                  />
                  <input
                    type="text"
                    className={`w-full pl-12 pr-4 py-5 border rounded-2xl outline-none text-sm font-bold transition-all shadow-inner ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-blue-500/10 focus:bg-slate-900" : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100 focus:bg-white"}`}
                    placeholder="Nome de usuário..."
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
                  Nova Chave de Acesso
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-600 transition-colors"
                    size={20}
                  />
                  <input
                    type="text"
                    className={`w-full pl-12 pr-4 py-5 border rounded-2xl outline-none text-sm font-bold transition-all shadow-inner ${isDarkMode ? "bg-slate-800 border-slate-700 text-white focus:ring-orange-500/10 focus:bg-slate-900" : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-orange-100 focus:bg-white"}`}
                    placeholder="Nova senha temporária..."
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic px-2">
                  Informe a nova senha ao analista após salvar. Esta ação é
                  irreversível.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className={`py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePassword}
                disabled={!tempPassword}
                className={`py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-xl disabled:opacity-30 ${isDarkMode ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-slate-900 text-white hover:bg-black"}`}
              >
                Confirmar Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚖️ PANEL DICIONÁRIO DE REGRAS DO SISTEMA */}
      {activeTab === "governance" && (() => {
        const ACTION_LABELS: Record<string, { label: string; bg: string; text: string }> = {
          MANTER_FLUXO: { label: "Liberar", bg: "bg-emerald-500/10", text: "text-emerald-500" },
          AVISO_OPERACIONAL: { label: "Aviso", bg: "bg-amber-500/10", text: "text-amber-500" },
          RE_TREINAMENTO: { label: "Treinamento", bg: "bg-orange-500/10", text: "text-orange-500" },
          REQUERER_AUDITORIA: { label: "Auditoria", bg: "bg-blue-500/10", text: "text-blue-500" },
          ALERTA_MASTER: { label: "Alerta", bg: "bg-purple-500/10", text: "text-purple-500" },
          ANALISE_100_OU_RESTRITO: { label: "Análise Completa", bg: "bg-pink-500/10", text: "text-pink-500" },
          RESTRITO_IMEDIATO: { label: "Bloquear", bg: "bg-red-500/10", text: "text-red-500" },
          NENHUMA: { label: "Nenhuma", bg: "bg-slate-500/10", text: "text-slate-500" }
        };

        return (
          <div className="space-y-10 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/60 dark:border-slate-800/60">
              <div>
                <h2 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}>
                  ⚖️ Regras do Sistema
                </h2>
                <p className="text-sm font-medium text-slate-400 mt-1">
                  Defina gatilhos, pontuações de risco e ações automáticas para a saúde dos parceiros.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetGovRules}
                className={`flex items-center justify-center gap-2 px-5 py-3 border border-red-500/30 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm shrink-0 ${isDarkMode ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-white text-red-600 hover:bg-red-50"}`}
              >
                <RefreshCw size={14} /> Redefinir para Padrão do Sistema
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* CADASTRO DE NOVA REGRA */}
              <div className={`lg:col-span-4 p-8 rounded-[2.5rem] border ${isDarkMode ? "bg-slate-800/30 border-slate-800" : "bg-slate-50 border-slate-200"} space-y-6 shadow-sm`}>
                <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? "text-slate-300" : "text-slate-700"} border-b border-slate-500/10 pb-3`}>
                  ➕ Nova Regra do Sistema
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      Descrição / Motivo de Decisão
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: FRAUDE SUSPEITA, ERRO DE ASSINATURA"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      className={`w-full p-4 border rounded-2xl outline-none text-xs font-bold transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100"}`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      Pontos de Impacto
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Ex: -50, 10"
                        value={newRulePoints}
                        onChange={(e) => setNewRulePoints(Number(e.target.value))}
                        className={`w-full p-4 border rounded-2xl outline-none text-xs font-bold transition-all ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100"}`}
                      />
                      <span className={`text-[10px] font-bold p-3 rounded-xl shrink-0 ${newRulePoints < 0 ? "bg-red-500/10 text-red-500" : newRulePoints > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"}`}>
                        {newRulePoints > 0 ? `+${newRulePoints}` : newRulePoints} pts
                      </span>
                    </div>
                    <p className="text-[9px] font-semibold text-slate-400 mt-1.5 leading-normal">
                      Valores negativos reduzem a saúde do parceiro, valores positivos aumentam ou reestabelecem.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      Ação da Regra
                    </label>
                    <select
                      value={newRuleAction}
                      onChange={(e) => setNewRuleAction(e.target.value)}
                      className={`w-full p-4 border rounded-2xl outline-none text-xs font-bold transition-all cursor-pointer ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-white border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100"}`}
                    >
                      <option value="MANTER_FLUXO">🟢 Liberar (MANTER_FLUXO)</option>
                      <option value="AVISO_OPERACIONAL">🟡 Aviso (AVISO_OPERACIONAL)</option>
                      <option value="RE_TREINAMENTO">🟠 Treinamento (RE_TREINAMENTO)</option>
                      <option value="REQUERER_AUDITORIA">🔵 Auditoria (REQUERER_AUDITORIA)</option>
                      <option value="ALERTA_MASTER">🟣 Alerta (ALERTA_MASTER)</option>
                      <option value="ANALISE_100_OU_RESTRITO">🔴 Análise Completa (ANALISE_100_OU_RESTRITO)</option>
                      <option value="RESTRITO_IMEDIATO">🚫 Bloquear (RESTRITO_IMEDIATO)</option>
                      <option value="NENHUMA">🔘 Nenhuma (NENHUMA)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-500 transition-all text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg"
                  >
                    <Plus size={16} /> Cadastrar Regra
                  </button>
                </div>
              </div>

               {/* DICIONÁRIO DE REGRAS ATIVAS */}
              <div className="lg:col-span-8 space-y-6">
                <div className={`p-6 rounded-[2.5rem] border ${isDarkMode ? "bg-slate-800/10 border-slate-800/40" : "bg-slate-50/50 border-slate-200/60"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      📖 Dicionário de Gatilhos Cadastrados ({Object.keys(govRules).length})
                    </span>
                  </div>

                  <div className="mt-6 space-y-3.5 max-h-[700px] overflow-y-auto pr-1">
                    {Object.keys(govRules).map((key) => {
                      const rule = govRules[key];
                      const isEditing = editingRuleKey === key;
                      const actionInfo = ACTION_LABELS[rule.acao] || ACTION_LABELS.NENHUMA;

                      return (
                        <div
                          key={key}
                          className={`p-5 rounded-2xl border transition-all duration-200 ${isDarkMode ? "bg-[#0b1120] border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:shadow-md"}`}
                        >
                          {isEditing ? (
                            <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-mono font-black ${isDarkMode ? "text-blue-400" : "text-blue-600"}`}>
                                  ⚙️ Editando:
                                </span>
                                <span className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                                  {key}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                    Pontos de Impacto
                                  </label>
                                  <input
                                    type="number"
                                    value={editingRulePoints}
                                    onChange={(e) => setEditingRulePoints(Number(e.target.value))}
                                    className={`w-full p-3 border rounded-xl outline-none text-xs font-bold ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-100 text-slate-800"}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                                    Ação da Regra
                                  </label>
                                  <select
                                    value={editingRuleAction}
                                    onChange={(e) => setEditingRuleAction(e.target.value)}
                                    className={`w-full p-3 border rounded-xl outline-none text-xs font-bold cursor-pointer ${isDarkMode ? "bg-slate-900 border-slate-700 text-white focus:border-blue-500" : "bg-slate-50 border-slate-100 text-slate-800"}`}
                                  >
                                    <option value="MANTER_FLUXO">🟢 Liberar (MANTER_FLUXO)</option>
                                    <option value="AVISO_OPERACIONAL">🟡 Aviso (AVISO_OPERACIONAL)</option>
                                    <option value="RE_TREINAMENTO">🟠 Treinamento (RE_TREINAMENTO)</option>
                                    <option value="REQUERER_AUDITORIA">🔵 Auditoria (REQUERER_AUDITORIA)</option>
                                    <option value="ALERTA_MASTER">🟣 Alerta (ALERTA_MASTER)</option>
                                    <option value="ANALISE_100_OU_RESTRITO">🔴 Análise Completa (ANALISE_100_OU_RESTRITO)</option>
                                    <option value="RESTRITO_IMEDIATO">🚫 Bloquear (RESTRITO_IMEDIATO)</option>
                                    <option value="NENHUMA">🔘 Nenhuma (NENHUMA)</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2.5 mt-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingRuleKey(null)}
                                  className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                                >
                                  <X size={12} className="inline mr-1" /> Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveRule(key, { pontos: editingRulePoints, acao: editingRuleAction as any })}
                                  className="px-4 py-2 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-black uppercase rounded-lg transition-all"
                                >
                                  <CheckCircle2 size={12} className="inline mr-1" /> Salvar Regra
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className={`text-xs font-mono font-black uppercase tracking-tight truncate max-w-[280px] sm:max-w-md ${isDarkMode ? "text-slate-100" : "text-slate-800"}`} title={key}>
                                    {key}
                                  </span>
                                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl whitespace-nowrap ${rule.pontos < 0 ? "bg-red-500/10 text-red-500" : rule.pontos > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500"}`}>
                                    {rule.pontos > 0 ? `+${rule.pontos}` : rule.pontos} pts
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-lg ${actionInfo.bg} ${actionInfo.text}`}>
                                    {actionInfo.label}
                                  </span>
                                  <span className="text-[9px] font-semibold text-slate-400">
                                    Ação: <code className="font-mono">{rule.acao}</code>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRuleKey(key);
                                    setEditingRulePoints(rule.pontos);
                                    setEditingRuleAction(rule.acao);
                                  }}
                                  className={`p-3 rounded-xl transition-all ${isDarkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600"}`}
                                  title="Editar regra"
                                >
                                  <Settings size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRule(key)}
                                  className={`p-3 rounded-xl transition-all ${isDarkMode ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-red-50 text-red-500 hover:bg-red-100"}`}
                                  title="Excluir regra"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ⚙️ MODAL DE PERMISSÕES E ACESSOS DO SISTEMA */}
      {isPermissionsModalOpen && selectedPermsUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className={`rounded-[3rem] p-10 max-w-xl w-full shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] space-y-8 border ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-100 text-indigo-650 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-2xl">
                  <Settings size={28} />
                </div>
                <div>
                  <h3 className={`text-xl font-black uppercase tracking-tight leading-none ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    Controle de Acessos
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">
                    Permissões e Recursos Avançados
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsPermissionsModalOpen(false);
                  setSelectedPermsUser(null);
                }}
                className={`p-3 rounded-full transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 text-slate-400 hover:text-slate-600"}`}
              >
                <X size={24} />
              </button>
            </div>

            <div className={`p-5 rounded-2xl border border-dashed flex items-center justify-between ${isDarkMode ? "bg-slate-800/30 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Configurando credenciais de:
                </p>
                <p className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {selectedPermsUser.username}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                selectedPermsUser.role === "Master" ? "bg-purple-150 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" :
                selectedPermsUser.role === "Supervisor" ? "bg-orange-150 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" :
                "bg-blue-150 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
              }`}>
                {selectedPermsUser.role}
              </span>
            </div>

            {currentUser.role !== "Master" && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-[11px] font-black text-red-500 uppercase tracking-tight">
                <span>⚠️</span> Somente o perfil Administrador (Master) possui permissão para editar estas chaves.
              </div>
            )}

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block">
                Chaves de Seleção de Recursos
              </span>

              {/* 1. Resumo de Performance do Dia abrangendo dados gerais */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Resumo de Performance do Dia
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Resumo de Performance do Dia abrangendo dados gerais.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewDailyPerfSummary: !tempPerms.viewDailyPerfSummary,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewDailyPerfSummary ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewDailyPerfSummary ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 2. Métricas de Desempenho */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Métricas de Desempenho
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Resumo de atividades e métricas gerais do sistema.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewActivitySummaryGov: !tempPerms.viewActivitySummaryGov,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewActivitySummaryGov ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewActivitySummaryGov ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 3. Relatório de Produção por Período de cada Analista */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Relatório de Produção do Analista
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Relatório de Produção por Período de cada Analista.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewProductionReportPeriod: !tempPerms.viewProductionReportPeriod,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewProductionReportPeriod ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewProductionReportPeriod ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 4. Painel Gráfico de Performance e Produtividade do Período */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Painel Gráfico de Performance
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Painel Gráfico de Performance e Produtividade do Período.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewPerformanceChartsPeriod: !tempPerms.viewPerformanceChartsPeriod,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewPerformanceChartsPeriod ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewPerformanceChartsPeriod ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 5. Gráfico de Distribuição Quantitativa de Ações */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Distribuição de Ações
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Gráfico de Distribuição Quantitativa de Ações.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewQtyActionsDistChart: !tempPerms.viewQtyActionsDistChart,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewQtyActionsDistChart ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewQtyActionsDistChart ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 6. Solicitação de Relatório Operacional (Exportação CSV) */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Solicitação Relatório Operacional
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Solicitação de Relatório Operacional (Exportação CSV).
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewOperationalReportCsv: !tempPerms.viewOperationalReportCsv,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewOperationalReportCsv ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewOperationalReportCsv ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 7. Ações por Analista & por Banco */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Tabela por Analista & Banco
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Ações por Analista & por Banco.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewActionsAnalystBank: !tempPerms.viewActionsAnalystBank,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewActionsAnalystBank ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewActionsAnalystBank ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 8. Liberação da Guia de Auditoria no menu de navegação da barra lateral */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Liberação da Guia de Auditoria
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Liberação da Guia de Auditoria no menu de navegação da barra lateral.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewAuditGuideSidebar: !tempPerms.viewAuditGuideSidebar,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewAuditGuideSidebar ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewAuditGuideSidebar ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 9. Opção de editar o teto operacional do parceiro */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Editar Teto Operacional
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Editar o teto operacional do parceiro.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      editPartnerLimit: !tempPerms.editPartnerLimit,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.editPartnerLimit ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.editPartnerLimit ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 10. Opção de editar a prioridade do SLA */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Editar Prioridade SLA
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Editar a prioridade do SLA.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      editPartnerSla: !tempPerms.editPartnerSla,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.editPartnerSla ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.editPartnerSla ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 11. Opção de editar a régua de comportamento operacional */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Editar Régua de Comportamento
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Editar a régua de comportamento operacional.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      editPartnerBehaviorRegua: !tempPerms.editPartnerBehaviorRegua,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.editPartnerBehaviorRegua ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.editPartnerBehaviorRegua ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* 12. Opção de editar a verificação de segurança */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Editar Verificação de Segurança
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Editar a verificação de segurança.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      editPartnerSecurityVerify: !tempPerms.editPartnerSecurityVerify,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.editPartnerSecurityVerify ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.editPartnerSecurityVerify ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* Gráfico de Prevenção de Fraudes */}
              <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                <div className="max-w-[80%] pr-2">
                  <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                    Gráfico Prevenção de Fraudes
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium leading-tight">
                    Liberar a visibilidade do gráfico de fraudes evitadas no dashboard.
                  </p>
                </div>
                <button
                  disabled={currentUser.role !== "Master"}
                  onClick={() =>
                    setTempPerms({
                      ...tempPerms,
                      viewFraudPreventionChart: !tempPerms.viewFraudPreventionChart,
                    })
                  }
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                    tempPerms.viewFraudPreventionChart ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                    tempPerms.viewFraudPreventionChart ? "left-6.5" : "left-0.5"
                  }`} />
                </button>
              </div>

              {/* Outras Permissões de Acesso */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 block">
                  Outras Permissões Legadas
                </span>

                {/* View Full CPF */}
                <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                  <div className="max-w-[80%] pr-2">
                    <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                      Visualizar CPF Integral
                    </span>
                    <p className="text-[9px] text-slate-400 font-medium leading-tight">
                      Descobre o mascaramento do CPF nas grades de dados.
                    </p>
                  </div>
                  <button
                    disabled={currentUser.role !== "Master"}
                    onClick={() =>
                      setTempPerms({
                        ...tempPerms,
                        viewFullCpf: !tempPerms.viewFullCpf,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                      tempPerms.viewFullCpf ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                      tempPerms.viewFullCpf ? "left-6.5" : "left-0.5"
                    }`} />
                  </button>
                </div>

                {/* View Values */}
                <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkMode ? "bg-slate-850/20 border-slate-800" : "bg-slate-50/40 border-slate-150"}`}>
                  <div className="max-w-[80%] pr-2">
                    <span className={`text-[11px] font-bold uppercase block ${isDarkMode ? "text-slate-200" : "text-slate-750"}`}>
                      Visualizar Valores Financeiros
                    </span>
                    <p className="text-[9px] text-slate-400 font-medium leading-tight">
                      Exibe valores de propostas e do relatório financeiro.
                    </p>
                  </div>
                  <button
                    disabled={currentUser.role !== "Master"}
                    onClick={() =>
                      setTempPerms({
                        ...tempPerms,
                        viewValues: !tempPerms.viewValues,
                      })
                    }
                    className={`w-12 h-6 rounded-full transition-all relative shrink-0 disabled:opacity-45 ${
                      tempPerms.viewValues ? "bg-emerald-600" : "bg-slate-400 dark:bg-slate-700"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow-md ${
                      tempPerms.viewValues ? "left-6.5" : "left-0.5"
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setIsPermissionsModalOpen(false);
                  setSelectedPermsUser(null);
                }}
                className={`py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                Cancelar
              </button>
              <button
                disabled={currentUser.role !== "Master"}
                onClick={handleSavePermissions}
                className={`py-5 rounded-3xl font-black text-xs uppercase tracking-widest transition-all shadow-xl disabled:opacity-30 ${isDarkMode ? "bg-indigo-650 text-white hover:bg-indigo-500" : "bg-slate-900 text-white hover:bg-black"}`}
              >
                Salvar Permissões
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusCard: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
  isDarkMode?: boolean;
  disabled?: boolean;
}> = ({ active, onClick, icon, label, desc, isDarkMode, disabled }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`flex flex-col items-center text-center p-6 rounded-3xl border-2 transition-all group ${
      disabled
        ? isDarkMode
          ? "opacity-55 cursor-not-allowed bg-slate-800/25 border-transparent text-slate-500"
          : "opacity-55 cursor-not-allowed bg-slate-100 border-transparent text-slate-400"
        : active
          ? "bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-200"
          : isDarkMode
            ? "bg-slate-800/50 border-transparent text-slate-500 hover:bg-slate-800 hover:border-slate-700"
            : "bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200"
    }`}
  >
    <div
      className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${active && !disabled ? "bg-white/20 text-white" : isDarkMode ? "bg-slate-900 text-slate-600 shadow-sm border border-slate-800 group-hover:text-blue-500" : "bg-white text-slate-300 shadow-sm border border-slate-100 group-hover:text-blue-500"}`}
    >
      {icon}
    </div>
    <span className="text-xs font-black mb-1 uppercase tracking-tight">
      {label}
    </span>
    <p
      className={`text-[10px] font-medium leading-relaxed px-2 ${active && !disabled ? "text-blue-100" : "text-slate-400"}`}
    >
      {desc}
    </p>
  </button>
);

const ToggleItem: React.FC<{
  label: string;
  active: boolean;
  onToggle: () => void;
  isDarkMode?: boolean;
  disabled?: boolean;
}> = ({ label, active, onToggle, isDarkMode, disabled }) => (
  <div
    className={`flex items-center justify-between p-4 rounded-2xl border ${isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-white/5 border-white/10"} ${disabled ? "opacity-55" : ""}`}
  >
    <span
      className={`text-xs font-black uppercase tracking-tight ${isDarkMode ? "text-slate-300" : "text-white"}`}
    >
      {label}
    </span>
    <button
      disabled={disabled}
      onClick={onToggle}
      className={`w-12 h-6 rounded-full transition-all relative ${disabled ? "cursor-not-allowed bg-slate-800" : active ? "bg-blue-500" : isDarkMode ? "bg-slate-700" : "bg-slate-700"}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${active ? "left-7" : "left-1"}`}
      />
    </button>
  </div>
);


import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CSVUploader } from './components/CSVUploader';
import { Sidebar, ViewType } from './components/Sidebar';
import { ProposalQueue } from './components/ProposalQueue';
import { SettingsView } from './components/SettingsView';
import { DashboardView, DashboardErrorBoundary } from './components/DashboardView';
import { HistoryView } from './components/HistoryView';
import { AgendaView } from './components/AgendaView';
import { LoginView } from './components/LoginView';
import { BaseManagementView } from './components/BaseManagementView';
// Fix: Added PartnerRule to imports
import { Proposal, RiskStatus, AppRules, UserAccount, BankMapping, DecisionEntry, AgendaEntry, PartnerRule, BaseImport } from './types';
import { REGRAS_SCORE } from './src/services/governanceService';
import { transitionProposalStatus } from './utils';
import { Clock, Database, Activity, Search, Info, LogOut, AlertCircle, X, BellRing, CalendarPlus, Undo2, Filter, SlidersHorizontal, ChevronDown, Landmark, Calendar, PhoneCall } from 'lucide-react';

const STORAGE_KEY_RULES = 'riskflow_rules_v4';
const STORAGE_KEY_LAYOUTS = 'riskflow_bank_layouts';
const STORAGE_KEY_HISTORY = 'riskflow_decision_history';
const STORAGE_KEY_PROPOSALS = 'riskflow_unified_db';
const STORAGE_KEY_USERS = 'riskflow_users_v4';
const STORAGE_KEY_AGENDA = 'riskflow_agenda_v4';
const SESSION_KEY_AUTH = 'riskflow_current_session';

export interface TimeFilter {
  type: 'all' | 'today' | 'month' | 'custom';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  icon?: string;
  actionLabel?: string;
  onActionClick?: () => void;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = sessionStorage.getItem(SESSION_KEY_AUTH);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username && parsed.username.toLowerCase() === 'administrador') {
          parsed.password = '1234';
          sessionStorage.setItem(SESSION_KEY_AUTH, JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) { return null; }
    }
    return null;
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const notifiedIds = useRef<Set<string>>(new Set());
  const handleAtenderAgendaRef = useRef<(ade: string) => void>();
  const [schedulingProposal, setSchedulingProposal] = useState<Proposal | null>(null);
  const [activeCpfAnalysis, setActiveCpfAnalysis] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('riskflow_dark_mode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('riskflow_dark_mode', isDarkMode.toString());
  }, [isDarkMode]);

  // --- ESTADO DOS FILTROS AVANÇADOS ---
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedBancos, setSelectedBancos] = useState<string[]>([]);
  const [selectedStatusCategories, setSelectedStatusCategories] = useState<string[]>([]);
  const [minDuration, setMinDuration] = useState(0);
  const [filterStartDate, setFilterStartDate] = useState('');

  const STATUS_OPCOES: Record<string, string[]> = {
    "Sendo Analisado": ["Em análise", "Em conferência", "Pré-consistência", "ANALISE_PROMOTORA"],
    "Pendente": ["Pendente", "Aguardando Documento", "PENDENTE"],
    "Aprovado": ["Aprovado", "Concluído", "APROVADA", "Aguardando liberação"],
    "Reprovado": ["Reprovado", "Cancelado", "RECUSADA"]
  };

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', icon?: string, actionLabel?: string, onActionClick?: () => void) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, icon, actionLabel, onActionClick }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, actionLabel ? 20000 : 4500);
  }, []);

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [agenda, setAgenda] = useState<AgendaEntry[]>([]);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoExpandId, setAutoExpandId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [settingsTab, setSettingsTab] = useState<'partner' | 'covenant' | 'access' | 'governance' | 'email' | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>({
    type: 'all',
    startDate: '',
    endDate: ''
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (activeCpfAnalysis) {
      setIsSidebarCollapsed(true);
    }
  }, [activeCpfAnalysis]);
  
  const [history, setHistory] = useState<DecisionEntry[]>([]);
  const [importedBases, setImportedBases] = useState<BaseImport[]>([]);
  const [rules, setRules] = useState<AppRules>({ partners: {}, covenants: {} });
  const [bankLayouts, setBankLayouts] = useState<Record<string, BankMapping>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [resProposals, resUsers, resAgenda, resHistory, resBases, resRules, resLayouts] = await Promise.all([
          fetch('/api/proposals').then(r => r.json()),
          fetch('/api/users').then(r => r.json()),
          fetch('/api/agenda').then(r => r.json()),
          fetch('/api/decision-history').then(r => r.json()),
          fetch('/api/imported-bases').then(r => r.json()),
          fetch('/api/rules').then(r => r.json()),
          fetch('/api/layouts').then(r => r.json())
        ]);
        setProposals(resProposals);
        setUsers(resUsers);
        setAgenda(resAgenda);
        setHistory(resHistory);
        setImportedBases(resBases);
        setRules(resRules);
        setBankLayouts(resLayouts);
      } catch (err) {
        console.error("Erro ao carregar dados do backend:", err);
        addToast("Erro ao carregar dados do banco.", "error");
      }
    };
    loadData();
  }, [addToast]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = new Date();
      const todayStr = now.toLocaleDateString('pt-BR');
      
      agenda.forEach(item => {
        if (item.status === 'Pendente' && item.data === todayStr && !notifiedIds.current.has(item.id)) {
          const [hours, minutes] = item.hora.split(':').map(Number);
          const agendaTime = new Date();
          agendaTime.setHours(hours, minutes, 0, 0);
          
          const diffInMinutes = (agendaTime.getTime() - now.getTime()) / (1000 * 60);
          
          if (diffInMinutes >= -1 && diffInMinutes <= 4) {
            addToast(
              `LEMBRETE: ADE ${item.ade} agendado para ${item.hora}`, 
              'error', 
              undefined, 
              'Ligar Agora', 
              () => {
                handleAtenderAgendaRef.current?.(item.ade);
              }
            );
            notifiedIds.current.add(item.id);
          }
        }
      });
    }, 15000);

    return () => clearInterval(checkInterval);
  }, [agenda, addToast]);



  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    sessionStorage.setItem(SESSION_KEY_AUTH, JSON.stringify(user));
    addToast(`Bem-vindo, ${user.username}!`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY_AUTH);
    setSelectedId(null);
    setCurrentView('dashboard');
    notifiedIds.current.clear();
  };

  useEffect(() => {
    if (currentUser) {
      const match = users.find(u => u.id === currentUser.id);
      if (match) {
        if (JSON.stringify(match.permissions) !== JSON.stringify(currentUser.permissions) ||
            match.role !== currentUser.role ||
            match.active !== currentUser.active) {
          if (!match.active) {
            handleLogout();
            addToast("Sua conta foi desativada.", "error");
          } else {
            setCurrentUser(match);
            sessionStorage.setItem(SESSION_KEY_AUTH, JSON.stringify(match));
          }
        }
      }
    }
  }, [users, currentUser]);

  const registerDecision = useCallback((proposal: Proposal, decision: RiskStatus | 'IMPORTAÇÃO' | 'ASSUMIU' | 'FINALIZOU' | 'LIBEROU', motivo: string, analista: string = currentUser?.username || "Analista", acao: string = "DECISÃO", aiAnalysisResult?: any, contactAttachment?: any, fraudCategory?: string, fraudSubMotive?: string) => {
    const entry: DecisionEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toLocaleString('pt-BR'),
      ade: proposal.ade,
      cliente: proposal.nomeCliente,
      banco: proposal.banco,
      decisao: decision,
      motivo: motivo,
      analista: analista,
      acao: acao,
      aiAnalysisResult,
      contactAttachment,
      fraudCategory,
      fraudSubMotive
    };
    setHistory(prev => [entry, ...prev]);
    fetch('/api/decision-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(err => console.error("Erro ao registrar decisão no banco:", err));
  }, [currentUser]);

  const handleProposalsLoaded = useCallback((data: Proposal[], fileName: string, rawContent: string, bankName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const initialLogs: DecisionEntry[] = [];
    
    const triagedData: Proposal[] = data.map(proposal => {
      const match = proposal.corretor.match(/\d+/);
      const partnerCode = match ? match[0] : proposal.corretor;
      const partnerRule: PartnerRule = rules.partners[partnerCode.toUpperCase()] || rules.partners[proposal.corretor.toUpperCase()] || { status: 'ACTING' as any, limite: 4000.00, sla: 'Normal' as any, selfie: true, doc: false };
      const covenantRule = rules.covenants[proposal.convenio.toUpperCase()] || rules.covenants[proposal.convenio] || null;

      let status: RiskStatus = 'PENDING';
      let obs = '';
      if (partnerRule.name) obs = `[${partnerRule.name} - ${partnerRule.classification || 'N/I'}] `;

      const rawStatusNorm = (proposal.originalStatus || '').toUpperCase().trim();
      if (rawStatusNorm === 'CONTATO TELEFONICO' || rawStatusNorm === 'CONTATO_TELEFONICO') {
        status = 'CONTACT';
        obs += 'Importado: Contato por telefone';
      } else if (rawStatusNorm === 'MESA' || rawStatusNorm === 'ANALISE DOC' || rawStatusNorm === 'ANALISE_DOC') {
        status = 'PENDING';
        obs += 'Importado: Análise manual';
      } else if (partnerRule.status === 'NON_ACTING') {
        status = 'WAITING_REQUEST';
        obs += 'Parceiro parado';
      } else if (partnerRule.status === 'ANALYSIS_100') {
        status = 'PENDING';
        obs += 'Análise manual obrigatória';
      } else {
        const withinPartnerLimit = proposal.valorFinanciado <= (partnerRule.limite || 0);
        const withinCovenantLimit = covenantRule ? proposal.valorFinanciado <= covenantRule.teto : true;
        if (partnerRule.status === 'ACTING' && withinPartnerLimit && withinCovenantLimit) {
          status = 'AUTO_APPROVED';
          obs += 'Aprovado automaticamente';
        } else {
          status = 'PENDING';
          obs += !withinPartnerLimit ? 'Acima do limite do parceiro' : !withinCovenantLimit ? 'Acima do limite do convênio' : '';
        }
      }

      initialLogs.push({
        id: `auto-${proposal.ade}-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleString('pt-BR'),
        ade: proposal.ade,
        cliente: proposal.nomeCliente,
        banco: proposal.banco,
        decisao: 'IMPORTAÇÃO',
        motivo: `CLASSIFICAÇÃO: ${obs || 'Importação direta'}`,
        analista: currentUser?.username || "Sistema",
        acao: "IMPORTAÇÃO"
      });

      const now = Date.now();
      return { 
        ...proposal, 
        status, 
        obs, 
        dataSistema: today, 
        sla: partnerRule.sla === 'Urgente' ? 'URGENTE' : proposal.sla,
        importedBy: currentUser?.username || "Sistema",
        createdAt: now,
        lastUpdatedStatusAt: now,
        slaRemainingMs: 3 * 3600000
      };
    });

    let newCount = 0;
    let dupCount = 0;
    triagedData.forEach(newP => {
      const exists = proposals.some(p => p.ade === newP.ade && p.banco === newP.banco);
      if (exists) {
        dupCount++;
      } else {
        newCount++;
      }
    });

    const baseId = `base-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newBase: BaseImport = {
      id: baseId,
      bankName: bankName || triagedData[0]?.banco || 'BANCO',
      fileName: fileName,
      importedAt: Date.now(),
      importedBy: currentUser?.username || 'Sistema',
      newCount,
      dupCount,
      rawContent: rawContent || '',
      proposalIds: triagedData.map(p => p.id)
    };

    setImportedBases(prev => [newBase, ...prev]);

    setProposals(prev => {
      const merged = [...prev];
      triagedData.forEach(newP => {
        const existingIdx = merged.findIndex(p => p.ade === newP.ade && p.banco === newP.banco);
        if (existingIdx > -1) {
          const oldP = merged[existingIdx];
          merged[existingIdx] = { ...newP, uploadedFiles: oldP.uploadedFiles, documentacao: oldP.documentacao };
        } else {
          merged.push(newP);
        }
      });
      return merged;
    });

    setHistory(prev => [...initialLogs, ...prev]);

    // DB calls
    fetch('/api/imported-bases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBase)
    }).catch(err => console.error(err));

    fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(triagedData)
    }).catch(err => console.error(err));

    for (const log of initialLogs) {
      fetch('/api/decision-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      }).catch(err => console.error(err));
    }

    addToast(`Planilha "${fileName}" importada com sucesso.`, "success");
    setCurrentView('dashboard');
  }, [rules, addToast, currentUser, proposals]);

  const handleUpdateBaseContent = useCallback((baseId: string, updatedRawContent: string, newFileName?: string) => {
    const base = importedBases.find(b => b.id === baseId);
    if (!base) return;

    const layout = bankLayouts[base.bankName];
    if (!layout) {
      addToast(`Erro: Não foi encontrado layout do banco "${base.bankName}".`, 'error');
      return;
    }

    const lines = updatedRawContent.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) {
      addToast('Erro: Conteúdo CSV inválido.', 'error');
      return;
    }

    const firstLine = lines[0];
    const sep = layout.sep || (firstLine.includes(';') ? ';' : ',');
    const headers = firstLine.split(sep).map(h => h.trim());

    const getColIndex = (colName: string) => headers.indexOf(colName);
    const activityIdx = getColIndex(layout.atividade);
    const faseIdx = getColIndex(layout.fase);

    const classifier = (text: string): string => {
      const txt = String(text || '').toUpperCase();
      if (/INSS|DATAPREV|APOSENT/.test(txt)) return 'INSS';
      if (/SIAPE|FEDERAL|SERVIDOR|ORGAO CENTRAL/.test(txt)) return 'FEDERAL (SIAPE)';
      if (/GOV|ESTADO|PREFEITURA|PREF|MUNICIP|GDF/.test(txt)) return 'GOVERNOS/PREFEITURAS';
      if (/MARINHA|AERONAUTICA|EXERCITO|MILITAR|PM|POLICIA/.test(txt)) return 'FORÇAS MILITARES';
      if (/PRIVADO|CLT/.test(txt)) return 'PRIVADO (CLT)';
      return 'OUTROS';
    };

    const parsedProposals: Proposal[] = [];
    const today = new Date().toISOString().split('T')[0];

    const dataRows = lines.slice(1);
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const cols = row.split(sep);

      const originalStatusRaw = activityIdx !== -1 ? (cols[activityIdx]?.trim() || '') : '';
      const faseAtuacaoRaw = faseIdx !== -1 ? (cols[faseIdx]?.trim() || '') : '';

      if (activityIdx !== -1 && layout.filterValue) {
        if (originalStatusRaw.toUpperCase() !== layout.filterValue.toUpperCase()) continue;
      }

      const getValue = (key: keyof BankMapping) => {
        const idx = getColIndex((layout as any)[key]);
        return (idx !== -1 && cols[idx]) ? cols[idx].trim() : 'N/I';
      };

      const ade = getValue('ade');
      if (!ade || ade === 'N/I') continue;

      const cleanVal = (val: string) => {
        if (!val || val === 'N/I') return '0';
        return val.toString()
          .replace(/R\$/g, '')
          .replace(/\s/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
          .trim();
      };

      const vParcela = cleanVal(getValue('valor'));
      const vFinanciado = cleanVal(getValue('valorFinanciado'));
      const rawCpf = getValue('cpf').replace(/\D/g, '');
      const rawConvenio = getValue('convenio');

      const match = getValue('corretor').match(/\d+/);
      const partnerCode = match ? match[0] : getValue('corretor');
      const partnerRule = rules.partners[partnerCode.toUpperCase()] || rules.partners[getValue('corretor').toUpperCase()] || { status: 'ACTING' as any, limite: 4000.00, sla: 'Normal' as any, selfie: true, doc: false };
      const covenantRule = rules.covenants[rawConvenio.toUpperCase()] || rules.covenants[rawConvenio] || null;

      let status: RiskStatus = 'PENDING';
      let obs = '';
      if (partnerRule.name) obs = `[${partnerRule.name} - ${partnerRule.classification || 'N/I'}] `;

      const rawStatusNorm = originalStatusRaw.toUpperCase().trim();
      if (rawStatusNorm === 'CONTATO TELEFONICO' || rawStatusNorm === 'CONTATO_TELEFONICO') {
        status = 'CONTACT';
        obs += 'Editado: Contato por telefone';
      } else if (rawStatusNorm === 'MESA' || rawStatusNorm === 'ANALISE DOC' || rawStatusNorm === 'ANALISE_DOC') {
        status = 'PENDING';
        obs += 'Editado: Análise manual';
      } else if (partnerRule.status === 'NON_ACTING') {
        status = 'WAITING_REQUEST';
        obs += 'Parceiro parado';
      } else if (partnerRule.status === 'ANALYSIS_100') {
        status = 'PENDING';
        obs += 'Análise manual obrigatória';
      } else {
        const withinPartnerLimit = (parseFloat(vFinanciado) || 0) <= (partnerRule.limite || 0);
        const withinCovenantLimit = covenantRule ? (parseFloat(vFinanciado) || 0) <= covenantRule.teto : true;
        if (partnerRule.status === 'ACTING' && withinPartnerLimit && withinCovenantLimit) {
          status = 'AUTO_APPROVED';
          obs += 'Aprovado automaticamente';
        } else {
          status = 'PENDING';
          obs += !withinPartnerLimit ? 'Acima do limite do parceiro' : !withinCovenantLimit ? 'Acima do limite do convênio' : '';
        }
      }

      const now = Date.now();
      parsedProposals.push({
        id: `prop-${ade}-${i}-${now}`,
        ade: ade,
        documentacao: 'Pendente',
        banco: base.bankName.toUpperCase(),
        convenio: rawConvenio,
        categoriaConvenio: classifier(rawConvenio),
        produto: getValue('produto'),
        corretor: getValue('corretor'),
        valor: parseFloat(vParcela) || 0,
        valorFinanciado: parseFloat(vFinanciado) || 0,
        cpf: rawCpf,
        nomeCliente: getValue('cliente'),
        sla: partnerRule.sla === 'Urgente' ? 'URGENTE' : '03:00:00',
        obs: obs,
        status: status,
        originalStatus: originalStatusRaw,
        faseAtuacao: faseAtuacaoRaw,
        dataSistema: today,
        importedBy: base.importedBy,
        createdAt: now,
        lastUpdatedStatusAt: now,
        slaRemainingMs: 3 * 3600000
      });
    }

    const otherProposals = proposals.filter(p => !base.proposalIds.includes(p.id));

    let newCount = 0;
    let dupCount = 0;
    parsedProposals.forEach(wp => {
      const exists = otherProposals.some(op => op.ade === wp.ade && op.banco === wp.banco);
      if (exists) {
        dupCount++;
      } else {
        newCount++;
      }
    });

    setProposals(prev => {
      const filtered = prev.filter(p => !base.proposalIds.includes(p.id));
      const merged = [...filtered];
      parsedProposals.forEach(newP => {
        const existingIdx = merged.findIndex(p => p.ade === newP.ade && p.banco === newP.banco);
        if (existingIdx > -1) {
          const oldP = merged[existingIdx];
          merged[existingIdx] = { ...newP, uploadedFiles: oldP.uploadedFiles, documentacao: oldP.documentacao };
        } else {
          merged.push(newP);
        }
      });
      return merged;
    });

    const updatedBase = {
      ...base,
      fileName: newFileName || base.fileName,
      newCount,
      dupCount,
      rawContent: updatedRawContent,
      proposalIds: parsedProposals.map(p => p.id)
    };

    setImportedBases(prev => prev.map(b => b.id === baseId ? updatedBase : b));

    // DB calls
    for (const pId of base.proposalIds) {
      fetch(`/api/proposals/${pId}`, { method: 'DELETE' }).catch(err => console.error(err));
    }
    fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedProposals)
    }).catch(err => console.error(err));
    fetch('/api/imported-bases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedBase)
    }).catch(err => console.error(err));

    addToast(`Planilha "${newFileName || base.fileName}" atualizada.`, 'success');
  }, [importedBases, bankLayouts, proposals, rules, addToast]);

  const handleDeleteBase = useCallback((baseId: string) => {
    const base = importedBases.find(b => b.id === baseId);
    if (!base) return;

    setProposals(prev => prev.filter(p => !base.proposalIds.includes(p.id)));
    setImportedBases(prev => prev.filter(b => b.id !== baseId));

    fetch(`/api/imported-bases/${baseId}`, { method: 'DELETE' }).catch(err => console.error(err));
    for (const pId of base.proposalIds) {
      fetch(`/api/proposals/${pId}`, { method: 'DELETE' }).catch(err => console.error(err));
    }

    addToast(`Planilha "${base.fileName}" e ${base.proposalIds.length} propostas foram removidas.`, 'success');
  }, [importedBases, addToast]);

  const handleDeleteAllProposals = useCallback(async () => {
    if (confirm("⚠️ ATENÇÃO: Deseja apagar TODAS as propostas do sistema?\n\nTodas as propostas, agendamentos e planilhas importadas serão removidos.\n\nIsso não pode ser desfeito!")) {
      setProposals([]);
      setImportedBases([]);
      setAgenda([]);
      try {
        await fetch('/api/proposals/clear-all', { method: 'POST' });
        addToast("Todas as propostas foram apagadas.", "success", "🗑️");
      } catch (err) {
        console.error(err);
      }
    }
  }, [addToast]);

  const handleTakeOver = useCallback(async (id: string) => {
    if (!currentUser) return;
    
    const target = proposals.find(p => p.id === id);
    if (!target) return;

    if (target.lockedBy && target.lockedBy !== currentUser.username) {
      addToast(`Proposta já está sendo analisada por ${target.lockedBy}`, 'warning');
      return;
    }
    
    if (activeCpfAnalysis && activeCpfAnalysis !== target.cpf) {
      addToast(`Você já está analisando o CPF ${activeCpfAnalysis}. Termine ou libere antes de pegar outra.`, 'error');
      return;
    }

    registerDecision(target, 'ASSUMIU', 'Começou a analisar', currentUser.username, "ASSUMIU");
    addToast(`Você pegou a ADE ${target.ade}`, 'success');
    setActiveCpfAnalysis(target.cpf);

    setProposals(prev => prev.map(p => p.id === id ? { ...p, lockedBy: currentUser.username } : p));

    try {
      await fetch(`/api/proposals/${id}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockedBy: currentUser.username })
      });
    } catch (err) {
      console.error(err);
    }
  }, [currentUser, proposals, activeCpfAnalysis, registerDecision, addToast]);

  const handleRelease = useCallback(async (id: string) => {
    if (!currentUser) return;

    const target = proposals.find(p => p.id === id);
    if (!target) return;

    if (!target.lockedBy) {
      addToast(`Proposta já está livre`, 'info');
      return;
    }

    const operatorWhoLocked = target.lockedBy;
    registerDecision(target, 'LIBEROU', `Liberada por ${currentUser.username === operatorWhoLocked ? 'analista' : currentUser.username}`, currentUser.username, "LIBEROU");
    addToast(`ADE ${target.ade} liberada`, 'success');
    
    const remainingLockedForCpf = proposals.filter(p => p.id !== id && p.cpf === target.cpf && p.lockedBy === currentUser.username);
    if (remainingLockedForCpf.length === 0 && activeCpfAnalysis === target.cpf) {
      setActiveCpfAnalysis(null);
    }

    setProposals(prev => prev.map(p => p.id === id ? { ...p, lockedBy: null } : p));

    try {
      await fetch(`/api/proposals/${id}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockedBy: null })
      });
    } catch (err) {
      console.error(err);
    }
  }, [currentUser, proposals, activeCpfAnalysis, registerDecision, addToast]);

  const handleAtenderAgenda = useCallback(async (ade: string) => {
    if (!currentUser) return;
    
    const target = proposals.find(p => p.ade === ade);
    if (!target) {
      addToast(`ADE ${ade} não encontrada.`, 'error');
      return;
    }

    if (target.lockedBy && target.lockedBy !== currentUser.username) {
      addToast(`Proposta está com ${target.lockedBy}.`, 'warning');
      return;
    }

    if (activeCpfAnalysis && activeCpfAnalysis !== target.cpf) {
      addToast(`Você já está analisando o CPF ${activeCpfAnalysis}. Termine ou libere antes.`, 'error');
      return;
    }

    const transitioned = transitionProposalStatus(target, 'CONTACT');
    setProposals(prev => prev.map(p => 
      p.id === target.id 
        ? { ...transitioned, lockedBy: currentUser.username } 
        : p
    ));

    setActiveCpfAnalysis(target.cpf);
    registerDecision(target, 'CONTACT', 'Iniciou contato agendado', currentUser.username, "RETORNO");

    setAgenda(prev => prev.map(item => 
      item.ade === ade ? { ...item, status: 'Concluído' } : item
    ));

    setAutoExpandId(target.id);
    setCurrentView('contact');
    addToast(`Você pegou a ADE ${ade} para contato.`, 'success');

    try {
      await fetch(`/api/proposals/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CONTACT',
          lastUpdatedStatusAt: transitioned.lastUpdatedStatusAt,
          slaRemainingMs: transitioned.slaRemainingMs
        })
      });
      await fetch(`/api/proposals/${target.id}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockedBy: currentUser.username })
      });
      const agendaItem = agenda.find(item => item.ade === ade && item.status === 'Pendente');
      if (agendaItem) {
        await fetch(`/api/agenda/${agendaItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Concluído' })
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [currentUser, proposals, activeCpfAnalysis, registerDecision, addToast, agenda]);

  useEffect(() => {
    handleAtenderAgendaRef.current = handleAtenderAgenda;
  }, [handleAtenderAgenda]);

  const handleQuickSchedule = useCallback((proposal: Proposal) => {
    setSchedulingProposal(proposal);
  }, []);

  const handleFinalize = useCallback(async (id: string, status: RiskStatus, parecer: string, aiAnalysisResult?: any, contactAttachment?: any, fraudCategory?: string, fraudSubMotive?: string) => {
    if (!currentUser) return;

    const target = proposals.find(p => p.id === id);
    if (!target) return;

    let acaoLabel = 'FINALIZOU';
    if (status === 'APPROVED' || status === 'AUTO_APPROVED') {
      acaoLabel = 'APROVOU';
    } else if (status === 'REJECTED') {
      acaoLabel = 'REPROVOU';
    } else if (status === 'WAITING_DOCS' || status === 'CONTACT') {
      acaoLabel = 'PENDENCIOU';
    }

    const transitioned = transitionProposalStatus(target, status);
    setProposals(prev => prev.map(p => p.id === id ? { ...transitioned, lockedBy: null, fraudCategory, fraudSubMotive } : p));
    const remainingLockedForCpf = proposals.filter(p => p.id !== id && p.cpf === target.cpf && p.lockedBy === currentUser.username);
    if (remainingLockedForCpf.length === 0) {
      setActiveCpfAnalysis(null);
    }
    registerDecision(target, status, parecer, currentUser.username, acaoLabel, aiAnalysisResult, contactAttachment, fraudCategory, fraudSubMotive);
    addToast(`ADE ${target.ade} finalizada: ${status}`, 'success');

    try {
      await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          lastUpdatedStatusAt: transitioned.lastUpdatedStatusAt,
          slaRemainingMs: transitioned.slaRemainingMs,
          fraudCategory: fraudCategory || null,
          fraudSubMotive: fraudSubMotive || null,
          obs: target.obs
        })
      });
      await fetch(`/api/proposals/${id}/lock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockedBy: null })
      });
    } catch (err) {
      console.error(err);
    }
  }, [currentUser, proposals, registerDecision, addToast]);

  const handleSaveSchedule = async (ade: string, contato: string, data: string, hora: string, motivo: string) => {
    const newEntry: AgendaEntry = {
      id: `agenda-${Date.now()}`,
      ade,
      contato,
      data: data.split('-').reverse().join('/'),
      hora,
      motivo,
      analista: currentUser?.username || 'SISTEMA',
      status: 'Pendente'
    };
    
    setAgenda(prev => [...prev, newEntry]);
    
    const target = proposals.find(p => p.ade === ade);
    let transitioned;
    if (target) {
      transitioned = transitionProposalStatus(target, 'AGENDADO');
      setProposals(prev => prev.map(p => 
        p.ade === ade ? { ...transitioned, lockedBy: null } : p
      ));
      registerDecision(target, 'AGENDADO', `Agendado: ${motivo} (${data} às ${hora})`, currentUser?.username || 'SISTEMA', "AGENDOU");
    }

    setSchedulingProposal(null);
    setActiveCpfAnalysis(null);
    addToast(`ADE ${ade} agendada`, 'success');

    try {
      await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });
      if (target) {
        await fetch(`/api/proposals/${target.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'AGENDADO',
            lastUpdatedStatusAt: transitioned?.lastUpdatedStatusAt,
            slaRemainingMs: transitioned?.slaRemainingMs
          })
        });
        await fetch(`/api/proposals/${target.id}/lock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lockedBy: null })
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateProposalStatus = useCallback(async (id: string, status: RiskStatus, motivo: string = "") => {
    const target = proposals.find(p => p.id === id);
    if (!target) return;

    if (target.lockedBy === currentUser?.username) {
      handleFinalize(id, status, motivo);
    } else {
      const transitioned = transitionProposalStatus(target, status);
      setProposals(prev => prev.map(p => p.id === id ? transitioned : p));
      registerDecision(target, status, motivo);
      addToast(`ADE ${target.ade} alterada para ${status}.`, 'info');
      setSelectedId(null);
      try {
        await fetch(`/api/proposals/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            lastUpdatedStatusAt: transitioned.lastUpdatedStatusAt,
            slaRemainingMs: transitioned.slaRemainingMs
          })
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [proposals, currentUser, handleFinalize, registerDecision, addToast]);

  const handleUpdateProposals = useCallback(async (newProposals: Proposal[]) => {
    const deletedIds = proposals.filter(p => !newProposals.some(np => np.id === p.id)).map(p => p.id);
    setProposals(newProposals);
    try {
      for (const id of deletedIds) {
        await fetch(`/api/proposals/${id}`, { method: 'DELETE' });
      }
      if (newProposals.length > 0) {
        await fetch('/api/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProposals)
        });
      }
    } catch (err) {
      console.error(err);
      addToast("Erro ao salvar propostas no banco.", "error");
    }
  }, [proposals, addToast]);

  const handleUpdateRules = useCallback(async (newRules: AppRules) => {
    setRules(newRules);
    try {
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_key: 'partners', rule_data: newRules.partners })
      });
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_key: 'covenants', rule_data: newRules.covenants })
      });
    } catch (err) {
      console.error(err);
      addToast("Erro ao salvar regras no banco.", "error");
    }
  }, [addToast]);

  const handleUpdateUsers = useCallback(async (newUsers: UserAccount[]) => {
    const deletedUserIds = users.filter(u => !newUsers.some(nu => nu.id === u.id)).map(u => u.id);
    setUsers(newUsers);
    try {
      for (const id of deletedUserIds) {
        await fetch(`/api/users/${id}`, { method: 'DELETE' });
      }
      for (const u of newUsers) {
        const exists = users.some(oldU => oldU.id === u.id);
        if (exists) {
          await fetch(`/api/users/${u.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(u)
          });
        } else {
          await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(u)
          });
        }
      }
    } catch (err) {
      console.error(err);
      addToast("Erro ao salvar usuários.", "error");
    }
  }, [users, addToast]);

  const handleUpdateBankLayouts = useCallback(async (newLayouts: Record<string, BankMapping>) => {
    const deletedBanks = Object.keys(bankLayouts).filter(bank => !newLayouts[bank]);
    setBankLayouts(newLayouts);
    try {
      for (const bank of deletedBanks) {
        await fetch(`/api/layouts/${bank}`, { method: 'DELETE' });
      }
      for (const [bank, layout] of Object.entries(newLayouts)) {
        await fetch('/api/layouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bank_name: bank, layout_data: layout })
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [bankLayouts]);

  const handleUpdateHistory = useCallback(async (newHistory: DecisionEntry[]) => {
    const deletedLogIds = history.filter(h => !newHistory.some(nh => nh.id === h.id)).map(h => h.id);
    setHistory(newHistory);
    try {
      for (const id of deletedLogIds) {
        await fetch(`/api/decision-history/${id}`, { method: 'DELETE' });
      }
      for (const entry of newHistory) {
        const exists = history.some(h => h.id === entry.id);
        if (!exists) {
          await fetch('/api/decision-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [history]);

  const handleUpdateAgenda = useCallback(async (newAgenda: AgendaEntry[]) => {
    const deletedAgendaIds = agenda.filter(a => !newAgenda.some(na => na.id === a.id)).map(a => a.id);
    setAgenda(newAgenda);
    try {
      for (const id of deletedAgendaIds) {
        await fetch(`/api/agenda/${id}`, { method: 'DELETE' });
      }
      for (const item of newAgenda) {
        const exists = agenda.some(a => a.id === item.id);
        if (exists) {
          await fetch(`/api/agenda/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: item.status })
          });
        } else {
          await fetch('/api/agenda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [agenda]);



  const userScopedProposals = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.actingAreas.includes('TODAS')) return proposals;
    return proposals.filter(p => currentUser.actingAreas.includes(p.banco));
  }, [proposals, currentUser]);

  const timeFilteredProposals = useMemo(() => {
    if (timeFilter.type === 'all') return userScopedProposals;
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);
    return userScopedProposals.filter(p => {
      if (timeFilter.type === 'today') return p.dataSistema === today;
      if (timeFilter.type === 'month') return p.dataSistema?.startsWith(thisMonth);
      if (timeFilter.type === 'custom') {
        const date = p.dataSistema;
        if (!date) return false;
        if (timeFilter.startDate && date < timeFilter.startDate) return false;
        if (timeFilter.endDate && date > timeFilter.endDate) return false;
        return true;
      }
      return true;
    });
  }, [userScopedProposals, timeFilter]);

  const filteredProposals = useMemo(() => {
    let base = timeFilteredProposals;

    if (selectedBancos.length > 0) base = base.filter(p => selectedBancos.includes(p.banco));

    if (selectedStatusCategories.length > 0) {
      base = base.filter(p => {
        const original = (p.originalStatus || '').toUpperCase();
        return selectedStatusCategories.some(cat => {
          const list = STATUS_OPCOES[cat].map(s => s.toUpperCase());
          return list.some(item => original.includes(item));
        });
      });
    }

    if (currentView === 'analyze') base = base.filter(p => p.status === 'PENDING');
    else if (currentView === 'contact') base = base.filter(p => p.status === 'CONTACT');
    else if (currentView === 'auto_approved') base = base.filter(p => p.status === 'AUTO_APPROVED');
    else if (currentView === 'waiting_request') base = base.filter(p => p.status === 'WAITING_REQUEST');
    else if (currentView === 'scheduled') base = base.filter(p => p.status === 'AGENDADO');
    else if (currentView === 'approved') base = base.filter(p => p.status === 'APPROVED');
    else if (currentView === 'pending') base = base.filter(p => p.status === 'WAITING_DOCS');
    else if (currentView === 'rejected') base = base.filter(p => p.status === 'REJECTED');

    return base.filter(p => 
      p.nomeCliente.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.ade.includes(searchTerm) || (p.cpf && p.cpf.includes(searchTerm))
    );
  }, [timeFilteredProposals, currentView, searchTerm, selectedBancos, selectedStatusCategories]);

  if (!currentUser) return <LoginView users={users} onLogin={handleLogin} />;

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {isDarkMode && (
        <>
          <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
          <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        </>
      )}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm md:max-w-md">
        {toasts.map(t => (
          <div key={t.id} className={`flex flex-col gap-2.5 p-5 rounded-2xl shadow-2xl border-2 animate-in slide-in-from-right-10 duration-300 ${
            t.type === 'success' ? 'bg-slate-900 border-emerald-500/50 text-white' :
            t.type === 'error' ? 'bg-[#1e1b1b] border-red-500/50 text-white' :
            t.type === 'warning' ? 'bg-[#221510] border-orange-500/50 text-white' :
            'bg-slate-900 border-slate-700 text-white'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-bold flex-1 leading-snug">{t.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} 
                className="opacity-50 hover:opacity-100 transition-opacity p-1"
              >
                <X size={16} />
              </button>
            </div>
            {t.actionLabel && t.onActionClick && (
              <button
                onClick={() => {
                  t.onActionClick?.();
                  setToasts(prev => prev.filter(x => x.id !== t.id));
                }}
                className={`mt-1.5 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all self-start shadow-md hover:shadow-lg ${
                  t.type === 'error'
                    ? 'bg-red-650 text-white hover:bg-red-550 active:scale-95'
                    : 'bg-indigo-600 text-white hover:bg-indigo-550 active:scale-95'
                }`}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>

      <Sidebar 
        currentView={currentView} 
        onViewChange={(v) => { 
          setCurrentView(v); 
          setSelectedId(null); 
          if (v !== 'analyze' && v !== 'contact') setAutoExpandId(null);
          const operationalViews = ['analyze', 'contact', 'scheduled', 'waiting_request', 'pending', 'approved', 'rejected', 'auto_approved'];
          if (operationalViews.includes(v)) {
            setIsSidebarCollapsed(true);
          } else {
            setIsSidebarCollapsed(false);
          }
        }}
        settingsTab={settingsTab}
        onSettingsTabChange={setSettingsTab}
        hasData={userScopedProposals.length > 0}
        proposals={userScopedProposals}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeCpfAnalysis={activeCpfAnalysis}
        onReleaseCpf={() => setActiveCpfAnalysis(null)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="login-info-container">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <div className="user-name-label">{currentUser.username}</div>
                <div className="user-role-label">{currentUser.role}</div>
              </div>
              <button 
                onClick={handleLogout}
                className={`p-2 rounded-full transition-all duration-300 group ${isDarkMode ? 'bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400' : 'bg-white hover:bg-red-50 text-slate-500 hover:text-red-600 shadow-sm'}`}
                title="Sair"
              >
                <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-16">
          {currentView === 'settings' ? (
            <div className="p-8">
               <SettingsView 
                  proposals={proposals} 
                  onUpdateProposals={handleUpdateProposals} 
                  rules={rules} 
                  onUpdateRules={handleUpdateRules}
                  users={users}
                  onUpdateUsers={handleUpdateUsers}
                  bankLayouts={bankLayouts}
                  onUpdateBankLayouts={handleUpdateBankLayouts}
                  history={history}
                  onUpdateHistory={handleUpdateHistory}
                  addToast={addToast}
                  currentUser={currentUser}
                  isDarkMode={isDarkMode}
                  activeTab={settingsTab}
                  onTabChange={setSettingsTab}
               />
            </div>
          ) : currentView === 'import' ? (
            <div className="p-8 max-w-screen-xl mx-auto">
               <CSVUploader 
                 onDataLoaded={handleProposalsLoaded} 
                 bankMemory={bankLayouts} 
                 onUpdateBankMemory={setBankLayouts} 
                 currentBaseSize={proposals.length} 
                 isDarkMode={isDarkMode}
               />
            </div>
          ) : currentView === 'dashboard' ? (
            <DashboardErrorBoundary isDarkMode={isDarkMode}>
              <DashboardView proposals={timeFilteredProposals} onNavigate={setCurrentView} history={history} isDarkMode={isDarkMode} currentUser={currentUser || undefined} users={users} importedBases={importedBases} timeFilter={timeFilter} />
            </DashboardErrorBoundary>
          ) : currentView === 'history' ? (
            <HistoryView history={history} isDarkMode={isDarkMode} />
          ) : currentView === 'base_management' ? (
            <BaseManagementView 
              bases={importedBases} 
              onDeleteBase={handleDeleteBase} 
              onUpdateBaseContent={handleUpdateBaseContent} 
              isDarkMode={isDarkMode} 
              onDeleteAllProposals={handleDeleteAllProposals}
            />
          ) : currentView === 'scheduled' ? (
            <AgendaView agenda={agenda} onUpdateAgenda={handleUpdateAgenda} addToast={addToast} currentUser={currentUser!} isDarkMode={isDarkMode} onAtenderAgenda={handleAtenderAgenda} />
          ) : (
            <div className={`p-8 space-y-8 mx-auto w-full transition-all duration-300 ${isSidebarCollapsed ? 'max-w-none px-4 md:px-12' : 'max-w-screen-2xl'}`}>
                <div className="header-riskflow">
                    <h1 className="titulo-pagina">
                      {currentView === 'analyze' ? '📋 Aguardando Análise' : 
                       currentView === 'contact' ? '📞 Em Contato' :
                       currentView === 'auto_approved' ? 'Aprovados Automático' :
                       currentView === 'waiting_request' ? 'Parados' :
                       currentView === 'pending' ? 'Pendências' :
                       currentView === 'approved' ? 'Aprovados' :
                       currentView === 'rejected' ? 'Reprovados' :
                       currentView === 'scheduled' ? 'Agendados' : 'Fila de Trabalho'}
                    </h1>
                    <div className="contador-quantidade">
                      {currentView === 'analyze' ? 'AGUARDANDO ANÁLISE: ' : 
                       currentView === 'contact' ? 'EM CONTATO: ' : 
                       'TOTAL: '}{filteredProposals.length}
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-4 text-center mb-2">
                    <div className="relative w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Buscar por cliente, ADE ou CPF..."
                            className={`w-full pl-12 pr-4 py-3 border rounded-2xl text-sm font-medium outline-none focus:ring-4 transition-all shadow-sm ${isDarkMode ? 'bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500/10' : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-100'}`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <ProposalQueue 
                    proposals={filteredProposals}
                    rules={rules}
                    onTakeOver={handleTakeOver}
                    onRelease={handleRelease}
                    onFinalize={handleFinalize}
                    onQuickSchedule={handleQuickSchedule}
                    permissions={currentUser.permissions}
                    currentUser={currentUser}
                    history={history}
                    activeCpfAnalysis={activeCpfAnalysis}
                    isDarkMode={isDarkMode}
                    initialExpandedId={autoExpandId}
                    isSidebarCollapsed={isSidebarCollapsed}
                />
            </div>
          )}
        </div>
      </main>

      {/* MODAL DE AGENDAMENTO RÁPIDO */}
      {schedulingProposal && (
        <QuickScheduleModal 
          proposal={schedulingProposal}
          onClose={() => setSchedulingProposal(null)}
          onSave={handleSaveSchedule}
          isDarkMode={isDarkMode}
        />
      )}


    </div>
  );
};

const QuickScheduleModal: React.FC<{ 
  proposal: Proposal; 
  onClose: () => void; 
  onSave: (ade: string, contato: string, data: string, hora: string, motivo: string) => void;
  isDarkMode: boolean;
}> = ({ proposal, onClose, onSave, isDarkMode }) => {
  const [formData, setFormData] = useState({
    contato: '',
    data: new Date().toISOString().split('T')[0],
    hora: '',
    motivo: 'AGENDAMENTO MANUAL',
    motivoManual: ''
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl space-y-8 border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-white/20'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl"><CalendarPlus size={28} /></div>
            <div>
              <h3 className={`text-2xl font-black uppercase tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Agendar Retorno</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase mt-2">ADE: {proposal.ade} - {proposal.nomeCliente}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
              <input 
                type="date" 
                className={`w-full p-4 border rounded-2xl outline-none text-sm font-bold transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100'}`}
                value={formData.data}
                onChange={(e) => setFormData({...formData, data: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora</label>
              <input 
                type="time" 
                className={`w-full p-4 border rounded-2xl outline-none text-sm font-bold transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100'}`}
                value={formData.hora}
                onChange={(e) => setFormData({...formData, hora: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / Contato</label>
            <input 
              type="text" 
              className={`w-full p-4 border rounded-2xl outline-none text-sm font-bold transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100'}`}
              placeholder="(00) 00000-0000"
              value={formData.contato}
              onChange={(e) => setFormData({...formData, contato: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tabulação / Motivo (Governança)</label>
            <select 
              className={`w-full p-4 border rounded-2xl outline-none text-sm font-bold transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100'}`}
              value={formData.motivo}
              disabled
            >
              <option value="AGENDAMENTO MANUAL">AGENDAMENTO MANUAL</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo do Agendamento (Manual)</label>
            <textarea 
              className={`w-full h-24 p-4 border rounded-2xl outline-none text-sm font-semibold transition-all resize-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500 placeholder-slate-650' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-100 placeholder-slate-400'}`}
              placeholder="Digite detalhadamente o porquê do agendamento..."
              value={formData.motivoManual}
              onChange={(e) => setFormData({...formData, motivoManual: e.target.value})}
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              const fullMotivo = formData.motivoManual.trim() 
                ? `AGENDAMENTO MANUAL - ${formData.motivoManual.trim()}` 
                : 'AGENDAMENTO MANUAL';
              onSave(proposal.ade, formData.contato, formData.data, formData.hora, fullMotivo);
            }}
            disabled={!formData.hora || !formData.contato || !formData.motivoManual.trim()}
            className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl disabled:opacity-35 ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-900 text-white hover:bg-black'}`}
          >
            Salvar Agendamento
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;

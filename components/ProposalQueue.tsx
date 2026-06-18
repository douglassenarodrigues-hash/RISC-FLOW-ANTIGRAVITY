import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Proposal, RiskStatus, UserPermissions, DecisionEntry, UserAccount, AppRules } from '../types';
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  UserCheck, 
  Lock, 
  Unlock, 
  Zap, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  History, 
  Info,
  Landmark,
  Activity,
  Trash2,
  PhoneCall,
  CalendarPlus,
  SlidersHorizontal,
  ArrowUpDown,
  Upload,
  Camera,
  Mic,
  Volume2,
  GripVertical
} from 'lucide-react';

import { calcularSaudeParceiro, REGRAS_SCORE } from '../src/services/governanceService';
import { translateStatus, formatAge, formatDuration } from '../utils';

interface PericiaRule {
  status: 'ANALISE' | 'PENDENCIA' | 'REPROVADO';
  mensagem: string;
  cor: 'normal' | 'warning' | 'error';
}

const REGRAS_PERICIA: Record<string, PericiaRule> = {
  "DOCUMENTO ILEGÍVEL": {
    status: "PENDENCIA",
    mensagem: "DOCUMENTO ILEGÍVEL - Gentileza enviar uma nova foto do documento com todos os dados legíveis e padrão.",
    cor: "warning"
  },
  "DOCUMENTO DETERIORADO": {
    status: "PENDENCIA",
    mensagem: "DOCUMENTO DETERIORADO - Solicitar um novo documento de identificação - Documento Deteriorado.",
    cor: "warning"
  },
  "FOTO CORTADA / INCOMPLETA": {
    status: "PENDENCIA",
    mensagem: "FOTO CORTADA / INCOMPLETA - A imagem enviada mostra apenas parte do documento. Gentileza reenviar o documento com enquadramento completo.",
    cor: "warning"
  },
  "DADOS BANCÁRIOS DIVERGENTES": {
    status: "PENDENCIA",
    mensagem: "DADOS BANCÁRIOS DIVERGENTES - Conta informada no contato não bate com o cadastro da proposta. Gentileza corrigir os dados bancários para reapresentação.",
    cor: "warning"
  },
  "TERCEIRO SE PASSANDO PELO CLIENTE": {
    status: "PENDENCIA",
    mensagem: "TERCEIRO SE PASSANDO PELO CLIENTE - Gentileza orientar que seja o cliente em linha realizando as confirmações.",
    cor: "warning"
  },
  "SELFIE DIVERGENTE": {
    status: "PENDENCIA",
    mensagem: "SELFIE DIVERGENTE - A foto enviada não corresponde ao portador do documento. Gentileza solicitar uma nova selfie.",
    cor: "warning"
  },
  "DIVERGÊNCIA DE TITULARIDADE": {
    status: "PENDENCIA",
    mensagem: "DIVERGÊNCIA DE TITULARIDADE - O CPF do documento anexado não confere com o cadastro da proposta. Gentileza verificar os dados digitados ou reenviar o documento correto.",
    cor: "warning"
  }
};

interface ProposalQueueProps {
  proposals: Proposal[];
  rules?: AppRules;
  onTakeOver: (id: string) => void;
  onRelease: (id: string) => void;
  onFinalize: (id: string, status: RiskStatus, parecer: string, aiAnalysisResult?: any, contactAttachment?: any) => void;
  onQuickSchedule: (proposal: Proposal) => void;
  onDelete?: (id: string) => void;
  permissions: UserPermissions;
  currentUser: UserAccount;
  history: DecisionEntry[];
  activeCpfAnalysis: string | null;
  isDarkMode: boolean;
  initialExpandedId?: string | null;
  isSidebarCollapsed?: boolean;
}

const getProductCategory = (prodName: string): 'NOVO' | 'REFIN' | 'CARTAO' | 'SAQUE' | 'PORTABILIDADE' | 'OUTROS' => {
  if (!prodName) return 'OUTROS';
  const clean = prodName.toLowerCase();
  if (clean.includes('nov')) return 'NOVO';
  if (clean.includes('refin')) return 'REFIN';
  if (clean.includes('cart') || clean.includes('crd')) return 'CARTAO';
  if (clean.includes('saque') || clean.includes('compl')) return 'SAQUE';
  if (clean.includes('port')) return 'PORTABILIDADE';
  return 'OUTROS';
};

const getCycleDescription = (cycle: number): string => {
  switch (cycle) {
    case 1:
      return 'Novo ➔ Refin ➔ Cartão ➔ Saque comp. ➔ Port';
    case 2:
      return 'Refin ➔ Cartão ➔ Saque comp. ➔ Port ➔ Novo';
    case 3:
      return 'Cartão ➔ Saque comp. ➔ Port ➔ Novo ➔ Refin';
    case 4:
      return 'Saque comp. ➔ Port ➔ Novo ➔ Refin ➔ Cartão';
    case 5:
      return 'Port ➔ Novo ➔ Refin ➔ Cartão ➔ Saque comp.';
    default:
      return 'Novo ➔ Refin ➔ Cartão ➔ Saque comp. ➔ Port';
  }
};

const getSortPriority = (category: 'NOVO' | 'REFIN' | 'CARTAO' | 'SAQUE' | 'PORTABILIDADE' | 'OUTROS', cycle: number): number => {
  const orderMap: Record<number, ('NOVO' | 'REFIN' | 'CARTAO' | 'SAQUE' | 'PORTABILIDADE')[]> = {
    1: ['NOVO', 'REFIN', 'CARTAO', 'SAQUE', 'PORTABILIDADE'],
    2: ['REFIN', 'CARTAO', 'SAQUE', 'PORTABILIDADE', 'NOVO'],
    3: ['CARTAO', 'SAQUE', 'PORTABILIDADE', 'NOVO', 'REFIN'],
    4: ['SAQUE', 'PORTABILIDADE', 'NOVO', 'REFIN', 'CARTAO'],
    5: ['PORTABILIDADE', 'NOVO', 'REFIN', 'CARTAO', 'SAQUE'],
  };
  
  const currentOrder = orderMap[cycle] || orderMap[1];
  
  if (category === 'OUTROS') return 999;
  const index = currentOrder.indexOf(category as any);
  return index !== -1 ? index : 500;
};

const getSlaRemaining = (p: Proposal): number => {
  const pSlaRemaining = p.slaRemainingMs !== undefined ? p.slaRemainingMs : 3 * 3600000;
  if (p.status === 'APPROVED' || p.status === 'AUTO_APPROVED' || p.status === 'REJECTED' || p.status === 'WAITING_DOCS') {
    return pSlaRemaining;
  }
  const elapsedSinceLastUpdate = Date.now() - (p.lastUpdatedStatusAt || p.createdAt || Date.now());
  return Math.max(0, pSlaRemaining - elapsedSinceLastUpdate);
};

export const ProposalQueue: React.FC<ProposalQueueProps> = ({ 
  proposals, 
  rules,
  onTakeOver, 
  onRelease,
  onFinalize, 
  onQuickSchedule,
  onDelete,
  permissions, 
  currentUser,
  history,
  activeCpfAnalysis,
  isDarkMode,
  initialExpandedId,
  isSidebarCollapsed = false
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId || null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FILA' | 'PRODUCT' | 'URGENT' | 'VALUE' | 'SCHEDULED' | 'MANUAL'>('ALL');
  const [productSortCycle, setProductSortCycle] = useState<number>(1);
  const [valueSortDirection, setValueSortDirection] = useState<'ASC' | 'DESC'>('DESC');
  const [slaSortDirection, setSlaSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [filaSortDirection, setFilaSortDirection] = useState<'ASC' | 'DESC'>('ASC');
  const [manualOrderIds, setManualOrderIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('riskflow_manual_order');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialExpandedId) {
      setExpandedId(initialExpandedId);
    }
  }, [initialExpandedId]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Count generators for filter options
  const ALLCount = proposals.length;
  const FILACount = proposals.filter(p => p.status === 'PENDING').length;
  const PRODUCTCount = proposals.length;
  const URGENTCount = proposals.filter(p => p.sla === 'URGENTE' || p.status === 'APPROVED' || p.status === 'AUTO_APPROVED' || p.status === 'WAITING_DOCS' || p.status === 'REJECTED').length;
  const VALUECount = proposals.length;
  const SCHEDULEDCount = proposals.filter(p => p.status === 'AGENDADO' || p.status === 'CONTACT').length;
  const MANUALCount = proposals.length;

  const filterOptions = [
    { id: 'ALL', label: 'Todas', icon: Activity, color: 'indigo' },
    { id: 'FILA', label: 'Aguardando Análise', icon: Clock, color: 'blue' },
    { id: 'PRODUCT', label: 'Produto', icon: SlidersHorizontal, color: 'emerald' },
    { id: 'URGENT', label: 'SLA (3h)', icon: AlertTriangle, color: 'rose' },
    { id: 'VALUE', label: 'Valor', icon: ArrowUpDown, color: 'orange' },
    { id: 'SCHEDULED', label: 'Agendados', icon: CalendarPlus, color: 'cyan' },
    { id: 'MANUAL', label: 'Ordem Personalizada', icon: GripVertical, color: 'indigo' },
  ] as const;

  const filteredProposals = useMemo(() => {
    switch (activeFilter) {
      case 'FILA': {
        const filtered = proposals.filter(p => p.status === 'PENDING');
        return filtered.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return filaSortDirection === 'ASC' ? timeA - timeB : timeB - timeA;
        });
      }
      case 'PRODUCT': {
        return [...proposals].sort((a, b) => {
          const catA = getProductCategory(a.produto);
          const catB = getProductCategory(b.produto);
          const prioA = getSortPriority(catA, productSortCycle);
          const prioB = getSortPriority(catB, productSortCycle);
          
          if (prioA !== prioB) {
            return prioA - prioB;
          }
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
      }
      case 'URGENT': {
        const filtered = proposals.filter(p => p.sla === 'URGENTE' || p.status === 'APPROVED' || p.status === 'AUTO_APPROVED' || p.status === 'WAITING_DOCS' || p.status === 'REJECTED');
        return filtered.sort((a, b) => {
          const slaA = getSlaRemaining(a);
          const slaB = getSlaRemaining(b);
          return slaSortDirection === 'ASC' ? slaA - slaB : slaB - slaA;
        });
      }
      case 'VALUE': {
        return [...proposals].sort((a, b) => {
          const valA = a.valorFinanciado !== undefined ? a.valorFinanciado : (a.valor || 0);
          const valB = b.valorFinanciado !== undefined ? b.valorFinanciado : (b.valor || 0);
          return valueSortDirection === 'ASC' ? valA - valB : valB - valA;
        });
      }
      case 'SCHEDULED':
        return proposals.filter(p => p.status === 'AGENDADO' || p.status === 'CONTACT');
      case 'MANUAL': {
        return [...proposals].sort((a, b) => {
          const indexA = manualOrderIds.indexOf(a.id);
          const indexB = manualOrderIds.indexOf(b.id);
          
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          
          return indexA - indexB;
        });
      }
      default:
        return proposals;
    }
  }, [proposals, activeFilter, productSortCycle, valueSortDirection, slaSortDirection, filaSortDirection, manualOrderIds]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* CHIPS DE SELEÇÃO RÁPIDA (FILTROS DINÂMICOS DE STATUS) */}
      <div className={`w-full transition-all duration-300 ${isSidebarCollapsed ? 'max-w-none' : 'max-w-[1300px]'} mb-6 flex flex-wrap gap-2.5 items-center justify-start pb-4 border-b border-dashed border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none`}>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-2 shrink-0 select-none">
          ⚡ FILTRAR POR:
        </span>
        {filterOptions.map((opt) => {
          const Icon = opt.icon;
          const count = opt.id === 'ALL' ? ALLCount :
                        opt.id === 'FILA' ? FILACount :
                        opt.id === 'PRODUCT' ? PRODUCTCount :
                        opt.id === 'URGENT' ? URGENTCount :
                        opt.id === 'VALUE' ? VALUECount :
                        opt.id === 'MANUAL' ? MANUALCount : SCHEDULEDCount;
          
          const isActive = activeFilter === opt.id;
          
          // Custom styles based on active state and color theme
          let bgStyle = '';
          let textStyle = '';
          let countBgStyle = '';

          if (isActive) {
            switch (opt.color) {
              case 'indigo':
                bgStyle = isDarkMode ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200';
                textStyle = 'text-indigo-500 dark:text-indigo-400';
                countBgStyle = isDarkMode ? 'bg-indigo-500 text-slate-950' : 'bg-indigo-600 text-white';
                break;
              case 'blue':
                bgStyle = isDarkMode ? 'bg-blue-500/20 border-blue-500/50' : 'bg-blue-50 border-blue-200';
                textStyle = 'text-blue-500 dark:text-blue-400';
                countBgStyle = isDarkMode ? 'bg-blue-500 text-slate-950' : 'bg-blue-600 text-white';
                break;
              case 'emerald':
                bgStyle = isDarkMode ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-emerald-50 border-emerald-200';
                textStyle = 'text-emerald-500 dark:text-emerald-400';
                countBgStyle = isDarkMode ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-600 text-white';
                break;
              case 'rose':
                bgStyle = isDarkMode ? 'bg-rose-500/20 border-rose-500/50' : 'bg-rose-50 border-rose-200';
                textStyle = 'text-rose-500 dark:text-rose-400';
                countBgStyle = isDarkMode ? 'bg-rose-500 text-slate-950' : 'bg-rose-600 text-white';
                break;
              case 'orange':
                bgStyle = isDarkMode ? 'bg-orange-500/20 border-orange-500/50' : 'bg-orange-50 border-orange-200';
                textStyle = 'text-orange-500 dark:text-orange-400';
                countBgStyle = isDarkMode ? 'bg-orange-500 text-slate-950' : 'bg-orange-600 text-white';
                break;
              case 'cyan':
                bgStyle = isDarkMode ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-cyan-50 border-cyan-200';
                textStyle = 'text-cyan-500 dark:text-cyan-400';
                countBgStyle = isDarkMode ? 'bg-cyan-500 text-slate-950' : 'bg-cyan-600 text-white';
                break;
            }
          } else {
            bgStyle = isDarkMode 
              ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 text-slate-400' 
              : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-500';
            textStyle = isDarkMode ? 'hover:text-slate-200' : 'hover:text-slate-800';
            countBgStyle = isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600';
          }

          return (
            <button
              key={opt.id}
              onClick={() => {
                if (opt.id === 'PRODUCT') {
                  if (activeFilter === 'PRODUCT') {
                    // Cycles the prioritization order on active click
                    setProductSortCycle((prev) => (prev === 5 ? 1 : prev + 1));
                  } else {
                    setActiveFilter('PRODUCT');
                  }
                } else if (opt.id === 'VALUE') {
                  if (activeFilter === 'VALUE') {
                    // Toggle value sort direction on active click
                    setValueSortDirection((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
                  } else {
                    setActiveFilter('VALUE');
                  }
                } else if (opt.id === 'URGENT') {
                  if (activeFilter === 'URGENT') {
                    // Toggle SLA sort direction on active click
                    setSlaSortDirection((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
                  } else {
                    setActiveFilter('URGENT');
                  }
                } else if (opt.id === 'FILA') {
                  if (activeFilter === 'FILA') {
                    // Toggle Fila sort direction on active click
                    setFilaSortDirection((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
                  } else {
                    setActiveFilter('FILA');
                  }
                } else {
                  setActiveFilter(opt.id);
                }
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer shrink-0 ${bgStyle} ${textStyle}`}
              title={
                opt.id === 'PRODUCT' 
                  ? `Ordenação: ${getCycleDescription(productSortCycle)} (Clique repetidas vezes para alternar)` 
                  : opt.id === 'VALUE'
                    ? `Ordenação por Valor: ${valueSortDirection === 'DESC' ? 'Decrescente' : 'Crescente'} (Clique repetidas vezes para alternar)`
                    : opt.id === 'URGENT'
                      ? `Ordenação por SLA: ${slaSortDirection === 'ASC' ? 'Crescente (Menor SLA primeiro)' : 'Decrescente (Maior SLA primeiro)'} (Clique repetidas vezes para alternar)`
                      : opt.id === 'FILA'
                        ? `Ordenação por Data de Importação: ${filaSortDirection === 'ASC' ? 'Mais antigas primeiro' : 'Mais recentes primeiro'} (Clique repetidas vezes para alternar)`
                        : opt.id === 'MANUAL'
                          ? 'Ordenação Manual: Arraste os cards para cima ou para baixo para organizar a fila livremente'
                          : undefined
              }
            >
              <Icon size={12} className={isActive ? 'animate-pulse' : ''} />
              <span>{opt.label}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold font-mono transition-colors ${countBgStyle}`}>
                {opt.id === 'VALUE' 
                  ? (valueSortDirection === 'ASC' ? '▲' : '▼') 
                  : opt.id === 'URGENT' 
                    ? (activeFilter === 'URGENT' ? (slaSortDirection === 'ASC' ? '▲' : '▼') : count) 
                    : opt.id === 'FILA'
                      ? (activeFilter === 'FILA' ? (filaSortDirection === 'ASC' ? '▲' : '▼') : count)
                      : count}
              </span>
            </button>
          );
        })}
      </div>

      {activeFilter === 'MANUAL' && filteredProposals.length > 0 && (
        <div id="drag-instructions-banner" className={`w-full transition-all duration-300 ${isSidebarCollapsed ? 'max-w-none' : 'max-w-[1300px]'} mb-4 p-4 rounded-xl border border-dashed text-xs flex items-center gap-3 ${
          isDarkMode ? 'bg-indigo-950/20 border-indigo-900/55 text-indigo-300' : 'bg-indigo-50 border-indigo-150 text-indigo-850'
        }`}>
          <span className="text-base animate-bounce">💡</span>
          <div>
            <strong className="font-black uppercase">Organização Manual da Fila:</strong>
            <p className="mt-0.5 opacity-90">
              Clique no ícone <strong className="font-mono bg-slate-800/10 dark:bg-slate-800/50 p-0.5 px-1 rounded text-[10px]">⠿</strong> e arraste os cards para ordenar a fila conforme sua prioridade de atendimento.
            </p>
          </div>
        </div>
      )}

      {filteredProposals.length === 0 ? (
        <div className={`w-full transition-all duration-300 ${isSidebarCollapsed ? 'max-w-none' : 'max-w-[1300px]'} rounded-2xl border border-dashed p-12 text-center ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-50 text-slate-300'}`}>
            <AlertTriangle size={32} />
          </div>
          <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma proposta correspondente</h3>
          <p className="text-sm text-slate-400">Nenhuma operação localizada na fila para o filtro selecionado.</p>
          <button 
            onClick={() => setActiveFilter('ALL')}
            className={`mt-4 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Limpar Filtros
          </button>
        </div>
      ) : (
        filteredProposals.map((p) => (
          <ProposalQueueItem 
            key={p.id}
            proposal={p}
            rules={rules}
            isExpanded={expandedId === p.id}
            onToggle={() => toggleExpand(p.id)}
            onTakeOver={onTakeOver}
            onRelease={onRelease}
            onFinalize={onFinalize}
            onQuickSchedule={onQuickSchedule}
            onDelete={onDelete}
            permissions={permissions}
            currentUser={currentUser}
            proposalHistory={history.filter(h => h.ade === p.ade)}
            activeCpfAnalysis={activeCpfAnalysis}
            isDarkMode={isDarkMode}
            fullHistory={history}
            allProposals={proposals}
            draggable={activeFilter === 'MANUAL'}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", p.id);
              setDraggingId(p.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggingId && draggingId !== p.id) {
                setDragOverId(p.id);
              }
            }}
            onDragLeave={() => {
              if (dragOverId === p.id) {
                setDragOverId(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const srcId = e.dataTransfer.getData("text/plain") || draggingId;
              if (srcId && srcId !== p.id) {
                const currentItems = [...filteredProposals];
                const srcIndex = currentItems.findIndex(x => x.id === srcId);
                const targetIndex = currentItems.findIndex(x => x.id === p.id);
                if (srcIndex !== -1 && targetIndex !== -1) {
                  const [removed] = currentItems.splice(srcIndex, 1);
                  currentItems.splice(targetIndex, 0, removed);
                  const newOrderIds = currentItems.map(item => item.id);
                  setManualOrderIds(newOrderIds);
                  localStorage.setItem('riskflow_manual_order', JSON.stringify(newOrderIds));
                }
              }
              setDraggingId(null);
              setDragOverId(null);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDragOverId(null);
            }}
            isDragging={draggingId === p.id}
            isDragOver={dragOverId === p.id}
          />
        ))
      )}
    </div>
  );
};

const parsePtBrDate = (dateStr: string): Date => {
  try {
    const parts = dateStr.split(/[\s,]+/);
    const dateParts = parts[0].split('/');
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    
    const timeParts = parts[1] ? parts[1].split(':') : ['0', '0', '0'];
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    const second = parseInt(timeParts[2] || '0', 10);
    
    return new Date(year, month, day, hour, minute, second);
  } catch (e) {
    return new Date();
  }
};

interface ItemProps {
  proposal: Proposal;
  rules?: AppRules;
  isExpanded: boolean;
  onToggle: () => void;
  onTakeOver: (id: string) => void;
  onRelease: (id: string) => void;
  onFinalize: (id: string, status: RiskStatus, parecer: string, aiAnalysisResult?: any, contactAttachment?: any) => void;
  onQuickSchedule: (proposal: Proposal) => void;
  onDelete?: (id: string) => void;
  permissions: UserPermissions;
  currentUser: UserAccount;
  proposalHistory: DecisionEntry[];
  activeCpfAnalysis: string | null;
  isDarkMode: boolean;
  fullHistory?: DecisionEntry[];
  allProposals?: Proposal[];
  isSidebarCollapsed?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}

const ProposalQueueItem: React.FC<ItemProps> = ({ 
  proposal, 
  rules,
  isExpanded, 
  onToggle, 
  onTakeOver, 
  onRelease,
  onFinalize, 
  onQuickSchedule,
  onDelete,
  permissions, 
  currentUser,
  proposalHistory,
  activeCpfAnalysis,
  isDarkMode,
  fullHistory = [],
  allProposals = [],
  isSidebarCollapsed = false,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging = false,
  isDragOver = false
}) => {
  const partnerName = useMemo(() => {
    if (rules && rules.partners) {
      const key = (proposal.corretor || '').toUpperCase().trim();
      if (rules.partners[key]?.name) {
        return rules.partners[key].name;
      }
    }
    try {
      const saved = localStorage.getItem('riskflow_rules_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        const key = (proposal.corretor || '').toUpperCase().trim();
        if (parsed?.partners?.[key]?.name) {
          return parsed.partners[key].name;
        }
      }
    } catch {
      // ignore
    }
    return proposal.corretor || 'N/I';
  }, [proposal.corretor, rules]);

   const [docFile, setDocFile] = useState<File | null>(null);
   const [docBackFile, setDocBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [relatoContato, setRelatoContato] = useState('');
  const [isDocExpanded, setIsDocExpanded] = useState(true);
  const [isSelfieExpanded, setIsSelfieExpanded] = useState(true);
  const [isAudioExpanded, setIsAudioExpanded] = useState(true);

  const [parecer, setParecer] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [deAcordo, setDeAcordo] = useState(false);
  const [quemAutorizou, setQuemAutorizou] = useState('');

  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    isValidDocument: boolean;
    isIlegivel: boolean;
    isDeteriorated: boolean;
    isCortado: boolean;
    matchesTitularidade: boolean;
    detectedName: string;
    detectedCpf: string;
    summary: string;
    suggestedStatus: string;
    suggestedReason: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/gemini/status")
      .then(res => res.json())
      .then(data => setGeminiConfigured(data.configured))
      .catch(() => setGeminiConfigured(false));
  }, []);

  const handleVerifyDocument = async (frontFile: File | null, backFile: File | null) => {
    if (!frontFile && !backFile) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAiAnalysisResult(null);

    try {
      const formData = new FormData();
      if (frontFile) {
        formData.append("document", frontFile);
      }
      if (backFile) {
        formData.append("documentBack", backFile);
      }
      formData.append("clientName", proposal.nomeCliente);
      formData.append("clientCpf", proposal.cpf);

      const response = await fetch("/api/verify-document", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro de conexão ao servidor de análise." }));
        throw new Error(errData.error || `Erro ${response.status} na perícia documental.`);
      }

      const result = await response.json();
      setAiAnalysisResult(result);

      if (result.suggestedReason && result.suggestedReason !== "Selecione o motivo...") {
        setSelectedReason(result.suggestedReason);
        if (REGRAS_PERICIA[result.suggestedReason]) {
          setParecer(REGRAS_PERICIA[result.suggestedReason].mensagem);
        }
      }
    } catch (e: any) {
      console.error("Erro na perícia:", e);
      setAnalysisError(e.message || "Erro desconhecido ao processar perícia.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  React.useEffect(() => {
    if (docFile || docBackFile) {
      handleVerifyDocument(docFile, docBackFile);
    } else {
      setAiAnalysisResult(null);
      setAnalysisError(null);
    }
  }, [docFile, docBackFile]);

  // File Input Refs for uploaders
  const docInputRef = React.useRef<HTMLInputElement>(null);
  const docBackInputRef = React.useRef<HTMLInputElement>(null);
  const selfieInputRef = React.useRef<HTMLInputElement>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  const [timeState, setTimeState] = useState({
    ageMs: 0,
    slaMs: 0,
    isPaused: false
  });

  React.useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const pCreatedAt = proposal.createdAt || now;
      const ageMs = now - pCreatedAt;

      const pSlaRemaining = proposal.slaRemainingMs !== undefined ? proposal.slaRemainingMs : 3 * 3600000;
      const isPaused = proposal.status ? (
        proposal.status === 'APPROVED' || 
        proposal.status === 'AUTO_APPROVED' || 
        proposal.status === 'WAITING_DOCS' || 
        proposal.status === 'REJECTED'
      ) : false;

      let slaMs = pSlaRemaining;
      if (!isPaused && proposal.lastUpdatedStatusAt) {
        const elapsedSinceLastUpdate = now - proposal.lastUpdatedStatusAt;
        slaMs = Math.max(0, pSlaRemaining - elapsedSinceLastUpdate);
      }

      setTimeState({
        ageMs,
        slaMs,
        isPaused
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [proposal.createdAt, proposal.slaRemainingMs, proposal.status, proposal.lastUpdatedStatusAt]);

  const reincidentAlerts = useMemo(() => {
    if (!fullHistory || !proposal) return [];

    const parentAdes = new Set<string>();
    if (proposal.cpf) {
      allProposals.forEach(p => {
        if (p.cpf === proposal.cpf && p.ade) {
          parentAdes.add(p.ade);
        }
      });
    }

    return fullHistory.filter(log => {
      const belongsToClient = 
        log.ade === proposal.ade ||
        parentAdes.has(log.ade) ||
        (log.cliente && proposal.nomeCliente && log.cliente.trim().toLowerCase() === proposal.nomeCliente.trim().toLowerCase());

      if (!belongsToClient) return false;

      const isRejection = 
        log.decisao === 'REJECTED' || 
        log.decisao === 'REPROVADO' || 
        (log.acao || '').toUpperCase().includes('REPROV') || 
        (log.acao || '').toUpperCase().includes('RECUS') ||
        (log.acao || '').toUpperCase().includes('REJECTED');

      if (!isRejection) return false;

      const logDate = parsePtBrDate(log.timestamp);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - logDate.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      return diffDays <= 30;
    });
  }, [fullHistory, proposal, allProposals]);

  const handleGeneratePDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const activeParecerByInput = parecer.trim();
    const latestRejectionLog = [...proposalHistory].reverse().find(log => {
      const act = (log.acao || '').toUpperCase();
      const dec = (log.decisao || '').toUpperCase();
      return (act.includes('REPROV') || act.includes('RECUS') || act.includes('REJEIT') || dec === 'REJECTED');
    });

    const activeParecer = activeParecerByInput || 
                          latestRejectionLog?.motivo || 
                          [...proposalHistory].reverse().find(log => log.motivo && !log.motivo.toLowerCase().includes("início da análise"))?.motivo || 
                          [...proposalHistory].reverse().find(log => log.motivo)?.motivo || 
                          'Sem parecer técnico informado ou análise em andamento.';

    const analistaName = (activeParecerByInput ? (currentUser.username || 'ADMINISTRADOR') : '') || 
                         latestRejectionLog?.analista || 
                         proposal.lockedBy || 
                         currentUser.username || 
                         'ADMINISTRADOR';
    
    let statusLabel = 'AGUARDANDO ANÁLISE';
    let statusColor = [59, 130, 246]; // blue #3b82f6
    
    if (proposal.status === 'REJECTED') {
      statusLabel = 'REPROVADO';
      statusColor = [239, 68, 68]; // red #ef4444
    } else if (proposal.status === 'APPROVED' || proposal.status === 'AUTO_APPROVED') {
      statusLabel = 'APROVADO';
      statusColor = [16, 185, 129]; // green #10b981
    } else if (proposal.status === 'WAITING_DOCS') {
      statusLabel = 'PENDENTE';
      statusColor = [245, 158, 11]; // orange #f59e0b
    } else if (proposal.status === 'CONTACT') {
      statusLabel = 'EM CONTATO';
      statusColor = [6, 182, 212]; // cyan #06b6d4
    } else if (proposal.status === 'AGENDADO') {
      statusLabel = 'AGENDADO';
      statusColor = [99, 102, 241]; // indigo #6366f1
    } else if (proposal.status === 'WAITING_REQUEST') {
      statusLabel = 'EM ESPERA';
      statusColor = [100, 116, 139]; // slate #64748b
    }

    // --- TOPO: BANNER PRINCIPAL & CABEÇALHO ---
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // Grafite Escuro
    doc.text("RISKFLOW | RELATÓRIO DE ANÁLISE DE RISCO", 10, 23);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`PARECER OPERACIONAL: ${statusLabel}`, 10, 29);

    // Linha fina divisória abaixo do cabeçalho
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(10, 33, 200, 33);

    // --- BLOCO 1: DADOS DA OPERAÇÃO ---
    const yInicialCard1 = 39;
    const hasRejection = !!latestRejectionLog;
    const cardHeight = hasRejection ? 41 : 32;

    doc.setFillColor(248, 250, 252); // #f8fafc
    doc.setDrawColor(203, 213, 225); // #cbd5e1
    doc.setLineWidth(0.5);
    doc.rect(10, yInicialCard1, 190, cardHeight, 'FD');

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // Cinza escuro para títulos (#475569)
    doc.text("DADOS CADASTRAIS DA PROPOSTA", 14, yInicialCard1 + 6);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    // Linha 1 de dados
    doc.text(`• ADE: ${proposal.ade}`, 14, yInicialCard1 + 15);
    doc.text(`• Banco: ${proposal.banco || 'N/A'}`, 105, yInicialCard1 + 15);

    // Linha 2 de dados
    doc.text(`• Cliente: ${proposal.nomeCliente}`, 14, yInicialCard1 + 24);
    doc.text(`• Responsável: ${analistaName}`, 105, yInicialCard1 + 24);

    if (hasRejection && latestRejectionLog) {
      // Linha 3 de dados (detalhes da última recusa)
      doc.text(`• Data/Hora da Reprovação: ${latestRejectionLog.timestamp}`, 14, yInicialCard1 + 33);
      doc.text(`• Analista: ${latestRejectionLog.analista}`, 105, yInicialCard1 + 33);
    }

    // --- BLOCO 2: PARECER TÉCNICO E APONTAMENTOS DA ANÁLISE ---
    const ySection2 = yInicialCard1 + cardHeight + 8;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("PARECER DA ANÁLISE", 10, ySection2);

    const yInicialCard2 = ySection2 + 4;

    const textLines = doc.splitTextToSize(`"${activeParecer.toUpperCase()}"`, 180);
    const blockQuoteHeight = textLines.length * 6 + 4;

    // Draw background
    doc.setFillColor(255, 255, 255);
    doc.rect(12, yInicialCard2, 188, blockQuoteHeight, 'F');

    // Left border (border="L", line_width=1.0)
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(1.0);
    doc.line(12, yInicialCard2, 12, yInicialCard2 + blockQuoteHeight);

    // Print text lines
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    let currentY = yInicialCard2 + 5;
    textLines.forEach((line: string) => {
      doc.text(line, 16, currentY);
      currentY += 6;
    });

    // --- RODAPÉ: ASSINATURA ---
    const signatureY = yInicialCard2 + blockQuoteHeight + 25;
    doc.setDrawColor(148, 163, 184); // #94a3b8
    doc.setLineWidth(0.5);
    doc.line(130, signatureY, 195, signatureY);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Assinatura Digital", 195, signatureY + 5, { align: 'right' });
    doc.text("RiskFlow Anti-Fraud System", 195, signatureY + 9, { align: 'right' });

    doc.save(`parecer_tecnico_${proposal.ade}.pdf`);
  };

  const isLockedByMe = proposal.lockedBy === currentUser.username;
  const isLockedByOther = proposal.lockedBy && proposal.lockedBy !== currentUser.username;
  const isFree = !proposal.lockedBy;
  
  const isCpfBlocked = activeCpfAnalysis && activeCpfAnalysis !== proposal.cpf && !isLockedByMe;

  const maskCpf = (cpf: string) => {
    if (permissions.viewFullCpf) return cpf;
    return `${cpf.substring(0, 3)}.***.***-${cpf.substring(cpf.length - 2)}`;
  };

  const maskValue = (val: number) => {
    if (permissions.viewValues) return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    return 'R$ ••••••';
  };

  const abbreviateName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 2) return name;
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const middleNames = parts.slice(1, -1).map(p => `${p[0]}.`).join(' ');
    return `${firstName} ${middleNames} ${lastName}`;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED': case 'AUTO_APPROVED': return 'bg-[#064e3b] text-[#34d399]';
      case 'REJECTED': return 'bg-red-900/40 text-red-400';
      case 'WAITING_DOCS': return 'bg-orange-900/40 text-orange-400';
      case 'AGENDADO': return 'bg-indigo-900/40 text-indigo-400';
      case 'PENDING': return 'bg-blue-900/40 text-blue-400';
      case 'CONTACT': return 'bg-cyan-900/40 text-cyan-400';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div 
      id={`proposal-card-${proposal.id}`} 
      className={`w-full flex items-start justify-center gap-3 transition-all duration-200 ${
        isDragging ? 'opacity-45 bg-indigo-500/5 border-indigo-500 border border-dashed rounded-xl' : ''
      } ${
        isDragOver ? 'translate-y-1 scale-[1.01] border-t-2 border-t-indigo-550' : ''
      }`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        <div 
          className="cursor-grab active:cursor-grabbing p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all shrink-0 flex items-center justify-center mt-3"
          title="Clique e arraste para cima ou para baixo para reordenar"
        >
          <GripVertical size={18} />
        </div>
      )}
      <div className="flex-1 flex flex-col w-full min-w-0">
        <div 
          className={`card-esteira-global group w-full ${isSidebarCollapsed ? '!max-w-none' : ''} ${isExpanded ? 'border-blue-500/55 shadow-lg shadow-blue-500/10 rounded-b-none mb-0' : ''} ${isDarkMode ? 'bg-[#0b1120]' : 'bg-white border-slate-200'}`}
          onClick={onToggle}
        >
        <div className="info-bloco">
          <span className="info-label">ADE</span>
          <span className="info-valor valor-destaque font-mono">{proposal.ade}</span>
        </div>

        <div className="info-bloco">
          <span className="info-label">CPF</span>
          <span className="info-valor valor-destaque font-mono">{maskCpf(proposal.cpf)}</span>
        </div>
        
        <div className="info-bloco">
          <span className="info-label">Cliente</span>
          <span className={`info-valor truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`} title={proposal.nomeCliente}>
            {abbreviateName(proposal.nomeCliente)}
          </span>
          <div className="flex flex-col items-center mt-1.5 w-full text-[10px] text-slate-400 font-medium leading-normal border-t border-slate-500/10 pt-1">
            <span className="truncate max-w-[140px]" title={`Digitador: ${proposal.corretor || 'N/I'}`}>
              👤 Digitador: <span className="font-bold text-slate-400">{proposal.corretor || 'N/I'}</span>
            </span>
            <span className="truncate max-w-[140px] text-blue-400" title={`Parceiro: ${partnerName}`}>
              🤝 Parceiro: <span className="font-bold text-blue-400">{partnerName}</span>
            </span>
          </div>
        </div>

        <div className="info-bloco">
          <span className="info-label">Valor Financiado</span>
          <span className="info-valor valor-dinheiro">{maskValue(proposal.valorFinanciado)}</span>
        </div>

        <div className="info-bloco">
          <span className="info-label">Produto</span>
          <span className={`info-valor text-[12px] ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{proposal.produto}</span>
        </div>

        <div className="info-bloco">
          <span className="info-label">Convênio</span>
          <span className="text-[#94a3b8] text-[10px] uppercase font-bold">{proposal.convenio}</span>
        </div>

        <div className="info-bloco items-center">
          <span className="info-label">Régua</span>
          <span className="tag-regua">OURO</span>
        </div>

        <div className="info-bloco items-center">
          <span className="info-label">Status</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${proposal.status === 'APPROVED' || proposal.status === 'AUTO_APPROVED' ? 'bg-[#34d399]' : 'bg-slate-500'}`} />
            <span className={`text-[11px] font-bold uppercase ${getStatusStyle(proposal.status).split(' ')[1]}`}>
              {translateStatus(proposal.status)}
            </span>
          </div>
        </div>

        <div className="info-bloco">
          <span className="info-label">SLA (3h)</span>
          <span className={`info-valor font-mono text-[11.5px] font-bold ${
            timeState.isPaused 
              ? 'text-yellow-500 font-extrabold'
              : timeState.slaMs <= 0 
                ? 'text-red-500 animate-pulse font-black font-mono'
                : timeState.slaMs < 1800000 
                  ? 'text-orange-500 font-black'
                  : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
          }`}>
            {formatDuration(timeState.slaMs)}
            {timeState.isPaused && <span className="text-[9px] uppercase font-black ml-1 text-yellow-500/85 bg-yellow-500/10 px-1 rounded">(Pausado)</span>}
          </span>
        </div>

        <div className="info-bloco">
          <span className="info-label">Tempo em Fila</span>
          <span className={`info-valor text-[11px] font-bold font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {formatAge(timeState.ageMs)}
          </span>
        </div>

        <div className="text-right flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {proposal.lockedBy ? (
            <>
              <div 
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  isLockedByMe ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                }`}
              >
                {isLockedByMe ? <Unlock size={12} /> : <Lock size={12} />}
                {isLockedByMe ? 'VOCÊ' : proposal.lockedBy}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onRelease(proposal.id);
                }}
                className={`p-1.5 px-2.5 rounded-full border text-[9px] uppercase font-black tracking-wider flex items-center gap-1 transition-all ${
                  isDarkMode 
                  ? 'bg-red-950/40 border-red-900/50 text-red-400 hover:bg-red-900 hover:text-white' 
                  : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-600 hover:text-white'
                }`}
                title="Soltar Análise (Devolver para Fila)"
              >
                <Unlock size={10} />
                <span>Soltar</span>
              </button>
            </>
          ) : (
            <div 
              className="bg-[#f1f5f9] text-slate-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
            >
              <Unlock size={12} /> LIVRE
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={`w-full transition-all duration-300 ${isSidebarCollapsed ? 'max-w-none' : 'max-w-[1300px]'} mb-4 p-8 rounded-b-2xl border-x border-b animate-in slide-in-from-top-2 duration-300 ${isDarkMode ? 'bg-[#0b1120]/80 border-[#1e293b]' : 'bg-slate-50 border-slate-200'}`}>
          
          {/* ⚠️ Alerta de Reincidência */}
          {reincidentAlerts.length > 0 && (
            <div className={`p-5 mb-6 rounded-2xl border flex flex-col md:flex-row gap-4 justify-between items-start animate-in fade-in zoom-in-95 duration-205 ${
              isDarkMode ? 'bg-red-950/40 border-red-900/50 text-red-200' : 'bg-red-50/70 border-red-200 text-red-900'
            }`}>
              <div className="flex gap-3.5 items-start">
                <span className="text-xl mt-0.5 leading-none" role="img" aria-label="alert">🚨</span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-red-600 dark:text-red-400">
                    Histórico de Reprovações do Cliente (Últimos 30 Dias)
                  </h4>
                  <p className="text-[11px] mt-1.5 font-semibold leading-relaxed opacity-90">
                    Este CPF possui um histórico de <b className="text-red-650 dark:text-red-350">{reincidentAlerts.length} proposta{reincidentAlerts.length > 1 ? 's' : ''} reprovada{reincidentAlerts.length > 1 ? 's' : ''}</b> nos últimos 30 dias na esteira de risco. 
                    Recomendamos analisar com rigor redobrado todos os documentos, selfies e assinaturas em busca de irregularidades ou falsificações.
                  </p>
                  
                  <div className="mt-4 space-y-2 pl-3 border-l-2 border-red-500/40 dark:border-red-500/35">
                    {reincidentAlerts.map((log) => (
                      <div key={log.id} className="text-[10px] font-bold flex flex-wrap items-center gap-x-2 text-slate-600 dark:text-slate-400">
                        <span className="font-extrabold px-1.5 py-0.5 rounded bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 font-mono text-[9px]">
                          {log.timestamp.split(',')[0]}
                        </span>
                        <span>
                          Banco: <b className="uppercase text-slate-800 dark:text-slate-200">{log.banco}</b> 
                          <span className="mx-1">|</span> 
                          ADE: <span className="font-mono text-slate-500 dark:text-slate-350 font-black">{log.ade}</span>
                        </span>
                        <span className="text-red-605 dark:text-red-400 font-black ml-1">
                          — Motivo da Reprovação: "{log.motivo}"
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header da Proposta - Perícia da Proposta (Streamlit Style) */}
          <div className={`p-5 mb-6 border-l-[6px] border-blue-500 rounded-r-xl transition-all shadow-sm ${
            isDarkMode ? 'bg-slate-900/60 text-slate-100' : 'bg-white border hover:border-slate-300 text-slate-850'
          }`}>
            <h4 className="text-sm md:text-base font-black uppercase tracking-tight flex items-center flex-wrap gap-2 text-blue-500 dark:text-blue-400">
              ADE: <span className="font-mono">{proposal.ade}</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cliente:</span>
              <span className="font-sans font-black">{proposal.nomeCliente}</span>
            </h4>
            <div className={`mt-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <span>VALOR FINANCIADO: <b className="text-emerald-500 dark:text-emerald-400 text-sm font-black font-mono">{maskValue(proposal.valorFinanciado)}</b></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>PRODUTO: <b className="uppercase font-extrabold">{proposal.produto}</b></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="flex items-center gap-1">STATUS: 
                <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${getStatusStyle(proposal.status)}`}>
                  {translateStatus(proposal.status)}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column (Span 2): Área de Perícia e Arquivos */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="flex flex-col space-y-5">
                <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  🛡️ Área de Perícia & Arquivos
                </h3>

                {/* 1. Campo Fixo para Anexo de Documento (CNH/RG) */}
                <div className={`p-5 rounded-2xl border shadow-sm transition-all ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <button 
                    onClick={() => setIsDocExpanded(!isDocExpanded)}
                    className="w-full flex items-center justify-between text-left focus:outline-none"
                  >
                    <h5 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}>
                      <span>📑 DOCUMENTO DE IDENTIFICAÇÃO DO CLIENTE (RG/CNH - PDF/Imagem)</span>
                    </h5>
                    {isDocExpanded ? <ChevronUp size={16} className="text-slate-450" /> : <ChevronDown size={16} className="text-slate-450" />}
                  </button>

                  {isDocExpanded && (
                    !isLockedByMe ? (
                      <div className="mt-4 p-6 text-center border-2 border-dashed rounded-xl flex flex-col items-center justify-center space-y-3 border-amber-500/20 bg-amber-500/5 animate-in fade-in duration-250">
                        <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                          <Lock size={18} />
                        </div>
                        <div className="space-y-1">
                          <h6 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Leitor de Documentos Bloqueado</h6>
                          <p className="text-[10px] text-slate-400 font-medium">Você precisa assumir esta proposta para enviar e analisar os documentos.</p>
                        </div>
                        {!isCpfBlocked && (
                          <button
                            type="button"
                            onClick={() => onTakeOver(proposal.id)}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-extrabold uppercase text-[9px] tracking-widest transition-all shadow-md flex items-center gap-1.5"
                          >
                            <Zap size={10} /> Assumir Análise
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* FRENTE DO DOCUMENTO (ANVERSO) */}
                        <div className="space-y-3">
                          <label className={`text-[10px] font-extrabold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Frente do Documento
                          </label>
                          <div 
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                setDocFile(e.dataTransfer.files[0]);
                              }
                            }}
                            onClick={() => docInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                              docFile
                                ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-500/50 bg-emerald-50/30')
                                : (isDarkMode ? 'border-slate-800 hover:border-slate-750 bg-slate-900/20 hover:bg-slate-900/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/50')
                            }`}
                          >
                            <input 
                              type="file" 
                              ref={docInputRef}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setDocFile(e.target.files[0]);
                                }
                              }}
                              accept="image/*,application/pdf"
                              className="hidden"
                            />
                            <Upload size={22} className={docFile ? 'text-emerald-500' : 'text-indigo-500 dark:text-indigo-400'} />
                            <span className={`text-[11px] font-extrabold line-clamp-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              {docFile ? `Frente: ${docFile.name}` : "Anexar Frente (Foto ou PDF)"}
                            </span>
                            <span className="text-[9px] font-medium text-slate-400">Arraste ou clique para enviar</span>
                          </div>

                          {docFile && (
                            <div className="animate-in slide-in-from-top-1 duration-200 pt-1">
                              {docFile.type === "application/pdf" ? (
                                <div className={`p-3 border rounded-xl text-[11px] flex items-center gap-2 ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                  <span className="text-xl">📄</span>
                                  <div className="font-semibold truncate">PDF Frente Anexado</div>
                                </div>
                              ) : (
                                <div className={`border rounded-xl overflow-hidden p-2 max-h-48 flex flex-col items-center justify-center ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                  <img 
                                    src={URL.createObjectURL(docFile)} 
                                    alt="Frente" 
                                    className="max-h-40 object-contain rounded-lg"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* VERSO DO DOCUMENTO (REVERSO) */}
                        <div className="space-y-3">
                          <label className={`text-[10px] font-extrabold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Verso do Documento
                          </label>
                          <div 
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                setDocBackFile(e.dataTransfer.files[0]);
                              }
                            }}
                            onClick={() => docBackInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                              docBackFile
                                ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-500/50 bg-emerald-50/30')
                                : (isDarkMode ? 'border-slate-800 hover:border-slate-750 bg-slate-900/20 hover:bg-slate-900/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/50')
                            }`}
                          >
                            <input 
                              type="file" 
                              ref={docBackInputRef}
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setDocBackFile(e.target.files[0]);
                                }
                              }}
                              accept="image/*,application/pdf"
                              className="hidden"
                            />
                            <Upload size={22} className={docBackFile ? 'text-emerald-500' : 'text-indigo-500 dark:text-indigo-400'} />
                            <span className={`text-[11px] font-extrabold line-clamp-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                              {docBackFile ? `Verso: ${docBackFile.name}` : "Anexar Verso (Foto ou PDF)"}
                            </span>
                            <span className="text-[9px] font-medium text-slate-400">Arraste ou clique para enviar</span>
                          </div>

                          {docBackFile && (
                            <div className="animate-in slide-in-from-top-1 duration-200 pt-1">
                              {docBackFile.type === "application/pdf" ? (
                                <div className={`p-3 border rounded-xl text-[11px] flex items-center gap-2 ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                  <span className="text-xl">📄</span>
                                  <div className="font-semibold truncate">PDF Verso Anexado</div>
                                </div>
                              ) : (
                                <div className={`border rounded-xl overflow-hidden p-2 max-h-48 flex flex-col items-center justify-center ${isDarkMode ? 'border-slate-800 bg-slate-950/20' : 'border-slate-200 bg-slate-50'}`}>
                                  <img 
                                    src={URL.createObjectURL(docBackFile)} 
                                    alt="Verso" 
                                    className="max-h-40 object-contain rounded-lg"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AREA PERICIAL & DIAGNOSTICOS */}
                      {(docFile || docBackFile) && (
                        <div className="space-y-4 pt-2 border-t border-slate-250/20 dark:border-slate-850/30">
                          {isAnalyzing && (
                            <div className={`p-4 border rounded-xl text-xs flex flex-col items-center justify-center gap-3 ${
                              isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                              <div className="flex items-center gap-3">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                                </span>
                                <span className="font-black uppercase tracking-wider text-[10px]">Realizando Perícia Documental por Inteligência Artificial...</span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-medium text-center">Inspecionando assinaturas, legibilidade, integridade física e titularidade de RG, CNH ou Identidade Funcional.</p>
                            </div>
                          )}

                          {analysisError && (
                            <div className="p-4 border rounded-xl text-xs space-y-3 bg-red-500/10 border-red-500/20 text-red-400">
                              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px]">
                                <span>🛑</span>
                                <span>Mesa Pericial: Falha na Análise Automática</span>
                              </div>
                              <p className="font-semibold text-[11px] leading-relaxed">{analysisError}</p>
                              <button 
                                type="button"
                                onClick={() => handleVerifyDocument(docFile, docBackFile)}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-extrabold uppercase text-[9px] tracking-widest transition-all"
                              >
                                Tentar Analisar Novamente
                              </button>
                            </div>
                          )}

                          {aiAnalysisResult && (
                            <div className={`p-5 border rounded-2xl text-xs space-y-4 ${
                              aiAnalysisResult.suggestedStatus === 'REPROVADO'
                                ? (isDarkMode ? 'bg-red-500/5 border-red-500/20 text-slate-200' : 'bg-red-50/50 border-red-200 text-slate-800')
                                : aiAnalysisResult.suggestedStatus === 'PENDENCIA'
                                ? (isDarkMode ? 'bg-amber-500/5 border-amber-500/20 text-slate-200' : 'bg-amber-50/50 border-amber-200 text-slate-800')
                                : (isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-200' : 'bg-emerald-50/50 border-emerald-200 text-slate-800')
                            }`}>
                              <div className="flex items-center justify-between border-b pb-3 border-slate-700/10 dark:border-slate-800/50">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">🤖</span>
                                  <h6 className="font-black uppercase tracking-widest text-[10px]">Diagnóstico Detalhado da Perícia de IA</h6>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                  aiAnalysisResult.suggestedStatus === 'REPROVADO'
                                    ? 'bg-red-500/20 text-red-400'
                                    : aiAnalysisResult.suggestedStatus === 'PENDENCIA'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}>
                                  Sugerido: {aiAnalysisResult.suggestedStatus === 'ANALISE' ? 'Aprovar' : aiAnalysisResult.suggestedStatus === 'PENDENCIA' ? 'Pendência' : 'Reprovar'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                                <div className="flex items-center gap-2">
                                  <span className={aiAnalysisResult.isValidDocument ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                                    {aiAnalysisResult.isValidDocument ? "✓" : "⚠"}
                                  </span>
                                  <span className="text-slate-400 font-semibold">Tipo de Docto:</span>
                                  <span className="font-bold">{aiAnalysisResult.isValidDocument ? "RG, CNH ou Funcional" : "Outro / Desconhecido"}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={!aiAnalysisResult.isIlegivel ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                                    {!aiAnalysisResult.isIlegivel ? "✓" : "✗"}
                                  </span>
                                  <span className="text-slate-400 font-semibold">Legibilidade:</span>
                                  <span className="font-bold">{!aiAnalysisResult.isIlegivel ? "100% Legível" : "Dados Ilegíveis"}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={!aiAnalysisResult.isDeteriorated ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                                    {!aiAnalysisResult.isDeteriorated ? "✓" : "✗"}
                                  </span>
                                  <span className="text-slate-400 font-semibold">Integridade Física:</span>
                                  <span className="font-bold">{!aiAnalysisResult.isDeteriorated ? "Documento Íntegro" : "Deteriorado / Rasgado"}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={!aiAnalysisResult.isCortado ? "text-emerald-500 font-bold" : "text-red-505 font-bold"}>
                                    {!aiAnalysisResult.isCortado ? "✓" : "✗"}
                                  </span>
                                  <span className="text-slate-400 font-semibold">Enquadramento:</span>
                                  <span className="font-bold">{!aiAnalysisResult.isCortado ? "Completo / Bordas OK" : "Foto Cortada"}</span>
                                </div>
                              </div>

                              <div className={`p-3 rounded-xl gap-2.5 flex flex-col text-[11px] ${isDarkMode ? 'bg-slate-950/40' : 'bg-slate-100/60'}`}>
                                <div className="flex items-center gap-2">
                                  <span className={aiAnalysisResult.matchesTitularidade ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                                    {aiAnalysisResult.matchesTitularidade ? "✓" : "✗"}
                                  </span>
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Verificação de Titularidade:</span>
                                  <span className="font-extrabold">{aiAnalysisResult.matchesTitularidade ? "CPF e Nome Conferem" : "Divergência de Titularidade"}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 border-t border-slate-700/10 dark:border-slate-800/10 pt-2 font-mono text-[10px]">
                                  <div>
                                    <span className="text-slate-400">Nome Detetado:</span>
                                    <p className="font-bold truncate text-indigo-500 uppercase">{aiAnalysisResult.detectedName || "---"}</p>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">CPF Detetado:</span>
                                    <p className="font-bold text-indigo-500">{aiAnalysisResult.detectedCpf || "---"}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="text-[11px] leading-relaxed opacity-90 border-t border-slate-700/10 dark:border-slate-800/10 pt-3">
                                <p className="font-bold text-[9px] uppercase tracking-wider text-slate-400 mb-1">Parecer Pericial Consolidado IA:</p>
                                <p className="font-medium italic">"{aiAnalysisResult.summary}"</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    )
                  )}
                </div>

                {/* 2. Campo Fixo para Anexo de Selfie */}
                <div className={`p-5 rounded-2xl border shadow-sm transition-all ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <button 
                    onClick={() => setIsSelfieExpanded(!isSelfieExpanded)}
                    className="w-full flex items-center justify-between text-left focus:outline-none"
                  >
                    <h5 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}>
                      <span>📸 SELFIE DO CLIENTE</span>
                    </h5>
                    {isSelfieExpanded ? <ChevronUp size={16} className="text-slate-450" /> : <ChevronDown size={16} className="text-slate-450" />}
                  </button>

                  {isSelfieExpanded && (
                    !isLockedByMe ? (
                      <div className="mt-4 p-6 text-center border-2 border-dashed rounded-xl flex flex-col items-center justify-center space-y-3 border-amber-500/20 bg-amber-500/5 animate-in fade-in duration-250">
                        <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                          <Lock size={18} />
                        </div>
                        <div className="space-y-1">
                          <h6 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Selfie do Cliente Bloqueada</h6>
                          <p className="text-[10px] text-slate-400 font-medium">Você precisa assumir esta proposta para anexar ou validar a selfie do cliente.</p>
                        </div>
                        {!isCpfBlocked && (
                          <button
                            type="button"
                            onClick={() => onTakeOver(proposal.id)}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-extrabold uppercase text-[9px] tracking-widest transition-all shadow-md flex items-center gap-1.5"
                          >
                            <Zap size={10} /> Assumir Análise
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4 animate-in fade-in duration-200 justify-center">
                      <div 
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            setSelfieFile(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => selfieInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                          selfieFile
                            ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-500/50 bg-emerald-50/30')
                            : (isDarkMode ? 'border-slate-800 hover:border-slate-750 bg-slate-900/20 hover:bg-slate-900/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/50')
                        }`}
                      >
                        <input 
                          type="file" 
                          ref={selfieInputRef}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setSelfieFile(e.target.files[0]);
                            }
                          }}
                          accept="image/*"
                          className="hidden"
                        />
                        <Camera size={24} className={selfieFile ? 'text-emerald-500' : 'text-slate-400'} />
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-750'}`}>
                          {selfieFile ? `Selfie: ${selfieFile.name}` : "Arraste ou clique para anexar a selfie do cliente"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">Formatos aceitos: png, jpg, jpeg (Foto direta do rosto do cliente)</span>
                      </div>

                      {selfieFile && (
                        <div className="space-y-4 animate-in slide-in-from-top-1 duration-200">
                          <div className="border border-slate-705/30 rounded-xl overflow-hidden p-3 bg-slate-950/20 max-w-[280px] mx-auto flex flex-col items-center justify-center">
                            <img 
                              src={URL.createObjectURL(selfieFile)} 
                              alt="Prévia da Selfie do Cliente" 
                              className="max-h-60 object-contain rounded-lg shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <p className="text-[10px] text-slate-400 mt-2 font-semibold italic">Prévia da Selfie do Cliente</p>
                          </div>

                          <div className={`p-3.5 border rounded-xl text-xs flex items-center gap-2 font-black uppercase tracking-widest text-[10px] ${
                            isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}>
                            <span>👤</span>
                            <span>Selfie Anexada</span>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  )}
                </div>

                {/* 3. Campo Fixo para Formalização de Voz/Vídeo */}
                <div className={`p-5 rounded-2xl border shadow-sm transition-all ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <button 
                    onClick={() => setIsAudioExpanded(!isAudioExpanded)}
                    className="w-full flex items-center justify-between text-left focus:outline-none"
                  >
                    <h5 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-650'}`}>
                      <span>📞 FORMALIZAÇÃO DA PROPOSTA (VOZ/VÍDEO)</span>
                    </h5>
                    {isAudioExpanded ? <ChevronUp size={16} className="text-slate-450" /> : <ChevronDown size={16} className="text-slate-450" />}
                  </button>

                  {isAudioExpanded && (
                    !isLockedByMe ? (
                      <div className="mt-4 p-6 text-center border-2 border-dashed rounded-xl flex flex-col items-center justify-center space-y-3 border-amber-500/20 bg-amber-500/5 animate-in fade-in duration-250">
                        <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                          <Lock size={18} />
                        </div>
                        <div className="space-y-1">
                          <h6 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Formalização Especial Reservada</h6>
                          <p className="text-[10px] text-slate-400 font-medium">Você precisa assumir esta proposta para habilitar a gravação de voz/vídeo e o relato do contato.</p>
                        </div>
                        {!isCpfBlocked && (
                          <button
                            type="button"
                            onClick={() => onTakeOver(proposal.id)}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-extrabold uppercase text-[9px] tracking-widest transition-all shadow-md flex items-center gap-1.5"
                          >
                            <Zap size={10} /> Assumir Análise
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                      <div 
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            setAudioFile(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => audioInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                          audioFile
                            ? (isDarkMode ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-500/50 bg-emerald-50/30')
                            : (isDarkMode ? 'border-slate-800 hover:border-slate-750 bg-slate-900/20 hover:bg-slate-900/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-100/50')
                        }`}
                      >
                        <input 
                          type="file" 
                          ref={audioInputRef}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setAudioFile(e.target.files[0]);
                            }
                          }}
                          accept="audio/*,video/*"
                          className="hidden"
                        />
                        <Mic size={24} className={audioFile ? 'text-emerald-500' : 'text-slate-400'} />
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-755'}`}>
                          {audioFile ? `Áudio/Vídeo: ${audioFile.name}` : "Arraste ou clique para anexar o áudio/vídeo da ligação"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">Formatos aceitos: mp3, wav, mp4</span>
                      </div>

                      {audioFile && (
                        <div className="space-y-3 animate-in slide-in-from-top-1 duration-200">
                          {audioFile.type.startsWith('audio/') && (
                            <div className="flex justify-center p-3 rounded-xl bg-slate-950/20">
                              <audio 
                                src={URL.createObjectURL(audioFile)} 
                                controls 
                                className="w-full max-w-md"
                              />
                            </div>
                          )}

                          {audioFile.type.startsWith('video/') && (
                            <div className="flex justify-center p-3 rounded-xl overflow-hidden bg-slate-950/20">
                              <video 
                                src={URL.createObjectURL(audioFile)} 
                                controls 
                                className="max-h-60 rounded-lg shadow-md"
                              />
                            </div>
                          )}

                          <div className={`p-3 border rounded-xl text-xs flex items-center gap-2 font-bold ${
                            isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}>
                            <Volume2 size={14} className="shrink-0" />
                            <span>🎵 Arquivo '{audioFile.name}' anexado com sucesso.</span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 mt-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Relato do Contato:</label>
                        <textarea 
                          className={`w-full h-24 p-3 border rounded-xl text-xs font-medium outline-none focus:ring-4 transition-all resize-none ${
                            isDarkMode 
                              ? 'bg-slate-800/50 border-slate-750 text-white focus:ring-blue-500/10' 
                              : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-blue-50'
                          }`}
                          placeholder="[O cliente confirmou as condições da proposta, incluindo o valor da parcela, mas...]"
                          value={relatoContato}
                          onChange={(e) => setRelatoContato(e.target.value)}
                        />
                      </div>
                    </div>
                    )
                  )}
                </div>

              </div>

              {/* Informações Gerais */}
              <div className={`p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h4 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <Info size={14} className="text-blue-500" />
                  🔍 Informações Gerais
                </h4>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  <DataField label="Valor da Parcela" value={maskValue(proposal.valor)} isDarkMode={isDarkMode} />
                  <DataField label="Valor Financiado" value={maskValue(proposal.valorFinanciado)} isDarkMode={isDarkMode} />
                  <DataField label="CPF" value={maskCpf(proposal.cpf)} isDarkMode={isDarkMode} />
                  <DataField label="Importado por" value={proposal.importedBy || 'SISTEMA'} isDarkMode={isDarkMode} />
                  <DataField label="Convênio" value={proposal.convenio} isDarkMode={isDarkMode} />
                  <DataField label="Produto" value={proposal.produto} isDarkMode={isDarkMode} />
                  <DataField label="Digitador" value={proposal.corretor || 'N/I'} isDarkMode={isDarkMode} />
                  <DataField label="Parceiro" value={partnerName} isDarkMode={isDarkMode} />
                  
                  {/* SLA Restante */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#64748b]">SLA Restante (3h)</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-black font-mono ${
                        timeState.isPaused 
                          ? 'text-yellow-500' 
                          : timeState.slaMs <= 0 
                            ? 'text-red-500 animate-pulse font-black' 
                            : timeState.slaMs < 1800000 
                              ? 'text-orange-500 font-extrabold' 
                              : isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                      }`}>
                        {formatDuration(timeState.slaMs)}
                      </span>
                      {timeState.isPaused ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                          PAUSADO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 animate-pulse">
                          ATIVO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tempo no Sistema */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#64748b]">Tempo no Sistema</span>
                    <span className={`text-sm font-black font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {formatAge(timeState.ageMs)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-700/50 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleGeneratePDF}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25"
                  >
                    <FileText size={14} /> 📥 Gerar Laudo Técnico PDF
                  </button>
                  {proposal.lockedBy && (
                    <button
                      onClick={() => onRelease(proposal.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
                        isDarkMode 
                        ? 'bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900 hover:text-white shadow-red-500/5' 
                        : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-650 hover:text-white shadow-red-500/10'
                      }`}
                    >
                      <Unlock size={14} /> Soltar Proposta
                    </button>
                  )}
                </div>
              </div>

              {/* Histórico do Movimentações */}
              <div className="flex flex-col">
                <h4 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <span>⏱️ HISTÓRICO DE MOVIMENTAÇÕES</span>
                </h4>
                <div 
                  style={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    padding: '15px',
                    height: '380px',
                    overflowY: 'auto',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'stretch'
                  }}
                  className="space-y-3"
                >
                  {proposalHistory.length > 0 ? (
                    [...proposalHistory].reverse().map((log) => {
                      const normAcao = (log.acao || log.decisao || '').toUpperCase();
                      let corAcao = '#38bdf8';
                      if (normAcao.includes('APROV') || normAcao.includes('APPROVED')) {
                        corAcao = '#10b981';
                      } else if (normAcao.includes('RECUS') || normAcao.includes('REPROV') || normAcao.includes('REJECTED')) {
                        corAcao = '#ef4444';
                      } else if (normAcao.includes('PENDEN') || normAcao.includes('WAITING') || normAcao.includes('CONTACT') || normAcao.includes('AGENDA')) {
                        corAcao = '#f59e0b';
                      }

                      return (
                        <div 
                          key={log.id} 
                          style={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '10px',
                            fontFamily: "'Inter', sans-serif",
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', fontWeight: 700, width: '100%' }}>
                            <span>🕒 {log.timestamp}</span>
                            <span>👤 {log.analista}</span>
                          </div>
                          
                          <div style={{ fontSize: '14px', fontWeight: 900, color: corAcao, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {log.acao || 'DECISÃO'}
                          </div>
                          
                          {log.motivo && (
                            <div style={{
                              backgroundColor: '#0f172a',
                              border: '1px solid #233146',
                              borderLeft: '4px solid #475569',
                              padding: '8px 12px',
                              marginTop: '8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#f1f5f9',
                              fontStyle: 'italic',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}>
                              "{log.motivo}"
                            </div>
                          )}

                          {log.aiAnalysisResult && (
                            <div className="mt-2.5 p-2.5 rounded bg-[#0f172a] border border-slate-700/40 text-[11px] space-y-2 text-slate-300">
                              <div className="flex items-center gap-1.5 font-bold text-indigo-400 border-b border-slate-800 pb-1.5">
                                <span>🤖</span>
                                <span className="uppercase text-[8px] tracking-widest font-black">Mesa Pericial IA Integrada</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-semibold text-slate-400">
                                <div>Docto Válido: <span className={log.aiAnalysisResult.isValidDocument ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{log.aiAnalysisResult.isValidDocument ? "Sim" : "Divergente"}</span></div>
                                <div>Legível: <span className={!log.aiAnalysisResult.isIlegivel ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{!log.aiAnalysisResult.isIlegivel ? "Sim" : "Não"}</span></div>
                                <div>Íntegro: <span className={!log.aiAnalysisResult.isDeteriorated ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{!log.aiAnalysisResult.isDeteriorated ? "Sim" : "Deteriorado"}</span></div>
                                <div>Enquadrado: <span className={!log.aiAnalysisResult.isCortado ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{!log.aiAnalysisResult.isCortado ? "Sim" : "Cortado"}</span></div>
                              </div>
                              <div className="text-[9px] bg-slate-900/60 p-2 rounded space-y-0.5 border border-slate-800/60">
                                <div><span className="text-slate-500">Nome Detetado:</span> <b className="text-indigo-300 font-mono uppercase">{log.aiAnalysisResult.detectedName || "---"}</b></div>
                                <div><span className="text-slate-500">CPF Detetado:</span> <b className="text-indigo-300 font-mono">{log.aiAnalysisResult.detectedCpf || "---"}</b></div>
                                <div><span className="text-slate-500">Titularidade:</span> <b className={log.aiAnalysisResult.matchesTitularidade ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{log.aiAnalysisResult.matchesTitularidade ? "Compatível" : "Incompatível/Divergente"}</b></div>
                              </div>
                              {log.aiAnalysisResult.summary && (
                                <div className="italic text-[10px] text-slate-400 leading-normal border-t border-slate-800/80 pt-1.5">
                                  "{log.aiAnalysisResult.summary}"
                                </div>
                              )}
                            </div>
                          )}

                          {log.contactAttachment && (
                            <div className="mt-2.5 p-2.5 rounded bg-[#0f172a] border border-slate-700/40 text-[11px] space-y-2 text-slate-300">
                              <div className="flex items-center gap-1.5 font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                                <span>📞</span>
                                <span className="uppercase text-[8px] tracking-widest font-black">Dados de Ligações / Gravador</span>
                              </div>
                              {log.contactAttachment.audioName && (
                                <div className="flex items-center gap-1.5 text-[9px] bg-cyan-950/20 text-cyan-400 p-1.5 rounded border border-cyan-900/30 truncate">
                                  <span>🎵</span>
                                  <span className="font-semibold truncate">{log.contactAttachment.audioName}</span>
                                </div>
                              )}
                              {log.contactAttachment.relatoContato && (
                                <div className="text-[10px] leading-relaxed bg-slate-900/20 p-2 rounded border border-slate-800/50">
                                  <span className="font-black text-[8px] uppercase text-cyan-500/80 block mb-1 tracking-widest">Anotações do Analista:</span>
                                  <p className="font-medium text-slate-200">{log.contactAttachment.relatoContato}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-white">
                      <History size={32} />
                      <p className="text-[10px] font-black uppercase mt-2">Sem histórico</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Decision Panel */}
            <div className="space-y-6">
              <div className={`p-6 rounded-2xl border shadow-sm h-full flex flex-col ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                <h4 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  <FileText size={14} className="text-blue-600" />
                  ✍️ Painel de Decisão
                </h4>

                {isFree ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
                    {isCpfBlocked ? (
                      <>
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                          <Lock size={32} />
                        </div>
                        <div>
                          <h5 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-red-400' : 'text-red-900'}`}>Visualização Bloqueada</h5>
                          <p className={`text-xs font-medium ${isDarkMode ? 'text-red-300/70' : 'text-red-700'}`}>Você já está analisando o CPF <span className="font-black underline">{activeCpfAnalysis}</span>.</p>
                        </div>
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Finalize ou libere o cliente atual para atuar nesta ADE.</p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                          <Unlock size={32} />
                        </div>
                        <div>
                          <h5 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-emerald-400' : 'text-emerald-900'}`}>Operação Livre</h5>
                          <p className={`text-xs font-medium ${isDarkMode ? 'text-emerald-300/70' : 'text-emerald-700'}`}>Assuma esta ADE para iniciar a análise técnica.</p>
                        </div>
                        <button 
                          onClick={() => onTakeOver(proposal.id)}
                          className={`px-10 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                        >
                          <Zap size={14} /> Assumir Análise
                        </button>
                      </>
                    )
                  }
                  </div>
                ) : isLockedByOther ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 p-8">
                    <div className="w-16 h-16 bg-orange-500/10 text-orange-500 rounded-full flex items-center justify-center">
                      <Lock size={32} />
                    </div>
                    <div>
                      <h5 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-orange-400' : 'text-orange-900'}`}>Operação Bloqueada</h5>
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-orange-300/70' : 'text-orange-700'}`}>Sendo atuada por <span className="font-black underline">{proposal.lockedBy}</span>.</p>
                    </div>
                    <button
                      onClick={() => onRelease(proposal.id)}
                      className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center gap-2 ${
                        isDarkMode
                          ? 'bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900 hover:text-white'
                          : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-600 hover:text-white'
                      }`}
                      title="Desvincular analista e colocar de volta na fila comum"
                    >
                      <Unlock size={14} /> Soltar Proposta
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-6 animate-in fade-in duration-500">
                    {(() => {
                      const currentRule = REGRAS_PERICIA[selectedReason] || { status: 'ANALISE', mensagem: '', cor: 'normal' };
                      const isApproveDisabled = deAcordo && !quemAutorizou.trim();
                      const isPendênciaDisabled = false;
                      const isReprovarDisabled = false;

                      const contactData = (audioFile || relatoContato) ? {
                        audioName: audioFile?.name,
                        audioUrl: audioFile ? URL.createObjectURL(audioFile) : undefined,
                        relatoContato: relatoContato
                      } : undefined;

                      return (
                        <>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo da Decisão (Governança)</label>
                            <select 
                              className={`w-full p-4 border rounded-xl text-sm font-bold outline-none transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                              value={selectedReason}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedReason(val);
                                if (REGRAS_PERICIA[val]) {
                                  setParecer(REGRAS_PERICIA[val].mensagem);
                                } else if (val === "OUTROS" || val === "") {
                                  setParecer("");
                                }
                              }}
                            >
                              <option value="">-- Selecione um motivo --</option>
                              {Object.keys(REGRAS_PERICIA).map(motivo => (
                                <option key={motivo} value={motivo}>{motivo}</option>
                              ))}
                              <option value="OUTROS">OUTROS / MANUAL</option>
                            </select>
                          </div>

                          {currentRule.status !== 'ANALISE' && (
                            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 animate-in slide-in-from-top-1 duration-200 ${
                              currentRule.status === 'REPROVADO' 
                                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                            }`}>
                              <Info size={14} className="shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold uppercase tracking-wider text-[10px]">Gatilho de Perícia Ativo ({currentRule.status})</p>
                                <p className="mt-0.5 opacity-85 font-medium">Esta decisão necessita ser {currentRule.status === 'REPROVADO' ? 'FINALIZADA (REPROVAR)' : 'COLOCADA EM ESPERA / PENDÊNCIA'} para gravação no sistema, salvo se houver Alçada de Exceção autorizada.</p>
                              </div>
                            </div>
                          )}

                          {/* Alçada de Exceção */}
                          <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'} space-y-3`}>
                            <h5 className={`text-xs font-black uppercase tracking-widest flex items-center gap-1.5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                              👑 Alçada de Exceção
                            </h5>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={deAcordo}
                                onChange={(e) => {
                                  setDeAcordo(e.target.checked);
                                  if (!e.target.checked) setQuemAutorizou('');
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                              />
                              <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                Aprovar por Exceção (Ordem Superior)
                              </span>
                            </label>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quem deu o 'DE ACORDO'?</label>
                              <input
                                type="text"
                                disabled={!deAcordo}
                                value={quemAutorizou}
                                onChange={(e) => setQuemAutorizou(e.target.value)}
                                placeholder="Nome do Diretor ou Gerente"
                                className={`w-full p-2.5 border rounded-lg text-xs font-bold outline-none transition-all disabled:opacity-50 ${isDarkMode ? 'bg-slate-900/50 border-slate-800 text-white placeholder-slate-600' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'}`}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parecer Técnico / Notas</label>
                            <textarea 
                              className={`w-full h-32 p-4 border rounded-xl text-sm font-medium outline-none focus:ring-4 transition-all resize-none ${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-white focus:ring-blue-500/10' : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-blue-50'}`}
                              placeholder="Descreva sua análise..."
                              value={parecer}
                              onChange={(e) => setParecer(e.target.value)}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <button 
                              onClick={() => {
                                const mot = deAcordo 
                                  ? `APROVADO COM RESSALVA - DE ACORDO: ${quemAutorizou.trim()}.${parecer.trim() ? ` Motivo: ${parecer.trim()}` : ''}`
                                  : (selectedReason && parecer.trim() && selectedReason !== parecer.trim()
                                    ? `${selectedReason} - ${parecer.trim()}`
                                    : (selectedReason || parecer.trim() || 'LIBERAÇÃO PADRÃO'));
                                onFinalize(proposal.id, 'APPROVED', mot, aiAnalysisResult, contactData);
                              }}
                              disabled={isApproveDisabled}
                              className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                            >
                              <CheckCircle2 size={16} /> Confirmar Aprovação
                            </button>
                            <button 
                              onClick={() => {
                                const mot = selectedReason && parecer.trim() && selectedReason !== parecer.trim()
                                  ? `${selectedReason} - ${parecer.trim()}`
                                  : (selectedReason || parecer.trim() || 'REPROVADO');
                                onFinalize(proposal.id, 'REJECTED', mot, aiAnalysisResult, contactData);
                              }}
                              disabled={isReprovarDisabled}
                              className="flex items-center justify-center gap-2 py-4 bg-red-650 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
                            >
                              <AlertTriangle size={16} /> Confirmar Reprovação
                            </button>
                            <button 
                              onClick={() => {
                                const mot = selectedReason && parecer.trim() && selectedReason !== parecer.trim()
                                  ? `${selectedReason} - ${parecer.trim()}`
                                  : (selectedReason || parecer.trim() || 'PENDÊNCIA');
                                onFinalize(proposal.id, 'WAITING_DOCS', mot, aiAnalysisResult, contactData);
                              }}
                              disabled={isPendênciaDisabled}
                              className={`flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg ${isDarkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                            >
                              <Clock size={16} /> Salvar Pendência
                            </button>
                            <button 
                              onClick={() => {
                                const mot = selectedReason && parecer.trim() && selectedReason !== parecer.trim()
                                  ? `${selectedReason} - ${parecer.trim()}`
                                  : (selectedReason || parecer.trim());
                                onFinalize(proposal.id, 'CONTACT', mot, aiAnalysisResult, contactData);
                              }}
                              disabled={false}
                              className={`flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg ${isDarkMode ? 'bg-cyan-900 text-cyan-100 hover:bg-cyan-800' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}
                            >
                              <PhoneCall size={16} /> Enviar para Contato
                            </button>
                            <button 
                              onClick={() => onQuickSchedule(proposal)}
                              className={`col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            >
                              <CalendarPlus size={16} /> Agendar Contato Telefônico
                            </button>
                            {(currentUser.role === 'Master' || permissions.deleteProposals) && onDelete && (
                              <button 
                                onClick={() => { if(confirm("Excluir esta proposta permanentemente?")) onDelete(proposal.id) }}
                                className="col-span-2 flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                              >
                                <Trash2 size={16} /> Excluir Proposta do Sistema
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

const DataField: React.FC<{ label: string; value: string; isDarkMode?: boolean }> = ({ label, value, isDarkMode }) => (
  <div className="flex flex-col">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</span>
    <span className={`text-xs font-black uppercase truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{value}</span>
  </div>
);

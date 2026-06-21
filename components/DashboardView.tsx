import React, { useMemo, useState, useEffect } from 'react';
import { Proposal, RiskStatus, DecisionEntry, UserAccount, BaseImport, UserPermissions } from '../types';
import { ViewType } from './Sidebar';
import { TimeFilter } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  Landmark, 
  Activity, 
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  User,
  ChevronRight,
  Filter,
  ArrowUpRight,
  BarChart,
  FileText,
  Download,
  Bell,
  X,
  Sparkles,
  GripVertical,
  ShieldCheck,
  PieChart
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export class DashboardErrorBoundary extends React.Component<{ children: React.ReactNode, isDarkMode?: boolean }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("DashboardErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`p-8 space-y-6 ${this.props.isDarkMode ? 'bg-[#0f172a] text-red-400' : 'bg-slate-50 text-red-650'}`}>
          <h2 className="text-xl font-black uppercase">Erro Crítico no Painel Operacional</h2>
          <p className="text-sm font-semibold">Ocorreu um erro ao processar os dados do dashboard. A pilha do erro está detalhada abaixo:</p>
          <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/20 text-xs overflow-auto font-mono max-h-96">
            <b>{this.state.error?.name}: {this.state.error?.message}</b>
            <pre className="mt-2 text-[10px] leading-relaxed">{this.state.error?.stack}</pre>
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-650 text-white rounded-xl text-xs font-bold uppercase hover:bg-red-750 transition-all"
          >
            Tentar Recarregar Painel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const parsePtBrDate = (dateStr: string): Date => {
  try {
    // Format is "DD/MM/YYYY, HH:MM:SS" or "DD/MM/YYYY HH:MM:SS"
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

const isLogToday = (timestampStr: string): boolean => {
  try {
    const parts = timestampStr.split(/[\s,]+/);
    const dateParts = parts[0].split('/');
    const d = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10) - 1;
    const y = parseInt(dateParts[2], 10);
    
    const today = new Date();
    return d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
  } catch (e) {
    return false;
  }
};

const isLogThisMonth = (timestampStr: string): boolean => {
  try {
    const parts = timestampStr.split(/[\s,]+/);
    const dateParts = parts[0].split('/');
    const m = parseInt(dateParts[1], 10) - 1;
    const y = parseInt(dateParts[2], 10);
    
    const today = new Date();
    return m === today.getMonth() && y === today.getFullYear();
  } catch (e) {
    return false;
  }
};

const isLogInFilter = (timestampStr: string, filter: TimeFilter): boolean => {
  try {
    const logDateObj = parsePtBrDate(timestampStr);
    const logDateStr = logDateObj.getFullYear() + '-' + 
      String(logDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
      String(logDateObj.getDate()).padStart(2, '0'); // format: YYYY-MM-DD
    
    if (filter.type === 'all') return true;
    if (filter.type === 'today') {
      const today = new Date().toISOString().split('T')[0];
      return logDateStr === today;
    }
    if (filter.type === 'month') {
      const thisMonth = new Date().toISOString().substring(0, 7);
      return logDateStr.startsWith(thisMonth);
    }
    if (filter.type === 'custom') {
      if (filter.startDate && logDateStr < filter.startDate) return false;
      if (filter.endDate && logDateStr > filter.endDate) return false;
      return true;
    }
    return true;
  } catch (e) {
    return false;
  }
};

const formatMsToTime = (ms: number): string => {
  if (ms <= 0 || isNaN(ms)) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
};

const calculateAvgSlaForLogList = (processedLogs: DecisionEntry[], allLogs: DecisionEntry[]) => {
  let totalMs = 0;
  let count = 0;
  
  processedLogs.forEach(finalLog => {
    const finalTime = parsePtBrDate(finalLog.timestamp).getTime();
    const startLog = allLogs.find(h => 
      h.ade === finalLog.ade && 
      h.analista === finalLog.analista && 
      h.decisao === 'ASSUMIU' && 
      parsePtBrDate(h.timestamp).getTime() < finalTime
    );
    
    if (startLog) {
      const startTime = parsePtBrDate(startLog.timestamp).getTime();
      const diff = finalTime - startTime;
      if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
        totalMs += diff;
        count++;
      }
    }
  });
  
  return count > 0 ? Math.round(totalMs / count) : 0;
};

interface DashboardViewProps {
  proposals: Proposal[];
  onNavigate: (view: ViewType) => void;
  history?: DecisionEntry[];
  isDarkMode?: boolean;
  currentUser?: UserAccount;
  users?: UserAccount[];
  importedBases?: BaseImport[];
  timeFilter: TimeFilter;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  proposals, 
  onNavigate, 
  history = [], 
  isDarkMode, 
  currentUser, 
  users = [],
  importedBases = [],
  timeFilter
}) => {
  const [selectedBancos, setSelectedBancos] = useState<string[]>([]);
  
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('riskflow_dashboard_card_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.includes('fraudes-evitadas')) {
            parsed.push('fraudes-evitadas');
          }
          return parsed;
        }
      } catch (e) {}
    }
    return [
      'minha-producao',
      'resumo-performance',
      'relatorio-producao',
      'painel-grafico',
      'distribuicao-demandas',
      'resumo-atividade',
      'filtros-relatorio',
      'relatorio-operacional',
      'produtividade-detalhada',
      'distribuicao-acoes',
      'fraudes-evitadas'
    ];
  });

  const [draggableId, setDraggableId] = useState<string | null>(null);

  const userRole = currentUser?.role || 'Analista';

  const hasPermission = (
    permissionKey: keyof UserPermissions,
    defaultForRoles: { master: boolean; supervisor: boolean; analyst: boolean }
  ): boolean => {
    const permVal = currentUser?.permissions?.[permissionKey];
    if (permVal !== undefined) {
      return permVal;
    }
    if (userRole === 'Master') return defaultForRoles.master;
    if (userRole === 'Supervisor') return defaultForRoles.supervisor;
    return defaultForRoles.analyst;
  };

  useEffect(() => {
    localStorage.setItem('riskflow_dashboard_card_order', JSON.stringify(cardOrder));
  }, [cardOrder]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId === targetId) return;

    const newOrder = [...cardOrder];
    const draggedIdx = newOrder.indexOf(draggedId);
    const targetIdx = newOrder.indexOf(targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedId);
      setCardOrder(newOrder);
    }
  };

  const renderDragHandle = (cardId: string) => (
    <div
      onMouseDown={() => setDraggableId(cardId)}
      onMouseUp={() => setDraggableId(null)}
      className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-500 transition-colors p-1.5 rounded-lg bg-slate-800/10 dark:bg-slate-800/30 hover:bg-slate-800/20 shrink-0 inline-flex items-center justify-center mr-1"
      title="Arraste para reordenar"
    >
      <GripVertical size={14} />
    </div>
  );
  
  // Track seen base IDs to know which ones are new to this user
  const [seenBaseIds, setSeenBaseIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('riskflow_seen_base_ids') || '[]');
    } catch (e) {
      return [];
    }
  });

  const newBases = useMemo(() => {
    return importedBases.filter(b => !seenBaseIds.includes(b.id));
  }, [importedBases, seenBaseIds]);

  const handleDismissBase = (baseId: string) => {
    const updated = [...seenBaseIds, baseId];
    setSeenBaseIds(updated);
    localStorage.setItem('riskflow_seen_base_ids', JSON.stringify(updated));
  };

  const handleDismissAll = () => {
    const allIds = importedBases.map(b => b.id);
    const updated = Array.from(new Set([...seenBaseIds, ...allIds]));
    setSeenBaseIds(updated);
    localStorage.setItem('riskflow_seen_base_ids', JSON.stringify(updated));
  };

  // States of the CSV Operational Report Filter Request Form
  const [repBank, setRepBank] = useState('TODOS');
  const [repStatus, setRepStatus] = useState('TODAS');
  const [repSubMotiveDropdown, setRepSubMotiveDropdown] = useState('TODOS');
  const [repSubMotiveCustom, setRepSubMotiveCustom] = useState('');
  const [repAnalyst, setRepAnalyst] = useState('TODOS');

  const [prodStartDate, setProdStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [prodEndDate, setProdEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    if (timeFilter.type === 'today') {
      const today = new Date().toISOString().split('T')[0];
      setProdStartDate(today);
      setProdEndDate(today);
    } else if (timeFilter.type === 'month') {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = today.toISOString().split('T')[0];
      setProdStartDate(firstDay);
      setProdEndDate(lastDay);
    } else if (timeFilter.type === 'all') {
      let earliestDate = '';
      if (history && history.length > 0) {
        try {
          const dates = history.map(h => parsePtBrDate(h.timestamp).getTime());
          const minTime = Math.min(...dates);
          earliestDate = new Date(minTime).toISOString().split('T')[0];
        } catch (e) {}
      }
      if (!earliestDate) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        earliestDate = d.toISOString().split('T')[0];
      }
      setProdStartDate(earliestDate);
      setProdEndDate(new Date().toISOString().split('T')[0]);
    } else if (timeFilter.type === 'custom') {
      if (timeFilter.startDate) setProdStartDate(timeFilter.startDate);
      if (timeFilter.endDate) setProdEndDate(timeFilter.endDate);
    }
  }, [timeFilter, history]);

  const performanceMetrics = useMemo(() => {
    // 1. Get all logs today/period
    const generalLogsToday = history.filter(h => isLogInFilter(h.timestamp, timeFilter));
    
    // Processed today (General)
    const generalProcessedToday = generalLogsToday.filter(h => 
      ['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'WAITING_DOCS'].includes(h.decisao)
    );
    
    // Processed today (Individual - currently logged-in analyst)
    const loggedInUser = currentUser?.username || '';
    const individualProcessedToday = generalProcessedToday.filter(h => 
      h.analista === loggedInUser
    );

    // Get all logs this month
    const generalLogsThisMonth = history.filter(h => isLogThisMonth(h.timestamp));
    const generalProcessedThisMonth = generalLogsThisMonth.filter(h => 
      ['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'WAITING_DOCS'].includes(h.decisao)
    );
    const individualProcessedThisMonth = generalProcessedThisMonth.filter(h => 
      h.analista === loggedInUser
    );

    // Calculate average handling time
    const calculateAvgSla = (processedLogs: typeof generalProcessedToday) => {
      let totalMs = 0;
      let count = 0;
      
      processedLogs.forEach(finalLog => {
        const finalTime = parsePtBrDate(finalLog.timestamp).getTime();
        const startLog = history.find(h => 
          h.ade === finalLog.ade && 
          h.analista === finalLog.analista && 
          h.decisao === 'ASSUMIU' && 
          parsePtBrDate(h.timestamp).getTime() < finalTime
        );
        
        if (startLog) {
          const startTime = parsePtBrDate(startLog.timestamp).getTime();
          const diff = finalTime - startTime;
          // Ignore unrealistic durations (e.g. over 24h, or negative)
          if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
            totalMs += diff;
            count++;
          }
        }
      });
      
      return count > 0 ? Math.round(totalMs / count) : 0;
    };

    // General Stats
    const generalTotal = generalProcessedToday.length;
    const generalApprovals = generalProcessedToday.filter(h => ['APPROVED', 'AUTO_APPROVED'].includes(h.decisao)).length;
    const generalApprovalRate = generalTotal > 0 ? Math.round((generalApprovals / generalTotal) * 100) : 0;
    const generalAvgSla = calculateAvgSla(generalProcessedToday);

    // Individual Stats (Today)
    const individualTotal = individualProcessedToday.length;
    const individualApprovals = individualProcessedToday.filter(h => ['APPROVED', 'AUTO_APPROVED'].includes(h.decisao)).length;
    const individualApprovalRate = individualTotal > 0 ? Math.round((individualApprovals / individualTotal) * 100) : 0;
    const individualAvgSla = calculateAvgSla(individualProcessedToday);
    const individualRejected = individualProcessedToday.filter(h => h.decisao === 'REJECTED').length;
    const individualPending = individualProcessedToday.filter(h => h.decisao === 'WAITING_DOCS').length;

    // Individual Stats (Month)
    const individualMonthTotal = individualProcessedThisMonth.length;
    const individualMonthApprovals = individualProcessedThisMonth.filter(h => ['APPROVED', 'AUTO_APPROVED'].includes(h.decisao)).length;
    const individualMonthApprovalRate = individualMonthTotal > 0 ? Math.round((individualMonthApprovals / individualMonthTotal) * 100) : 0;
    const individualMonthAvgSla = calculateAvgSla(individualProcessedThisMonth);
    const individualMonthRejected = individualProcessedThisMonth.filter(h => h.decisao === 'REJECTED').length;
    const individualMonthPending = individualProcessedThisMonth.filter(h => h.decisao === 'WAITING_DOCS').length;

    return {
      general: {
        total: generalTotal,
        approvalRate: generalApprovalRate,
        avgSla: generalAvgSla,
        approvals: generalApprovals
      },
      individual: {
        total: individualTotal,
        approvalRate: individualApprovalRate,
        avgSla: individualAvgSla,
        approvals: individualApprovals,
        rejected: individualRejected,
        pending: individualPending
      },
      individualMonth: {
        total: individualMonthTotal,
        approvalRate: individualMonthApprovalRate,
        avgSla: individualMonthAvgSla,
        approvals: individualMonthApprovals,
        rejected: individualMonthRejected,
        pending: individualMonthPending
      }
    };
  }, [history, currentUser, timeFilter]);

  const productionReportData = useMemo(() => {
    const startDayTime = new Date(prodStartDate + 'T00:00:00').getTime();
    const endDayTime = new Date(prodEndDate + 'T23:59:59').getTime();

    const filteredLogs = history.filter(log => {
      const logTime = parsePtBrDate(log.timestamp).getTime();
      return logTime >= startDayTime && logTime <= endDayTime;
    });

    const analysts = new Set<string>();
    users.forEach(u => {
      if (u.username) analysts.add(u.username);
    });
    history.forEach(h => {
      if (h.analista) analysts.add(h.analista);
    });
    analysts.delete("Motor de Regras");
    analysts.delete("Sistema");
    analysts.delete("SISTEMA");

    const analystList = Array.from(analysts).sort();

    const getApprovalCategory = (log: DecisionEntry): 'FAST_TRACK' | 'CONTACT_VIDEO' | 'DE_ACORDO' | 'ONLY_DOCS' | null => {
      if (log.decisao === 'AUTO_APPROVED') {
        return 'FAST_TRACK';
      }
      if (log.decisao === 'APPROVED') {
        const motiveRaw = (log.motivo || '').toUpperCase();
        if (motiveRaw.includes('CONTATO') || motiveRaw.includes('TELEFON') || motiveRaw.includes('VIDEO') || motiveRaw.includes('CHAMADA') || motiveRaw.includes('FONE')) {
          return 'CONTACT_VIDEO';
        }
        if (motiveRaw.includes('ACORDO') || motiveRaw.includes('DE ACORDO') || motiveRaw.includes('REGIONAL') || motiveRaw.includes('COMERCIAL')) {
          return 'DE_ACORDO';
        }
        return 'ONLY_DOCS';
      }
      return null;
    };

    const rows = analystList.map(analyst => {
      const analystLogs = filteredLogs.filter(h => h.analista === analyst);
      const processedLogs = analystLogs.filter(h => 
        ['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'WAITING_DOCS', 'CONTACT'].includes(h.decisao)
      );

      const total = processedLogs.length;
      const approvals = processedLogs.filter(h => ['APPROVED', 'AUTO_APPROVED'].includes(h.decisao));
      const totalApprovals = approvals.length;
      const approvalRate = total > 0 ? Math.round((totalApprovals / total) * 100) : 0;

      const pendencies = processedLogs.filter(h => h.decisao === 'WAITING_DOCS').length;
      const pendingRate = total > 0 ? Math.round((pendencies / total) * 150) : 0; // standard pct formatting below handles it

      const recusals = processedLogs.filter(h => h.decisao === 'REJECTED').length;
      const recusalRate = total > 0 ? Math.round((recusals / total) * 100) : 0;

      const contactMesa = processedLogs.filter(h => h.decisao === 'CONTACT').length;
      const contactMesaRate = total > 0 ? Math.round((contactMesa / total) * 100) : 0;

      // Approval details (expressed as % of total approvals)
      const ftCount = approvals.filter(h => getApprovalCategory(h) === 'FAST_TRACK').length;
      const ftRate = totalApprovals > 0 ? Math.round((ftCount / totalApprovals) * 100) : 0;

      const cvCount = approvals.filter(h => getApprovalCategory(h) === 'CONTACT_VIDEO').length;
      const cvRate = totalApprovals > 0 ? Math.round((cvCount / totalApprovals) * 100) : 0;

      const docCount = approvals.filter(h => getApprovalCategory(h) === 'ONLY_DOCS').length;
      const docRate = totalApprovals > 0 ? Math.round((docCount / totalApprovals) * 100) : 0;

      const daCount = approvals.filter(h => getApprovalCategory(h) === 'DE_ACORDO').length;
      const daRate = totalApprovals > 0 ? Math.round((daCount / totalApprovals) * 100) : 0;

      const avgSla = calculateAvgSlaForLogList(processedLogs, history);

      return {
        analyst,
        total,
        totalApprovals,
        approvalRate,
        pendencies,
        pendingRate: total > 0 ? Math.round((pendencies / total) * 100) : 0,
        recusals,
        recusalRate,
        contactMesa,
        contactMesaRate,
        ftCount,
        ftRate,
        cvCount,
        cvRate,
        docCount,
        docRate,
        daCount,
        daRate,
        avgSla
      };
    });

    const teamLogs = filteredLogs.filter(h => 
      h.analista && h.analista !== "Motor de Regras" && h.analista !== "Sistema" && h.analista !== "SISTEMA"
    );
    const teamProcessedLogs = teamLogs.filter(h => 
      ['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'WAITING_DOCS', 'CONTACT'].includes(h.decisao)
    );

    const teamTotal = teamProcessedLogs.length;
    const teamApprovals = teamProcessedLogs.filter(h => ['APPROVED', 'AUTO_APPROVED'].includes(h.decisao));
    const teamTotalApprovals = teamApprovals.length;
    const teamApprovalRate = teamTotal > 0 ? Math.round((teamTotalApprovals / teamTotal) * 100) : 0;

    const teamPendencies = teamProcessedLogs.filter(h => h.decisao === 'WAITING_DOCS').length;
    const teamPendingRate = teamTotal > 0 ? Math.round((teamPendencies / teamTotal) * 100) : 0;

    const teamRecusals = teamProcessedLogs.filter(h => h.decisao === 'REJECTED').length;
    const teamRecusalRate = teamTotal > 0 ? Math.round((teamRecusals / teamTotal) * 100) : 0;

    const teamContactMesa = teamProcessedLogs.filter(h => h.decisao === 'CONTACT').length;
    const teamContactMesaRate = teamTotal > 0 ? Math.round((teamContactMesa / teamTotal) * 100) : 0;

    const teamFtCount = teamApprovals.filter(h => getApprovalCategory(h) === 'FAST_TRACK').length;
    const teamFtRate = teamTotalApprovals > 0 ? Math.round((teamFtCount / teamTotalApprovals) * 100) : 0;

    const teamCvCount = teamApprovals.filter(h => getApprovalCategory(h) === 'CONTACT_VIDEO').length;
    const teamCvRate = teamTotalApprovals > 0 ? Math.round((teamCvCount / teamTotalApprovals) * 100) : 0;

    const teamDocCount = teamApprovals.filter(h => getApprovalCategory(h) === 'ONLY_DOCS').length;
    const teamDocRate = teamTotalApprovals > 0 ? Math.round((teamDocCount / teamTotalApprovals) * 100) : 0;

    const teamDaCount = teamApprovals.filter(h => getApprovalCategory(h) === 'DE_ACORDO').length;
    const teamDaRate = teamTotalApprovals > 0 ? Math.round((teamDaCount / teamTotalApprovals) * 100) : 0;

    const teamAvgSla = calculateAvgSlaForLogList(teamProcessedLogs, history);

    const totals = {
      total: teamTotal,
      totalApprovals: teamTotalApprovals,
      approvalRate: teamApprovalRate,
      pendencies: teamPendencies,
      pendingRate: teamPendingRate,
      recusals: teamRecusals,
      recusalRate: teamRecusalRate,
      contactMesa: teamContactMesa,
      contactMesaRate: teamContactMesaRate,
      ftCount: teamFtCount,
      ftRate: teamFtRate,
      cvCount: teamCvCount,
      cvRate: teamCvRate,
      docCount: teamDocCount,
      docRate: teamDocRate,
      daCount: teamDaCount,
      daRate: teamDaRate,
      avgSla: teamAvgSla
    };

    return {
      rows,
      totals,
      error: null as string | null
    };
  }, [history, users, prodStartDate, prodEndDate]);

  const chartTrendData = useMemo(() => {
    const startDayTime = new Date(prodStartDate + 'T00:00:00').getTime();
    const endDayTime = new Date(prodEndDate + 'T23:59:59').getTime();

    const filteredLogs = history.filter(log => {
      const logTime = parsePtBrDate(log.timestamp).getTime();
      return logTime >= startDayTime && logTime <= endDayTime;
    });

    const dailyDataMap: { 
      [dateStr: string]: { 
        dateStr: string; 
        dateObj: Date; 
        approvals: number; 
        recusals: number; 
        pendencies: number; 
        contactMesa: number; 
        total: number 
      } 
    } = {};

    filteredLogs.forEach(h => {
      const datePart = h.timestamp.split(/[\s,]+/)[0];
      if (!datePart) return;

      if (!dailyDataMap[datePart]) {
        dailyDataMap[datePart] = {
          dateStr: datePart,
          dateObj: parsePtBrDate(h.timestamp),
          approvals: 0,
          recusals: 0,
          pendencies: 0,
          contactMesa: 0,
          total: 0
        };
      }

      if (['APPROVED', 'AUTO_APPROVED'].includes(h.decisao)) {
        dailyDataMap[datePart].approvals++;
        dailyDataMap[datePart].total++;
      } else if (h.decisao === 'REJECTED') {
        dailyDataMap[datePart].recusals++;
        dailyDataMap[datePart].total++;
      } else if (h.decisao === 'WAITING_DOCS') {
        dailyDataMap[datePart].pendencies++;
        dailyDataMap[datePart].total++;
      } else if (h.decisao === 'CONTACT') {
        dailyDataMap[datePart].contactMesa++;
        dailyDataMap[datePart].total++;
      }
    });

    const sortedDays = Object.values(dailyDataMap).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    return sortedDays.map(d => ({
      name: d.dateStr,
      'Aprovações': d.approvals,
      'Recusas': d.recusals,
      'Pendências': d.pendencies,
      'Mesa': d.contactMesa,
      'Total': d.total
    }));
  }, [history, prodStartDate, prodEndDate]);

  const topAnalystsToday = useMemo(() => {
    const generalLogsToday = history.filter(h => isLogInFilter(h.timestamp, timeFilter));
    
    // Processed today (General/Valid finalizations)
    const finalizedToday = generalLogsToday.filter(h => 
      ['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'WAITING_DOCS'].includes(h.decisao)
    );

    // Filter out automated / robot entries
    const excluded = ["Motor de Regras", "Sistema", "SISTEMA", "Motor"];
    const filtered = finalizedToday.filter(h => h.analista && !excluded.includes(h.analista));

    // Aggregate counts
    const counts: Record<string, { total: number; approvals: number; recusals: number; pendencies: number }> = {};
    filtered.forEach(log => {
      const name = log.analista;
      if (!counts[name]) {
        counts[name] = { total: 0, approvals: 0, recusals: 0, pendencies: 0 };
      }
      counts[name].total++;
      if (['APPROVED', 'AUTO_APPROVED'].includes(log.decisao)) {
        counts[name].approvals++;
      } else if (log.decisao === 'REJECTED') {
        counts[name].recusals++;
      } else if (log.decisao === 'WAITING_DOCS') {
        counts[name].pendencies++;
      }
    });

    return Object.entries(counts)
      .map(([name, stats]) => ({
        name,
        ...stats
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [history, timeFilter]);

  const demandDistributions = useMemo(() => {
    // Filter proposals based on selected bank
    const filteredProps = selectedBancos.length === 0
      ? proposals
      : proposals.filter(p => p.banco && selectedBancos.includes(p.banco.toUpperCase()));

    // 1. Covenant Category mapping & counting
    const covenantCounts: Record<string, number> = {};
    const getCovenantCategory = (convenio: string): string => {
      const bn = String(convenio || "").toUpperCase();
      if (/INSS|DATAPREV|APOSENT/.test(bn)) return "INSS";
      if (/SIAPE|FEDERAL|SERVIDOR|ORGAO CENTRAL/.test(bn)) return "FEDERAL (SIAPE)";
      if (/GOV|ESTADO|PREFEITURA|PREF|MUNICIP|GDF/.test(bn)) return "GOVERNOS / PREFEITURAS";
      if (/MARINHA|AERONAUTICA|EXERCITO|MILITAR|PM|POLICIA/.test(bn)) return "FORÇAS MILITARES";
      if (/PRIVADO|CLT/.test(bn)) return "PRIVADO (CLT)";
      return "OUTROS";
    };

    // 2. Product mapping & counting
    const productCounts: Record<string, number> = {};
    const getProductCategory = (produto: string): string => {
      const p = String(produto || "").toUpperCase().trim();
      if (!p || p === "N/I") return "NÃO INFORMADO";
      if (/NOVO/.test(p)) return "NOVO";
      if (/REFIN/.test(p)) return "REFIN";
      if (/CARTAO|CARTÃO|PORTABILIDADE/.test(p)) return "CARTÃO";
      if (/SAQUE/.test(p)) return "SAQUE COMPLEMENTAR";
      return p;
    };

    filteredProps.forEach(p => {
      // Covenant cat
      const covCat = p.categoriaConvenio || getCovenantCategory(p.convenio);
      covenantCounts[covCat] = (covenantCounts[covCat] || 0) + 1;

      // Product cat
      const prodCat = getProductCategory(p.produto);
      productCounts[prodCat] = (productCounts[prodCat] || 0) + 1;
    });

    const covenantData = Object.entries(covenantCounts)
      .map(([name, count]) => ({ name, 'Volume': count }))
      .sort((a, b) => b['Volume'] - a['Volume']);

    const productData = Object.entries(productCounts)
      .map(([name, count]) => ({ name, 'Volume': count }))
      .sort((a, b) => b['Volume'] - a['Volume']);

    return {
      covenantData,
      productData,
      totalProposals: filteredProps.length
    };
  }, [proposals, selectedBancos]);

  const availableBanks = useMemo(() => {
    return Array.from(new Set(history.map(h => h.banco))).sort();
  }, [history]);

  const reportBanks = useMemo(() => {
    const list = new Set<string>();
    proposals.forEach(p => { if (p.banco) list.add(p.banco.toUpperCase()); });
    history.forEach(h => { if (h.banco) list.add(h.banco.toUpperCase()); });
    return Array.from(list).sort();
  }, [proposals, history]);

  const reportAnalysts = useMemo(() => {
    const list = new Set<string>();
    history.forEach(h => {
      if (h.analista) {
        list.add(h.analista);
      }
    });
    return Array.from(list).sort();
  }, [history]);

  const subMotivosPorStatus = useMemo(() => {
    return {
      APROVADA: [
        "LIBERAÇÃO SEM ANÁLISE",
        "CONTATO TELEFONICO E DOCUMENTAÇÃO OK",
        "COM ACORDO COMERCIAL (REGIONAL)",
        "SOMENTE ANÁLISE DOCUMENTAL"
      ],
      REPROVADA: [
        "PROPONENTE NÃO RECONHECE A OPERAÇÃO",
        "CONFIRMAÇÕES INSATISFATÓRIAS",
        "DECURSO DE PRAZO",
        "FALTA DE RETORNO DA PENDENCIA",
        "MONITORAMENTO INTERNO",
        "INRREGULARIDADE"
      ],
      PENDENTE: [
        "DADOS BANCÁRIOS DIVERGENTES",
        "DOCUMENTAÇÃO INCOMPLETA"
      ],
      STANDBY: []
    } as Record<string, string[]>;
  }, []);

  const reportItems = useMemo(() => {
    return history.filter(log => {
      // 0. Filtrar por Período Geral
      if (!isLogInFilter(log.timestamp, timeFilter)) {
        return false;
      }

      // 1. Filtrar por Banco
      if (repBank !== 'TODOS' && log.banco.toUpperCase() !== repBank.toUpperCase()) {
        return false;
      }

      // 2. Filtrar por Finalização (APPROVED/AUTO_APPROVED, REJECTED, WAITING_DOCS, WAITING_REQUEST)
      const isApproved = log.decisao === 'APPROVED' || log.decisao === 'AUTO_APPROVED';
      const isRejected = log.decisao === 'REJECTED';
      const isPending = log.decisao === 'WAITING_DOCS' || log.decisao === 'PENDING' || log.decisao === 'CONTACT';
      const isStandby = log.decisao === 'WAITING_REQUEST';

      if (repStatus === 'APROVADA' && !isApproved) return false;
      if (repStatus === 'REPROVADA' && !isRejected) return false;
      if (repStatus === 'PENDENTE' && !isPending) return false;
      if (repStatus === 'STANDBY' && !isStandby) return false;

      // Se "TODAS", garantimos que é uma das decisões operacionais de finalização válidas
      if (repStatus === 'TODAS') {
        const isOperational = isApproved || isRejected || isPending || isStandby;
        if (!isOperational) return false;
      }

      // 3. Filtrar por Sub Motivo (Dropdown ou texto de busca opcional)
      const logMotivo = (log.motivo || '').toUpperCase();

      if (repSubMotiveDropdown !== 'TODOS') {
        if (!logMotivo.includes(repSubMotiveDropdown.toUpperCase())) {
          return false;
        }
      }

      if (repSubMotiveCustom.trim() !== '') {
        if (!logMotivo.includes(repSubMotiveCustom.toUpperCase())) {
          return false;
        }
      }

      // 4. Filtrar por Analista
      if (repAnalyst !== 'TODOS' && log.analista !== repAnalyst) {
        return false;
      }

      return true;
    });
  }, [history, repBank, repStatus, repSubMotiveDropdown, repSubMotiveCustom, repAnalyst, timeFilter]);

  const handleStatusChange = (statusVal: string) => {
    setRepStatus(statusVal);
    setRepSubMotiveDropdown('TODOS');
  };

  const handleDownloadReportCSV = () => {
    if (reportItems.length === 0) {
      alert("Nenhum registro encontrado para os filtros selecionados.");
      return;
    }

    const csvHeaders = [
      "DATA HORA EMISSAO",
      "ADE",
      "PROPONENTE",
      "CPF EMISSÃO",
      "BANCO",
      "CONVENIO",
      "PRODUTO",
      "VALOR PARCELA",
      "VALOR FINANCIADO",
      "FINALIZACAO",
      "SUB MOTIVO DECISAO",
      "ANALISTA RESPONSAVEL"
    ];

    const csvRows = reportItems.map(log => {
      // Procura dados complementares na proposta pelo ADE
      const prop = proposals.find(p => p.ade === log.ade);

      const formatValue = (num: number | undefined) => {
        if (num === undefined) return "0,00";
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      const cpfFormatted = prop?.cpf ? prop.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "N/I";

      let finalizacaoDesc = "OUTROS";
      if (log.decisao === 'APPROVED' || log.decisao === 'AUTO_APPROVED') finalizacaoDesc = "APROVADA";
      else if (log.decisao === 'REJECTED') finalizacaoDesc = "REPROVADA";
      else if (log.decisao === 'WAITING_DOCS' || log.decisao === 'PENDING' || log.decisao === 'CONTACT') finalizacaoDesc = "PENDENTE";
      else if (log.decisao === 'WAITING_REQUEST') finalizacaoDesc = "EM ESPERA";

      const cleanCell = (val: string | undefined | null) => {
        if (!val) return "";
        const cleaned = val.toString().replace(/\r?\n/g, " ").replace(/"/g, '""');
        return `"${cleaned}"`;
      };

      return [
        log.timestamp,
        log.ade || "N/I",
        cleanCell(log.cliente || prop?.nomeCliente || "N/I"),
        cpfFormatted,
        log.banco || prop?.banco || "N/I",
        cleanCell(prop?.convenio || "N/I"),
        cleanCell(prop?.produto || "N/I"),
        formatValue(prop?.valor),
        formatValue(prop?.valorFinanciado),
        finalizacaoDesc,
        cleanCell(log.motivo),
        log.analista
      ].join(";");
    });

    const csvContent = "\ufeff" + [csvHeaders.join(";"), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const statusName = repStatus === 'TODAS' ? 'Operacional_Geral' : repStatus;
    const bankNameFormatted = repBank === 'TODOS' ? 'Todos_Bancos' : repBank;
    const analystFormatted = repAnalyst === 'TODOS' ? 'Todos_Analistas' : repAnalyst.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Relatorio_Operacional_${bankNameFormatted}_${statusName}_${analystFormatted}_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadProductionCSV = () => {
    if (productionReportData.rows.length === 0) {
      alert("Nenhum dado de analista para exportar no período selecionado.");
      return;
    }

    const csvHeaders = [
      "ANALISTA / EQUIPE",
      "PROPOSTAS PROCESSADAS",
      "TAXA APROVACAO (%)",
      "TOTAL APROVADOS",
      "TAXA PENDENCIA (%)",
      "TOTAL PENDENCIAS",
      "TAXA REPROVACAO (%)",
      "TOTAL REPROVADOS",
      "APROV. CONTATO/VIDEOCF. (%)",
      "APROV. CONTATO/VIDEOCF. (TOTAL)",
      "APROV. DOCUMENTAL (%)",
      "APROV. DOCUMENTAL (TOTAL)",
      "APROV. DE ACORDO (%)",
      "APROV. DE ACORDO (TOTAL)",
      "APROV. AUTOMATICA (%)",
      "APROV. AUTOMATICA (TOTAL)",
      "SLA MEDIO EXECUTADO"
    ];

    const formatSla = (ms: number) => {
      if (ms <= 0) return "---";
      return formatMsToTime(ms);
    };

    const csvRows = [
      [
        "TOTAL DA EQUIPE",
        productionReportData.totals?.total,
        `${productionReportData.totals?.approvalRate}%`,
        productionReportData.totals?.totalApprovals,
        `${productionReportData.totals?.pendingRate}%`,
        productionReportData.totals?.pendencies,
        `${productionReportData.totals?.recusalRate}%`,
        productionReportData.totals?.recusals,
        `${productionReportData.totals?.cvRate}%`,
        productionReportData.totals?.cvCount,
        `${productionReportData.totals?.docRate}%`,
        productionReportData.totals?.docCount,
        `${productionReportData.totals?.daRate}%`,
        productionReportData.totals?.daCount,
        `${productionReportData.totals?.ftRate}%`,
        productionReportData.totals?.ftCount,
        formatSla(productionReportData.totals?.avgSla || 0)
      ].join(";"),
      ...productionReportData.rows.map(r => [
        r.analyst,
        r.total,
        `${r.approvalRate}%`,
        r.totalApprovals,
        `${r.pendingRate}%`,
        r.pendencies,
        `${r.recusalRate}%`,
        r.recusals,
        `${r.cvRate}%`,
        r.cvCount,
        `${r.docRate}%`,
        r.docCount,
        `${r.daRate}%`,
        r.daCount,
        `${r.ftRate}%`,
        r.ftCount,
        formatSla(r.avgSla)
      ].join(";"))
    ];

    const csvContent = "\ufeff" + [csvHeaders.join(";"), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Producao_Gerencial_${prodStartDate}_a_${prodEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const timeFilteredHistory = useMemo(() => {
    return history.filter(h => isLogInFilter(h.timestamp, timeFilter));
  }, [history, timeFilter]);

  const filteredHistory = useMemo(() => {
    if (selectedBancos.length === 0) return timeFilteredHistory;
    return timeFilteredHistory.filter(h => selectedBancos.includes(h.banco));
  }, [timeFilteredHistory, selectedBancos]);

  const metrics = useMemo(() => {
    const stats = {
      total: filteredHistory.length,
      approvals: filteredHistory.filter(h => h.decisao === 'APPROVED' || h.decisao === 'AUTO_APPROVED').length,
      pendencies: filteredHistory.filter(h => h.decisao === 'WAITING_DOCS').length,
      refusals: filteredHistory.filter(h => h.decisao === 'REJECTED').length
    };

    // Tabela Dinâmica: Analista x Ação
    const analystTable: Record<string, Record<string, number>> = {};
    // Tabela Dinâmica: Banco x Ação
    const bankTable: Record<string, Record<string, number>> = {};

    filteredHistory.forEach(log => {
      // Normalização da ação para o relatório
      let acaoLabel = 'OUTROS';
      if (log.decisao === 'APPROVED' || log.decisao === 'AUTO_APPROVED') acaoLabel = 'APROVAR';
      else if (log.decisao === 'WAITING_DOCS') acaoLabel = 'PENDENCIAR';
      else if (log.decisao === 'REJECTED') acaoLabel = 'RECUSAR';

      // Por Analista
      if (!analystTable[log.analista]) {
        analystTable[log.analista] = { APROVAR: 0, PENDENCIAR: 0, RECUSAR: 0, TOTAL: 0 };
      }
      analystTable[log.analista].TOTAL++;
      if (acaoLabel !== 'OUTROS') analystTable[log.analista][acaoLabel]++;

      // Por Banco
      if (!bankTable[log.banco]) {
        bankTable[log.banco] = { APROVAR: 0, PENDENCIAR: 0, RECUSAR: 0, TOTAL: 0 };
      }
      bankTable[log.banco].TOTAL++;
      if (acaoLabel !== 'OUTROS') bankTable[log.banco][acaoLabel]++;
    });

    return { stats, analystTable, bankTable };
  }, [filteredHistory]);

  const toggleBankFilter = (bank: string) => {
    setSelectedBancos(prev => 
      prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]
    );
  };

  const isAdmin = userRole === 'Master';
  const isSupervisor = userRole === 'Supervisor';
  const isAnalyst = userRole === 'Analista';

  const hasFullAnalyticalAccess = isAdmin || (currentUser?.permissions?.fullAnalyticalControl || false);
  const viewAdminResources = hasFullAnalyticalAccess;
  const viewSupervisorResources = hasFullAnalyticalAccess || isSupervisor;

  const renderCard = (cardId: string): React.ReactNode => {
    const showAnalystTable = hasPermission('viewActionsAnalystBank', { master: true, supervisor: true, analyst: false });

    switch (cardId) {
      case 'minha-producao':
        return (
          <div className={`p-6 rounded-[2rem] border transition-all shadow-sm ${
            isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-dashed dark:border-slate-800 border-slate-150">
              <div className="flex items-center gap-3">
                {renderDragHandle('minha-producao')}
                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><User size={18} /></div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Minha Produção Individual
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium font-bold uppercase tracking-tight mt-0.5">
                    Métricas de desempenho pessoal do login ativo: <span className="text-indigo-500 font-mono font-black">{currentUser?.username || 'Analista'}</span>
                  </p>
                </div>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isDarkMode ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
              }`}>
                Perfil: {userRole === 'Master' ? 'Administrador' : userRole}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50/50 border-slate-200/50'}`}>
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span>📅</span> Produção no Período ({
                    timeFilter.type === 'today' ? 'Hoje' :
                    timeFilter.type === 'month' ? 'Mês Corrente' :
                    timeFilter.type === 'all' ? 'Tudo' :
                    `Personalizado: ${timeFilter.startDate ? timeFilter.startDate.split('-').reverse().join('/') : ''} a ${timeFilter.endDate ? timeFilter.endDate.split('-').reverse().join('/') : ''}`
                  })
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-slate-800 dark:text-white">{performanceMetrics.individual.total}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Processadas</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-emerald-500">{performanceMetrics.individual.approvals}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Aprovadas</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-orange-500">{performanceMetrics.individual.pending}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Pendenciadas</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-red-500">{performanceMetrics.individual.rejected}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Reprovadas</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-dashed border-slate-150 dark:border-slate-800 flex justify-between items-center text-[10px]">
                  <span className="text-slate-450 font-bold uppercase text-[9px]">Taxa de Aprovação:</span>
                  <span className="font-mono font-black text-emerald-500">{performanceMetrics.individual.approvalRate}%</span>
                </div>
                <div className="mt-1 flex justify-between items-center text-[10px]">
                  <span className="text-slate-450 font-bold uppercase text-[9px]">SLA Médio de Atendimento:</span>
                  <span className="font-mono font-black text-indigo-400">
                    {performanceMetrics.individual.avgSla > 0 ? formatMsToTime(performanceMetrics.individual.avgSla) : "---"}
                  </span>
                </div>
              </div>

              <div className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50/50 border-slate-200/50'}`}>
                <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span>📅</span> Produção Mensal (Mês)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-105 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-slate-800 dark:text-white">{performanceMetrics.individualMonth.total}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Processadas</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-105 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-emerald-500">{performanceMetrics.individualMonth.approvals}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Aprovadas</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-105 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-orange-500">{performanceMetrics.individualMonth.pending}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Pendenciadas</div>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-105 dark:border-slate-800/80 text-center">
                    <div className="text-2xl font-black text-red-500">{performanceMetrics.individualMonth.rejected}</div>
                    <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider mt-1">Reprovadas</div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-dashed border-slate-150 dark:border-slate-800 flex justify-between items-center text-[10px]">
                  <span className="text-slate-450 font-bold uppercase text-[9px]">Taxa de Aprovação (Mês):</span>
                  <span className="font-mono font-black text-emerald-500">{performanceMetrics.individualMonth.approvalRate}%</span>
                </div>
                <div className="mt-1 flex justify-between items-center text-[10px]">
                  <span className="text-slate-450 font-bold uppercase text-[9px]">SLA Médio do Período:</span>
                  <span className="font-mono font-black text-purple-400">
                    {performanceMetrics.individualMonth.avgSla > 0 ? formatMsToTime(performanceMetrics.individualMonth.avgSla) : "---"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'resumo-performance':
        if (!hasPermission('viewDailyPerfSummary', { master: true, supervisor: true, analyst: true })) return null;
        return (
          <div className={`p-6 rounded-[2rem] border transition-all shadow-sm ${
            isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 pb-4 border-b border-dashed dark:border-slate-800 border-slate-150">
              <div className="flex items-center gap-3">
                {renderDragHandle('resumo-performance')}
                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Activity size={18} /></div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Resumo de Performance do Dia
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Métricas de propostas processadas pelos analistas no período.
                  </p>
                </div>
              </div>
              {currentUser && (
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Analista Logado: <span className="font-mono">{currentUser.username}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/20' : 'bg-slate-50/50 border-slate-150 hover:bg-slate-50'
              }`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Propostas Processadas</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-905'}`}>
                    {performanceMetrics.individual.total}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{performanceMetrics.individual.total === 1 ? 'proposta' : 'propostas'} {timeFilter.type === 'today' ? 'hoje' : 'no período'}</span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-dashed dark:border-slate-800/80 border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-450 font-bold uppercase text-[9px] tracking-wide">Fila de Análise:</span>
                  <span className={`font-black font-mono ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    {performanceMetrics.general.total} no total
                  </span>
                </div>
              </div>

              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/20' : 'bg-slate-50/50 border-slate-150 hover:bg-slate-50'
              }`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Taxa de Aprovação</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-905'}`}>
                    {performanceMetrics.individual.approvalRate}%
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">de aprovações</span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-dashed dark:border-slate-800/80 border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-455 font-bold uppercase text-[9px] tracking-wide">Média Geral:</span>
                  <span className={`font-black font-mono ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {performanceMetrics.general.approvalRate}%
                  </span>
                </div>
              </div>

              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/20' : 'bg-slate-50/50 border-slate-150 hover:bg-slate-50'
              }`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">SLA / Tempo de Atendimento</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-905'}`}>
                    {performanceMetrics.individual.avgSla > 0 ? formatMsToTime(performanceMetrics.individual.avgSla) : "---"}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">médio por análise</span>
                </div>
                
                <div className="mt-3 pt-3 border-t border-dashed dark:border-slate-800/80 border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-455 font-bold uppercase text-[9px] tracking-wide">Tempo Médio Geral:</span>
                  <span className={`font-black font-mono ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    {performanceMetrics.general.avgSla > 0 ? formatMsToTime(performanceMetrics.general.avgSla) : "---"}
                  </span>
                </div>
              </div>

              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/20' : 'bg-slate-50/50 border-slate-150 hover:bg-slate-50'
              }`}>
                <div className="flex items-center justify-between mb-2 pb-1 border-b dark:border-slate-800/80 border-slate-150">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🏆 Top 3 Analistas ({
                    timeFilter.type === 'today' ? 'Hoje' :
                    timeFilter.type === 'month' ? 'Mês Corrente' :
                    timeFilter.type === 'all' ? 'Tudo' :
                    'Período'
                  })</p>
                  <span className={`text-[9.5px] font-black font-mono px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                    Ranking
                  </span>
                </div>
                
                {topAnalystsToday.length === 0 ? (
                  <div className="h-[76px] flex items-center justify-center text-[10px] font-semibold text-slate-400 text-center uppercase tracking-wide">
                    Nenhuma proposta finalizada<br />{timeFilter.type === 'today' ? 'hoje' : 'no período'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topAnalystsToday.map((analyst, index) => {
                      const medals = ["🥇", "🥈", "🥉"];
                      return (
                        <div key={analyst.name} className="flex items-center justify-between text-xs py-0.5 first:pt-0 last:pb-0 border-b border-dashed border-slate-150 dark:border-slate-800 last:border-0">
                          <div className="flex items-center gap-1.5 truncate max-w-[110px]">
                            <span className="text-sm leading-none">{medals[index]}</span>
                            <span className={`font-black truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`} title={analyst.name}>
                              {analyst.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <span className={`font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{analyst.total}</span>
                            <span className="text-[9px] text-slate-400 font-sans font-medium" title="Sendo: (Aprovações / Pendenciadas / Recusadas)">
                              ({analyst.approvals}A/{analyst.pendencies}P/{analyst.recusals}R)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'relatorio-producao':
        if (!hasPermission('viewProductionReportPeriod', { master: true, supervisor: true, analyst: false })) return null;
        return (
          <div className={`p-6 rounded-[2rem] border transition-all shadow-sm ${
            isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-dashed dark:border-slate-800 border-slate-150">
              <div className="flex items-center gap-3">
                {renderDragHandle('relatorio-producao')}
                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><BarChart3 size={18} /></div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Relatório de Produção por Período
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Métricas de desempenho individual e da equipe no período selecionado.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">De:</span>
                  <input 
                    type="date"
                    value={prodStartDate}
                    onChange={(e) => setProdStartDate(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-black outline-none transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:ring-blue-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-slate-900'
                    }`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-405">Até:</span>
                  <input 
                    type="date"
                    value={prodEndDate}
                    onChange={(e) => setProdEndDate(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-black outline-none transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:ring-blue-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-slate-900'
                    }`}
                  />
                </div>

                <button
                  onClick={handleDownloadProductionCSV}
                  disabled={!!productionReportData.error}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${
                    productionReportData.error 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 dark:shadow-none'
                  }`}
                >
                  <Download size={12} />
                  Exportar XLS/CSV
                </button>
              </div>
            </div>

            {productionReportData.error ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-2xl text-[11px] font-bold">
                ⚠️ {productionReportData.error}
              </div>
            ) : (
              <div className="space-y-6">
                {productionReportData.totals && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-150'}`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Processadas no Período</p>
                      <p className={`text-lg font-black mt-1 ${isDarkMode ? 'text-white' : 'text-slate-850'}`}>{productionReportData.totals.total}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-emerald-50/40 border-slate-150'}`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Taxa de Aprovação</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{productionReportData.totals.approvalRate}%</p>
                        <span className="text-[10px] text-slate-400">({productionReportData.totals.totalApprovals})</span>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-orange-50/40 border-slate-150'}`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Taxa de Pendência</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <p className="text-lg font-black text-orange-600 dark:text-orange-400">{productionReportData.totals.pendingRate}%</p>
                        <span className="text-[10px] text-slate-400">({productionReportData.totals.pendencies})</span>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-red-50/40 border-slate-150'}`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Taxa de Recusa</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <p className="text-lg font-black text-red-600 dark:text-red-400">{productionReportData.totals.recusalRate}%</p>
                        <span className="text-[10px] text-slate-400">({productionReportData.totals.recusals})</span>
                      </div>
                    </div>
                    <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-purple-50/40 border-slate-150'}`}>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">SLA Médio Comercial</p>
                      <p className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1">
                        {productionReportData.totals.avgSla > 0 ? formatMsToTime(productionReportData.totals.avgSla) : "---"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border dark:border-slate-800 border-slate-150">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b dark:border-slate-800 border-slate-150 text-[9px] font-black uppercase tracking-wider ${
                        isDarkMode ? 'bg-slate-950/20 text-slate-450' : 'bg-slate-100/60 text-slate-500'
                      }`}>
                        <th className="p-4">Analista</th>
                        <th className="p-4 text-center">Processados</th>
                        <th className="p-4 text-center">Aprovação %</th>
                        <th className="p-4 text-center">Pendências %</th>
                        <th className="p-4 text-center">Reprovações %</th>
                        <th className="p-4 text-center">Contato</th>
                        <th className="p-4">Detalhamento das Aprovações</th>
                        <th className="p-4 text-right">SLA Médio</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y text-xs ${isDarkMode ? 'divide-slate-800' : 'divide-slate-150'}`}>
                      {productionReportData.rows.map((row, idx) => (
                        <tr 
                          key={row.analyst}
                          className={idx % 2 === 0 ? '' : isDarkMode ? 'bg-slate-950/20' : 'bg-slate-50/30'}
                        >
                          <td className="p-4 font-bold max-w-[140px] truncate">{row.analyst}</td>
                          <td className="p-4 font-black font-mono text-center">{row.total}</td>
                          <td className="p-4 font-black font-mono text-center text-emerald-600 dark:text-emerald-400">
                            {row.approvalRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({row.totalApprovals})</span>
                          </td>
                          <td className="p-4 font-black font-mono text-center text-orange-600 dark:text-orange-400">
                            {row.pendingRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({row.pendencies})</span>
                          </td>
                          <td className="p-4 font-black font-mono text-center text-red-600 dark:text-red-400">
                            {row.recusalRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({row.recusals})</span>
                          </td>
                          <td className="p-4 font-black font-mono text-center text-purple-600 dark:text-purple-400">
                            {row.contactMesaRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({row.contactMesa})</span>
                          </td>
                          <td className="p-4 space-y-1">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                              <div className="flex items-center justify-between text-slate-500">
                                <span>📞 Contato / Video:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                                  {row.cvCount} ({row.cvRate}%)
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>📄 Documental:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                                  {row.docCount} ({row.docRate}%)
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>🤝 De Acordo:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                                  {row.daCount} ({row.daRate}%)
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>⚡ Fast-Track:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                  {row.ftCount} ({row.ftRate}%)
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-bold font-mono text-right text-slate-500">
                            {row.avgSla > 0 ? formatMsToTime(row.avgSla) : "---"}
                          </td>
                        </tr>
                      ))}

                      {productionReportData.totals && (
                        <tr className={`font-black ${
                          isDarkMode ? 'bg-[#0f172a] text-white' : 'bg-indigo-50/50 text-slate-800'
                        }`}>
                          <td className="p-4 uppercase tracking-tight text-[11px] font-black">🌟 Total Equipe</td>
                          <td className="p-4 text-center font-mono text-[13px]">{productionReportData.totals.total}</td>
                          <td className="p-4 text-center font-mono text-[13px] text-emerald-600 dark:text-emerald-400">
                            {productionReportData.totals.approvalRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({productionReportData.totals.totalApprovals})</span>
                          </td>
                          <td className="p-4 text-center font-mono text-[13px] text-orange-600 dark:text-orange-400 font-bold font-mono">
                            {productionReportData.totals.pendingRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({productionReportData.totals.pendencies})</span>
                          </td>
                          <td className="p-4 text-center font-mono text-[13px] text-red-600 dark:text-red-400 font-bold font-mono">
                            {productionReportData.totals.recusalRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({productionReportData.totals.recusals})</span>
                          </td>
                          <td className="p-4 text-center font-mono text-[13px] text-purple-600 dark:text-purple-400 font-bold font-mono">
                            {productionReportData.totals.contactMesaRate}% <span className="text-[10px] text-slate-400 font-medium font-sans">({productionReportData.totals.contactMesa})</span>
                          </td>
                          <td className="p-4">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-bold">
                              <div className="flex items-center justify-between text-slate-500">
                                <span>📞 Contato / Video:</span>
                                <span className="text-slate-800 dark:text-white font-mono">
                                  {productionReportData.totals.cvCount} ({productionReportData.totals.cvRate}%)
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>📄 Documental:</span>
                                <span className="text-slate-800 dark:text-white font-mono">
                                  {productionReportData.totals.docCount} ({productionReportData.totals.docRate}%)
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>🤝 De Acordo:</span>
                                <span className="text-slate-800 dark:text-white font-mono">
                                  {productionReportData.totals.daCount} ({productionReportData.totals.daRate}%)
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>⚡ Fast-Track:</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                                  {productionReportData.totals.ftCount} ({productionReportData.totals.ftRate}%)
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono text-slate-600 dark:text-slate-300">
                            {productionReportData.totals.avgSla > 0 ? formatMsToTime(productionReportData.totals.avgSla) : "---"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 rounded-xl border dark:border-slate-800/80 border-slate-150 bg-slate-50/50 dark:bg-slate-900/10 text-[10px] text-slate-400 leading-relaxed font-semibold">
                  💡 <b>Conceito de Análise:</b> O SLA é medido a partir da diferença de tempo entre o log "ASSUMIU" e o parecer conclusivo. Os percentuais acima são calculados sobre as <b>propostas aprovadas</b> de cada analista para acompanhamento tático.
                </div>
              </div>
            )}
          </div>
        );

      case 'painel-grafico':
        if (!hasPermission('viewPerformanceChartsPeriod', { master: true, supervisor: true, analyst: false })) return null;
        return (
          <div className={`p-6 rounded-[2rem] border transition-all shadow-sm space-y-6 ${
            isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-dashed dark:border-slate-800 border-slate-150">
              <div className="flex items-center gap-3">
                {renderDragHandle('painel-grafico')}
                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><TrendingUp size={18} /></div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Painel Gráfico de Performance e Produtividade do Período
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Análise de tendências cronológicas, identificação de gargalos de análise, e distribuição individual/equipe para reuniões de feedback.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Período: {prodStartDate} - {prodEndDate}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-150'}`}>
                <div className="mb-4">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    📈 Evolução Diária (Aprovações vs. Recusas)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Comportamento e volume de deferidos e indeferidos ao longo dos dias selecionados.
                  </p>
                </div>
                
                {chartTrendData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
                    Nenhum dado histórico encontrado para a evolução diária no período.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorApprovals" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorRecusals" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                            borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: isDarkMode ? '#ffffff' : '#1e293b',
                            fontWeight: 'bold'
                          }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <Area name="Aprovações" type="monotone" dataKey="Aprovações" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorApprovals)" />
                        <Area name="Recusas" type="monotone" dataKey="Recusas" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRecusals)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-150'}`}>
                <div className="mb-4">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    👥 Produtividade e Pareceres por Analista
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Resultados individuais detalhados para identificação de gargalos de desempenho e tomada de decisão.
                  </p>
                </div>

                {productionReportData.rows.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
                    Nenhum analista com produção registrada no período selecionado.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart 
                        data={productionReportData.rows} 
                        margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis 
                          dataKey="analyst" 
                          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                            borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: isDarkMode ? '#ffffff' : '#1e293b',
                            fontWeight: 'bold'
                          }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <Bar name="Aprovações" dataKey="totalApprovals" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar name="Pendências" dataKey="pendencies" fill="#f97316" radius={[4, 4, 0, 0]} />
                        <Bar name="Reprovações" dataKey="recusals" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${
              isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-indigo-50/20 border-indigo-100 dark:border-indigo-900/40'
            }`}>
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                  🔎 DIAGNÓSTICO DE FLUXO (GARGALOS)
                </span>
                <p className={`text-[11px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-350' : 'text-slate-600'}`}>
                  {productionReportData.totals && productionReportData.totals.total > 0 ? (
                    <>
                      A equipe operou <b>{productionReportData.totals.total}</b> propostas no sistema entre <b>{prodStartDate}</b> e <b>{prodEndDate}</b>.
                      A taxa média de aprovação foi de <b className="text-emerald-500">{productionReportData.totals.approvalRate}%</b>, com <b className="text-orange-500">{productionReportData.totals.pendingRate}% de pendências</b> e <b className="text-red-500">{productionReportData.totals.recusalRate}% de reprovações</b>. 
                      {productionReportData.totals.pendingRate > 20 ? (
                        " Gargalo Identificado: A alta proporção de pendências (superior a 20%) sugere ineficiência no recolhimento ou qualidade de envio dos documentos por parte dos parceiros. Recomendamos melhorar a qualidade dos arquivos enviados antes da submissão no sistema."
                      ) : (
                        " Indicadores Saudáveis: O fluxo de aprovação é contínuo e equilibrado. Contatos e decisões de aprovação automática estão operando de acordo com as metas."
                      )}
                    </>
                  ) : (
                    "Nenhuma proposta registrada no período selecionado."
                  )}
                </p>
              </div>
            </div>
          </div>
        );

      case 'distribuicao-demandas':
        return (
          <div className={`p-6 rounded-[2rem] border transition-all shadow-sm space-y-6 ${
            isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-dashed dark:border-slate-800 border-slate-150">
              <div className="flex items-center gap-3">
                {renderDragHandle('distribuicao-demandas')}
                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><PieChart size={18} /></div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Distribuição de Demandas por Segmento (Convênio & Produto)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Análise comparativa das propostas por convênio e produto para identificação de maiores demandas de análise.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Total sob Análise: {demandDistributions.totalProposals} Propostas
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-150'}`}>
                <div className="mb-4">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    🏢 Concentração por Categoria de Convênio (INSS vs SIAPE vs PRIVADO)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Volume atual de propostas de acordo com a categoria de convênio mapeada.
                  </p>
                </div>

                {demandDistributions.covenantData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
                    Nenhuma proposta encontrada para convênios.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart 
                        data={demandDistributions.covenantData} 
                        margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                            borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: isDarkMode ? '#ffffff' : '#1e293b',
                            fontWeight: 'bold'
                          }}
                        />
                        <Bar name="Volume" dataKey="Volume" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-150'}`}>
                <div className="mb-4">
                  <h4 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    🏷️ Concentração por Produto (NOVO vs REFIN vs Cartão vs SAQUE COMPLEMENTAR)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Distribuição das demandas por tipo de produto.
                  </p>
                </div>

                {demandDistributions.productData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-semibold">
                    Nenhuma proposta encontrada para produtos.
                  </div>
                ) : (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart 
                        data={demandDistributions.productData} 
                        margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                          stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                            borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: isDarkMode ? '#ffffff' : '#1e293b',
                            fontWeight: 'bold'
                          }}
                        />
                        <Bar name="Volume" dataKey="Volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${
              isDarkMode ? 'bg-[#0f172a] border-slate-800' : 'bg-indigo-50/20 border-indigo-100 dark:border-indigo-900/40'
            }`}>
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                  💡 INSIGHT DE MAPEAMENTO DE PROPOSTAS
                </span>
                <p className={`text-[11px] font-medium leading-relaxed ${isDarkMode ? 'text-slate-350' : 'text-slate-600'}`}>
                  {demandDistributions.totalProposals > 0 ? (
                    <>
                      A maior concentração de convênios atualmente está no segmento <b className="text-blue-500">{demandDistributions.covenantData[0]?.name || 'N/A'}</b> com <b>{demandDistributions.covenantData[0]?.Volume || 0} propostas</b>. 
                      No desdobramento de produtos, a maior demanda reside em <b className="text-purple-500">{demandDistributions.productData[0]?.name || 'N/A'}</b> (responsável por <b>{demandDistributions.productData[0]?.Volume || 0} propostas</b>). 
                      Supervisores devem alinhar recursos analíticos para equilibrar esses fluxos.
                    </>
                  ) : (
                    "Não há propostas registradas para o banco selecionado."
                  )}
                </p>
              </div>
            </div>
          </div>
        );

      case 'resumo-atividade':
        if (!hasPermission('viewActivitySummaryGov', { master: true, supervisor: false, analyst: false })) return null;
        return (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <h2 className={`text-2xl font-black tracking-tight flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {renderDragHandle('resumo-atividade')}
                <TrendingUp size={28} className="text-blue-600" />
                📈 Resumo de Atividade
              </h2>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BI Dashboard V18</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiMetric title="Total de Ações" value={metrics.stats.total} color="blue" icon={<BarChart3 size={24} />} isDarkMode={isDarkMode} />
              <KpiMetric title="Aprovações ✅" value={metrics.stats.approvals} color="emerald" icon={<CheckCircle2 size={24} />} isDarkMode={isDarkMode} />
              <KpiMetric title="Pendências 🔴" value={metrics.stats.pendencies} color="orange" icon={<AlertTriangle size={24} />} isDarkMode={isDarkMode} />
              <KpiMetric title="Reprovações ✖️" value={metrics.stats.refusals} color="red" icon={<XCircle size={24} />} isDarkMode={isDarkMode} />
            </div>
          </div>
        );

      case 'filtros-relatorio':
        return (
          <div className={`rounded-[2rem] border p-6 shadow-sm space-y-4 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3">
              {renderDragHandle('filtros-relatorio')}
              <Filter size={18} className="text-slate-400" />
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Filtros de Relatório</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setSelectedBancos([])}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedBancos.length === 0 ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                Todos os Bancos
              </button>
              {availableBanks.map(bank => (
                <button 
                  key={bank}
                  onClick={() => toggleBankFilter(bank)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${selectedBancos.includes(bank) ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {bank}
                </button>
              ))}
            </div>
          </div>
        );

      case 'relatorio-operacional':
        if (!hasPermission('viewOperationalReportCsv', { master: true, supervisor: true, analyst: false })) return null;
        return (
          <div id="solicitacao_relatorio_operacional" className={`rounded-[2rem] border p-8 shadow-sm space-y-6 ${isDarkMode ? 'bg-slate-900/40 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {renderDragHandle('relatorio-operacional')}
                <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-blue-500/10 text-blue-404' : 'bg-blue-50 text-blue-604'}`}>
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tight">Relatório Operacional (Exportação CSV)</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Extraia e filtre decisões por banco, status da proposta e sub-motivo específico.</p>
                </div>
              </div>
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                reportItems.length > 0 
                  ? 'bg-emerald-500/10 text-emerald-500' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                Registros Selecionados: {reportItems.length}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Banco Emissor</label>
                <select
                  id="relatorio-filtro-banco"
                  value={repBank}
                  onChange={(e) => setRepBank(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-white focus:ring-blue-500 font-bold' 
                      : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-900 font-bold'
                  }`}
                >
                  <option value="TODOS">TODOS OS BANCOS</option>
                  {reportBanks.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Finalização (Status)</label>
                <select
                  id="relatorio-filtro-finalizacao"
                  value={repStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-white focus:ring-blue-500 font-bold' 
                      : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-900 font-bold'
                  }`}
                >
                  <option value="TODAS">TODAS AS FINALIZAÇÕES</option>
                  <option value="APROVADA">APROVADA (SISTEMA & ANALISTA)</option>
                  <option value="REPROVADA">REPROVADA</option>
                  <option value="PENDENTE">PENDENTE</option>
                  <option value="STANDBY">EM ESPERA</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sub-Motivo da Decisão</label>
                <select
                  id="relatorio-filtro-submotivo"
                  value={repSubMotiveDropdown}
                  onChange={(e) => setRepSubMotiveDropdown(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-white focus:ring-blue-500 font-bold' 
                      : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-900 font-bold'
                  }`}
                >
                  <option value="TODOS">TODOS OS SUB-MOTIVOS</option>
                  {subMotivosPorStatus[repStatus] && subMotivosPorStatus[repStatus].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {repStatus === 'TODAS' && (
                    <>
                      <optgroup label="Aprovações">
                        {subMotivosPorStatus.APROVADA.map(m => <option key={m} value={m}>{m}</option>)}
                      </optgroup>
                      <optgroup label="Recusas">
                        {subMotivosPorStatus.REPROVADA.map(m => <option key={m} value={m}>{m}</option>)}
                      </optgroup>
                      <optgroup label="Pendências">
                        {subMotivosPorStatus.PENDENTE.map(m => <option key={m} value={m}>{m}</option>)}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Analista do Sistema</label>
                <select
                  id="relatorio-filtro-analista"
                  value={repAnalyst}
                  onChange={(e) => setRepAnalyst(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border text-xs font-bold outline-none focus:ring-2 transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-white focus:ring-blue-500 font-bold' 
                      : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-900 font-bold'
                  }`}
                >
                  <option value="TODOS">TODOS OS ANALISTAS</option>
                  {reportAnalysts.map(analyst => (
                    <option key={analyst} value={analyst}>{analyst}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Busca por Palavra-chave</label>
                <input
                  id="relatorio-filtro-palavrachave"
                  type="text"
                  placeholder="Digite termo para busca livre..."
                  value={repSubMotiveCustom}
                  onChange={(e) => setRepSubMotiveCustom(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold outline-none focus:ring-2 transition-all ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-white focus:ring-blue-500' 
                      : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-900'
                  }`}
                />
              </div>
            </div>

            <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isDarkMode ? 'bg-slate-950/45' : 'bg-slate-50'
            }`}>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Filtros ativos: Banco: {repBank === 'TODOS' ? 'Todos' : repBank} | Status: {repStatus === 'TODAS' ? 'Padrão Geral' : repStatus} | Analista: {repAnalyst === 'TODOS' ? 'Todos' : repAnalyst}</span>
              </div>

              <button
                id="btn-baixar-relatorio-csv"
                onClick={handleDownloadReportCSV}
                disabled={reportItems.length === 0}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg duration-200 transition-all ${
                  reportItems.length > 0 
                    ? 'bg-blue-650 hover:bg-blue-700 bg-blue-600 text-white cursor-pointer hover:shadow-blue-600/10' 
                    : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed shadow-none border border-slate-200 dark:border-slate-800/60'
                }`}
              >
                <Download size={14} />
                Solicitar & Baixar CSV ({reportItems.length})
              </button>
            </div>
          </div>
        );

      case 'produtividade-detalhada':
        if (!hasPermission('viewActionsAnalystBank', { master: true, supervisor: true, analyst: true })) return null;
        return (
          <div className={`p-6 rounded-[2rem] border transition-all shadow-sm ${
            isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-dashed dark:border-slate-800 border-slate-150">
              <div className="flex items-center gap-3">
                {renderDragHandle('produtividade-detalhada')}
                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><Users size={18} /></div>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    Produtividade Detalhada por Analista e Convênio
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Tabelas dinâmicas de volume de aprovar, pendenciar e reprovar.
                  </p>
                </div>
              </div>
            </div>

            <div className={showAnalystTable ? "grid grid-cols-1 lg:grid-cols-2 gap-8" : "max-w-3xl mx-auto"}>
              {showAnalystTable && (
                <div className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`p-6 border-b flex flex-col items-center justify-center gap-3 text-center ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50'}`}>
                    <h3 className={`text-sm font-black uppercase tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      <Users size={18} className="text-blue-600" />
                      Ações por Analista
                    </h3>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>Pivot Table</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className={`text-[10px] font-black text-slate-405 uppercase tracking-widest border-b ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50'}`}>
                          <th className="px-6 py-4 text-center">Analista</th>
                          <th className="px-4 py-4 text-center">Aprovar</th>
                          <th className="px-4 py-4 text-center">Pendenciar</th>
                          <th className="px-4 py-4 text-center">Reprovar</th>
                          <th className="px-4 py-4 text-center">Total</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {Object.entries(metrics.analystTable).length > 0 ? (
                          Object.entries(metrics.analystTable).map(([name, data]: [string, any]) => (
                            <tr key={name} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                              <td className="px-6 py-5">
                                <div className="flex items-center justify-center gap-3">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}>
                                    {name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className={`font-bold text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-5 text-center text-xs font-bold text-emerald-600">{data.APROVAR}</td>
                              <td className="px-4 py-5 text-center text-xs font-bold text-orange-600">{data.PENDENCIAR}</td>
                              <td className="px-4 py-5 text-center text-xs font-bold text-red-600">{data.RECUSAR}</td>
                              <td className={`px-4 py-5 text-center font-black text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{data.TOTAL}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-20 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sem registros no período</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`p-6 border-b flex flex-col items-center justify-center gap-3 text-center ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50'}`}>
                  <h3 className={`text-sm font-black uppercase tracking-tight flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                    <Landmark size={18} className="text-blue-600" />
                    Ações por Convênio
                  </h3>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>Pivot Table</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className={`text-[10px] font-black text-slate-405 uppercase tracking-widest border-b ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50'}`}>
                        <th className="px-6 py-4 text-center">Instituição</th>
                        <th className="px-4 py-4 text-center">Aprovar</th>
                        <th className="px-4 py-4 text-center">Pendenciar</th>
                        <th className="px-4 py-4 text-center">Reprovar</th>
                        <th className="px-4 py-4 text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {Object.entries(metrics.bankTable).length > 0 ? (
                        Object.entries(metrics.bankTable).map(([name, data]: [string, any]) => (
                          <tr key={name} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                            <td className="px-6 py-5 text-center">
                              <span className={`font-bold text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-830'}`}>{name}</span>
                            </td>
                            <td className="px-4 py-5 text-center text-xs font-bold text-emerald-600">{data.APROVAR}</td>
                            <td className="px-4 py-5 text-center text-xs font-bold text-orange-600">{data.PENDENCIAR}</td>
                            <td className="px-4 py-5 text-center text-xs font-bold text-red-650">{data.RECUSAR}</td>
                            <td className={`px-4 py-5 text-center font-black text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{data.TOTAL}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-20 text-center text-[10px] font-bold text-slate-404 uppercase tracking-widest">Sem dados bancários detectados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );

      case 'distribuicao-acoes':
        if (!hasPermission('viewQtyActionsDistChart', { master: true, supervisor: false, analyst: false })) return null;
        return (
          <div className={`rounded-[2.5rem] p-8 border shadow-sm space-y-6 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <h3 className={`text-lg font-black flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {renderDragHandle('distribuicao-acoes')}
                <BarChart size={22} className="text-blue-600" />
                Distribuição Quantitativa de Ações
              </h3>
            </div>
            <div className="flex items-end gap-6 h-48 pt-4">
              <BarItem label="Aprov" count={metrics.stats.approvals} color="bg-emerald-500" max={metrics.stats.total} />
              <BarItem label="Pend" count={metrics.stats.pendencies} color="bg-orange-500" max={metrics.stats.total} />
              <BarItem label="Reprov" count={metrics.stats.refusals} color="bg-red-500" max={metrics.stats.total} />
              <BarItem label="Outros" count={metrics.stats.total - (metrics.stats.approvals + metrics.stats.pendencies + metrics.stats.refusals)} color={isDarkMode ? 'bg-slate-700' : 'bg-slate-200'} max={metrics.stats.total} />
            </div>
          </div>
        );

      case 'fraudes-evitadas': {
        try {
          const showFraudPreventionChart = hasPermission('viewFraudPreventionChart', { master: true, supervisor: true, analyst: false });
          if (!showFraudPreventionChart) return null;

          const fraudCounts: Record<string, number> = {
            "Terceiro se Passando": 0,
            "Cliente não Reconhece a Operação": 0,
            "Campo Foto": 0,
            "Fonte": 0,
            "Formatação": 0,
            "Sobreposição de Foto": 0,
            "Informações diferentes da Receita Federal": 0
          };

          if (Array.isArray(history)) {
            history.forEach(log => {
              if (log && log.decisao === 'REJECTED') {
                if (log.fraudSubMotive && log.fraudSubMotive in fraudCounts) {
                  fraudCounts[log.fraudSubMotive]++;
                } else if (log.motivo) {
                  const motiveText = log.motivo;
                  Object.keys(fraudCounts).forEach(subMotive => {
                    if (motiveText.includes(subMotive)) {
                      fraudCounts[subMotive]++;
                    }
                  });
                }
              }
            });
          }

          const chartData = Object.entries(fraudCounts).map(([subMotive, total]) => ({
            subMotive,
            total
          }));

          const totalFraudsEvitadas = Object.values(fraudCounts).reduce((a, b) => a + b, 0);

          return (
            <div className={`p-6 rounded-[2.5rem] border transition-all shadow-sm ${
              isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-dashed dark:border-slate-800 border-slate-150">
                <div className="flex items-center gap-3">
                  {renderDragHandle('fraudes-evitadas')}
                  <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><ShieldCheck size={18} /></div>
                  <div>
                    <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Indicadores de Fraudes Evitadas
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium font-bold uppercase tracking-tight mt-0.5">
                      Detalhamento técnico dos sub-motivos de irregularidade identificados
                    </p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isDarkMode ? 'bg-red-950/40 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-750 border border-red-100'
                }`}>
                  Total de Fraudes Evitadas: {totalFraudsEvitadas}
                </div>
              </div>

              {totalFraudsEvitadas === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold gap-2">
                  <ShieldCheck size={20} className="text-slate-400" />
                  Nenhuma suspeita de fraude registrada no histórico de logs.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart 
                      data={chartData} 
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} horizontal={false} vertical={true} />
                      <XAxis 
                        type="number"
                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                        stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        allowDecimals={false}
                      />
                      <YAxis 
                        type="category"
                        dataKey="subMotive" 
                        tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                        stroke={isDarkMode ? '#475569' : '#cbd5e1'}
                        width={215}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', 
                          borderColor: isDarkMode ? '#475569' : '#cbd5e1',
                          borderRadius: '12px',
                          fontSize: '11px',
                          color: isDarkMode ? '#ffffff' : '#1e293b',
                          fontWeight: 'bold'
                        }}
                      />
                      <Bar name="Fraudes Evitadas" dataKey="total" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={16} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        } catch (err: any) {
          console.error("Error rendering fraud prevention card:", err);
          return (
            <div className="p-6 rounded-[2.5rem] border border-red-500 bg-red-550/10 text-red-500">
              <h3 className="font-bold">Error rendering fraud prevention card</h3>
              <p className="text-xs">{err?.message || String(err)}</p>
              <pre className="text-[10px] mt-2 overflow-auto max-h-40">{err?.stack}</pre>
            </div>
          );
        }
      }

      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-700 max-w-screen-2xl mx-auto">
      <div className="header-riskflow">
        <h1 className="titulo-pagina">Painel Operacional</h1>
        <div className="contador-quantidade">TOTAL: {metrics.stats.total}</div>
      </div>

      <AnimatePresence>
        {newBases.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`p-6 rounded-[2rem] border relative overflow-hidden shadow-xl ${
              isDarkMode 
                ? 'bg-indigo-950/20 border-indigo-500/20 text-indigo-100 shadow-indigo-950/10' 
                : 'bg-indigo-50/50 border-indigo-200/60 text-indigo-950 shadow-indigo-100/20'
            }`}
          >
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-indigo-200/30 dark:border-indigo-500/10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>
                  <Bell className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                    Novas Propostas Importadas
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  </h2>
                  <p className="text-[11px] font-semibold opacity-85 mt-0.5">
                    Novos arquivos contendo propostas foram importados. Verifique as atualizações abaixo.
                  </p>
                </div>
              </div>
              <button 
                onClick={handleDismissAll}
                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  isDarkMode 
                    ? 'hover:bg-indigo-950/45 text-indigo-300 border-indigo-500/20' 
                    : 'hover:bg-indigo-100/30 text-indigo-750 border-indigo-200'
                }`}
              >
                Dispensar Todas
              </button>
            </div>

            <div className="mt-4 space-y-3.5 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {newBases.map((base) => (
                <motion.div
                  key={base.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all border ${
                    isDarkMode 
                      ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/60' 
                      : 'bg-white hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      🏦 {base.bankName || 'Banco'}
                    </span>
                    
                    <div className="space-y-0.5">
                      <div className={`text-xs font-bold leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {base.fileName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-1">
                        Importado por <span className="font-extrabold">{base.importedBy}</span> em {new Date(base.importedAt).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-auto">
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        +{base.newCount} novas propostas
                      </div>
                      {base.dupCount > 0 && (
                        <div className="text-[9px] font-bold text-slate-400 leading-none mt-0.5">
                          {base.dupCount} duplicadas ignoradas
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDismissBase(base.id)}
                      className={`p-2 rounded-xl transition-all ${
                        isDarkMode ? 'hover:bg-slate-800 text-slate-405 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                      }`}
                      title="Dispensar alerta"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {cardOrder.map(cardId => {
        const content = renderCard(cardId);
        if (!content) return null;
        return (
          <div
            key={cardId}
            draggable={draggableId === cardId}
            onDragStart={(e) => handleDragStart(e, cardId)}
            onDragOver={(e) => handleDragOver(e, cardId)}
            onDrop={(e) => handleDrop(e, cardId)}
            onDragEnd={() => setDraggableId(null)}
            className={`transition-all duration-300 ${draggableId === cardId ? 'opacity-40 scale-[0.99] border-blue-500/50' : ''}`}
          >
            {content}
          </div>
        );
      })}

      {/* 🛡️ Portal de Auditoria & Logs de Decisões */}
      {viewSupervisorResources && (
        <div id="quick_auditoria_logs_panel" className={`p-6 rounded-[2rem] border transition-all shadow-sm ${
          isDarkMode ? 'bg-[#0f172a]/60 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}><ShieldCheck size={18} /></div>
              <div>
                <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  Portal de Auditoria & Logs de Decisões
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Acompanhe e audite o histórico completo de decisões, validações e ações periciais executadas na mesa de risco.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-[10px] uppercase flex items-center justify-center gap-2 shadow-md transition-all ${
                isDarkMode 
                  ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/35 border border-blue-500/30' 
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-105 border border-blue-100'
              }`}
            >
              Abrir Auditoria Completa ➜
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const BarItem: React.FC<{ label: string, count: number, color: string, max: number }> = ({ label, count, color, max }) => {
  const height = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex-1 flex flex-col items-center gap-3">
       <div className="w-full flex flex-col justify-end h-full">
          <div className={`${color} rounded-t-2xl transition-all duration-1000 w-full flex items-center justify-center text-[11px] font-black text-white shadow-lg`} style={{ height: `${Math.max(height, 5)}%` }}>
            {count > 0 && count}
          </div>
       </div>
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    </div>
  );
};

const KpiMetric: React.FC<{ title: string; value: number; color: string; icon: React.ReactNode; isDarkMode?: boolean }> = ({ title, value, color, icon, isDarkMode }) => {
    const colors: Record<string, string> = {
        blue: isDarkMode ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' : 'text-blue-600 border-blue-100 bg-blue-50/10',
        emerald: isDarkMode ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-emerald-600 border-emerald-100 bg-emerald-50/10',
        orange: isDarkMode ? 'text-orange-400 border-orange-500/20 bg-orange-500/5' : 'text-orange-600 border-orange-100 bg-orange-50/10',
        red: isDarkMode ? 'text-red-400 border-red-500/20 bg-red-500/5' : 'text-red-600 border-red-100 bg-red-50/10'
    };

    return (
        <div className={`p-8 rounded-[2.5rem] border-2 shadow-sm transition-all hover:shadow-md hover:-translate-y-1 ${colors[color]}`}>
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-50'}`}>{icon}</div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                    <span className={`text-4xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</span>
                </div>
            </div>
            <div className={`flex items-center gap-2 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100/50'}`}>
                <ArrowUpRight size={14} className="opacity-50" />
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-tight">Cálculo de Produtividade Ativo</span>
            </div>
        </div>
    );
};

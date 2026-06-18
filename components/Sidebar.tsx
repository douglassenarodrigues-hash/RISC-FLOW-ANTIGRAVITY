import React, { useState } from "react";
import {
  Upload,
  Database,
  ClipboardCheck,
  ShieldCheck,
  Settings,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  BarChart3,
  History,
  Calendar,
  LogOut,
  PhoneCall,
  Snowflake,
  ChevronDown,
  Smartphone,
  CalendarDays,
  Moon,
  Sun,
  Menu,
} from "lucide-react";
import { Proposal, RiskStatus, UserAccount } from "../types";
import { TimeFilter } from "../App";

export type ViewType =
  | "import"
  | "analyze"
  | "auto_approved"
  | "contact"
  | "scheduled"
  | "approved"
  | "pending"
  | "rejected"
  | "settings"
  | "waiting_request"
  | "dashboard"
  | "history"
  | "master_partners"
  | "master_covenants"
  | "master_access"
  | "base_management";
export type SettingsTab = "partner" | "covenant" | "access" | "governance" | "";

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  hasData: boolean;
  proposals: Proposal[];
  timeFilter: TimeFilter;
  onTimeFilterChange: (filter: TimeFilter) => void;
  currentUser: UserAccount;
  onLogout: () => void;
  activeCpfAnalysis: string | null;
  onReleaseCpf: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  settingsTab,
  onSettingsTabChange,
  hasData,
  proposals,
  timeFilter,
  onTimeFilterChange,
  currentUser,
  onLogout,
  activeCpfAnalysis,
  onReleaseCpf,
  isDarkMode,
  onToggleDarkMode,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [isMasterExpanded, setIsMasterExpanded] = useState(false);
  const [isGovernanceExpanded, setIsGovernanceExpanded] = useState(
    currentView === "settings",
  );

  const getCount = (status: RiskStatus) => {
    const today = new Date().toISOString().split("T")[0];
    const thisMonth = today.substring(0, 7);

    return proposals.filter((p) => {
      const matchStatus = p.status === status;
      if (!matchStatus) return false;
      if (timeFilter === "all") return true;
      if (timeFilter === "today") return p.dataSistema === today;
      if (timeFilter === "month") return p.dataSistema?.startsWith(thisMonth);
      return p.dataSistema === timeFilter;
    }).length;
  };

  return (
    <aside
      className={`${isCollapsed ? "w-20" : "w-72"} flex flex-col shrink-0 overflow-y-auto border-r transition-all duration-300 text-left ${isDarkMode ? "bg-slate-900/80 border-slate-800 backdrop-blur-xl" : "bg-slate-900 border-slate-800"}`}
    >
      <div className={`p-6 ${isCollapsed ? "px-3" : "p-6"}`}>
        <div
          className={`flex ${isCollapsed ? "flex-col gap-3" : "flex-row justify-between"} items-center mb-8 w-full`}
        >
          <button
            onClick={onToggleCollapse}
            className={`p-2 rounded-lg transition-all ${isDarkMode ? "bg-slate-800 text-slate-300 hover:text-white" : "bg-slate-800 text-slate-300 hover:text-white"}`}
            title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            <Menu size={18} />
          </button>
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-lg transition-all ${isDarkMode ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-800 text-slate-400 hover:text-white"}`}
            title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        {/* Monitoramento */}
        <div className="mb-4">
          {!isCollapsed && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-2">
              Painel
            </p>
          )}
          <nav className="space-y-1">
            <NavItem
              icon={<BarChart3 size={18} />}
              label="Visão Geral"
              active={currentView === "dashboard"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("dashboard")}
            />
            {(currentUser?.role === "Master" ||
              currentUser?.permissions?.viewAuditGuideSidebar !== false) && (
              <NavItem
                icon={<History size={18} />}
                label="Histórico"
                active={currentView === "history"}
                disabled={!hasData}
                isCollapsed={isCollapsed}
                onClick={() => onViewChange("history")}
              />
            )}
          </nav>
        </div>

        {/* Gestão de Dados */}
        <div className="mb-4">
          {!isCollapsed && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-2">
              Importação
            </p>
          )}
          <nav className="space-y-1">
            <NavItem
              icon={<Upload size={18} />}
              label="Importar Arquivo"
              active={currentView === "import"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("import")}
            />
            <NavItem
              icon={<Database size={18} />}
              label="Bases Importadas"
              active={currentView === "base_management"}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("base_management")}
            />
          </nav>
        </div>

        {/* Esteiras de Risco */}
        <div className="mb-4">
          {!isCollapsed && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-2">
              Filas de Trabalho
            </p>
          )}
          <nav className="space-y-1">
            <NavItem
              icon={<Zap size={18} className="text-emerald-500" />}
              label="Aprovação Automática"
              active={currentView === "auto_approved"}
              disabled={!hasData}
              badge={getCount("AUTO_APPROVED")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("auto_approved")}
            />
            <NavItem
              icon={<ClipboardCheck size={18} />}
              label="Aguardando Análise"
              active={currentView === "analyze"}
              disabled={!hasData}
              badge={getCount("PENDING")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("analyze")}
            />
            <NavItem
              icon={<PhoneCall size={18} className="text-purple-400" />}
              label="Em Contato"
              active={currentView === "contact"}
              disabled={!hasData}
              badge={getCount("CONTACT")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("contact")}
            />
            <NavItem
              icon={<CalendarDays size={18} className="text-indigo-400" />}
              label="Agendados"
              active={currentView === "scheduled"}
              disabled={!hasData}
              badge={getCount("AGENDADO")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("scheduled")}
            />
            <NavItem
              icon={<Snowflake size={18} className="text-slate-400" />}
              label="Em Espera"
              active={currentView === "waiting_request"}
              disabled={!hasData}
              badge={getCount("WAITING_REQUEST")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("waiting_request")}
            />
            <NavItem
              icon={<CheckCircle size={18} />}
              label="Aprovados"
              active={currentView === "approved"}
              disabled={!hasData}
              badge={getCount("APPROVED")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("approved")}
            />
            <NavItem
              icon={<AlertTriangle size={18} />}
              label="Pendentes"
              active={currentView === "pending"}
              disabled={!hasData}
              badge={getCount("WAITING_DOCS")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("pending")}
            />
            <NavItem
              icon={<XCircle size={18} />}
              label="Reprovados"
              active={currentView === "rejected"}
              disabled={!hasData}
              badge={getCount("REJECTED")}
              isCollapsed={isCollapsed}
              onClick={() => onViewChange("rejected")}
            />
          </nav>
        </div>

        {/* Filtro Temporal com Calendário (Posicionado abaixo de Reprovados) - Habilita apenas quando expandido */}
        {!isCollapsed && (
          <div className="mb-6 px-4 py-4 bg-slate-850/40 dark:bg-slate-800/40 rounded-2xl border border-slate-800 dark:border-slate-700/50 mt-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Calendar size={12} /> Filtrar por Data
            </p>
            <div className="flex flex-col gap-1.5">
              <FilterButton
                active={timeFilter === "all"}
                label="Tudo"
                onClick={() => onTimeFilterChange("all")}
              />
              <FilterButton
                active={timeFilter === "today"}
                label="D0 (Hoje)"
                onClick={() => onTimeFilterChange("today")}
              />
              <FilterButton
                active={timeFilter === "month"}
                label="Mês Corrente"
                onClick={() => onTimeFilterChange("month")}
              />

              <div className="mt-2 pt-2 border-t border-slate-700/30">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Data Específica
                </label>
                <input
                  type="date"
                  value={
                    !["all", "today", "month"].includes(timeFilter)
                      ? timeFilter
                      : ""
                  }
                  onChange={(e) => {
                    const selected = e.target.value;
                    if (selected) {
                      onTimeFilterChange(selected);
                    } else {
                      onTimeFilterChange("all");
                    }
                  }}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    !["all", "today", "month"].includes(timeFilter)
                      ? "bg-blue-600 text-white border border-blue-500"
                      : "bg-slate-850 text-slate-300 border border-slate-700/70 hover:border-slate-600"
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        {currentUser.role === "Master" && (
          <div className="mt-4">
            <button
              onClick={() => {
                setIsGovernanceExpanded(!isGovernanceExpanded);
                if (currentView !== "settings") {
                  onViewChange("settings");
                }
              }}
              className={`w-full flex items-center justify-between transition-all duration-200 ${isCollapsed ? "px-2 py-2.5 justify-center" : "px-4 py-3 rounded-xl"} ${currentView === "settings" ? "bg-slate-800 text-white shadow-lg" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
              title="Configurações"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-blue-400" />
                {!isCollapsed && (
                  <span className="text-sm font-bold uppercase tracking-tight">
                    Configurações
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isGovernanceExpanded ? "" : "-rotate-90"}`}
                />
              )}
            </button>

            {isGovernanceExpanded && !isCollapsed && (
              <nav className="mt-2 space-y-1 px-2 animate-in slide-in-from-top-1 duration-200">
                <NavItem
                  icon={<span>🤝</span>}
                  label="Parceiros"
                  active={
                    currentView === "settings" && settingsTab === "partner"
                  }
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    onViewChange("settings");
                    onSettingsTabChange("partner");
                  }}
                />
                <NavItem
                  icon={<span>🏦</span>}
                  label="Convênios"
                  active={
                    currentView === "settings" && settingsTab === "covenant"
                  }
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    onViewChange("settings");
                    onSettingsTabChange("covenant");
                  }}
                />
                <NavItem
                  icon={<span>👤</span>}
                  label="Usuários"
                  active={
                    currentView === "settings" && settingsTab === "access"
                  }
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    onViewChange("settings");
                    onSettingsTabChange("access");
                  }}
                />
                <NavItem
                  icon={<span>⚖️</span>}
                  label="Regras de Risco"
                  active={
                    currentView === "settings" && settingsTab === "governance"
                  }
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    onViewChange("settings");
                    onSettingsTabChange("governance");
                  }}
                />
              </nav>
            )}
          </div>
        )}
      </div>

      <div
        className={`mt-auto space-y-4 bg-slate-900/50 border-t border-slate-800 ${isCollapsed ? "p-3" : "p-6"}`}
      >
        {activeCpfAnalysis && (
          <div
            className={`bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3 animate-in slide-in-from-bottom-2 ${isCollapsed ? "p-2 text-center" : "p-4"}`}
          >
            <div className="flex items-center gap-2 justify-center text-blue-400">
              <ShieldCheck size={16} />
              {!isCollapsed && (
                <span className="text-[10px] font-black uppercase tracking-widest">
                  CPF em Análise
                </span>
              )}
            </div>
            {!isCollapsed && (
              <p className="text-xs font-bold text-white">
                CPF: {activeCpfAnalysis}
              </p>
            )}
            <button
              onClick={onReleaseCpf}
              className={`w-full bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 font-black uppercase ${isCollapsed ? "py-1 text-[8px] tracking-tight" : "py-2 text-[10px] tracking-widest hover:bg-blue-600"}`}
              title="Liberar Cliente"
            >
              {isCollapsed ? "Liberar" : "Liberar Cliente"}
            </button>
          </div>
        )}
        <button
          onClick={onLogout}
          className={`w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isCollapsed ? "p-2 justify-center" : "py-3"}`}
          title="Sair"
        >
          <LogOut size={16} /> {!isCollapsed && "Sair"}
        </button>
      </div>
    </aside>
  );
};

const FilterButton: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      active
        ? "bg-slate-100 text-slate-900 shadow-sm"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`}
  >
    {label}
  </button>
);

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: number;
  isCollapsed?: boolean;
}> = ({ icon, label, active, onClick, disabled, badge, isCollapsed }) => (
  <button
    disabled={disabled}
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={`w-full flex items-center justify-between rounded-xl transition-all duration-200 ${
      isCollapsed ? "px-2 py-2.5 justify-center" : "px-4 py-2.5"
    } ${
      active
        ? "bg-slate-100 text-slate-900 shadow-sm font-bold"
        : disabled
          ? "opacity-30 cursor-not-allowed text-slate-500"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`}
  >
    <div className="flex items-center gap-3 relative">
      <div className="flex items-center justify-center shrink-0 w-6 h-6">
        {icon}
      </div>
      {!isCollapsed && (
        <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
          {label}
        </span>
      )}
      {isCollapsed && badge !== undefined && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white border border-slate-900 shadow-sm">
          {badge}
        </span>
      )}
    </div>
    {!isCollapsed && badge !== undefined && badge > 0 && (
      <span
        className={`text-[10px] font-black px-2 py-0.5 rounded-lg min-w-[24px] text-center ${active ? "bg-slate-900 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"}`}
      >
        {badge}
      </span>
    )}
  </button>
);

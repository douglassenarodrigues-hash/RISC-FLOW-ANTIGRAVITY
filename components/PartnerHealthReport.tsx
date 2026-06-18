import React from 'react';
import { 
  Download, 
  ChevronLeft, 
  HeartPulse, 
  FileText, 
  BarChart3, 
  Activity,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { Proposal, DecisionEntry, PartnerRule } from '../types';
import { calcularSaudeParceiro, REGRAS_SCORE } from '../src/services/governanceService';

interface PartnerHealthReportProps {
  partnerCode: string;
  partnerRule: PartnerRule;
  proposals: Proposal[];
  history: DecisionEntry[];
  onBack: () => void;
  isDarkMode: boolean;
}

export const PartnerHealthReport: React.FC<PartnerHealthReportProps> = ({
  partnerCode,
  partnerRule,
  proposals,
  history,
  onBack,
  isDarkMode
}) => {
  const partnerProposals = proposals.filter(p => p.corretor === partnerCode);
  const partnerAdes = new Set(partnerProposals.map(p => p.ade));
  const partnerHistory = history.filter(h => partnerAdes.has(h.ade));
  
  const abbreviateName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 2) return name;
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const middleNames = parts.slice(1, -1).map(p => `${p[0]}.`).join(' ');
    return `${firstName} ${middleNames} ${lastName}`;
  };

  const motivos = partnerHistory.filter(h => h.motivo).map(h => h.motivo);
  const health = calcularSaudeParceiro(motivos);

  const exportToCSV = () => {
    const headers = ['Data', 'ADE', 'Cliente', 'Banco', 'Decisão', 'Parecer', 'Analista'];
    const rows = partnerHistory.map(h => [
      h.timestamp,
      h.ade,
      h.cliente,
      h.banco,
      h.decisao,
      h.motivo,
      h.analista
    ]);

    const csvContent = [
      ['RELATÓRIO DE SAÚDE DO PARCEIRO'],
      [`PARCEIRO: ${partnerRule.name || partnerCode}`],
      [`PONTUAÇÃO ATUAL: ${health.score} PTS`],
      [`DATA DE EXTRAÇÃO: ${new Date().toLocaleString()}`],
      [],
      headers,
      ...rows
    ].map(e => e.join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Saude_${partnerCode}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* HEADER COMP exportacao */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 w-full max-w-[1300px] mx-auto mb-8">
        <div className="space-y-2">
          <button 
            onClick={onBack}
            className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4 transition-all hover:translate-x-[-4px] ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <ChevronLeft size={14} /> Voltar para Configurações
          </button>
          <h1 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Saúde do Correspondente (Corban)
          </h1>
          <div className="flex items-center gap-2">
            <div className="h-1 w-12 bg-blue-500 rounded-full"></div>
            <span className="text-blue-400 font-black text-sm uppercase tracking-widest">
              Correspondente (Corban): {partnerRule.name || partnerCode} ({partnerCode})
            </span>
          </div>
        </div>
        
        <button 
          onClick={exportToCSV}
          className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
            isDarkMode 
              ? 'bg-slate-100 text-slate-900 hover:bg-blue-400 hover:text-white' 
              : 'bg-slate-900 text-white hover:bg-blue-600'
          }`}
        >
          <Download size={18} /> Extrair Relatório
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1300px] mx-auto">
        {/* SCORE CARD */}
        <div className={`p-8 rounded-[2.5rem] border flex flex-col items-center justify-center text-center space-y-4 shadow-2xl relative overflow-hidden ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100'}`}>
          {isDarkMode && <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>}
          <div className={`p-4 rounded-3xl ${health.score >= 80 ? 'bg-emerald-500/10 text-emerald-500' : health.score >= 50 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
            <HeartPulse size={48} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pontuação de Saúde</p>
            <h2 className={`text-7xl font-black tracking-tighter ${health.score >= 80 ? 'text-emerald-500' : health.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
              {health.score}<span className="text-2xl ml-1 opacity-50">pts</span>
            </h2>
          </div>
          <div className="flex gap-2">
            {health.bloqueioAtivo ? (
              <span className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse">🔴 RESTRITO</span>
            ) : (
              <span className="bg-emerald-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">🟢 ATIVO</span>
            )}
            {health.analiseTotal && !health.bloqueioAtivo && (
              <span className="bg-orange-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">Análise 100%</span>
            )}
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-8 rounded-[2rem] border space-y-4 ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><Activity size={20} /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume de Propostas</p>
            </div>
            <p className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{partnerProposals.length}</p>
            <p className="text-[10px] font-bold opacity-60">Total de propostas registradas.</p>
          </div>

          <div className={`p-8 rounded-[2rem] border space-y-4 ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl"><BarChart3 size={20} /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apontamentos</p>
            </div>
            <p className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{motivos.length}</p>
            <p className="text-[10px] font-bold opacity-60">Decisões que afetam a pontuação.</p>
          </div>

          <div className={`p-8 rounded-[2rem] border space-y-4 ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl"><ShieldCheck size={20} /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Atual</p>
            </div>
            <p className={`text-2xl font-black uppercase ${partnerRule.status === 'ACTING' ? 'text-emerald-500' : partnerRule.status === 'NON_ACTING' ? 'text-red-500' : 'text-orange-500'}`}>
              {partnerRule.status === 'ACTING' ? 'Fast-Track' : partnerRule.status === 'NON_ACTING' ? 'Stand-by' : 'Análise 100%'}
            </p>
            <p className="text-[10px] font-bold opacity-60">Configuração vigente na régua técnica.</p>
          </div>

          <div className={`p-8 rounded-[2rem] border space-y-4 ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl"><AlertCircle size={20} /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Classificação</p>
            </div>
            <p className={`text-2xl font-black uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{partnerRule.classification || 'Padrão'}</p>
            <p className="text-[10px] font-bold opacity-60">Nível de confiança comercial.</p>
          </div>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className={`max-w-[1300px] mx-auto border rounded-[2.5rem] overflow-hidden shadow-2xl ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-blue-500" />
            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Histórico de Decisões Técnicas</h3>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{partnerHistory.length} Registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead>
              <tr className={`font-black text-slate-500 uppercase tracking-tight border-b ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <th className="px-8 py-4">Data/Hora</th>
                <th className="px-6 py-4">ADE</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Decisão</th>
                <th className="px-6 py-4">Apontamento</th>
                <th className="px-8 py-4">Impacto</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {partnerHistory.map(h => {
                const regra = REGRAS_SCORE[h.motivo || ''] || { pontos: 0 };
                return (
                  <tr key={h.id} className={`transition-all ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-8 py-4 font-mono text-[10px] opacity-60">{h.timestamp}</td>
                    <td className={`px-6 py-4 font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{h.ade}</td>
                    <td className="px-6 py-4 font-bold">{abbreviateName(h.cliente)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                        h.decisao === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
                        h.decisao === 'REJECTED' ? 'bg-red-500/10 text-red-500' :
                        'bg-slate-500/10 text-slate-500'
                      }`}>
                        {h.decisao}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium italic opacity-80">{h.motivo || '---'}</td>
                    <td className="px-8 py-4">
                      {regra.pontos !== 0 && (
                        <span className={`font-black ${regra.pontos > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {regra.pontos > 0 ? `+${regra.pontos}` : regra.pontos}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {partnerHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center opacity-40 italic font-bold">
                    Nenhum histórico de decisão técnica encontrado para este correspondente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

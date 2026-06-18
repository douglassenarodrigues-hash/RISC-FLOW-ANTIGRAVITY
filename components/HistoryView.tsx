import React, { useState, useMemo } from 'react';
import { DecisionEntry, RiskStatus } from '../types';
import { History, Search, Clock, FileText, CheckCircle2, XCircle, HelpCircle, PhoneCall, Zap, Snowflake, Download, Filter } from 'lucide-react';

interface HistoryViewProps {
  history: DecisionEntry[];
  isDarkMode?: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, isDarkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [selectedBancos, setSelectedBancos] = useState<string[]>([]);

  const availableBanks = useMemo(() => {
    return Array.from(new Set(history.map(h => h.banco))).sort();
  }, [history]);

  const filteredHistory = history.filter(entry => {
    const matchesSearch = entry.ade.includes(searchTerm) || 
      entry.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.analista.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'ALL' || 
      (filterAction === 'IMPORT' && entry.motivo.includes('IMPORTAÇÃO')) ||
      (filterAction === 'TRIAGEM' && entry.motivo.includes('TRIAGEM')) ||
      (filterAction === 'MANUAL' && !entry.motivo.includes('IMPORTAÇÃO') && !entry.motivo.includes('TRIAGEM'));

    const matchesBank = selectedBancos.length === 0 || selectedBancos.includes(entry.banco);

    return matchesSearch && matchesAction && matchesBank;
  });

  const toggleBankFilter = (bank: string) => {
    setSelectedBancos(prev => 
      prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]
    );
  };

  const exportProductivityCSV = () => {
    if (filteredHistory.length === 0) return;
    
    // Cabeçalhos otimizados para Excel Brasileiro (ponto e vírgula)
    const headers = ['Data/Hora', 'ADE', 'Cliente', 'Banco', 'Responsável', 'Decisão', 'Parecer'];
    const rows = filteredHistory.map(entry => [
      entry.timestamp,
      entry.ade,
      entry.cliente,
      entry.banco,
      entry.analista,
      entry.decisao,
      `"${entry.motivo.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    // Inclusão do BOM para o Excel Windows reconhecer UTF-8
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '_');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `produtividade_riskflow_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusIcon = (status: RiskStatus) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle2 size={14} className="text-emerald-500" />;
      case 'REJECTED': return <XCircle size={14} className="text-red-500" />;
      case 'WAITING_DOCS': return <HelpCircle size={14} className="text-orange-500" />;
      case 'CONTACT': return <PhoneCall size={14} className="text-blue-500" />;
      case 'AUTO_APPROVED': return <Zap size={14} className="text-emerald-500" />;
      case 'WAITING_REQUEST': return <Snowflake size={14} className="text-slate-400" />;
      default: return <Clock size={14} className="text-slate-400" />;
    }
  };

  const getStatusLabel = (status: RiskStatus) => {
    switch (status) {
      case 'APPROVED': return 'Aprovado';
      case 'REJECTED': return 'Reprovado';
      case 'WAITING_DOCS': return 'Pendência';
      case 'CONTACT': return 'Mesa de Contato';
      case 'AUTO_APPROVED': return 'Fast-Track';
      case 'WAITING_REQUEST': return 'Stand-by';
      case 'PENDING': return 'Fila (Em Análise)';
      case 'AGENDADO': return 'Agendado';
      default: return status;
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="header-riskflow">
        <h1 className="titulo-pagina">Histórico & Auditoria</h1>
        <div className="contador-quantidade">QUANTIDADE: {filteredHistory.length}</div>
      </div>

      {/* Painel de Filtros Superiores */}
      <div className={`rounded-[2rem] border p-8 shadow-sm space-y-6 ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Filter size={18} className="text-blue-600" />
            <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Filtros de Gestão</h3>
          </div>
          <button 
              onClick={() => setSelectedBancos([])}
              className="text-[10px] font-black text-blue-600 hover:underline uppercase"
          >
              Limpar Todos
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
           {availableBanks.map(bank => (
             <button 
               key={bank}
               onClick={() => toggleBankFilter(bank)}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${selectedBancos.includes(bank) ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
             >
               {bank}
             </button>
           ))}
           {availableBanks.length === 0 && <span className="text-[10px] text-slate-400 font-bold italic">Aguardando dados...</span>}
        </div>
      </div>

      <div className={`rounded-3xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`p-6 border-b flex flex-col xl:flex-row xl:items-center justify-between gap-6 ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl text-white shadow-lg ${isDarkMode ? 'bg-blue-600' : 'bg-slate-900'}`}><History size={20} /></div>
            <div>
              <h3 className={`font-black tracking-tight uppercase text-xs ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Auditoria & Logs V18</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Rastreabilidade Master com Exportação Consolidada.</p>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-4 flex-1 xl:justify-end">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Pesquisar Log..."
                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-xs font-bold outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-700 text-white focus:ring-blue-500' : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-900'}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
               <div className={`border rounded-xl flex items-center px-3 py-2 gap-2 shadow-sm ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                  <Filter size={14} className="text-slate-400" />
                  <select 
                    className={`text-[10px] font-black uppercase outline-none bg-transparent cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                  >
                     <option value="ALL">Todas as Ações</option>
                     <option value="IMPORT">Importações</option>
                     <option value="TRIAGEM">Automático</option>
                     <option value="MANUAL">Analista</option>
                  </select>
               </div>
               
               <button 
                  onClick={exportProductivityCSV}
                  disabled={filteredHistory.length === 0}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-30 disabled:grayscale ${isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'}`}
               >
                  <Download size={14} /> 📦 Exportar para Excel
               </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className={`text-[10px] font-black text-slate-400 uppercase tracking-widest border-b ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50'}`}>
                <th className="px-6 py-4 text-center">Data/Hora</th>
                <th className="px-6 py-4 text-center">ADE</th>
                <th className="px-6 py-4 text-center">Banco</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Analista</th>
                <th className="px-6 py-4 text-center">Parecer</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {filteredHistory.length > 0 ? filteredHistory.map((entry) => (
                <tr key={entry.id} className={`transition-colors group ${isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-6 py-5 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
                      <Clock size={12} />
                      {entry.timestamp}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`font-mono font-black text-xs ${isDarkMode ? 'text-blue-400' : 'text-slate-900'}`}>{entry.ade}</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                     <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{entry.banco}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`flex items-center justify-center gap-2 px-2 py-1 border rounded-lg shadow-sm w-fit mx-auto ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                      {getStatusIcon(entry.decisao)}
                      <span className={`text-[9px] font-black uppercase tracking-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{getStatusLabel(entry.decisao)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-black text-white ${entry.analista.includes('Motor') || entry.analista === 'Sistema' ? 'bg-slate-700' : isDarkMode ? 'bg-blue-600' : 'bg-slate-900'}`}>
                        {entry.analista.charAt(0)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{entry.analista}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <p className={`text-[11px] font-medium max-w-sm italic leading-relaxed mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} title={entry.motivo}>
                      "{entry.motivo}"
                    </p>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-10">
                      <FileText size={64} />
                      <p className="text-xs font-black uppercase tracking-widest">Nenhum registro localizado</p>
                    </div>
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

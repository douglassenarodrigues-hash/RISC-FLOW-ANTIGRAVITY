import React from 'react';
import { AgendaEntry, UserAccount } from '../types';
import { 
  Calendar, 
  Clock, 
  Phone, 
  Trash2, 
  CheckCircle,
  FileText,
  User,
  Info
} from 'lucide-react';

interface AgendaViewProps {
  agenda: AgendaEntry[];
  onUpdateAgenda: (agenda: AgendaEntry[]) => void;
  addToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  currentUser: UserAccount;
  isDarkMode: boolean;
  onAtenderAgenda: (ade: string) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ agenda, onUpdateAgenda, addToast, currentUser, isDarkMode, onAtenderAgenda }) => {
  const handleClearCompleted = () => {
    const activeOnly = agenda.filter(item => item.status === 'Pendente');
    onUpdateAgenda(activeOnly);
    addToast("Agenda atualizada: removidos registros processados.", "info");
  };

  const toggleStatus = (id: string) => {
    const updated = agenda.map(item => 
      item.id === id 
      ? { ...item, status: (item.status === 'Pendente' ? 'Concluído' : 'Pendente') as any } 
      : item
    );
    onUpdateAgenda(updated);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-screen-xl mx-auto">
      <div className="header-riskflow">
        <h1 className="titulo-pagina">Contatos Agendados</h1>
        <div className="contador-quantidade">QUANTIDADE: {agenda.length}</div>
      </div>

      <div className="space-y-6">
         <div className={`rounded-3xl border shadow-sm overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
               <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl text-white ${isDarkMode ? 'bg-blue-600' : 'bg-slate-900'}`}><Calendar size={20} /></div>
                  <h3 className={`font-black uppercase text-xs tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Próximos Contatos</h3>
               </div>
               {agenda.some(i => i.status === 'Concluído') && (
                 <button 
                   onClick={handleClearCompleted}
                   className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors flex items-center gap-2"
                 >
                   <Trash2 size={14} /> Limpar Concluídos
                 </button>
               )}
            </div>

            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className={`text-[10px] font-black text-slate-400 uppercase tracking-widest border-b ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <th className="px-6 py-4 text-center">ADE</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">Data / Hora</th>
                        <th className="px-6 py-4 text-center">Contato</th>
                        <th className="px-6 py-4 text-center">Analista</th>
                        <th className="px-6 py-4 text-center">Motivo</th>
                        <th className="px-6 py-4 text-center">Ação</th>
                     </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                     {agenda.length > 0 ? agenda.map((item) => (
                       <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${item.status === 'Concluído' ? (isDarkMode ? 'bg-slate-800/50 opacity-40 grayscale' : 'bg-slate-50 opacity-40 grayscale') : ''}`}>
                          <td className="px-6 py-5 text-center">
                             <span className={`font-mono font-black text-xs ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.ade}</span>
                          </td>
                          <td className="px-6 py-5">
                             <div className={`flex items-center justify-center gap-1.5 text-[10px] font-black uppercase ${item.status === 'Pendente' ? 'text-orange-600' : 'text-emerald-600'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Pendente' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                                {item.status}
                             </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex flex-col items-center justify-center gap-0.5">
                                <div className={`flex items-center gap-1.5 text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                                   <Calendar size={12} className="text-slate-400" /> {item.data}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                   <Clock size={12} className="text-slate-400" /> {item.hora}
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className={`flex items-center justify-center gap-1.5 text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                <Phone size={14} className="text-blue-500" />
                                {item.contato}
                             </div>
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                <User size={12} /> {item.analista}
                              </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <p className={`text-xs font-medium max-w-xs truncate mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} title={item.motivo}>{item.motivo}</p>
                          </td>
                          <td className="px-6 py-5 text-center">
                             <div className="flex items-center justify-center gap-2">
                               {item.status === 'Pendente' && (
                                 <button
                                   onClick={() => onAtenderAgenda(item.ade)}
                                   className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[11px] font-black uppercase tracking-widest shadow-sm ${
                                     isDarkMode 
                                       ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500/30' 
                                       : 'bg-slate-900 hover:bg-black text-white border-slate-900/30'
                                   }`}
                                   title="Assumir operação e abrir na esteira de análise"
                                 >
                                    <Phone size={12} className="animate-pulse" />
                                    Atender
                                 </button>
                               )}
                               <button 
                                 onClick={() => toggleStatus(item.id)}
                                 className={`p-1.5 rounded-lg border transition-all ${item.status === 'Pendente' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'} ${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : ''}`}
                                 title={item.status === 'Pendente' ? 'Marcar como concluído' : 'Reabrir agendamento'}
                               >
                                  <CheckCircle size={16} />
                               </button>
                             </div>
                          </td>
                       </tr>
                     )) : (
                       <tr>
                          <td colSpan={7} className="py-24 text-center">
                             <div className="flex flex-col items-center gap-4 opacity-10">
                                <FileText size={64} className={isDarkMode ? 'text-white' : ''} />
                                <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : ''}`}>Nenhum retorno agendado</p>
                             </div>
                          </td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {agenda.length === 0 && (
           <div className={`border rounded-2xl p-5 flex items-center gap-4 animate-in slide-in-from-left-4 ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
              <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Info size={24} /></div>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>A agenda está vazia. Os agendamentos de retorno podem ser configurados diretamente na avaliação de cada proposta.</p>
           </div>
         )}
      </div>
    </div>
  );
};

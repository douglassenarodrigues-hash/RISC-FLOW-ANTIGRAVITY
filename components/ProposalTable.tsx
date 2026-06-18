import React from 'react';
import { Proposal, UserPermissions, UserAccount } from '../types';
import { ChevronRight, Clock, Calendar, EyeOff, CalendarPlus, Zap, AlertCircle, Lock, Unlock, UserCheck } from 'lucide-react';
import { translateStatus } from '../utils';

interface ProposalTableProps {
  proposals: Proposal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onQuickSchedule?: (proposal: Proposal) => void;
  onTakeOver?: (id: string) => void;
  permissions: UserPermissions;
  currentUser: UserAccount;
}

export const ProposalTable: React.FC<ProposalTableProps> = ({ proposals, selectedId, onSelect, onQuickSchedule, onTakeOver, permissions, currentUser }) => {
  const maskCpf = (cpf: string) => {
    if (permissions.viewFullCpf) return cpf;
    return `${cpf.substring(0, 3)}.***.***-${cpf.substring(cpf.length - 2)}`;
  };

  const formatMinsToTime = (totalMins: number) => {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getSlaInfo = (p: Proposal) => {
    const now = new Date();
    const [year, month, day] = p.dataSistema.split('-').map(Number);
    const entryDate = new Date(year, month - 1, day, 8, 0, 0);
    const diffMs = now.getTime() - entryDate.getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));

    if (diffMins < 30) return { label: "🟢 No Prazo", color: "text-emerald-500", mins: diffMins };
    if (diffMins < 60) return { label: "🟡 Alerta", color: "text-orange-500", mins: diffMins };
    return { label: "🔴 SLA Estourado", color: "text-red-500", mins: diffMins };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1800px]">
        <thead>
          <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <th className="px-4 py-4 whitespace-nowrap text-center">RESPONSÁVEL</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">IMPORTADO POR</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">ADE</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">SLA</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">TEMPO DE ESPERA (HH:MM)</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">STATUS</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">BANCO</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">CONVÊNIO</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">PRODUTO</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">VALOR</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">CPF</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">CLIENTE</th>
            <th className="px-4 py-4 whitespace-nowrap text-center">AÇÕES</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((p) => {
            const sla = getSlaInfo(p);
            return (
              <tr 
                key={p.id}
                className={`group cursor-pointer transition-all hover:bg-blue-50/30 ${selectedId === p.id ? 'bg-blue-50' : 'bg-white'}`}
              >
                <td className="px-4 py-4">
                  <div className="flex justify-center">
                    {p.lockedBy ? (
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${p.lockedBy === currentUser.username ? 'bg-blue-600 text-white border-blue-700' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                        <Lock size={10} />
                        {p.lockedBy === currentUser.username ? 'COM VOCÊ' : p.lockedBy}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase border bg-emerald-50 text-emerald-600 border-emerald-100">
                        <Unlock size={10} />
                        DISPONÍVEL
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                    <UserCheck size={12} className="text-slate-400" />
                    {p.importedBy || 'SISTEMA'}
                  </div>
                </td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-mono font-black text-slate-900 text-center">
                  <div className="flex items-center justify-center gap-2">
                      {p.ade}
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 text-center">
                  <span className={`text-[10px] font-black uppercase ${sla.color}`}>{sla.label}</span>
                </td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-mono text-[11px] font-black text-slate-400 text-center">
                  {formatMinsToTime(sla.mins)}
                </td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight border ${
                      p.status === 'PENDING' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      p.status === 'APPROVED' || p.status === 'AUTO_APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      p.status === 'AGENDADO' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      p.status === 'WAITING_DOCS' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      p.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {translateStatus(p.status)}
                  </span>
                </td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-bold text-slate-600 uppercase text-[11px] text-center">{p.banco}</td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-bold text-slate-600 uppercase text-[11px] text-center">{p.convenio}</td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-bold text-slate-600 uppercase text-[11px] text-center">{p.produto}</td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-mono font-black text-slate-900 text-[11px] text-center">
                  {p.valorFinanciado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-mono text-slate-500 text-[11px] text-center">{maskCpf(p.cpf)}</td>
                <td onClick={() => onSelect(p.id)} className="px-4 py-4 font-black text-slate-900 truncate max-w-[200px] uppercase text-[11px] text-center">{p.nomeCliente}</td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                      {!p.lockedBy && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onTakeOver?.(p.id); }}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-1.5"
                          title="Analisar"
                        >
                          <Zap size={12} /> Assumir
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); onQuickSchedule?.(p); }}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                        title="Agendar Retorno"
                      >
                        <CalendarPlus size={18} />
                      </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

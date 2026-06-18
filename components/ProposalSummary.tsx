import React from 'react';
import { Proposal, UserPermissions } from '../types';
import { User, Landmark, FileText, CreditCard, Calendar, Clock } from 'lucide-react';

interface ProposalSummaryProps {
  proposal: Proposal;
  permissions: UserPermissions;
}

export const ProposalSummary: React.FC<ProposalSummaryProps> = ({ proposal, permissions }) => {
  const maskCpf = (cpf: string) => {
    if (permissions.viewFullCpf) return cpf;
    return `${cpf.substring(0, 3)}.***.***-${cpf.substring(cpf.length - 2)}`;
  };

  const maskValue = (val: number) => {
    if (permissions.viewValues) return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    return 'R$ ••••••';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
            <p className="text-sm font-black text-slate-900 uppercase truncate">{proposal.nomeCliente}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Landmark size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Banco</p>
            <p className="text-sm font-black text-slate-900 uppercase">{proposal.banco}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</p>
            <p className="text-sm font-black text-slate-900">{maskValue(proposal.valorFinanciado)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ADE</p>
            <p className="text-sm font-black text-slate-900 font-mono">{proposal.ade}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</p>
            <p className="text-sm font-black text-slate-900">{proposal.dataSistema}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SLA</p>
            <p className="text-sm font-black text-slate-900 uppercase">{proposal.sla}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

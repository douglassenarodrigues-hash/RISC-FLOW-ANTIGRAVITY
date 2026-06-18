import React, { useState, useEffect } from 'react';
import { RiskStatus, Checklist, Proposal } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Send, 
  Clock, 
  Zap, 
  Edit3, 
  Search,
  ShieldCheck,
  AlertOctagon,
  ClipboardList,
  AlertCircle
} from 'lucide-react';

interface DecisionPanelProps {
  proposalId: string;
  status: RiskStatus;
  onStatusChange: (id: string, status: RiskStatus, motivo: string) => void;
  proposal?: Proposal;
}

type DecisionAction = 'KEEP' | 'APPROVE' | 'PENDING' | 'REJECT' | 'CONTACT';

const TEMPLATE_APROVACAO = "CONFERÊNCIA CONCLUÍDA - Dados pessoais, bancários e valores validados com o cliente por telefone: ( ) _____-____.";
const TEMPLATE_REPROVACAO = "PROPOSTA REPROVADA - MOTIVO: ";

const DICIONARIO_PENDENCIAS: Record<string, string[]> = {
  "CONTATO INSATISFATÓRIO": [
    "PENDÊNCIA: CONTATO INSATISFATÓRIO - Informe telefone válido do cliente.",
    "PENDÊNCIA: CONTATO INSATISFATÓRIO - Informe melhor horário e telefone válido do cliente.",
    "PENDÊNCIA: CLIENTE NÃO RECONHECE - Confirme a proposta, o cliente diz que não contratou.",
    "PENDÊNCIA: DÚVIDA - Entre em contato com o cliente para tirar dúvidas sobre a proposta.",
    "PENDÊNCIA: DESISTÊNCIA - O cliente informou que desistiu da contratação.",
    "PENDÊNCIA: TELEFONE INDISPONÍVEL - Telefone cadastrado não atende ou não existe."
  ],
  "AUSÊNCIA DE DOCUMENTAÇÃO": [
    "PENDÊNCIA: DOCUMENTO DO CLIENTE - Envie foto legível do documento (RG ou CNH) frente e verso.",
    "PENDÊNCIA: EXTRATO DE EMPRÉSTIMOS - Envie o extrato de empréstimos atualizado (e.g. Meu INSS, SouGov, etc.)."
  ],
  "DOCUMENTAÇÃO ILEGÍVEL/INCOMPLETA": [
    "PENDÊNCIA: FOTO ILEGÍVEL - Envie foto nítida e legível do documento (RG ou CNH).",
    "PENDÊNCIA: CONTRATO INCOMPLETO - Envie o contrato completo com todas as assinaturas."
  ],
  "DADOS BANCÁRIOS/CADASTRAIS": [
    "PENDÊNCIA: DADOS BANCÁRIOS - Envie comprovante de dados bancários (extrato recente ou cartão da conta) em nome do cliente.",
    "PENDÊNCIA: DIVERGÊNCIA DE DADOS - Os dados informados estão diferentes do documento enviado."
  ]
};

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ proposalId, status, onStatusChange, proposal }) => {
  const [checklist, setChecklist] = useState<Checklist>({
    docsLegible: false,
    dataMatches: false,
    selfieValidated: false,
    marginReserved: false,
  });
  
  const [notes, setNotes] = useState('');
  const [decisionAction, setDecisionAction] = useState<DecisionAction>('KEEP');
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedPhrase, setSelectedPhrase] = useState<string>("");

  const isFastTrack = () => {
    const statusFast = ["Aguardando liberação", "Aprovado", "APROVA PROMOTORA", "CONCLUÍDO"];
    const original = (proposal?.originalStatus || '').trim();
    return status === 'AUTO_APPROVED' || statusFast.includes(original);
  };

  const fastTrackActive = isFastTrack();

  useEffect(() => {
    if (decisionAction === 'APPROVE') {
      setNotes(TEMPLATE_APROVACAO);
      setSelectedCategory("");
      setSelectedPhrase("");
    } else if (decisionAction === 'REJECT') {
      setNotes(TEMPLATE_REPROVACAO);
      setSelectedCategory("");
      setSelectedPhrase("");
    } else if (decisionAction === 'KEEP') {
      setNotes("");
      setSelectedCategory("");
      setSelectedPhrase("");
    } else if (decisionAction === 'PENDING') {
      setNotes("PENDÊNCIA: [Descreva o motivo aqui]");
    } else if (decisionAction === 'CONTACT') {
      setNotes("MESA DE CONTATO: Direcionado para contato por telefone e conferência.");
    }
  }, [decisionAction]);

  useEffect(() => {
    if (selectedPhrase) {
      setNotes(selectedPhrase);
    }
  }, [selectedPhrase]);

  const checklistOk = fastTrackActive || (
    checklist.docsLegible && 
    checklist.dataMatches && 
    checklist.selfieValidated && 
    checklist.marginReserved
  );

  const canExecute = () => {
    if (decisionAction === 'KEEP') return false;
    if (notes.trim().length < 10) return false;
    if (decisionAction === 'APPROVE' && !checklistOk) return false;
    return true;
  };

  const handleActionExecution = () => {
    if (!canExecute()) return;
    
    let finalStatus: RiskStatus = 'PENDING';
    if (decisionAction === 'APPROVE') finalStatus = 'APPROVED';
    if (decisionAction === 'REJECT') finalStatus = 'REJECTED';
    if (decisionAction === 'PENDING') finalStatus = 'WAITING_DOCS';
    if (decisionAction === 'CONTACT') finalStatus = 'CONTACT';

    onStatusChange(proposalId, finalStatus, notes);
    
    // Reset local state after confirm
    setDecisionAction('KEEP');
    setNotes("");
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="bg-white rounded-3xl shadow-sm border p-8">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                <ShieldCheck size={22} className="text-blue-600" />
                🏁 Decisão da Análise
            </h3>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <Clock size={12} />
                REGRAS DE ANÁLISE
            </div>
        </div>

        {/* DECISION SELECTOR - RADIOS STYLE */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <ActionButton 
                active={decisionAction === 'KEEP'} 
                onClick={() => setDecisionAction('KEEP')} 
                label="Manter em Análise" 
                icon={<Search size={16} />}
                color="slate"
            />
            <ActionButton 
                active={decisionAction === 'CONTACT'} 
                onClick={() => setDecisionAction('CONTACT')} 
                label="Enviar para Contato" 
                icon={<ClipboardList size={16} />}
                color="purple"
            />
            <ActionButton 
                active={decisionAction === 'APPROVE'} 
                onClick={() => setDecisionAction('APPROVE')} 
                label="Aprovar" 
                icon={<CheckCircle2 size={16} />}
                color="blue"
            />
            <ActionButton 
                active={decisionAction === 'PENDING'} 
                onClick={() => setDecisionAction('PENDING')} 
                label="Marcar Pendência" 
                icon={<HelpCircle size={16} />}
                color="orange"
            />
            <ActionButton 
                active={decisionAction === 'REJECT'} 
                onClick={() => setDecisionAction('REJECT')} 
                label="Reprovar" 
                icon={<XCircle size={16} />}
                color="red"
            />
        </div>

        <div className="space-y-8 animate-in fade-in duration-300">
            {decisionAction === 'CONTACT' && (
                <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-purple-600 text-white rounded-lg shadow-lg"><ClipboardList size={16} /></div>
                    <p className="text-xs font-bold text-purple-700">📞 <b>Contato:</b> Entrar em contato com o cliente para verificação.</p>
                </div>
            )}

            {decisionAction === 'APPROVE' && (
                <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-lg shadow-lg"><Zap size={16} /></div>
                    <p className="text-xs font-bold text-blue-700">💡 <b>Aprovação:</b> Insira as observações da aprovação abaixo.</p>
                </div>
            )}

            {decisionAction === 'REJECT' && (
                <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-red-600 text-white rounded-lg shadow-lg"><AlertCircle size={16} /></div>
                    <p className="text-xs font-bold text-red-700">⚠️ <b>Reprovação:</b> Insira o motivo da reprovação abaixo.</p>
                </div>
            )}

            {/* Checklist Validation (Only for Manual Approval) */}
            {!fastTrackActive && decisionAction === 'APPROVE' && (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                    <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <ClipboardList size={14} /> Checklist de Verificação Obrigatória
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <CheckItem label="Documentos Conferidos" checked={checklist.docsLegible} onToggle={() => setChecklist(p => ({...p, docsLegible: !p.docsLegible}))} />
                        <CheckItem label="Dados Bancários Ok" checked={checklist.dataMatches} onToggle={() => setChecklist(p => ({...p, dataMatches: !p.dataMatches}))} />
                        <CheckItem label="Assinatura Validada" checked={checklist.selfieValidated} onToggle={() => setChecklist(p => ({...p, selfieValidated: !p.selfieValidated}))} />
                        <CheckItem label="Margem Reservada" checked={checklist.marginReserved} onToggle={() => setChecklist(p => ({...p, marginReserved: !p.marginReserved}))} />
                    </div>
                </div>
            )}

            {fastTrackActive && (
                 <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4">
                    <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg"><Zap size={24} /></div>
                    <div>
                        <p className="text-sm font-black text-emerald-900 uppercase tracking-tight">🚀 APROVAÇÃO AUTOMÁTICA ATIVA</p>
                        <p className="text-[11px] text-emerald-700 font-bold opacity-80">Esta proposta foi aprovada automaticamente por se enquadrar nas regras de limite do parceiro e convênio.</p>
                    </div>
                 </div>
            )}

            {/* Pendency Multilevel Dictionary */}
            {decisionAction === 'PENDING' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-orange-50/30 border border-orange-100 rounded-2xl">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">Tipo de Pendência:</label>
                        <select 
                            className="w-full p-4 bg-white border border-orange-100 rounded-xl text-xs font-bold text-slate-700 outline-none"
                            value={selectedCategory}
                            onChange={(e) => { setSelectedCategory(e.target.value); setSelectedPhrase(""); }}
                        >
                            <option value="">-- Escolha uma Categoria --</option>
                            {Object.keys(DICIONARIO_PENDENCIAS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">Detalhe da Ocorrência:</label>
                        <select 
                            disabled={!selectedCategory}
                            className="w-full p-4 bg-white border border-orange-100 rounded-xl text-xs font-bold text-slate-700 outline-none disabled:opacity-30"
                            value={selectedPhrase}
                            onChange={(e) => setSelectedPhrase(e.target.value)}
                        >
                            <option value="">-- Escolha a Frase Técnica --</option>
                            {selectedCategory && DICIONARIO_PENDENCIAS[selectedCategory].map(p => <option key={p} value={p}>{p.substring(0, 50)}...</option>)}
                        </select>
                    </div>
                </div>
            )}

            {/* Observation / Technical Parecer */}
            <div className="space-y-3">
                <div className="flex items-center justify-between ml-1">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Edit3 size={14} /> Parecer da Análise (Observação)
                    </h4>
                </div>
                <textarea 
                    className={`w-full h-36 p-5 text-sm bg-slate-50 border rounded-[2rem] outline-none transition-all focus:ring-4 font-medium leading-relaxed ${
                        decisionAction === 'APPROVE' ? 'focus:ring-blue-100 border-blue-200 focus:bg-white' :
                        decisionAction === 'PENDING' ? 'focus:ring-orange-100 border-orange-200 focus:bg-white' :
                        decisionAction === 'REJECT' ? 'focus:ring-red-100 border-red-200 focus:bg-white' : 'border-slate-200'
                    }`}
                    placeholder="Escreva o parecer ou observação da proposta..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
            </div>

            {/* FINAL CONFIRMATION BUTTON - V14 Master Auditor */}
            {decisionAction !== 'KEEP' && (
                <div className="pt-4">
                    <button 
                        disabled={!canExecute()}
                        onClick={handleActionExecution}
                        className={`w-full py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${
                            !canExecute() ? 'bg-slate-100 text-slate-300 border grayscale cursor-not-allowed shadow-none' :
                            decisionAction === 'APPROVE' ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' :
                            decisionAction === 'PENDING' ? 'bg-orange-600 text-white shadow-orange-200 hover:bg-orange-700' :
                            decisionAction === 'CONTACT' ? 'bg-purple-600 text-white shadow-purple-200 hover:bg-purple-700' :
                            'bg-red-600 text-white shadow-red-200 hover:bg-red-700'
                        }`}
                    >
                        {decisionAction === 'APPROVE' ? '✅ Confirmar Aprovação' : 
                         decisionAction === 'PENDING' ? '🔴 Salvar Pendência' : 
                         decisionAction === 'CONTACT' ? '📞 Enviar para Contato' : '✖️ Confirmar Reprovação'}
                    </button>
                    {!canExecute() && (
                        <p className="text-center mt-4 text-[10px] font-bold text-red-500 animate-pulse">
                            {notes.length < 10 ? '⚠️ O parecer deve ter no mínimo 10 caracteres.' : '⚠️ Preencha todos os itens do checklist obrigatório.'}
                        </p>
                    )}
                </div>
            )}
        </div>
      </section>
    </div>
  );
};

const ActionButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: React.ReactNode; color: 'slate' | 'blue' | 'orange' | 'red' | 'purple' }> = ({ active, onClick, label, icon, color }) => {
    const colors = {
        slate: active ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300',
        blue: active ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-100' : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50',
        orange: active ? 'bg-orange-600 text-white border-orange-600 shadow-xl shadow-orange-100' : 'bg-white text-orange-600 border-orange-100 hover:bg-orange-50',
        red: active ? 'bg-red-600 text-white border-red-600 shadow-xl shadow-red-100' : 'bg-white text-red-600 border-red-100 hover:bg-red-50',
        purple: active ? 'bg-purple-600 text-white border-purple-600 shadow-xl shadow-purple-100' : 'bg-white text-purple-600 border-purple-100 hover:bg-purple-50',
    };

    return (
        <button 
            onClick={onClick}
            className={`flex flex-col md:flex-row items-center justify-center gap-2 py-4 px-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${colors[color]}`}
        >
            {icon} {label}
        </button>
    );
};

const CheckItem: React.FC<{ label: string, checked: boolean, onToggle: () => void }> = ({ label, checked, onToggle }) => (
    <button 
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
            checked ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
        }`}
    >
        <span className="text-[10px] font-black uppercase tracking-tight">{label}</span>
        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
            checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'
        }`}>
            {checked && <CheckCircle2 size={14} strokeWidth={4} />}
        </div>
    </button>
);
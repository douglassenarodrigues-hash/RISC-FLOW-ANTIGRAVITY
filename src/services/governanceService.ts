
export type GovernanceAction = 
  | 'MANTER_FLUXO' 
  | 'ALERTA_MASTER' 
  | 'REQUERER_AUDITORIA' 
  | 'AVISO_OPERACIONAL' 
  | 'RE_TREINAMENTO' 
  | 'ANALISE_100_OU_RESTRITO' 
  | 'RESTRITO_IMEDIATO' 
  | 'NENHUMA';

export interface GovernanceRule {
  pontos: number;
  acao: GovernanceAction;
}

export const REGRAS_SCORE: Record<string, GovernanceRule> = {
  // --- MOTIVOS DE APROVAÇÃO (POSITIVOS) ---
  "LIBERAÇÃO SEM ANÁLISE": { pontos: 20, acao: "MANTER_FLUXO" },
  "CONTATO TELEFONICO E DOCUMENTAÇÃO OK": { pontos: 10, acao: "MANTER_FLUXO" },
  "COM ACORDO COMERCIAL (REGIONAL)": { pontos: 5, acao: "MANTER_FLUXO" },
  "SOMENTE ANÁLISE DOCUMENTAL": { pontos: 5, acao: "MANTER_FLUXO" },
  
  // --- MOTIVOS DE RECUSA (PENALIDADES) ---
  "CLIENTE NÃO RECONHECE A PROPOSTA": { pontos: -50, acao: "ALERTA_MASTER" },
  "CONFIRMAÇÕES INSATISFATÓRIAS": { pontos: -30, acao: "REQUERER_AUDITORIA" },
  "DECURSO DE PRAZO": { pontos: -10, acao: "AVISO_OPERACIONAL" },
  "FALTA DE RETORNO DA PENDENCIA": { pontos: -5, acao: "AVISO_OPERACIONAL" },
  
  // --- MOTIVOS DE PENDÊNCIA (OPERACIONAL) ---
  "DADOS BANCÁRIOS DIVERGENTES": { pontos: -15, acao: "RE_TREINAMENTO" },
  "DOCUMENTAÇÃO INCOMPLETA": { pontos: -10, acao: "AVISO_OPERACIONAL" },
  
  // --- GATILHOS CRÍTICOS (BLOQUEIO/RESTRIÇÃO) ---
  "MONITORAMENTO INTERNO": { pontos: 0, acao: "ANALISE_100_OU_RESTRITO" },
  "INRREGULARIDADE": { pontos: -100, acao: "RESTRITO_IMEDIATO" }
};

export function obterRegrasScore(): Record<string, GovernanceRule> {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem('riskflow_governance_rules');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
  }
  return { ...REGRAS_SCORE };
}

export function salvarRegrasScore(regras: Record<string, GovernanceRule>): void {
  if (typeof window !== "undefined") {
    localStorage.setItem('riskflow_governance_rules', JSON.stringify(regras));
  }
}

export interface PartnerHealth {
  score: number;
  bloqueioAtivo: boolean;
  analiseTotal: boolean;
}

export function calcularSaudeParceiro(listaMotivos: string[], regrasCustom?: Record<string, GovernanceRule>): PartnerHealth {
  let scoreInicial = 100;
  let bloqueioAtivo = false;
  let analiseTotal = false;
  
  const regras = regrasCustom || obterRegrasScore();
  
  for (const motivoRaw of listaMotivos) {
    const motivo = (motivoRaw || '').toString().trim().toUpperCase();
    const regra = regras[motivo] || { pontos: 0, acao: "NENHUMA" };
    
    // Aplica a pontuação
    scoreInicial += regra.pontos;
    
    // Verifica Gatilhos de Monitoramento
    if (motivo === "MONITORAMENTO INTERNO") {
      analiseTotal = true; 
    }
    
    if (motivo === "INRREGULARIDADE" || regra.acao === "RESTRITO_IMEDIATO") {
      bloqueioAtivo = true;
    }
  }

  // Garante que o score não seja negativo
  const scoreFinal = Math.max(0, scoreInicial);
  
  // Regra adicional do Python: Score < 50 ou Monitoramento Ativo = RESTRITO
  if (scoreFinal < 50) {
    bloqueioAtivo = true;
  }
  
  return {
    score: scoreFinal,
    bloqueioAtivo,
    analiseTotal
  };
}

export type RiskStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITING_DOCS' | 'CONTACT' | 'WAITING_REQUEST' | 'AUTO_APPROVED' | 'AGENDADO';

export interface BankMapping {
  bankName: string;
  ade: string;
  cliente: string;
  valor: string;
  valorFinanciado: string;
  convenio: string;
  corretor: string;
  cpf: string;
  produto: string;
  atividade: string; // Mapeado para Status/Situação do Banco
  fase: string;      // Mapeado para Fase de Atuação (Nova Coluna)
  filterValue: string;
  sep: ';' | ',';
}

export interface Proposal {
  id: string;
  ade: string; 
  documentacao: string;
  banco: string;
  convenio: string; 
  produto: string; 
  corretor: string; 
  valor: number; 
  valorFinanciado: number; 
  cpf: string;
  nomeCliente: string; 
  sla: string;
  obs: string;
  status: RiskStatus;
  originalStatus?: string; // Status bruto vindo do portal (ex: "Aguardando liberação")
  faseAtuacao?: string;    // Fase de Atuação (Nova Coluna)
  dataSistema: string; 
  uploadedFiles?: string[];
  lastContentType?: string;
  categoriaConvenio?: string; // Metadata for reporting
  lockedBy?: string | null;   // Analista que assumiu a operação
  importedBy?: string;        // Analista que subiu o arquivo
  createdAt?: number;         // Timestamp in ms of creation/import
  lastUpdatedStatusAt?: number; // Timestamp in ms of last status transition
  slaRemainingMs?: number;    // Remaining duration of SLA (3 hours default)
  fraudCategory?: string;
  fraudSubMotive?: string;
}

export interface AgendaEntry {
  id: string;
  ade: string;
  contato: string;
  data: string;
  hora: string;
  motivo: string;
  analista: string;
  status: 'Pendente' | 'Concluído';
}

export interface DecisionEntry {
  id: string;
  timestamp: string;
  ade: string;
  cliente: string;
  banco: string;
  decisao: RiskStatus | 'IMPORTAÇÃO' | 'ASSUMIU' | 'FINALIZOU' | 'LIBEROU';
  motivo: string;
  analista: string;
  acao?: string; // Descrição da ação (ex: "IMPORTAÇÃO DE PROPOSTA")
  aiAnalysisResult?: {
    isValidDocument: boolean;
    isIlegivel: boolean;
    isDeteriorated: boolean;
    isCortado: boolean;
    matchesTitularidade: boolean;
    detectedName?: string;
    detectedCpf?: string;
    summary?: string;
    suggestedStatus?: string;
  };
  contactAttachment?: {
    audioName?: string;
    audioUrl?: string; // in case of played URL
    relatoContato?: string;
  };
  fraudCategory?: string;
  fraudSubMotive?: string;
}

export interface Checklist {
  docsLegible: boolean;
  dataMatches: boolean;
  selfieValidated: boolean;
  marginReserved: boolean;
}

export type PartnerStatus = 'ACTING' | 'NON_ACTING' | 'ANALYSIS_100';

export type PartnerClassification = 'Master' | 'Ouro' | 'Prata' | 'Bronze' | 'Restrito';

export interface PartnerRule {
  name?: string;
  classification?: PartnerClassification;
  selfie: boolean;
  doc: boolean;
  sla: 'Baixa' | 'Normal' | 'Urgente';
  limite: number; 
  status: PartnerStatus; 
  score?: number;
  driveUrl?: string;
  username?: string;
  email_parceiro?: string;
  usuarios_vinculados?: string[];
  contato_telefonico: boolean;
}

export interface CovenantRule {
  documents: string[];
  teto: number; 
}

export interface UserPermissions {
  viewFullCpf: boolean;
  viewValues: boolean;
  editRules: boolean;
  deleteProposals: boolean;
  fullAnalyticalControl?: boolean;
  viewDailyPerfSummary?: boolean;
  viewActivitySummaryGov?: boolean;
  viewProductionReportPeriod?: boolean;
  viewPerformanceChartsPeriod?: boolean;
  viewQtyActionsDistChart?: boolean;
  viewOperationalReportCsv?: boolean;
  viewActionsAnalystBank?: boolean;
  viewAuditGuideSidebar?: boolean;
  editPartnerLimit?: boolean;
  editPartnerSla?: boolean;
  editPartnerBehaviorRegua?: boolean;
  editPartnerSecurityVerify?: boolean;
  viewFraudPreventionChart?: boolean;
}

export type UserStatus = 'Online' | 'Offline' | 'Suspenso';

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  role: 'Master' | 'Analista' | 'Supervisor';
  actingAreas: string[];
  permissions: UserPermissions;
  active: boolean;
  status?: UserStatus;
}

export type AppRules = {
  partners: Record<string, PartnerRule>;
  covenants: Record<string, CovenantRule>;
  fullVisibilitySelect?: boolean;
};

export interface BaseImport {
  id: string;
  bankName: string;
  fileName: string;
  importedAt: number;
  importedBy: string;
  newCount: number;
  dupCount: number;
  rawContent: string;
  proposalIds: string[];
}
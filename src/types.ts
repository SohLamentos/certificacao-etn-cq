/**
 * Types for the Certificação Prática CQ application.
 */

export type CertificacaoType = string;

export type AvaliacaoStatus = 'AGENDADA' | 'EM ANDAMENTO' | 'FINALIZADA' | 'Rascunho' | 'Concluída';

export type ChecklistValue = 'Fez' | 'NaoFez' | 'NA';

export interface ChecklistItem {
  id: number;
  pergunta: string;
  critico: boolean;
}

export interface DynamicChecklistItem {
  id: number;
  certificacao: string; // Certification name (or ID)
  grupo: string;
  ordem: number;
  descricao: string; // Question text
  critico: boolean;
  obrigatorio?: boolean; // Required
  ativo: boolean;
}

export interface DynamicCertificacao {
  id: string; // Unique ID (e.g., lowercase slug or UUID)
  nome: string;
  descricao: string;
  perfilPermitido: PerfilPermitido;
  cor: string; // e.g., '#E30613' (Claro Red), '#FFB800', etc.
  icone: string; // e.g., 'Cpu', 'Wifi', 'Tv', 'Shield', 'Layers', etc.
  ativa: boolean;
}

export interface AvaliacaoResult {
  totalAvaliado: number;
  acertos: number;
  nota: number; // Percentage
  resultado: 'APROVADO' | 'REPROVADO' | 'PENDENTE';
  motivoReprovacao?: string;
  itensNaoRealizados: number[]; // IDs of items
  itensCriticosNaoRealizados: number[]; // IDs of critical items
}

export interface Avaliacao {
  id: string;
  nomeTecnico: string;
  matricula: string;
  empresa: string;
  cidadeBase: string;
  nomeCQ: string;
  data: string;
  tipoCertificacao: CertificacaoType;
  status: AvaliacaoStatus;
  checklistResponses: Record<number, ChecklistValue>; // Map of itemId -> response value
  resultado?: AvaliacaoResult; // Final results when status is 'Concluída' or previewed
  observacao?: string; // Optional notes/observation
  notaTeorica?: number; // Theoretical exam grade (0 to 10)
  createdAt: string;
  updatedAt: string;
}

export interface CityBaseOption {
  name: string;
  state: string;
}

export interface CompanyOption {
  name: string;
}

export type PerfilPermitido = 'Apenas CQ' | 'Apenas Analista' | 'CQ ou Analista';

export interface CQ {
  id: string;
  nome: string;
  perfil: 'CQ' | 'Analista';
  cidadeBase: string;
  status: 'Ativo' | 'Inativo';
  createdAt: string;
  updatedAt: string;
}


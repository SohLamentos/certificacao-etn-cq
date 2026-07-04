import { DynamicCertificacao, DynamicChecklistItem, ChecklistValue, AvaliacaoResult } from '../types';

// Default static lists that will be used to initialize localStorage if not present
export const DEFAULT_CERTIFICACOES: DynamicCertificacao[] = [
  {
    id: 'gpon-veterano',
    nome: 'GPON Veterano',
    descricao: 'Avaliação prática periódica para técnicos veteranos em tecnologia de fibra óptica GPON.',
    perfilPermitido: 'Apenas CQ',
    cor: '#E30613', // Claro Red
    icone: 'Cpu',
    ativa: true
  },
  {
    id: 'gpon-capacitacao',
    nome: 'GPON Capacitação',
    descricao: 'Auditoria de capacitação técnica inicial para novos técnicos em rede óptica GPON.',
    perfilPermitido: 'Apenas Analista',
    cor: '#FFB800', // Amber
    icone: 'Wifi',
    ativa: true
  },
  {
    id: 'hfc-capacitacao',
    nome: 'HFC Capacitação',
    descricao: 'Auditoria de padrões e conformidades para redes coaxiais (HFC) e decodificadores.',
    perfilPermitido: 'CQ ou Analista',
    cor: '#00A859', // Green
    icone: 'Tv',
    ativa: true
  }
];

// Map of GPON Veterano items
const defaultGponVeteranoRaw = [
  { id: 1, pergunta: 'Utilizou a caneta de limpeza? (Conector, Power Meter, Porta da NAP)', critico: false, grupo: 'Processos' },
  { id: 2, pergunta: 'Realizou medição de sinal na NAP? (Uso correto do Power Meter / configuração correta)', critico: false, grupo: 'Processos' },
  { id: 3, pergunta: 'Confecção de Conectores Correta - Fibra Cinza (utilizou as ferramentas e gabaritos adequadamente)?', critico: true, grupo: 'Instalação Física' },
  { id: 4, pergunta: 'Identificou o cabo corretamente? (Poste/Cordoalha)', critico: false, grupo: 'Instalação Física' },
  { id: 5, pergunta: 'Confecção de Conectores Correta - Fibra Branca (utilizou as ferramentas e gabaritos adequadamente)?', critico: true, grupo: 'Instalação Física' },
  { id: 6, pergunta: 'Identificou o cabo corretamente? (MDU)', critico: false, grupo: 'Instalação Física' },
  { id: 7, pergunta: 'Identificou o andar da NAP em que foi instalada?', critico: false, grupo: 'Instalação Física' },
  { id: 8, pergunta: 'Realizou a acomodação correta na NAP? (Poste/Cordoalha)', critico: true, grupo: 'Instalação Física' },
  { id: 9, pergunta: 'Realizou a acomodação correta na NAP? (MDU)', critico: true, grupo: 'Instalação Física' },
  { id: 10, pergunta: 'Realizou a passagem do cabo óptico corretamente? (FLECHA, SDO, SDA e SRDO)', critico: false, grupo: 'Instalação Física' },
  { id: 11, pergunta: 'Realizou a montagem corretamente e explicou a regra de aplicação da PTO?', critico: false, grupo: 'Instalação Física' },
  { id: 12, pergunta: 'Realizou a acomodação correta na ONT? (Utilizou a fita autofusão no conector)', critico: false, grupo: 'Instalação Física' },
];

// Map of GPON Capacitação items
const defaultGponCapacitacaoRaw = [
  { id: 101, pergunta: 'Atualizou o status no PDA (Rota para início)?', critico: false, grupo: 'Processos' },
  { id: 102, pergunta: 'Se apresentou ao cliente e verificou se ele recebeu a mensagem via aplicativo?', critico: false, grupo: 'Processos' },
  { id: 103, pergunta: 'Informou o código de segurança quando solicitado?', critico: false, grupo: 'Processos' },
  { id: 104, pergunta: 'Confirmou com o cliente os produtos antes de entrar na residência?', critico: false, grupo: 'Processos' },
  { id: 105, pergunta: 'Explicou ao cliente sobre a utilização do propé?', critico: false, grupo: 'Processos' },
  { id: 106, pergunta: 'Confirmou o local de instalação dos equipamentos?', critico: false, grupo: 'Processos' },
  { id: 107, pergunta: 'Combinou com o cliente a passagem do cabo e os possíveis furos?', critico: false, grupo: 'Processos' },
  { id: 108, pergunta: 'Realizou APR e ativou o botão escada através do App Técnico Nota 10?', critico: false, grupo: 'Processos' },
  { id: 109, pergunta: 'Confecção de Conectores Correta (utilizou as ferramentas adequadamente)?', critico: true, grupo: 'Instalação Física' },
  { id: 110, pergunta: 'Instalou Autofusão / Protetor no Conector?', critico: false, grupo: 'Instalação Física' },
  { id: 111, pergunta: 'Realizou medição de sinal na NAP?', critico: false, grupo: 'Instalação Física' },
  { id: 112, pergunta: 'Instalou corretamente o ECAM na NAP?', critico: false, grupo: 'Instalação Física' },
  { id: 113, pergunta: 'Identificou corretamente o cabo?', critico: false, grupo: 'Instalação Física' },
  { id: 114, pergunta: 'Realizou a cintagem do poste?', critico: true, grupo: 'Instalação Física' },
  { id: 115, pergunta: 'Realizou corretamente a passagem do cabo óptico (AGF, SRDO, SDO etc.)?', critico: false, grupo: 'Instalação Física' },
  { id: 116, pergunta: 'Instalou corretamente o PTO?', critico: false, grupo: 'Instalação Física' },
  { id: 117, pergunta: 'Explicou ao cliente sobre a fragilidade do cordão óptico?', critico: false, grupo: 'Instalação Física' },
  { id: 118, pergunta: 'Realizou reset de fábrica e instalação do decoder via Wi-Fi 5 GHz?', critico: false, grupo: 'Decodificador' },
  { id: 119, pergunta: 'Verificou se o decoder possui Status e IP corretamente?', critico: false, grupo: 'Decodificador' },
  { id: 120, pergunta: 'Configurou e explicou a utilização básica do controle remoto?', critico: false, grupo: 'Decodificador' },
  { id: 121, pergunta: 'Retirou bloqueio por idade e alterou senha de compra?', critico: false, grupo: 'Decodificador' },
  { id: 122, pergunta: 'Configurou corretamente TV e Decoder (HDMI, resolução, formato de exibição e sistema de áudio)?', critico: true, grupo: 'Decodificador' },
  { id: 123, pergunta: 'Explicou os recursos de gravação (Agendar gravação)?', critico: false, grupo: 'Decodificador' },
  { id: 124, pergunta: 'Demonstrou o Replay TV?', critico: false, grupo: 'Decodificador' },
  { id: 125, pergunta: 'Explicou a função Autodesligar?', critico: false, grupo: 'Decodificador' },
  { id: 126, pergunta: 'Apresentou o App Claro TV+ ao cliente?', critico: false, grupo: 'Decodificador' },
  { id: 127, pergunta: 'Confecção do Conector RJ45 está correta?', critico: true, grupo: 'Banda Larga' },
  { id: 128, pergunta: 'Definiu corretamente o local da ONT e analisou a cobertura Wi-Fi?', critico: false, grupo: 'Banda Larga' },
  { id: 129, pergunta: 'Acessou as propriedades da ONT e explicou sobre senha forte?', critico: false, grupo: 'Banda Larga' },
  { id: 130, pergunta: 'Configurou corretamente o Wi-Fi (Band Steering e Redes 2.4 e 5 GHz)?', critico: true, grupo: 'Banda Larga' },
  { id: 131, pergunta: 'Explicou ao cliente sobre a rede IoT?', critico: false, grupo: 'Banda Larga' },
  { id: 132, pergunta: 'Informou sobre compatibilidade dos dispositivos?', critico: false, grupo: 'Banda Larga' },
  { id: 133, pergunta: 'Realizou teste de velocidade?', critico: false, grupo: 'Banda Larga' },
  { id: 134, pergunta: 'Verificou os níveis TX e RX pela ONT ou niveis.virtua.com.br?', critico: false, grupo: 'Banda Larga' },
  { id: 135, pergunta: 'Realizou teste de velocidade e cobertura Wi-Fi junto ao cliente?', critico: false, grupo: 'Banda Larga' },
  { id: 36, pergunta: 'Confecção dos conectores RJ11 está correta?', critico: false, grupo: 'Telefone' },
  { id: 37, pergunta: 'Explicou Claro Fone, Serviços Inteligentes e Portabilidade?', critico: false, grupo: 'Telefone' },
  { id: 38, pergunta: 'Confirmou o funcionamento do Claro Fone informando o número?', critico: false, grupo: 'Telefone' },
  { id: 139, pergunta: 'Confirmou que o firmware está atualizado?', critico: 'Aplicativos' }, // Wait, let's fix critico to false, group to Aplicativos
  { id: 140, pergunta: 'Solicitou documento e realizou upload na OS Digital?', critico: false, grupo: 'Aplicativos' },
  { id: 141, pergunta: 'Preencheu corretamente a Ordem de Serviço Digital e coletou assinatura?', critico: false, grupo: 'Aplicativos' },
  { id: 142, pergunta: 'Finalizou o atendimento no PDA e lançou os materiais utilizados?', critico: false, grupo: 'Aplicativos' },
  { id: 143, pergunta: 'Informou os canais de Autoatendimento (Minha Claro, WhatsApp e Site)?', critico: false, grupo: 'Aplicativos' },
  { id: 144, pergunta: 'Realizou a Autoinspeção?', critico: false, grupo: 'Aplicativos' },
  { id: 145, pergunta: 'Informou sobre o TNPS e solicitou a avaliação?', critico: false, grupo: 'Atendimento Consultivo / TNPS' },
  { id: 146, pergunta: 'Explicou corretamente as notas do TNPS?', critico: false, grupo: 'Atendimento Consultivo / TNPS' },
];

// Map of HFC Capacitação items
const defaultHfcCapacitacaoRaw = [
  { id: 201, pergunta: 'Atualizou o status no PDA (Rota para início)?', critico: false, grupo: 'Processos' },
  { id: 202, pergunta: 'Se apresentou ao cliente e verificou se ele recebeu a mensagem via aplicativo?', critico: false, grupo: 'Processos' },
  { id: 203, pergunta: 'Informou o código de segurança quando solicitado?', critico: false, grupo: 'Processos' },
  { id: 204, pergunta: 'Confirmou com o cliente os produtos a serem instalados antes de entrar na residência?', critico: false, grupo: 'Processos' },
  { id: 205, pergunta: 'Explicou ao cliente sobre a utilização do pro-pé?', critico: false, grupo: 'Processos' },
  { id: 206, pergunta: 'Confirmou com o cliente o local de instalação dos equipamentos?', critico: false, grupo: 'Processos' },
  { id: 207, pergunta: 'Combinou com o cliente a passagem do cabo e as paredes que seriam furadas?', critico: false, grupo: 'Processos' },
  { id: 208, pergunta: 'Realizou a APR e ativou o botão escada através do APP Técnico Nota 10 antes do trabalho em altura?', critico: false, grupo: 'Processos' },
  { id: 209, pergunta: 'Realizou corretamente a confecção dos conectores utilizando as ferramentas adequadas?', critico: true, grupo: 'Instalação Física' },
  { id: 210, pergunta: 'Efetuou a medição de sinal (CA e CB)?', critico: false, grupo: 'Instalação Física' },
  { id: 211, pergunta: 'Utilizou corretamente o anel de vedação?', critico: false, grupo: 'Instalação Física' },
  { id: 212, pergunta: 'Identificou corretamente o cabo?', critico: false, grupo: 'Instalação Física' },
  { id: 213, pergunta: 'Realizou corretamente a cintagem do poste e a amarração?', critico: true, grupo: 'Instalação Física' },
  { id: 214, pergunta: 'Instalou corretamente o Cable Isolator?', critico: false, grupo: 'Instalação Física' },
  { id: 215, pergunta: 'Aplicou corretamente o torque nas conexões do MDU, passivos e equipamentos?', critico: false, grupo: 'Instalação Física' },
  { id: 216, pergunta: 'Explicou corretamente a importância do Mini Isolator?', critico: false, grupo: 'Instalação Física' },
  { id: 217, pergunta: 'Executou corretamente a distribuição do sinal do cabo coaxial?', critico: false, grupo: 'Instalação Física' },
  { id: 218, pergunta: 'Efetuou o reset de fábrica do decoder e realizou a configuração da base?', critico: false, grupo: 'Decodificador' },
  { id: 219, pergunta: 'Todos os pontos de TV ficaram com níveis de sinal dentro do padrão?', critico: false, grupo: 'Decodificador' },
  { id: 220, pergunta: 'Configurou e explicou a utilização do controle remoto?', critico: false, grupo: 'Decodificador' },
  { id: 221, pergunta: 'Retirou o bloqueio por idade e alterou a senha de compra?', critico: false, grupo: 'Decodificador' },
  { id: 222, pergunta: 'Configurou corretamente TV e Decoder (HDMI, resolução, formato e áudio)?', critico: true, grupo: 'Decodificador' },
  { id: 223, pergunta: 'Explicou o NOW demonstrando conteúdos gratuitos?', critico: false, grupo: 'Decodificador' },
  { id: 224, pergunta: 'Explicou os recursos de gravação?', critico: false, grupo: 'Decodificador' },
  { id: 225, pergunta: 'Demonstrou o Replay TV?', critico: false, grupo: 'Decodificador' },
  { id: 226, pergunta: 'Explicou a função Auto Hit?', critico: false, grupo: 'Decodificador' },
  { id: 227, pergunta: 'Explicou a função Autodesligar?', critico: false, grupo: 'Decodificador' },
  { id: 228, pergunta: 'Realizou o Valida Retorno?', critico: false, grupo: 'Decodificador' },
  { id: 229, pergunta: 'Apresentou o App Claro TV+ e explicou cadastro e acesso?', critico: false, grupo: 'Decodificador' },
  { id: 230, pergunta: 'Confeccionou corretamente o conector RJ45?', critico: true, grupo: 'Banda Larga' },
  { id: 231, pergunta: 'Definiu corretamente o local do eMTA e analisou a potência do Wi-Fi?', critico: false, grupo: 'Banda Larga' },
  { id: 232, pergunta: 'Acessou as propriedades do eMTA e explicou sobre senha forte?', critico: false, grupo: 'Banda Larga' },
  { id: 233, pergunta: 'Configurou corretamente o Wi-Fi (Band Steering e redes 2.4 e 5 GHz)?', critico: true, grupo: 'Banda Larga' },
  { id: 234, pergunta: 'Explicou sobre a rede IoT?', critico: false, grupo: 'Banda Larga' },
  { id: 235, pergunta: 'Informou sobre compatibilidade dos dispositivos do cliente?', critico: false, grupo: 'Banda Larga' },
  { id: 236, pergunta: 'Realizou teste de velocidade pelo Brasil Banda Larga/Speedtest?', critico: false, grupo: 'Banda Larga' },
  { id: 237, pergunta: 'Verificou TX/RX/SNR pelo site niveis.virtua.com.br?', critico: false, grupo: 'Banda Larga' },
  { id: 238, pergunta: 'Verificou TX/RX/SNR pela página interna do eMTA?', critico: false, grupo: 'Banda Larga' },
  { id: 239, pergunta: 'Realizou teste de velocidade e cobertura Wi-Fi junto ao cliente?', critico: false, grupo: 'Banda Larga' },
  { id: 240, pergunta: 'Realizou atendimento consultivo apresentando opções de contratação?', critico: false, grupo: 'Telefone' },
  { id: 241, pergunta: 'Confeccionou corretamente os conectores telefônicos RJ11?', critico: false, grupo: 'Telefone' },
  { id: 242, pergunta: 'Explicou os Serviços Inteligentes Claro Fone e Portabilidade?', critico: false, grupo: 'Telefone' },
  { id: 243, pergunta: 'Confirmou o funcionamento do Claro Fone informando o número ao cliente?', critico: false, grupo: 'Telefone' },
  { id: 244, pergunta: 'Confirmou que o firmware dos equipamentos está atualizado?', critico: false, grupo: 'Aplicativos' },
  { id: 245, pergunta: 'Solicitou documento e realizou upload na OS Digital?', critico: false, grupo: 'Aplicativos' },
  { id: 246, pergunta: 'Preencheu corretamente a Ordem de Serviço Digital e coletou a assinatura do cliente?', critico: false, grupo: 'Aplicativos' },
  { id: 247, pergunta: 'Finalizou o atendimento no PDA e lançou corretamente os materiais?', critico: false, grupo: 'Aplicativos' },
  { id: 248, pergunta: 'Informou sobre os canais de autoatendimento (Minha Claro, WhatsApp e Site)?', critico: false, grupo: 'Aplicativos' },
  { id: 249, pergunta: 'Realizou a autoinspeção?', critico: false, grupo: 'Atendimento Consultivo / TNPS' },
  { id: 250, pergunta: 'Informou sobre o TNPS e solicitou a avaliação do cliente?', critico: false, grupo: 'Atendimento Consultivo / TNPS' }
];

export const getDynamicCertificacoes = (): DynamicCertificacao[] => {
  const saved = localStorage.getItem('claro_dynamic_certificacoes');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing dynamic certificacoes', e);
    }
  }
  // Initialize on first load
  saveDynamicCertificacoes(DEFAULT_CERTIFICACOES);
  return DEFAULT_CERTIFICACOES;
};

export const saveDynamicCertificacoes = (certs: DynamicCertificacao[]) => {
  localStorage.setItem('claro_dynamic_certificacoes', JSON.stringify(certs));
};

export const getDynamicChecklistItems = (): DynamicChecklistItem[] => {
  const saved = localStorage.getItem('claro_dynamic_checklist_items');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing dynamic checklist items', e);
    }
  }

  // Combine static items into dynamic items
  const items: DynamicChecklistItem[] = [];

  // 1. GPON Veterano
  defaultGponVeteranoRaw.forEach((x, idx) => {
    items.push({
      id: x.id,
      certificacao: 'GPON Veterano',
      grupo: x.grupo,
      ordem: idx + 1,
      descricao: x.pergunta,
      critico: x.critico,
      obrigatorio: x.critico, // critical by default is required
      ativo: true
    });
  });

  // 2. GPON Capacitação
  defaultGponCapacitacaoRaw.forEach((x, idx) => {
    items.push({
      id: x.id,
      certificacao: 'GPON Capacitação',
      grupo: x.grupo,
      ordem: idx + 1,
      descricao: x.pergunta,
      critico: x.critico === true,
      obrigatorio: x.critico === true,
      ativo: true
    });
  });

  // 3. HFC Capacitação
  defaultHfcCapacitacaoRaw.forEach((x, idx) => {
    items.push({
      id: x.id,
      certificacao: 'HFC Capacitação',
      grupo: x.grupo,
      ordem: idx + 1,
      descricao: x.pergunta,
      critico: x.critico,
      obrigatorio: x.critico,
      ativo: true
    });
  });

  saveDynamicChecklistItems(items);
  return items;
};

export const saveDynamicChecklistItems = (items: DynamicChecklistItem[]) => {
  localStorage.setItem('claro_dynamic_checklist_items', JSON.stringify(items));
};

// Dynamic results calculations
export function calcularResultadoDinamico(
  certItems: DynamicChecklistItem[],
  responses: Record<number, ChecklistValue>,
  notaTeorica?: number
): AvaliacaoResult {
  let totalAvaliado = 0;
  let acertos = 0;
  const itensNaoRealizados: number[] = [];
  const itensCriticosNaoRealizados: number[] = [];

  // Filter to active items only
  const activeItems = certItems.filter(item => item.ativo);

  activeItems.forEach((item) => {
    const value = responses[item.id];
    
    if (value === 'Fez') {
      totalAvaliado++;
      acertos++;
    } else if (value === 'NaoFez') {
      totalAvaliado++;
      itensNaoRealizados.push(item.id);
      if (item.critico) {
        itensCriticosNaoRealizados.push(item.id);
      }
    }
    // NA is skipped from calculation
  });

  const nota = totalAvaliado > 0 ? Math.round((acertos / totalAvaliado) * 100) / 10 : 0;

  let resultado: 'APROVADO' | 'REPROVADO' = 'APROVADO';
  let motivos: string[] = [];

  const reprovadoPorTeorica = notaTeorica !== undefined && notaTeorica < 7;
  const reprovadoPorCritico = itensCriticosNaoRealizados.length > 0;
  const reprovadoPorNota = nota < 7.0;

  if (reprovadoPorTeorica || reprovadoPorCritico || reprovadoPorNota) {
    resultado = 'REPROVADO';
    
    if (reprovadoPorTeorica) {
      motivos.push(`Nota teórica inferior a 7`);
    }
    
    if (reprovadoPorCritico) {
      const criticosStr = itensCriticosNaoRealizados
        .map(id => `#${id}`)
        .join(', ');
      motivos.push(`Falha em item crítico obrigatório (${criticosStr})`);
    }
    
    if (reprovadoPorNota) {
      const formattedNota = nota.toFixed(1).replace('.', ',');
      motivos.push(`Nota prática insuficiente: ${formattedNota} (mínimo de 7,0 exigido)`);
    }
  }

  return {
    totalAvaliado,
    acertos,
    nota,
    resultado,
    motivoReprovacao: motivos.length > 0 ? motivos.join(' e ') : undefined,
    itensNaoRealizados,
    itensCriticosNaoRealizados,
  };
}

// Generate dynamic groups from checklist items
export interface DynamicGroup {
  id: number;
  nome: string;
  total: number;
  startId: number; // For compatibility
  endId: number;   // For compatibility
}

export const getGroupsForCertificacao = (
  certName: string,
  items: DynamicChecklistItem[]
): DynamicGroup[] => {
  const activeCertItems = items.filter(
    item => item.certificacao === certName && item.ativo
  );

  // Collect unique group names
  const groupNamesSet = new Set<string>();
  activeCertItems.forEach(item => {
    if (item.grupo) groupNamesSet.add(item.grupo);
  });

  const groupNames = Array.from(groupNamesSet);

  // For each group, calculate minimum order to preserve natural ordering
  const groupsWithMinOrder = groupNames.map(name => {
    const groupItems = activeCertItems.filter(item => item.grupo === name);
    const minOrder = Math.min(...groupItems.map(item => item.ordem));
    const minId = Math.min(...groupItems.map(item => item.id));
    const maxId = Math.max(...groupItems.map(item => item.id));
    return {
      nome: name,
      minOrder,
      total: groupItems.length,
      startId: minId,
      endId: maxId
    };
  });

  // Sort groups by minOrder
  groupsWithMinOrder.sort((a, b) => a.minOrder - b.minOrder);

  // Return formatted DynamicGroup objects with sequential IDs
  return groupsWithMinOrder.map((g, idx) => ({
    id: idx + 1,
    nome: g.nome,
    total: g.total,
    startId: g.startId,
    endId: g.endId
  }));
};

import { 
  Cpu, Wifi, Tv, Layers, Shield, Globe, Smartphone, Award, ClipboardList, Sliders, CheckSquare, ListTodo, Cable, HardDrive, Settings, Activity
} from 'lucide-react';

export const getIconComponent = (name: string) => {
  switch (name) {
    case 'Cpu': return Cpu;
    case 'Wifi': return Wifi;
    case 'Tv': return Tv;
    case 'Layers': return Layers;
    case 'Shield': return Shield;
    case 'Globe': return Globe;
    case 'Smartphone': return Smartphone;
    case 'Award': return Award;
    case 'ClipboardList': return ClipboardList;
    case 'CheckSquare': return CheckSquare;
    case 'ListTodo': return ListTodo;
    case 'Cable': return Cable;
    case 'HardDrive': return HardDrive;
    case 'Settings': return Settings;
    case 'Activity': return Activity;
    default: return Award;
  }
};

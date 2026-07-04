import { ChecklistItem, ChecklistValue, AvaliacaoResult } from '../types';

export const GPON_VETERANO_ITEMS: ChecklistItem[] = [
  {
    id: 1,
    pergunta: 'Utilizou a caneta de limpeza? (Conector, Power Meter, Porta da NAP)',
    critico: false,
  },
  {
    id: 2,
    pergunta: 'Realizou medição de sinal na NAP? (Uso correto do Power Meter / configuração correta)',
    critico: false,
  },
  {
    id: 3,
    pergunta: 'Confecção de Conectores Correta - Fibra Cinza (utilizou as ferramentas e gabaritos adequadamente)?',
    critico: true,
  },
  {
    id: 4,
    pergunta: 'Identificou o cabo corretamente? (Poste/Cordoalha)',
    critico: false,
  },
  {
    id: 5,
    pergunta: 'Confecção de Conectores Correta - Fibra Branca (utilizou as ferramentas e gabaritos adequadamente)?',
    critico: true,
  },
  {
    id: 6,
    pergunta: 'Identificou o cabo corretamente? (MDU)',
    critico: false,
  },
  {
    id: 7,
    pergunta: 'Identificou o andar da NAP em que foi instalada?',
    critico: false,
  },
  {
    id: 8,
    pergunta: 'Realizou a acomodação correta na NAP? (Poste/Cordoalha)',
    critico: true,
  },
  {
    id: 9,
    pergunta: 'Realizou a acomodação correta na NAP? (MDU)',
    critico: true,
  },
  {
    id: 10,
    pergunta: 'Realizou a passagem do cabo óptico corretamente? (FLECHA, SDO, SDA e SRDO)',
    critico: false,
  },
  {
    id: 11,
    pergunta: 'Realizou a montagem corretamente e explicou a regra de aplicação da PTO?',
    critico: false,
  },
  {
    id: 12,
    pergunta: 'Realizou a acomodação correta na ONT? (Utilizou a fita autofusão no conector)',
    critico: false,
  },
];

/**
 * Calculates the result of a GPON Veterano evaluation.
 */
export function calcularResultadoGPONVeterano(
  responses: Record<number, ChecklistValue>,
  notaTeorica?: number
): AvaliacaoResult {
  let totalAvaliado = 0;
  let acertos = 0;
  const itensNaoRealizados: number[] = [];
  const itensCriticosNaoRealizados: number[] = [];

  GPON_VETERANO_ITEMS.forEach((item) => {
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
    // 'NA' does not enter calculations, and if not answered yet, we treat as not entered
  });

  // Calculate score out of 10 with 1 decimal place (avoid division by 0)
  const nota = totalAvaliado > 0 ? Math.round((acertos / totalAvaliado) * 100) / 10 : 0;

  let resultado: 'APROVADO' | 'REPROVADO' = 'APROVADO';
  let motivos: string[] = [];

  // Rules:
  // 1. Nota teórica >= 7
  const reprovadoPorTeorica = notaTeorica !== undefined && notaTeorica < 7;

  // 2. Any critical item marked as 'NaoFez' results in automatic REPROVADO
  const reprovadoPorCritico = itensCriticosNaoRealizados.length > 0;
  
  // 3. Minimum score for approval is 7.0
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

export interface HFCGroup {
  id: number;
  nome: string;
  startId: number;
  endId: number;
  total: number;
}

export const HFC_24_GROUPS: HFCGroup[] = [
  { id: 1, nome: 'Processos', startId: 1, endId: 8, total: 8 },
  { id: 2, nome: 'Instalação Física', startId: 9, endId: 17, total: 9 },
  { id: 3, nome: 'Decodificador', startId: 18, endId: 29, total: 12 },
  { id: 4, nome: 'Banda Larga', startId: 30, endId: 39, total: 10 },
  { id: 5, nome: 'Telefone', startId: 40, endId: 42, total: 3 },
  { id: 6, nome: 'Aplicativos', startId: 43, endId: 48, total: 6 },
  { id: 7, nome: 'Atendimento Consultivo / TNPS', startId: 49, endId: 50, total: 2 },
];

export const HFC_24_ITEMS: ChecklistItem[] = [
  { id: 1, pergunta: 'Atualizou o status no PDA (Rota para início)?', critico: false },
  { id: 2, pergunta: 'Se apresentou ao cliente e verificou se ele recebeu a mensagem via aplicativo?', critico: false },
  { id: 3, pergunta: 'Informou o código de segurança quando solicitado?', critico: false },
  { id: 4, pergunta: 'Confirmou com o cliente os produtos a serem instalados antes de entrar na residência?', critico: false },
  { id: 5, pergunta: 'Explicou ao cliente sobre a utilização do pro-pé?', critico: false },
  { id: 6, pergunta: 'Confirmou com o cliente o local de instalação dos equipamentos?', critico: false },
  { id: 7, pergunta: 'Combinou com o cliente a passagem do cabo e as paredes que seriam furadas?', critico: false },
  { id: 8, pergunta: 'Realizou a APR e ativou o botão escada através do APP Técnico Nota 10 antes do trabalho em altura?', critico: false },
  { id: 9, pergunta: 'Realizou corretamente a confecção dos conectores utilizando as ferramentas adequadas?', critico: true },
  { id: 10, pergunta: 'Efetuou a medição de sinal (CA e CB)?', critico: false },
  { id: 11, pergunta: 'Utilizou corretamente o anel de vedação?', critico: false },
  { id: 12, pergunta: 'Identificou corretamente o cabo?', critico: false },
  { id: 13, pergunta: 'Realizou corretamente a cintagem do poste e a amarração?', critico: true },
  { id: 14, pergunta: 'Instalou corretamente o Cable Isolator?', critico: false },
  { id: 15, pergunta: 'Aplicou corretamente o torque nas conexões do MDU, passivos e equipamentos?', critico: false },
  { id: 16, pergunta: 'Explicou corretamente a importância do Mini Isolator?', critico: false },
  { id: 17, pergunta: 'Executou corretamente a distribuição do sinal do cabo coaxial?', critico: false },
  { id: 18, pergunta: 'Efetuou o reset de fábrica do decoder e realizou a configuração da base?', critico: false },
  { id: 19, pergunta: 'Todos os pontos de TV ficaram com níveis de sinal dentro do padrão?', critico: false },
  { id: 20, pergunta: 'Configurou e explicou a utilização do controle remoto?', critico: false },
  { id: 21, pergunta: 'Retirou o bloqueio por idade e alterou a senha de compra?', critico: false },
  { id: 22, pergunta: 'Configurou corretamente TV e Decoder (HDMI, resolução, formato e áudio)?', critico: true },
  { id: 23, pergunta: 'Explicou o NOW demonstrando conteúdos gratuitos?', critico: false },
  { id: 24, pergunta: 'Explicou os recursos de gravação?', critico: false },
  { id: 25, pergunta: 'Demonstrou o Replay TV?', critico: false },
  { id: 26, pergunta: 'Explicou a função Auto Hit?', critico: false },
  { id: 27, pergunta: 'Explicou a função Autodesligar?', critico: false },
  { id: 28, pergunta: 'Realizou o Valida Retorno?', critico: false },
  { id: 29, pergunta: 'Apresentou o App Claro TV+ e explicou cadastro e acesso?', critico: false },
  { id: 30, pergunta: 'Confeccionou corretamente o conector RJ45?', critico: true },
  { id: 31, pergunta: 'Definiu corretamente o local do eMTA e analisou a potência do Wi-Fi?', critico: false },
  { id: 32, pergunta: 'Acessou as propriedades do eMTA e explicou sobre senha forte?', critico: false },
  { id: 33, pergunta: 'Configurou corretamente o Wi-Fi (Band Steering e redes 2.4 e 5 GHz)?', critico: true },
  { id: 34, pergunta: 'Explicou sobre a rede IoT?', critico: false },
  { id: 35, pergunta: 'Informou sobre compatibilidade dos dispositivos do cliente?', critico: false },
  { id: 36, pergunta: 'Realizou teste de velocidade pelo Brasil Banda Larga/Speedtest?', critico: false },
  { id: 37, pergunta: 'Verificou TX/RX/SNR pelo site niveis.virtua.com.br?', critico: false },
  { id: 38, pergunta: 'Verificou TX/RX/SNR pela página interna do eMTA?', critico: false },
  { id: 39, pergunta: 'Realizou teste de velocidade e cobertura Wi-Fi junto ao cliente?', critico: false },
  { id: 40, pergunta: 'Realizou atendimento consultivo apresentando opções de contratação?', critico: false },
  { id: 41, pergunta: 'Confeccionou corretamente os conectores telefônicos RJ11?', critico: false },
  { id: 42, pergunta: 'Explicou os Serviços Inteligentes Claro Fone e Portabilidade?', critico: false },
  { id: 43, pergunta: 'Confirmou o funcionamento do Claro Fone informando o número ao cliente?', critico: false },
  { id: 44, pergunta: 'Confirmou que o firmware dos equipamentos está atualizado?', critico: false },
  { id: 45, pergunta: 'Solicitou documento e realizou upload na OS Digital?', critico: false },
  { id: 46, pergunta: 'Preencheu corretamente a Ordem de Serviço Digital e coletou a assinatura do cliente?', critico: false },
  { id: 47, pergunta: 'Finalizou o atendimento no PDA e lançou corretamente os materiais?', critico: false },
  { id: 48, pergunta: 'Informou sobre os canais de autoatendimento (Minha Claro, WhatsApp e Site)?', critico: false },
  { id: 49, pergunta: 'Realizou a autoinspeção?', critico: false },
  { id: 50, pergunta: 'Informou sobre o TNPS e solicitou a avaliação do cliente?', critico: false }
];

export function calcularResultadoHFC24(
  responses: Record<number, ChecklistValue>,
  notaTeorica?: number
): AvaliacaoResult {
  let totalAvaliado = 0;
  let acertos = 0;
  const itensNaoRealizados: number[] = [];
  const itensCriticosNaoRealizados: number[] = [];

  HFC_24_ITEMS.forEach((item) => {
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

export const GPON_CAPACITACAO_GROUPS: HFCGroup[] = [
  { id: 1, nome: 'Processos', startId: 1, endId: 8, total: 8 },
  { id: 2, nome: 'Instalação Física', startId: 9, endId: 17, total: 9 },
  { id: 3, nome: 'Decodificador', startId: 18, endId: 26, total: 9 },
  { id: 4, nome: 'Banda Larga', startId: 27, endId: 35, total: 9 },
  { id: 5, nome: 'Telefone', startId: 36, endId: 38, total: 3 },
  { id: 6, nome: 'Aplicativos', startId: 39, endId: 44, total: 6 },
  { id: 7, nome: 'Atendimento Consultivo / TNPS', startId: 45, endId: 46, total: 2 },
];

export const GPON_CAPACITACAO_ITEMS: ChecklistItem[] = [
  { id: 1, pergunta: 'Atualizou o status no PDA (Rota para início)?', critico: false },
  { id: 2, pergunta: 'Se apresentou ao cliente e verificou se ele recebeu a mensagem via aplicativo?', critico: false },
  { id: 3, pergunta: 'Informou o código de segurança quando solicitado?', critico: false },
  { id: 4, pergunta: 'Confirmou com o cliente os produtos antes de entrar na residência?', critico: false },
  { id: 5, pergunta: 'Explicou ao cliente sobre a utilização do propé?', critico: false },
  { id: 6, pergunta: 'Confirmou o local de instalação dos equipamentos?', critico: false },
  { id: 7, pergunta: 'Combinou com o cliente a passagem do cabo e os possíveis furos?', critico: false },
  { id: 8, pergunta: 'Realizou APR e ativou o botão escada através do App Técnico Nota 10?', critico: false },
  { id: 9, pergunta: 'Confecção de Conectores Correta (utilizou as ferramentas adequadamente)?', critico: true },
  { id: 10, pergunta: 'Instalou Autofusão / Protetor no Conector?', critico: false },
  { id: 11, pergunta: 'Realizou medição de sinal na NAP?', critico: false },
  { id: 12, pergunta: 'Instalou corretamente o ECAM na NAP?', critico: false },
  { id: 13, pergunta: 'Identificou corretamente o cabo?', critico: false },
  { id: 14, pergunta: 'Realizou a cintagem do poste?', critico: true },
  { id: 15, pergunta: 'Realizou corretamente a passagem do cabo óptico (AGF, SRDO, SDO etc.)?', critico: false },
  { id: 16, pergunta: 'Instalou corretamente o PTO?', critico: false },
  { id: 17, pergunta: 'Explicou ao cliente sobre a fragilidade do cordão óptico?', critico: false },
  { id: 18, pergunta: 'Realizou reset de fábrica e instalação do decoder via Wi-Fi 5 GHz?', critico: false },
  { id: 19, pergunta: 'Verificou se o decoder possui Status e IP corretamente?', critico: false },
  { id: 20, pergunta: 'Configurou e explicou a utilização básica do controle remoto?', critico: false },
  { id: 21, pergunta: 'Retirou bloqueio por idade e alterou senha de compra?', critico: false },
  { id: 22, pergunta: 'Configurou corretamente TV e Decoder (HDMI, resolução, formato de exibição e sistema de áudio)?', critico: true },
  { id: 23, pergunta: 'Explicou os recursos de gravação (Agendar gravação)?', critico: false },
  { id: 24, pergunta: 'Demonstrou o Replay TV?', critico: false },
  { id: 25, pergunta: 'Explicou a função Autodesligar?', critico: false },
  { id: 26, pergunta: 'Apresentou o App Claro TV+ ao cliente?', critico: false },
  { id: 27, pergunta: 'Confecção do Conector RJ45 está correta?', critico: true },
  { id: 28, pergunta: 'Definiu corretamente o local da ONT e analisou a cobertura Wi-Fi?', critico: false },
  { id: 29, pergunta: 'Acessou as propriedades da ONT e explicou sobre senha forte?', critico: false },
  { id: 30, pergunta: 'Configurou corretamente o Wi-Fi (Band Steering e Redes 2.4 e 5 GHz)?', critico: true },
  { id: 31, pergunta: 'Explicou ao cliente sobre a rede IoT?', critico: false },
  { id: 32, pergunta: 'Informou sobre compatibilidade dos dispositivos?', critico: false },
  { id: 33, pergunta: 'Realizou teste de velocidade?', critico: false },
  { id: 34, pergunta: 'Verificou os níveis TX e RX pela ONT ou niveis.virtua.com.br?', critico: false },
  { id: 35, pergunta: 'Realizou teste de velocidade e cobertura Wi-Fi junto ao cliente?', critico: false },
  { id: 36, pergunta: 'Confecção dos conectores RJ11 está correta?', critico: false },
  { id: 37, pergunta: 'Explicou Claro Fone, Serviços Inteligentes e Portabilidade?', critico: false },
  { id: 38, pergunta: 'Confirmou o funcionamento do Claro Fone informando o número?', critico: false },
  { id: 39, pergunta: 'Confirmou que o firmware está atualizado?', critico: false },
  { id: 40, pergunta: 'Solicitou documento e realizou upload na OS Digital?', critico: false },
  { id: 41, pergunta: 'Preencheu corretamente a Ordem de Serviço Digital e coletou assinatura?', critico: false },
  { id: 42, pergunta: 'Finalizou o atendimento no PDA e lançou os materiais utilizados?', critico: false },
  { id: 43, pergunta: 'Informou os canais de Autoatendimento (Minha Claro, WhatsApp e Site)?', critico: false },
  { id: 44, pergunta: 'Realizou a Autoinspeção?', critico: false },
  { id: 45, pergunta: 'Informou sobre o TNPS e solicitou a avaliação?', critico: false },
  { id: 46, pergunta: 'Explicou corretamente as notas do TNPS?', critico: false },
];

export function calcularResultadoGPONCapacitacao(
  responses: Record<number, ChecklistValue>,
  notaTeorica?: number
): AvaliacaoResult {
  let totalAvaliado = 0;
  let acertos = 0;
  const itensNaoRealizados: number[] = [];
  const itensCriticosNaoRealizados: number[] = [];

  GPON_CAPACITACAO_ITEMS.forEach((item) => {
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

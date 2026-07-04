import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowRight,
  Save, 
  CheckCircle, 
  XCircle,
  FileText, 
  User, 
  Hash, 
  Building2, 
  MapPin, 
  UserCheck, 
  Calendar, 
  Sliders, 
  AlertTriangle,
  Sparkles,
  Wifi,
  Cpu,
  Tv,
  Check,
  X,
  Play,
  ClipboardList,
  Award,
  AlertCircle,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { Avaliacao, CertificacaoType, AvaliacaoStatus, ChecklistValue, CQ, PerfilPermitido, DynamicCertificacao } from '../types';
import { 
  getDynamicChecklistItems, 
  getDynamicCertificacoes,
  getGroupsForCertificacao,
  calcularResultadoDinamico
} from '../data/dynamicChecklist';

interface FormViewProps {
  onSave: (
    formData: {
      nomeTecnico: string;
      matricula: string;
      empresa: string;
      cidadeBase: string;
      nomeCQ: string;
      data: string;
      tipoCertificacao: CertificacaoType;
      observacao?: string;
      notaTeorica?: number;
    }, 
    status: AvaliacaoStatus,
    checklistResponses: Record<number, ChecklistValue>
  ) => void;
  onCancel: () => void;
  initialData: Avaliacao | null;
  profile?: 'analista' | 'cq';
}

export default function FormView({ onSave, onCancel, initialData, profile }: FormViewProps) {
  // Current active step: 1, 2, 3, or 4
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Theoretical exam states
  const [notaTeoricaInput, setNotaTeoricaInput] = useState('');
  const [teoricaError, setTeoricaError] = useState('');
  const [activeCqView, setActiveCqView] = useState<'teorica' | 'checklist' | 'reprovadoTeorica'>('teorica');

  const parseNotaTeorica = (val: string): number | null => {
    const normalized = val.trim().replace(',', '.');
    if (normalized === '') return null;
    const num = parseFloat(normalized);
    if (isNaN(num)) return null;
    if (num < 0 || num > 10) return null;
    return num;
  };

  // State for form fields
  const [nomeTecnico, setNomeTecnico] = useState('');
  const [matricula, setMatricula] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [cidadeBase, setCidadeBase] = useState('');
  const [nomeCQ, setNomeCQ] = useState('');
  const [data, setData] = useState('');
  const [tipoCertificacao, setTipoCertificacao] = useState<CertificacaoType | ''>('');
  const [observacao, setObservacao] = useState('');

  // Checklist state
  const [checklistResponses, setChecklistResponses] = useState<Record<number, ChecklistValue>>({});
  const [activeHFCGroupId, setActiveHFCGroupId] = useState<number>(1);

  // Validation error states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // CQs list state for scheduling
  const [cqs, setCqs] = useState<CQ[]>([]);

  // Dynamic certifications state
  const [dynamicCerts, setDynamicCerts] = useState<DynamicCertificacao[]>([]);
  const [certificacaoPerfilRules, setCertificacaoPerfilRules] = useState<Record<string, PerfilPermitido>>({});

  // Load certification profile configuration rules and active certs
  useEffect(() => {
    const certs = getDynamicCertificacoes();
    setDynamicCerts(certs.filter(c => c.ativa));

    const savedRules = localStorage.getItem('claro_cq_certificacao_perfis');
    if (savedRules) {
      try {
        setCertificacaoPerfilRules(JSON.parse(savedRules));
      } catch (e) {
        console.error('Error loading certification rules', e);
      }
    } else {
      // Seed initial rules from certifications
      const initialRules: Record<string, PerfilPermitido> = {};
      certs.forEach(c => {
        initialRules[c.nome] = c.perfilPermitido;
      });
      setCertificacaoPerfilRules(initialRules);
      localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(initialRules));
    }
  }, []);

  const handleUpdateCertificacaoRule = (cert: CertificacaoType, rule: PerfilPermitido) => {
    const updated = {
      ...certificacaoPerfilRules,
      [cert]: rule
    };
    setCertificacaoPerfilRules(updated);
    localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(updated));

    // Clear selected CQ/Analista if they do not match the new rule
    const activeCqs = cqs.filter(cq => {
      if (cq.status !== 'Ativo') return false;
      const cqProfile = cq.perfil || 'CQ';
      if (rule === 'Apenas CQ') return cqProfile === 'CQ';
      if (rule === 'Apenas Analista') return cqProfile === 'Analista';
      return true;
    });
    const matches = activeCqs.some(cq => cq.nome === nomeCQ);
    if (!matches) {
      setNomeCQ('');
    }
  };

  // Load CQs from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('claro_cq_cadastrados');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure legacy CQs get a default profile 'CQ' if missing
        const fixed = parsed.map((item: any) => ({
          ...item,
          perfil: item.perfil || 'CQ'
        }));
        setCqs(fixed);
      } catch (e) {
        console.error('Error loading CQs in FormView', e);
      }
    } else {
      const defaultCQs: CQ[] = [
        {
          id: 'cq-1',
          nome: 'Pedro Henrique Santos',
          perfil: 'CQ',
          cidadeBase: 'São Paulo - Base Leste',
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cq-2',
          nome: 'Juliana Mendes Silva',
          perfil: 'CQ',
          cidadeBase: 'Campinas - Base Norte',
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cq-3',
          nome: 'Rodrigo Antunes Costa',
          perfil: 'CQ',
          cidadeBase: 'Rio de Janeiro - Base Sul',
          status: 'Inativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'cq-4',
          nome: 'Thiago Anderson',
          perfil: 'Analista',
          cidadeBase: 'São Paulo - Base Centro',
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];
      setCqs(defaultCQs);
      localStorage.setItem('claro_cq_cadastrados', JSON.stringify(defaultCQs));
    }
  }, []);

  // Initialize form if editing
  useEffect(() => {
    if (initialData) {
      setNomeTecnico(initialData.nomeTecnico);
      setMatricula(initialData.matricula);
      setEmpresa(initialData.empresa);
      setCidadeBase(initialData.cidadeBase);
      setNomeCQ(initialData.nomeCQ || '');
      setData(initialData.data);
      setTipoCertificacao(initialData.tipoCertificacao);
      setChecklistResponses(initialData.checklistResponses || {});
      setObservacao(initialData.observacao || '');
      
      if (initialData.notaTeorica !== undefined) {
        setNotaTeoricaInput(String(initialData.notaTeorica).replace('.', ','));
        setActiveCqView(initialData.notaTeorica < 7 ? 'reprovadoTeorica' : 'checklist');
      } else {
        setNotaTeoricaInput('');
        setActiveCqView('teorica');
      }

      if (profile === 'cq') {
        setStep(3);
      } else {
        setStep(1);
      }
    } else {
      // Set default date as today (YYYY-MM-DD in local timezone)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setData(`${year}-${month}-${day}`);
      setChecklistResponses({});
      setNomeCQ('');
      setObservacao('');
      setNotaTeoricaInput('');
      setActiveCqView('teorica');
      
      if (profile === 'cq') {
        setStep(3);
      } else {
        setStep(1);
      }
    }
  }, [initialData, profile]);

  // When changing certification, clear checklist or reset
  const handleCertificacaoChange = (cert: CertificacaoType) => {
    setTipoCertificacao(cert);
    setActiveHFCGroupId(1);
    if (cert !== 'GPON Veterano' && cert !== 'HFC Capacitação') {
      setChecklistResponses({});
    } else if (initialData && initialData.tipoCertificacao === cert) {
      setChecklistResponses(initialData.checklistResponses || {});
    } else {
      setChecklistResponses({});
    }

    // Dynamic filtering of CQs: check if current CQ is valid for the new cert's rule
    if (cert) {
      const savedRules = localStorage.getItem('claro_cq_certificacao_perfis');
      let rule: PerfilPermitido = 'CQ ou Analista';
      if (savedRules) {
        try {
          const rules = JSON.parse(savedRules);
          rule = rules[cert] || rule;
        } catch (e) {}
      } else {
        if (cert === 'GPON Veterano') rule = 'Apenas CQ';
        else if (cert === 'GPON Capacitação') rule = 'Apenas Analista';
      }

      const activeCqs = cqs.filter(cq => {
        if (cq.status !== 'Ativo') return false;
        const cqProfile = cq.perfil || 'CQ';
        if (rule === 'Apenas CQ') return cqProfile === 'CQ';
        if (rule === 'Apenas Analista') return cqProfile === 'Analista';
        return true;
      });
      const matches = activeCqs.some(cq => cq.nome === nomeCQ);
      if (!matches) {
        setNomeCQ('');
      }
    }

    // Clear tech errors
    if (errors.tipoCertificacao) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated.tipoCertificacao;
        return updated;
      });
    }
  };

  // Quick helper to fill test data
  const handleFillTestData = () => {
    const technicianNames = [
      'Carlos Eduardo Souza', 'Guilherme Santos', 'Rodrigo Alencar', 
      'Marcos André Lima', 'Thiago da Silva', 'Felipe Albuquerque'
    ];
    const companies = ['Claro S/A (Próprio)', 'Terceirizada Delta', 'Terceirizada Alpha', 'Leste Telecom'];
    const bases = ['Rio de Janeiro - Base Oeste', 'São Paulo - Base Centro', 'Belo Horizonte - Leste', 'Campinas - Sul'];
    
    const activeCerts = dynamicCerts.map(c => c.nome);
    const randomCert = activeCerts.length > 0 ? activeCerts[Math.floor(Math.random() * activeCerts.length)] : 'GPON Veterano';
    const rule = certificacaoPerfilRules[randomCert] || 'CQ ou Analista';

    const filteredActiveCqs = cqs.filter(cq => {
      if (cq.status !== 'Ativo') return false;
      const cqProfile = cq.perfil || 'CQ';
      if (rule === 'Apenas CQ') return cqProfile === 'CQ';
      if (rule === 'Apenas Analista') return cqProfile === 'Analista';
      return true;
    });

    const randomCQ = filteredActiveCqs.length > 0 ? filteredActiveCqs[Math.floor(Math.random() * filteredActiveCqs.length)].nome : '';
    const randomTec = technicianNames[Math.floor(Math.random() * technicianNames.length)];
    const randomComp = companies[Math.floor(Math.random() * companies.length)];
    const randomBase = bases[Math.floor(Math.random() * bases.length)];
    const randomMatricula = 'TR' + Math.floor(100000 + Math.random() * 900000);

    setNomeTecnico(randomTec);
    setMatricula(randomMatricula);
    setEmpresa(randomComp);
    setCidadeBase(randomBase);
    setNomeCQ(randomCQ);
    
    // Fill certification and checklist responses dynamically
    setTipoCertificacao(randomCert);
    
    const simulated: Record<number, ChecklistValue> = {};
    const certItems = getDynamicChecklistItems().filter(item => item.certificacao === randomCert && item.ativo);
    
    certItems.forEach(item => {
      const rand = Math.random();
      if (rand < 0.88) {
        simulated[item.id] = 'Fez';
      } else if (rand < 0.08) {
        simulated[item.id] = 'NaoFez';
      } else {
        simulated[item.id] = 'NA';
      }
    });
    setChecklistResponses(simulated);
    
    // Clear errors
    setErrors({});
  };

  // Handle single item response change
  const handleResponseChange = (itemId: number, value: ChecklistValue) => {
    setChecklistResponses(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  // Validate Step 1 fields before saving or advancing
  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nomeTecnico.trim()) newErrors.nomeTecnico = 'Nome do técnico é obrigatório';
    if (!matricula.trim()) newErrors.matricula = 'Matrícula é obrigatória';
    if (!empresa.trim()) newErrors.empresa = 'Empresa é obrigatória';
    if (!cidadeBase.trim()) newErrors.cidadeBase = 'Cidade/Base é obrigatória';
    if (!data) newErrors.data = 'Data da avaliação é obrigatória';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Pure validation check for render-time disability checks without triggering state updates
  const isStep1Valid = (): boolean => {
    return !!(
      nomeTecnico.trim() &&
      matricula.trim() &&
      empresa.trim() &&
      cidadeBase.trim() &&
      data
    );
  };

  // Calculate stats for current active certification dynamically
  const parsedTeorica = parseNotaTeorica(notaTeoricaInput);
  const allDynamicItems = getDynamicChecklistItems();
  const activeItems = allDynamicItems.filter(item => item.certificacao === tipoCertificacao && item.ativo);
  const activeGroups = getGroupsForCertificacao(tipoCertificacao, allDynamicItems);
  const isGrouped = activeGroups.length > 1;
  const activeStats = activeItems.length > 0 ? calcularResultadoDinamico(activeItems, checklistResponses, parsedTeorica ?? undefined) : null;
  const totalItems = activeItems.length;
  const answeredCount = Object.keys(checklistResponses).length;
  const missingResponsesCount = activeItems.filter(item => checklistResponses[item.id] === undefined).length;
  const hasUnanswered = missingResponsesCount > 0;

  const handleNextStep1 = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleNextStep2 = () => {
    if (!tipoCertificacao) {
      setErrors({ tipoCertificacao: 'Selecione um tipo de certificação' });
      return;
    }
    setErrors({});
    setStep(3);
  };

  const handleNextStep3 = () => {
    // Navigate to stage 4 (Resultado) - block if there are unanswered items
    if (hasUnanswered) {
      return;
    }
    setStep(4);
  };

  // Final Action: Save Evaluation
  const handleFinalSave = (status: AvaliacaoStatus) => {
    if (profile !== 'cq') {
      if (!validateStep1() || !tipoCertificacao) {
        setStep(1);
        return;
      }
    }

    const parsedTeorica = parseNotaTeorica(notaTeoricaInput);
    onSave({
      nomeTecnico: nomeTecnico.trim(),
      matricula: matricula.trim().toUpperCase(),
      empresa: empresa.trim(),
      cidadeBase: cidadeBase.trim(),
      nomeCQ: nomeCQ.trim(),
      data,
      tipoCertificacao: tipoCertificacao as CertificacaoType,
      observacao: observacao.trim(),
      notaTeorica: parsedTeorica !== null ? parsedTeorica : undefined
    }, status, checklistResponses);
  };

  const handleRestart = () => {
    if (profile === 'cq') {
      onCancel();
      return;
    }
    // Clear responses and go back to step 1
    setNomeTecnico('');
    setMatricula('');
    setEmpresa('');
    setCidadeBase('');
    setNomeCQ('');
    setTipoCertificacao('');
    setChecklistResponses({});
    setErrors({});
    setStep(1);
  };

  if (profile === 'analista') {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6 animate-fade-in" id="analista-form-view">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="flex items-center space-x-1.5 text-slate-500 hover:text-claro-dark transition-colors font-bold text-sm py-1.5 px-2.5 -ml-2.5 rounded-xl hover:bg-slate-100 cursor-pointer"
            id="btn-analista-form-back"
          >
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>

          <button
            onClick={handleFillTestData}
            type="button"
            className="flex items-center space-x-1 text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <Sparkles size={12} className="text-amber-500" />
            <span>Simular Dados</span>
          </button>
        </div>

        {/* Form Title */}
        <div className="space-y-1 text-left">
          <h2 className="text-2xl font-extrabold text-claro-dark tracking-tight">
            {initialData ? 'Editar Agendamento' : 'Agendar Nova Avaliação'}
          </h2>
          <p className="text-slate-500 text-xs font-semibold">
            Preencha os dados do técnico e selecione a certificação prática para agendar.
          </p>
        </div>

        {/* Fields */}
        <div className="bg-white rounded-3xl border border-claro-border p-6 shadow-sm space-y-4 text-left">
          
          {/* Nome do Técnico */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Nome do Técnico <span className="text-claro-red">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User size={16} />
              </div>
              <input
                type="text"
                placeholder="Nome completo do técnico"
                value={nomeTecnico}
                onChange={(e) => setNomeTecnico(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                  errors.nomeTecnico 
                    ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                    : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                }`}
              />
            </div>
            {errors.nomeTecnico && <p className="text-xs text-red-500 font-bold">{errors.nomeTecnico}</p>}
          </div>

          {/* Login/Matrícula */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Login <span className="text-claro-red">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Hash size={16} />
              </div>
              <input
                type="text"
                placeholder="Ex: TR123456"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all uppercase focus:outline-none focus:ring-2 ${
                  errors.matricula 
                    ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                    : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                }`}
              />
            </div>
            {errors.matricula && <p className="text-xs text-red-500 font-bold">{errors.matricula}</p>}
          </div>

          {/* Empresa */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Empresa <span className="text-claro-red">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Claro S/A (Próprio) ou Serede"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                errors.empresa 
                  ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                  : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
              }`}
            />
            {errors.empresa && <p className="text-xs text-red-500 font-bold">{errors.empresa}</p>}
          </div>

          {/* Cidade/Base */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Cidade / Base <span className="text-claro-red">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: São Paulo - Base Leste"
              value={cidadeBase}
              onChange={(e) => setCidadeBase(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                errors.cidadeBase 
                  ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                  : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
              }`}
            />
            {errors.cidadeBase && <p className="text-xs text-red-500 font-bold">{errors.cidadeBase}</p>}
          </div>

          {/* Data da Avaliação */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Data da Avaliação <span className="text-claro-red">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar size={16} />
              </div>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                  errors.data 
                    ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                    : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                }`}
              />
            </div>
            {errors.data && <p className="text-xs text-red-500 font-bold">{errors.data}</p>}
          </div>

          {/* Tipo de Certificação */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Tipo de Certificação <span className="text-claro-red">*</span>
            </label>
            <select
              value={tipoCertificacao}
              onChange={(e) => handleCertificacaoChange(e.target.value as CertificacaoType)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white transition-all focus:outline-none focus:ring-2 ${
                errors.tipoCertificacao 
                  ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                  : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
              }`}
            >
              <option value="">Selecione uma certificação</option>
              {dynamicCerts.map((cert) => (
                <option key={cert.id} value={cert.nome}>
                  {cert.nome}
                </option>
              ))}
            </select>
            {errors.tipoCertificacao && <p className="text-xs text-red-500 font-bold">{errors.tipoCertificacao}</p>}
          </div>

          {/* Regras das Certificações: Perfil Permitido */}
          {tipoCertificacao && (
            <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl space-y-2 text-left animate-fade-in">
              <span className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Configuração da Certificação ({tipoCertificacao})
              </span>
              <span className="block text-xs font-bold text-slate-700">
                Perfil permitido para realizar esta certificação:
              </span>
              
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {(['Apenas CQ', 'Apenas Analista', 'CQ ou Analista'] as PerfilPermitido[]).map((rule) => {
                  const isSelected = (certificacaoPerfilRules[tipoCertificacao] || 'CQ ou Analista') === rule;
                  return (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => handleUpdateCertificacaoRule(tipoCertificacao, rule)}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs font-extrabold'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-[10px]">
                        {rule === 'Apenas CQ' ? '🟥' : rule === 'Apenas Analista' ? '🟦' : '⚙️'}
                      </span>
                      <span>{rule}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-400 font-medium leading-tight">
                Essa configuração define automaticamente quem aparecerá no dropdown de avaliadores abaixo.
              </p>
            </div>
          )}

          {/* Avaliador Responsável (Obrigatório, Filtrado Dinamicamente) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              {(() => {
                const rule = tipoCertificacao ? (certificacaoPerfilRules[tipoCertificacao] || 'CQ ou Analista') : 'CQ ou Analista';
                if (rule === 'Apenas CQ') return 'Avaliador CQ Responsável';
                if (rule === 'Apenas Analista') return 'Avaliador Analista Responsável';
                return 'Avaliador Responsável';
              })()} <span className="text-claro-red">*</span>
            </label>
            {(() => {
              const rule = tipoCertificacao ? (certificacaoPerfilRules[tipoCertificacao] || 'CQ ou Analista') : 'CQ ou Analista';
              const activeCqs = cqs.filter(cq => {
                if (cq.status !== 'Ativo') return false;
                const cqProfile = cq.perfil || 'CQ';
                if (rule === 'Apenas CQ') return cqProfile === 'CQ';
                if (rule === 'Apenas Analista') return cqProfile === 'Analista';
                return true;
              });

              if (activeCqs.length === 0) {
                return (
                  <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-2.5">
                    <AlertCircle size={18} className="text-claro-red shrink-0 mt-0.5" />
                    <div className="text-xs font-bold text-red-800">
                      Nenhum avaliador ativo com o perfil ({rule}) cadastrado. Cadastre um avaliador no menu "Gerenciar Avaliadores" primeiro.
                    </div>
                  </div>
                );
              }

              const currentCQExists = activeCqs.some(cq => cq.nome === nomeCQ);
              const foundInInactive = !currentCQExists && cqs.find(cq => cq.nome === nomeCQ);
              const dropdownCqs = foundInInactive ? [...activeCqs, foundInInactive] : activeCqs;

              return (
                <select
                  value={nomeCQ}
                  onChange={(e) => setNomeCQ(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm bg-white transition-all focus:outline-none focus:ring-2 ${
                    errors.nomeCQ 
                      ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                      : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                  }`}
                >
                  <option value="">Selecione um Avaliador</option>
                  {dropdownCqs.map((cq) => (
                    <option key={cq.id} value={cq.nome}>
                      {cq.nome} • {cq.cidadeBase} ({cq.perfil || 'CQ'})
                    </option>
                  ))}
                </select>
              );
            })()}
            {errors.nomeCQ && <p className="text-xs text-red-500 font-bold">{errors.nomeCQ}</p>}
          </div>

          {/* Observação (Opcional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Observação <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              placeholder="Notas ou instruções especiais para a avaliação"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-claro-red"
            />
          </div>

        </div>

        {/* Save Button */}
        <button
          onClick={() => {
            const hasErrors: Record<string, string> = {};
            if (!nomeTecnico.trim()) hasErrors.nomeTecnico = 'Nome do técnico é obrigatório';
            if (!matricula.trim()) hasErrors.matricula = 'Matrícula é obrigatória';
            if (!empresa.trim()) hasErrors.empresa = 'Empresa é obrigatória';
            if (!cidadeBase.trim()) hasErrors.cidadeBase = 'Cidade/Base é obrigatória';
            if (!data) hasErrors.data = 'Data é obrigatória';
            if (!tipoCertificacao) hasErrors.tipoCertificacao = 'Selecione uma certificação';
            
            const activeCqsCount = cqs.filter(cq => cq.status === 'Ativo').length;
            if (activeCqsCount === 0) {
              hasErrors.nomeCQ = 'Cadastre pelo menos um CQ ativo antes de agendar.';
            } else if (!nomeCQ.trim()) {
              hasErrors.nomeCQ = 'Selecione o Avaliador CQ responsável';
            }
            
            setErrors(hasErrors);
            if (Object.keys(hasErrors).length === 0) {
              onSave({
                nomeTecnico: nomeTecnico.trim(),
                matricula: matricula.trim().toUpperCase(),
                empresa: empresa.trim(),
                cidadeBase: cidadeBase.trim(),
                nomeCQ: nomeCQ.trim(),
                data,
                tipoCertificacao: tipoCertificacao as CertificacaoType,
                observacao: observacao.trim(),
                notaTeorica: initialData?.notaTeorica
              }, 'AGENDADA', {});
            }
          }}
          className="w-full py-4.5 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-black rounded-2xl text-base transition-all duration-150 shadow-md border-b-4 border-red-800 active:border-b-0 flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Save size={18} />
          <span>Salvar Agendamento</span>
        </button>
      </div>
    );
  }

  const isViewingChecklist = step === 3 && (profile !== 'cq' || activeCqView === 'checklist');

  // Adjust body/main layout and lock scrolling when viewing checklist
  useEffect(() => {
    if (isViewingChecklist) {
      document.body.style.overflow = 'hidden';
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.style.overflow = 'hidden';
        mainEl.style.height = 'calc(100vh - 64px)';
        mainEl.style.paddingBottom = '0';
      }
    } else {
      document.body.style.overflow = '';
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.style.overflow = '';
        mainEl.style.height = '';
        mainEl.style.paddingBottom = '';
      }
    }
    return () => {
      document.body.style.overflow = '';
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.style.overflow = '';
        mainEl.style.height = '';
        mainEl.style.paddingBottom = '';
      }
    };
  }, [isViewingChecklist]);

  return (
    <div 
      className={`mx-auto px-4 transition-all duration-300 flex flex-col ${
        isViewingChecklist 
          ? 'max-w-7xl w-full h-[calc(100vh-64px)] py-3 overflow-hidden gap-3.5' 
          : 'max-w-xl py-6 space-y-6'
      }`} 
      id="form-view-container"
    >
      
      {/* Form Navigation Header */}
      {!isViewingChecklist && (
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="flex items-center space-x-1.5 text-slate-500 hover:text-claro-dark transition-colors font-bold text-sm py-1.5 px-2.5 -ml-2.5 rounded-xl hover:bg-slate-100 cursor-pointer"
            id="btn-form-back"
          >
            <ArrowLeft size={16} />
            <span>Sair</span>
          </button>

          {/* Dynamic Mock Simulating Sparkles button - useful in step 1 or 2 */}
          {step < 3 && (
            <button
              onClick={handleFillTestData}
              className="flex items-center space-x-1 text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-sm"
              id="btn-fill-test"
            >
              <Sparkles size={12} className="text-amber-500" />
              <span>Simular Dados</span>
            </button>
          )}
        </div>
      )}

      {/* Elegant Progress Stepper Indicator */}
      {(!profile || profile !== 'cq') && !isViewingChecklist && (
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between relative">
            {/* Connector Line */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 -z-0"></div>
            <div 
              className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-claro-red transition-all duration-300 -z-0"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            ></div>

            {/* Stepper Buttons */}
            {[
              { num: 1, label: 'Cadastro', icon: User },
              { num: 2, label: 'Tecnologia', icon: Sliders },
              { num: 3, label: 'Checklist', icon: ClipboardList },
              { num: 4, label: 'Resultado', icon: Award }
            ].map((item) => {
              const Icon = item.icon;
              const isCompleted = step > item.num;
              const isActive = step === item.num;
              return (
                <div key={item.num} className="flex flex-col items-center relative z-10">
                  <button
                    type="button"
                    disabled={item.num > step && !isStep1Valid()}
                    onClick={() => {
                      if (item.num === 1) setStep(1);
                      if (item.num === 2 && validateStep1()) setStep(2);
                      if (item.num === 3 && validateStep1() && tipoCertificacao) setStep(3);
                      if (item.num === 4 && validateStep1() && tipoCertificacao) setStep(4);
                    }}
                    className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? 'bg-claro-red border-claro-red text-white ring-4 ring-red-500/10 scale-110 shadow-md font-bold'
                        : isCompleted
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {isCompleted ? <Check size={16} className="stroke-[3]" /> : <Icon size={15} />}
                  </button>
                  <span className={`text-[10px] font-extrabold mt-1.5 uppercase tracking-wider ${
                    isActive ? 'text-claro-red font-black' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Single-Column Content Viewport */}
      <div className={`flex flex-col ${isViewingChecklist ? 'flex-grow overflow-hidden h-full' : 'min-h-[380px]'}`}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 flex-grow"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-claro-dark tracking-tight">
                  Dados Gerais da Avaliação
                </h2>
                <p className="text-slate-500 text-xs">
                  Insira as credenciais do técnico de campo e dados da vistoria técnica.
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-claro-border p-6 shadow-sm space-y-4">
                {/* Nome do Técnico */}
                <div className="space-y-1.5" id="field-nomeTecnico">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nome do Técnico <span className="text-claro-red">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="Nome completo do técnico"
                      value={nomeTecnico}
                      onChange={(e) => setNomeTecnico(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
                        errors.nomeTecnico 
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                      }`}
                    />
                  </div>
                  {errors.nomeTecnico && (
                    <p className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} /> {errors.nomeTecnico}
                    </p>
                  )}
                </div>

                {/* Matrícula */}
                <div className="space-y-1.5" id="field-matricula">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Matrícula <span className="text-claro-red">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Hash size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: TR123456"
                      value={matricula}
                      onChange={(e) => setMatricula(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 uppercase ${
                        errors.matricula 
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                      }`}
                    />
                  </div>
                  {errors.matricula && (
                    <p className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} /> {errors.matricula}
                    </p>
                  )}
                </div>

                {/* Empresa */}
                <div className="space-y-1.5" id="field-empresa">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Empresa Parceira <span className="text-claro-red">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building2 size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: Claro S/A ou Terceirizada"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
                        errors.empresa 
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                      }`}
                    />
                  </div>
                  {errors.empresa && (
                    <p className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} /> {errors.empresa}
                    </p>
                  )}
                </div>

                {/* Cidade / Base */}
                <div className="space-y-1.5" id="field-cidadeBase">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Cidade / Base <span className="text-claro-red">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MapPin size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="Ex: Rio de Janeiro - Base Oeste"
                      value={cidadeBase}
                      onChange={(e) => setCidadeBase(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
                        errors.cidadeBase 
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                      }`}
                    />
                  </div>
                  {errors.cidadeBase && (
                    <p className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} /> {errors.cidadeBase}
                    </p>
                  )}
                </div>

                <div className="h-px bg-slate-100 my-1"></div>

                {/* CQ Avaliador */}
                <div className="space-y-1.5" id="field-nomeCQ">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Nome do CQ Avaliador <span className="text-claro-red">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <UserCheck size={16} />
                    </div>
                    <input
                      type="text"
                      placeholder="Seu nome completo"
                      value={nomeCQ}
                      onChange={(e) => setNomeCQ(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
                        errors.nomeCQ 
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                      }`}
                    />
                  </div>
                  {errors.nomeCQ && (
                    <p className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} /> {errors.nomeCQ}
                    </p>
                  )}
                </div>

                {/* Data da Avaliação */}
                <div className="space-y-1.5" id="field-data">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Data da Avaliação <span className="text-claro-red">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar size={16} />
                    </div>
                    <input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
                        errors.data 
                          ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                          : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                      }`}
                    />
                  </div>
                  {errors.data && (
                    <p className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertTriangle size={12} /> {errors.data}
                    </p>
                  )}
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="w-full py-4 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-extrabold rounded-2xl text-base transition-all duration-150 shadow-md flex items-center justify-center space-x-2 cursor-pointer border-b-2 border-red-800 active:border-b-0"
                >
                  <span>Próximo Passo</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 flex-grow"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-claro-dark tracking-tight">
                  Escolha da Certificação
                </h2>
                <p className="text-slate-500 text-xs">
                  Selecione qual tecnologia ou treinamento prático o técnico será avaliado.
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-claro-border p-6 shadow-sm space-y-4">
                <div className="flex flex-col gap-3" id="field-tipoCertificacao">
                  {[
                    { id: 'GPON Veterano', label: 'GPON Veterano', desc: 'Checklist completo com 12 quesitos e controle crítico de conectores e acomodação.', icon: Wifi },
                    { id: 'GPON Capacitação', label: 'GPON Capacitação', desc: 'Avaliação técnica para ingressantes na tecnologia de fibra óptica GPON.', icon: Cpu },
                    { id: 'HFC Capacitação', label: 'HFC Capacitação', desc: 'Auditoria de padrões e conformidades para redes coaxiais e decodificadores.', icon: Tv }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = tipoCertificacao === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleCertificacaoChange(item.id as CertificacaoType)}
                        className={`flex items-start p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer select-none gap-4 ${
                          isSelected 
                            ? 'border-claro-red bg-red-50/40 ring-2 ring-red-500/10' 
                            : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl flex-shrink-0 ${isSelected ? 'bg-claro-red text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon size={20} />
                        </div>
                        <div className="flex-grow space-y-1">
                          <div className="flex items-center justify-between">
                            <strong className={`text-sm ${isSelected ? 'text-claro-red font-black' : 'text-slate-800'}`}>
                              {item.label}
                            </strong>
                            {isSelected && (
                              <div className="w-4.5 h-4.5 bg-claro-red text-white rounded-full flex items-center justify-center shadow-sm">
                                <Check size={12} className="stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 leading-normal font-medium">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.tipoCertificacao && (
                  <p className="text-xs text-red-500 flex items-center gap-1 font-semibold mt-1">
                    <AlertTriangle size={12} /> {errors.tipoCertificacao}
                  </p>
                )}
              </div>

              {/* Step 2 Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full sm:w-auto px-6 py-4 border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold rounded-2xl text-sm transition-all shadow-sm text-center cursor-pointer order-2 sm:order-1"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={handleNextStep2}
                  disabled={!tipoCertificacao}
                  className={`w-full flex-grow py-4 flex items-center justify-center space-x-2 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-extrabold rounded-2xl text-base transition-all duration-150 shadow-md border-b-2 border-red-800 active:border-b-0 cursor-pointer order-1 sm:order-2 ${
                    !tipoCertificacao ? 'opacity-50 cursor-not-allowed bg-red-400 hover:bg-red-400' : ''
                  }`}
                >
                  <Play size={16} fill="currentColor" />
                  <span>Iniciar Checklist</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
              className={`flex-grow ${isViewingChecklist ? 'overflow-hidden h-full flex flex-col gap-3.5 space-y-0' : 'space-y-5'}`}
            >
              {profile === 'cq' && activeCqView === 'teorica' ? (
                <div className="bg-white rounded-3xl border border-claro-border p-6 shadow-md space-y-6 text-left animate-fade-in" id="teorica-grade-entry">
                  <div className="flex items-center space-x-3 text-claro-dark pb-3 border-b border-slate-100">
                    <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700">
                      <ClipboardList size={22} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg tracking-tight">Nota da Avaliação Teórica</h3>
                      <p className="text-xs text-slate-500 font-semibold">Tecnologia: {tipoCertificacao}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs space-y-2">
                      <span className="block font-black text-slate-400 uppercase tracking-widest">Identificação do Técnico</span>
                      <div className="grid grid-cols-2 gap-2 text-slate-700">
                        <div>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Nome</span>
                          <strong className="text-slate-800 font-black truncate block">{nomeTecnico}</strong>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Matrícula</span>
                          <strong className="text-slate-800 font-black uppercase block">{matricula}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                        Nota da Avaliação Teórica <span className="text-claro-red">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 7,5 ou 8.0"
                        value={notaTeoricaInput}
                        onChange={(e) => {
                          setNotaTeoricaInput(e.target.value);
                          setTeoricaError('');
                        }}
                        className={`w-full px-4 py-3 rounded-xl border text-sm font-bold transition-all focus:outline-none focus:ring-2 ${
                          teoricaError 
                            ? 'border-red-400 focus:ring-red-100 focus:border-red-500' 
                            : 'border-slate-200 focus:ring-red-500/10 focus:border-claro-red'
                        }`}
                        id="input-nota-teorica"
                      />
                      {teoricaError ? (
                        <p className="text-xs text-red-500 font-bold flex items-center gap-1">
                          <AlertTriangle size={12} /> {teoricaError}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-medium">Insira um valor de 0 a 10. Decimais são permitidos com ponto ou vírgula.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onCancel}
                      className="flex-1 py-3.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseNotaTeorica(notaTeoricaInput);
                        if (parsed === null) {
                          setTeoricaError('Por favor, informe uma nota de 0 a 10 (ex: 7,5 ou 8.0).');
                          return;
                        }
                        if (parsed < 7) {
                          setActiveCqView('reprovadoTeorica');
                        } else {
                          setActiveCqView('checklist');
                        }
                      }}
                      className="flex-1 py-3.5 bg-claro-red hover:bg-red-700 text-white font-black rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center space-x-1"
                      id="btn-confirm-teorica"
                    >
                      <span>Confirmar Nota</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : profile === 'cq' && activeCqView === 'reprovadoTeorica' ? (
                <div className="bg-white rounded-3xl border border-claro-border p-6 shadow-md space-y-6 text-left animate-fade-in" id="teorica-grade-failure">
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-xl bg-claro-red text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                      <X size={26} className="stroke-[3]" />
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold tracking-widest opacity-75">Diagnóstico Teórico</span>
                      <strong className="text-xl font-black uppercase tracking-tight">REPROVADO</strong>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 space-y-3">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                      Detalhes do Resultado
                    </span>
                    
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="block text-slate-400 font-medium">Técnico</span>
                        <strong className="text-slate-800 font-black truncate block">{nomeTecnico}</strong>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-medium">Nota Teórica Informada</span>
                        <strong className="text-base text-claro-red font-extrabold block">
                          {notaTeoricaInput}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-slate-400 font-medium">Motivo</span>
                        <strong className="text-xs text-red-700 font-bold block bg-red-50 border border-red-100 px-2 py-1 rounded mt-0.5">
                          Nota teórica inferior a 7
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseNotaTeorica(notaTeoricaInput);
                        onSave({
                          nomeTecnico: nomeTecnico.trim(),
                          matricula: matricula.trim().toUpperCase(),
                          empresa: empresa.trim(),
                          cidadeBase: cidadeBase.trim(),
                          nomeCQ: nomeCQ.trim(),
                          data,
                          tipoCertificacao: tipoCertificacao as CertificacaoType,
                          observacao: observacao.trim(),
                          notaTeorica: parsed !== null ? parsed : undefined
                        }, 'FINALIZADA', {});
                      }}
                      className="w-full py-4.5 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-black rounded-2xl text-base transition-all duration-150 shadow-md border-b-4 border-red-800 active:border-b-0 flex items-center justify-center space-x-2 cursor-pointer animate-pulse"
                      id="btn-finalize-theoretical-failure"
                    >
                      <CheckCircle size={18} />
                      <span>Finalizar Avaliação</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveCqView('teorica');
                      }}
                      className="w-full py-3 bg-slate-900 hover:bg-neutral-800 active:bg-neutral-950 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm text-center cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <ArrowLeft size={12} />
                      <span>Voltar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Compact Sticky Top Summary Box */}
                  <div className="bg-slate-900 text-white rounded-2xl p-2.5 md:p-3 shadow-md border border-neutral-800 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 text-xs shrink-0 select-none">
                    <div className="flex items-center gap-3.5 flex-wrap">
                      <button
                        type="button"
                        onClick={onCancel}
                        className="flex items-center gap-1.5 text-slate-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={13} />
                        <span>Sair</span>
                      </button>
                      
                      <div className="h-4 w-px bg-neutral-800 hidden sm:block"></div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-400 font-medium">Técnico:</span>
                        <strong className="text-white font-black truncate max-w-[130px] sm:max-w-[180px]" title={nomeTecnico}>
                          {nomeTecnico}
                        </strong>
                      </div>

                      <div className="h-4 w-px bg-neutral-800 hidden md:block"></div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-400 font-medium">Certificação:</span>
                        <span className="bg-red-500/15 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-black text-[10px]">
                          {tipoCertificacao}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t border-neutral-800/60 md:border-t-0 pt-2 md:pt-0">
                      <div className="flex items-center gap-3">
                        {profile === 'cq' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-400 font-medium">Teórica:</span>
                            <strong className="text-emerald-400 font-extrabold">{notaTeoricaInput}</strong>
                            <button
                              type="button"
                              onClick={() => setActiveCqView('teorica')}
                              className="text-[10px] text-red-400 hover:text-red-300 font-bold underline ml-1 cursor-pointer"
                            >
                              Ajustar
                            </button>
                          </div>
                        )}

                        <div className="h-4 w-px bg-neutral-800 hidden sm:block"></div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-400 font-medium">Progresso:</span>
                          <strong className="text-amber-400 font-black">
                            {tipoCertificacao ? `${answeredCount} de ${totalItems}` : '0 de 0'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Checklist content scrollbox */}
                  <div className="flex-grow overflow-hidden flex flex-col h-full gap-4">
                    {tipoCertificacao ? (
                      isGrouped ? (
                        /* Grouped layout with Fixed Sidebar / Horiz Tabs and scrollbox */
                        <div className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-6 items-stretch animate-fade-in flex-grow overflow-hidden h-full min-h-0" id="hfc-grouped-layout">
                          
                          {/* Left Navigation Sidebar / Mobile Sticky Header */}
                          <div className="md:col-span-4 flex flex-col flex-shrink-0 min-h-0">
                            {/* Mobile Horizontal Navigation Header */}
                            <div className="md:hidden flex overflow-x-auto pb-2 pt-1 scrollbar-none gap-1.5 shrink-0 border-b border-slate-100 bg-slate-50 z-20" id="hfc-mobile-groups">
                              {activeGroups.map((g) => {
                                const groupItems = activeItems.filter(item => item.grupo === g.nome);
                                const groupAnsweredCount = groupItems.filter(item => checklistResponses[item.id] !== undefined).length;
                                const groupPercentage = Math.round((groupAnsweredCount / g.total) * 100);
                                const groupUnansweredCount = groupItems.filter(item => checklistResponses[item.id] === undefined).length;
                                const isGroupPending = groupUnansweredCount > 0;
                                const isSelected = activeHFCGroupId === g.id;

                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setActiveHFCGroupId(g.id)}
                                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex flex-col gap-1 ${
                                      isSelected
                                        ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                        : isGroupPending
                                          ? 'bg-amber-50/40 border-amber-300 text-amber-800'
                                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 w-full">
                                      <span className="whitespace-nowrap font-black">{g.id}. {g.nome}</span>
                                      <span className={`text-[9px] font-black ${
                                        isSelected 
                                          ? 'text-white/85' 
                                          : isGroupPending
                                            ? 'text-amber-600 font-extrabold'
                                            : 'text-slate-400'
                                      }`}>
                                        {groupAnsweredCount}/{g.total}
                                      </span>
                                    </div>
                                    {/* Progress track */}
                                    <div className="w-full h-0.5 bg-slate-100/30 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${isSelected ? 'bg-white' : isGroupPending ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                                        style={{ width: `${groupPercentage}%` }}
                                      />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Desktop Vertical Sidebar */}
                            <div className="hidden md:flex flex-col gap-2 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm h-full overflow-y-auto" id="hfc-desktop-groups">
                              <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 pb-1.5 border-b border-slate-50">
                                Grupos da Certificação
                              </h4>
                              {activeGroups.map((g) => {
                                const groupItems = activeItems.filter(item => item.grupo === g.nome);
                                const groupAnsweredCount = groupItems.filter(item => checklistResponses[item.id] !== undefined).length;
                                const groupPercentage = Math.round((groupAnsweredCount / g.total) * 100);
                                const groupUnansweredCount = groupItems.filter(item => checklistResponses[item.id] === undefined).length;
                                const isGroupPending = groupUnansweredCount > 0;
                                const isSelected = activeHFCGroupId === g.id;

                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => setActiveHFCGroupId(g.id)}
                                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                                      isSelected
                                        ? 'bg-red-50/50 border-red-600 ring-1 ring-red-600/20 shadow-sm'
                                        : isGroupPending
                                          ? 'bg-amber-50/30 border-amber-300 hover:border-amber-400'
                                          : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1 w-full">
                                      <strong className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-red-600' : isGroupPending ? 'text-amber-800' : 'text-slate-700'}`}>
                                        {g.id}. {g.nome}
                                      </strong>
                                      <span className={`text-[9px] font-black whitespace-nowrap px-1 py-0.5 rounded ${
                                        isSelected 
                                          ? 'bg-red-50 text-red-600 border border-red-100' 
                                          : isGroupPending
                                            ? 'bg-amber-100 text-amber-700 border border-amber-200 font-extrabold animate-pulse'
                                            : 'bg-slate-100 text-slate-500'
                                      }`}>
                                        {groupAnsweredCount}/{g.total}
                                      </span>
                                    </div>
                                    
                                    {/* Progress indicator */}
                                    <div className="w-full flex items-center gap-2">
                                      <div className="flex-grow h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full transition-all duration-300 ${
                                            groupPercentage === 100 
                                              ? 'bg-emerald-500' 
                                              : isGroupPending ? 'bg-amber-400' : 'bg-slate-300'
                                          }`}
                                          style={{ width: `${groupPercentage}%` }}
                                        />
                                      </div>
                                      <span className="text-[9px] font-bold text-slate-400 min-w-[20px] text-right leading-none">
                                        {groupPercentage}%
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Right Content Panel - active group items list (Scrollable) */}
                          <div className="md:col-span-8 flex flex-col flex-grow overflow-y-auto h-full pr-1 pb-28 md:pb-12 min-h-0" id="hfc-items-list">
                            {(() => {
                              const activeGroup = activeGroups.find(g => g.id === activeHFCGroupId) || activeGroups[0];
                              const activeGroupItems = activeItems.filter(item => item.grupo === activeGroup.nome);
                              const activeGroupAnsweredCount = activeGroupItems.filter(item => checklistResponses[item.id] !== undefined).length;

                              return (
                                <div className="space-y-3">
                                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between shrink-0 mb-1">
                                    <div>
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">
                                        Grupo Selecionado
                                      </span>
                                      <h3 className="font-extrabold text-xs text-slate-800 tracking-tight mt-0.5">
                                        {activeGroup.nome}
                                      </h3>
                                    </div>
                                    <span className="text-[10px] bg-white border border-slate-200 text-slate-700 font-extrabold px-2 py-0.5 rounded-md shadow-sm">
                                      {activeGroupAnsweredCount} de {activeGroup.total}
                                    </span>
                                  </div>

                                  <div className="space-y-2">
                                    {activeGroupItems.map((item) => {
                                      const currentValue = checklistResponses[item.id];
                                      const isCritical = item.critico;

                                      return (
                                        <div
                                          key={item.id}
                                          className={`rounded-xl border transition-all p-3 relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                                            isCritical 
                                              ? 'border-red-200 bg-red-50/10 border-l-4 border-l-red-600 shadow-sm' 
                                              : 'border-slate-100 bg-white shadow-sm'
                                          }`}
                                        >
                                          <div className="flex flex-col gap-1 sm:max-w-[65%]">
                                            {isCritical && (
                                              <div className="flex items-center space-x-1 text-[8px] font-black text-red-600 tracking-wider uppercase bg-red-50 border border-red-100 self-start px-1.5 py-0.5 rounded">
                                                <AlertTriangle size={8} className="fill-red-600 text-white" />
                                                <span>ITEM CRÍTICO</span>
                                              </div>
                                            )}

                                            <div className="flex items-start space-x-2">
                                              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 rounded w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                {item.id}
                                              </span>
                                              <p className={`text-xs leading-snug font-bold ${
                                                isCritical ? 'text-slate-900' : 'text-slate-700'
                                              }`}>
                                                {item.descricao}
                                              </p>
                                            </div>
                                          </div>

                                          {/* Dynamic buttons - aligned on single line */}
                                          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:w-auto shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleResponseChange(item.id, 'Fez')}
                                              className={`py-1.5 px-3 rounded-lg text-xs font-black flex items-center justify-center space-x-1 border transition-all cursor-pointer select-none sm:min-w-[65px] ${
                                                currentValue === 'Fez'
                                                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm'
                                                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 active:bg-slate-100'
                                              }`}
                                            >
                                              <span>Fez</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleResponseChange(item.id, 'NaoFez')}
                                              className={`py-1.5 px-3 rounded-lg text-xs font-black flex items-center justify-center space-x-1 border transition-all cursor-pointer select-none sm:min-w-[65px] ${
                                                currentValue === 'NaoFez'
                                                  ? 'bg-red-600 border-red-700 text-white shadow-sm'
                                                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 active:bg-slate-100'
                                              }`}
                                            >
                                              <span>Não fez</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleResponseChange(item.id, 'NA')}
                                              className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer select-none sm:min-w-[65px] ${
                                                currentValue === 'NA'
                                                  ? 'bg-slate-600 border-slate-700 text-white shadow-sm'
                                                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 active:bg-slate-100'
                                              }`}
                                            >
                                              <span>N/A</span>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Sub Group Navigation Controls at bottom */}
                                  <div className="flex justify-between items-center pt-3 border-t border-slate-100 shrink-0 mt-4 pb-6">
                                    <button
                                      type="button"
                                      disabled={activeHFCGroupId === 1}
                                      onClick={() => {
                                        setActiveHFCGroupId(prev => Math.max(1, prev - 1));
                                        const scrollable = document.getElementById('hfc-items-list');
                                        if (scrollable) scrollable.scrollTop = 0;
                                      }}
                                      className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer select-none ${
                                        activeHFCGroupId === 1
                                          ? 'opacity-35 cursor-not-allowed border-slate-100 text-slate-300'
                                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      <ArrowLeft size={12} />
                                      <span>Anterior</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={activeHFCGroupId === activeGroups.length}
                                      onClick={() => {
                                        setActiveHFCGroupId(prev => Math.min(activeGroups.length, prev + 1));
                                        const scrollable = document.getElementById('hfc-items-list');
                                        if (scrollable) scrollable.scrollTop = 0;
                                      }}
                                      className={`px-3 py-1.5 border rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer select-none ${
                                        activeHFCGroupId === activeGroups.length
                                          ? 'opacity-35 cursor-not-allowed border-slate-100 text-slate-300'
                                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                      }`}
                                    >
                                      <span>Próximo</span>
                                      <ArrowRight size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        /* Flat list for GPON Veterano with independent scrolling */
                        <div className="space-y-2 overflow-y-auto h-full pr-1 pb-28 md:pb-12 min-h-0" id="gpon-items-list">
                          {activeItems.map((item, index) => {
                            const currentValue = checklistResponses[item.id];
                            const isCritical = item.critico;

                            return (
                              <div
                                key={item.id}
                                className={`rounded-xl border transition-all p-3 relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                                  isCritical 
                                    ? 'border-red-200 bg-red-50/10 border-l-4 border-l-red-600 shadow-sm' 
                                    : 'border-slate-100 bg-white shadow-sm'
                                }`}
                              >
                                <div className="flex flex-col gap-1 sm:max-w-[65%]">
                                  {isCritical && (
                                    <div className="flex items-center space-x-1 text-[8px] font-black text-red-600 tracking-wider uppercase bg-red-50 border border-red-100 self-start px-1.5 py-0.5 rounded">
                                      <AlertTriangle size={8} className="fill-red-600 text-white" />
                                      <span>ITEM CRÍTICO</span>
                                    </div>
                                  )}

                                  <div className="flex items-start space-x-2">
                                    <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 rounded w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      {item.id}
                                    </span>
                                    <p className={`text-xs leading-snug font-bold ${
                                      isCritical ? 'text-slate-900' : 'text-slate-700'
                                    }`}>
                                      {item.descricao}
                                    </p>
                                  </div>
                                </div>

                                {/* Dynamic buttons - aligned on single line */}
                                <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:w-auto shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleResponseChange(item.id, 'Fez')}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-black flex items-center justify-center space-x-1 border transition-all cursor-pointer select-none sm:min-w-[65px] ${
                                      currentValue === 'Fez'
                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 active:bg-slate-100'
                                    }`}
                                  >
                                    <span>Fez</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleResponseChange(item.id, 'NaoFez')}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-black flex items-center justify-center space-x-1 border transition-all cursor-pointer select-none sm:min-w-[65px] ${
                                      currentValue === 'NaoFez'
                                        ? 'bg-red-600 border-red-700 text-white shadow-sm'
                                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 active:bg-slate-100'
                                    }`}
                                  >
                                    <span>Não fez</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleResponseChange(item.id, 'NA')}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1 border transition-all cursor-pointer select-none sm:min-w-[65px] ${
                                      currentValue === 'NA'
                                        ? 'bg-slate-600 border-slate-700 text-white shadow-sm'
                                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-600 active:bg-slate-100'
                                    }`}
                                  >
                                    <span>N/A</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      /* Other Certifications: Empty State */
                      <div className="bg-white rounded-2xl border border-claro-border p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-sm min-h-[200px] shrink-0">
                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400">
                          <Sliders size={20} />
                        </div>
                        <div className="max-w-xs space-y-1">
                          <h4 className="font-extrabold text-xs text-claro-dark uppercase tracking-wider">
                            Estrutura Pendente
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                            “Os itens desta certificação serão configurados posteriormente.”
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 3 Actions (Fixed bottom panel) */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 shrink-0 bg-slate-50/80 backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2">
                      {profile === 'cq' ? (
                        <button
                          type="button"
                          onClick={onCancel}
                          className="flex-1 py-2 border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-all shadow-sm text-center cursor-pointer"
                        >
                          Sair
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="flex-1 py-2 border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-all shadow-sm text-center cursor-pointer"
                        >
                          Voltar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleFinalSave(profile === 'cq' ? 'EM ANDAMENTO' : 'Rascunho')}
                        className="flex-1 py-2 flex items-center justify-center space-x-1 border border-amber-300 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                      >
                        <FileText size={14} />
                        <span>{profile === 'cq' ? 'Salvar em Andamento' : 'Salvar Rascunho'}</span>
                      </button>
                    </div>

                    {hasUnanswered && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start space-x-2 text-amber-800 text-xs shadow-sm animate-fade-in" id="unanswered-items-alert">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <strong className="font-extrabold block">Existem itens sem resposta. Responda todos os itens antes de concluir.</strong>
                          <p className="font-bold text-amber-700">
                            Restam {missingResponsesCount} {missingResponsesCount === 1 ? 'item' : 'itens'} sem resposta no checklist.
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleNextStep3}
                      disabled={hasUnanswered}
                      className={`w-full py-2.5 font-extrabold rounded-xl text-xs transition-all duration-150 shadow-md flex items-center justify-center space-x-1.5 ${
                        hasUnanswered
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                          : 'bg-slate-900 hover:bg-neutral-800 active:bg-neutral-950 text-white cursor-pointer'
                      }`}
                      id="btn-conclude-checklist"
                    >
                      <span>Concluir Checklist e Ver Diagnóstico</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 flex-grow"
            >
              <div className="space-y-0.5 text-center">
                <h2 className="text-lg font-black text-claro-dark tracking-tight">
                  Diagnóstico Prático Final
                </h2>
                <p className="text-slate-500 text-[11px]">
                  Revise o rendimento final e valide a ficha para salvar o registro no banco.
                </p>
              </div>

              {/* Compact Single Identification Card */}
              <div className="bg-white rounded-2xl border border-slate-150 p-3.5 shadow-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Técnico</span>
                    <strong className="text-slate-800 font-black truncate block mt-1 leading-none">{nomeTecnico}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Matrícula</span>
                    <strong className="text-slate-800 font-black uppercase block mt-1 leading-none">{matricula}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Empresa</span>
                    <strong className="text-slate-800 font-bold block mt-1 leading-none">{empresa}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Cidade / Base</span>
                    <strong className="text-slate-800 font-bold block mt-1 leading-none">{cidadeBase}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Avaliador CQ</span>
                    <strong className="text-slate-800 font-bold block mt-1 leading-none">{nomeCQ}</strong>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Certificação</span>
                    <strong className="text-claro-red font-extrabold block mt-1 leading-none">{tipoCertificacao}</strong>
                  </div>
                </div>
              </div>

              {/* Four small indicators in a single row */}
              {(() => {
                const isReprovadoPorTeorica = parsedTeorica !== null && parsedTeorica < 7;
                const isReprovadoPorCritico = activeStats !== null && activeStats.itensCriticosNaoRealizados.length > 0;
                const isReprovadoPorNotaPratica = activeStats !== null && activeStats.nota < 7;
                const isApproved = activeStats 
                  ? activeStats.resultado === 'APROVADO' 
                  : !isReprovadoPorTeorica;

                const totalCriticalCount = activeItems.filter(item => item.critico).length;
                const unexecutedCriticalCount = activeStats ? activeStats.itensCriticosNaoRealizados.length : 0;
                const criticalFraction = `${unexecutedCriticalCount}/${totalCriticalCount}`;

                return (
                  <div className="space-y-4">
                    {/* Row of 4 Indicators */}
                    <div className="grid grid-cols-4 gap-2">
                      {/* Nota Teórica */}
                      <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-2 text-center flex flex-col justify-center shadow-xs">
                        <span className="block text-[8px] text-slate-400 uppercase font-black tracking-wider leading-none">Nota Teor.</span>
                        <strong className="text-sm font-black text-slate-800 mt-1.5 leading-none">
                          {parsedTeorica !== null ? parsedTeorica.toFixed(1).replace('.', ',') : '—'}
                        </strong>
                      </div>

                      {/* Nota Prática */}
                      <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-2 text-center flex flex-col justify-center shadow-xs">
                        <span className="block text-[8px] text-slate-400 uppercase font-black tracking-wider leading-none">Nota Prát.</span>
                        <strong className="text-sm font-black text-slate-800 mt-1.5 leading-none">
                          {activeStats ? activeStats.nota.toFixed(1).replace('.', ',') : '10,0'}
                        </strong>
                      </div>

                      {/* Itens Críticos */}
                      <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-2 text-center flex flex-col justify-center shadow-xs">
                        <span className="block text-[8px] text-slate-400 uppercase font-black tracking-wider leading-none">Itens Crít.</span>
                        <strong className="text-sm font-black text-slate-800 mt-1.5 leading-none">
                          {criticalFraction}
                        </strong>
                      </div>

                      {/* Resultado Final */}
                      <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-2 text-center flex flex-col justify-center shadow-xs">
                        <span className="block text-[8px] text-slate-400 uppercase font-black tracking-wider leading-none">Resultado</span>
                        <span className={`text-[9px] font-black uppercase leading-none block mt-1.5 py-1 px-0.5 rounded-md ${
                          isApproved
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                            : 'text-red-700 bg-red-50 border border-red-100'
                        }`}>
                          {isApproved ? 'APROVADO' : 'REPROVADO'}
                        </span>
                      </div>
                    </div>

                    {/* Single prominent highlight card */}
                    {isApproved ? (
                      <div className="bg-emerald-50/40 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center justify-center space-x-2 shadow-xs">
                        <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                        <strong className="text-sm font-black uppercase tracking-wide">✔ APROVADO</strong>
                      </div>
                    ) : (
                      <div className="bg-red-50/40 border border-red-200 text-red-800 p-3.5 rounded-2xl space-y-2.5 shadow-xs">
                        <div className="flex items-center justify-center space-x-2">
                          <XCircle size={18} className="text-red-600 shrink-0" />
                          <strong className="text-sm font-black uppercase tracking-wide">✖ REPROVADO</strong>
                        </div>
                        
                        <div className="border-t border-red-200/50 pt-2 space-y-1.5">
                          <span className="block text-[9px] uppercase font-black tracking-wider text-red-700">Motivo da reprovação:</span>
                          <ul className="text-xs font-bold text-red-700/95 space-y-1 leading-tight">
                            {isReprovadoPorTeorica && (
                              <li className="flex items-center gap-1.5">
                                <span className="text-red-500">•</span> Nota teórica inferior a 7
                              </li>
                            )}
                            {isReprovadoPorCritico && (
                              <li className="flex items-start gap-1.5">
                                <span className="text-red-500 mt-0.5">•</span> 
                                <span>
                                  Item crítico não executado
                                </span>
                              </li>
                            )}
                            {isReprovadoPorNotaPratica && (
                              <li className="flex items-center gap-1.5">
                                <span className="text-red-500">•</span> Nota prática inferior a 7
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Step 4 Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                {/* Botão principal (vermelho) */}
                <button
                  type="button"
                  onClick={() => handleFinalSave(profile === 'cq' ? 'FINALIZADA' : 'Concluída')}
                  className="w-full py-3 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-black rounded-xl text-xs transition-all duration-150 shadow-md flex items-center justify-center space-x-2 cursor-pointer"
                  id="btn-save-finalize"
                >
                  <Save size={14} />
                  <span>SALVAR AVALIAÇÃO</span>
                </button>

                {/* Botão secundário */}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full py-2.5 border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-extrabold rounded-xl text-xs transition-all shadow-xs text-center cursor-pointer"
                >
                  AJUSTAR CHECKLIST
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

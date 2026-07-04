import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Settings, Shield, RefreshCw, LogOut, CheckCircle2, 
  Award, ClipboardList, AlertTriangle, Database, Plus, Trash2, 
  Edit2, Download, Upload, X, ChevronRight, Save, Check,
  Cpu, Wifi, Tv, Layers, Smartphone, Globe, Info, Play, CheckSquare, ListTodo, Cable, HardDrive, HelpCircle,
  AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CertificacaoType, PerfilPermitido, DynamicCertificacao, DynamicChecklistItem, ChecklistValue } from '../types';
import { 
  getDynamicCertificacoes, 
  saveDynamicCertificacoes, 
  getDynamicChecklistItems, 
  saveDynamicChecklistItems, 
  getGroupsForCertificacao, 
  getIconComponent 
} from '../data/dynamicChecklist';

interface SettingsViewProps {
  onBack: () => void;
  onSwitchProfile: () => void;
}

type ActiveTab = 'profiles' | 'certifications' | 'items' | 'critical' | 'actions';

// Color palette presets for certifications
const COLOR_PRESETS = [
  { value: '#E30613', label: 'Claro Vermelho' },
  { value: '#0056B3', label: 'Azul Claro' },
  { value: '#00A859', label: 'Verde Fibra' },
  { value: '#FFB800', label: 'Amarelo Alerta' },
  { value: '#7000FF', label: 'Roxo Premium' },
  { value: '#0F172A', label: 'Slate Escuro' },
  { value: '#EC4899', label: 'Rosa Pink' },
  { value: '#06B6D4', label: 'Ciano Moderno' }
];

// Icon presets for certifications
const ICON_PRESETS = [
  { name: 'Cpu', label: 'Chip / CPU', icon: Cpu },
  { name: 'Wifi', label: 'Sinal Wi-Fi', icon: Wifi },
  { name: 'Tv', label: 'Televisão / HFC', icon: Tv },
  { name: 'Layers', label: 'Camadas / MDU', icon: Layers },
  { name: 'Cable', label: 'Cabo / Rede', icon: Cable },
  { name: 'HardDrive', label: 'Equipamento', icon: HardDrive },
  { name: 'Shield', label: 'Escudo / Segurança', icon: Shield },
  { name: 'Globe', label: 'Globo / Internet', icon: Globe },
  { name: 'Smartphone', label: 'Celular / App', icon: Smartphone },
  { name: 'Award', label: 'Medalha / Premium', icon: Award }
];

export default function SettingsView({ onBack, onSwitchProfile }: SettingsViewProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('profiles');

  // Dynamic States
  const [certifications, setCertifications] = useState<DynamicCertificacao[]>([]);
  const [checklistItems, setChecklistItems] = useState<DynamicChecklistItem[]>([]);
  const [profileRules, setProfileRules] = useState<Record<string, PerfilPermitido>>({});

  // UI Status
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / Editor States for Certification
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [editingCert, setEditingCert] = useState<DynamicCertificacao | null>(null);
  const [certForm, setCertForm] = useState({
    nome: '',
    descricao: '',
    perfilPermitido: 'CQ ou Analista' as PerfilPermitido,
    cor: '#E30613',
    icone: 'Cpu',
    ativa: true
  });

  // Modal / Editor States for Checklist Item
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DynamicChecklistItem | null>(null);
  const [itemForm, setItemForm] = useState({
    certificacao: '',
    grupo: '',
    descricao: '',
    ordem: 1,
    critico: false,
    obrigatorio: true,
    ativo: true
  });

  // Checklist Items Selection Filter
  const [selectedCertFilter, setSelectedCertFilter] = useState<string>('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('todos');

  // Load state on mount
  useEffect(() => {
    const certs = getDynamicCertificacoes();
    const items = getDynamicChecklistItems();
    setCertifications(certs);
    setChecklistItems(items);

    // Initial selected cert filter
    if (certs.length > 0) {
      setSelectedCertFilter(certs[0].nome);
    }

    // Load profile rules
    const savedRules = localStorage.getItem('claro_cq_certificacao_perfis');
    if (savedRules) {
      try {
        setProfileRules(JSON.parse(savedRules));
      } catch (e) {
        console.error('Error parsing profile rules', e);
      }
    } else {
      // Seed default rules from certifications
      const initialRules: Record<string, PerfilPermitido> = {};
      certs.forEach(c => {
        initialRules[c.nome] = c.perfilPermitido;
      });
      setProfileRules(initialRules);
      localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(initialRules));
    }
  }, []);

  // Show auto-dismiss success message
  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Profile update handler
  const handleUpdateProfileRule = (certName: string, rule: PerfilPermitido) => {
    const updated = {
      ...profileRules,
      [certName]: rule
    };
    setProfileRules(updated);
    localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(updated));
    triggerSuccess(`Regras de perfil para "${certName}" atualizadas!`);
  };

  // CERTIFICATIONS CRUD
  const handleOpenCertModal = (cert?: DynamicCertificacao) => {
    if (cert) {
      setEditingCert(cert);
      setCertForm({
        nome: cert.nome,
        descricao: cert.descricao,
        perfilPermitido: cert.perfilPermitido,
        cor: cert.cor,
        icone: cert.icone,
        ativa: cert.ativa
      });
    } else {
      setEditingCert(null);
      setCertForm({
        nome: '',
        descricao: '',
        perfilPermitido: 'CQ ou Analista',
        cor: '#E30613',
        icone: 'Cpu',
        ativa: true
      });
    }
    setIsCertModalOpen(true);
  };

  const handleSaveCert = () => {
    if (!certForm.nome.trim()) {
      setErrorMessage('O nome da certificação é obrigatório.');
      return;
    }

    let updatedCerts: DynamicCertificacao[];

    if (editingCert) {
      // Edit existing
      // If certification name changed, update items in checklist to point to the new name
      const nameChanged = editingCert.nome !== certForm.nome;

      updatedCerts = certifications.map(c => {
        if (c.id === editingCert.id) {
          return {
            ...c,
            nome: certForm.nome,
            descricao: certForm.descricao,
            perfilPermitido: certForm.perfilPermitido,
            cor: certForm.cor,
            icone: certForm.icone,
            ativa: certForm.ativa
          };
        }
        return c;
      });

      if (nameChanged) {
        const updatedItems = checklistItems.map(item => {
          if (item.certificacao === editingCert.nome) {
            return { ...item, certificacao: certForm.nome };
          }
          return item;
        });
        setChecklistItems(updatedItems);
        saveDynamicChecklistItems(updatedItems);
      }

      // Sync profile rules with the updated certification name
      const updatedRules = { ...profileRules };
      if (nameChanged) {
        updatedRules[certForm.nome] = certForm.perfilPermitido;
        delete updatedRules[editingCert.nome];
      } else {
        updatedRules[certForm.nome] = certForm.perfilPermitido;
      }
      setProfileRules(updatedRules);
      localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(updatedRules));

      triggerSuccess('Certificação editada com sucesso!');
    } else {
      // Create new
      const exists = certifications.some(c => c.nome.toLowerCase() === certForm.nome.toLowerCase());
      if (exists) {
        setErrorMessage('Já existe uma certificação com este nome.');
        return;
      }

      const newCert: DynamicCertificacao = {
        id: 'cert_' + Date.now(),
        nome: certForm.nome,
        descricao: certForm.descricao,
        perfilPermitido: certForm.perfilPermitido,
        cor: certForm.cor,
        icone: certForm.icone,
        ativa: certForm.ativa
      };

      updatedCerts = [...certifications, newCert];

      // Add profile rule
      const updatedRules = {
        ...profileRules,
        [newCert.nome]: newCert.perfilPermitido
      };
      setProfileRules(updatedRules);
      localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(updatedRules));

      triggerSuccess('Nova certificação cadastrada!');
    }

    setCertifications(updatedCerts);
    saveDynamicCertificacoes(updatedCerts);
    setIsCertModalOpen(false);
    setErrorMessage(null);

    // Update checklist filters
    if (!editingCert) {
      setSelectedCertFilter(certForm.nome);
    }
  };

  const handleDeleteCert = (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a certificação "${name}"? Todos os itens de checklist vinculados a ela também serão removidos!`)) {
      const updatedCerts = certifications.filter(c => c.id !== id);
      const updatedItems = checklistItems.filter(i => i.certificacao !== name);

      setCertifications(updatedCerts);
      saveDynamicCertificacoes(updatedCerts);

      setChecklistItems(updatedItems);
      saveDynamicChecklistItems(updatedItems);

      // Clean up profile rules
      const updatedRules = { ...profileRules };
      delete updatedRules[name];
      setProfileRules(updatedRules);
      localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(updatedRules));

      triggerSuccess(`Certificação "${name}" e seus itens removidos com sucesso.`);

      // Adjust filter if needed
      if (selectedCertFilter === name && updatedCerts.length > 0) {
        setSelectedCertFilter(updatedCerts[0].nome);
      }
    }
  };


  // CHECKLIST ITEMS CRUD & AUTO-REORDERING
  const handleOpenItemModal = (item?: DynamicChecklistItem) => {
    const activeCert = selectedCertFilter || (certifications.length > 0 ? certifications[0].nome : '');
    const certItems = checklistItems.filter(i => i.certificacao === activeCert);
    const nextOrdem = certItems.length + 1;

    if (item) {
      setEditingItem(item);
      setItemForm({
        certificacao: item.certificacao,
        grupo: item.grupo || '',
        descricao: item.descricao,
        ordem: item.ordem,
        critico: item.critico,
        obrigatorio: item.obrigatorio ?? true,
        ativo: item.ativo
      });
    } else {
      setEditingItem(null);
      setItemForm({
        certificacao: activeCert,
        grupo: selectedGroupFilter !== 'todos' ? selectedGroupFilter : 'Processos',
        descricao: '',
        ordem: nextOrdem,
        critico: false,
        obrigatorio: true,
        ativo: true
      });
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = () => {
    if (!itemForm.descricao.trim()) {
      setErrorMessage('A descrição/pergunta do item é obrigatória.');
      return;
    }
    if (!itemForm.grupo.trim()) {
      setErrorMessage('O grupo do item é obrigatório.');
      return;
    }

    let updatedItems: DynamicChecklistItem[] = [];

    if (editingItem) {
      // Edit existing item
      const itemToUpdate = {
        ...editingItem,
        certificacao: itemForm.certificacao,
        grupo: itemForm.grupo,
        descricao: itemForm.descricao,
        critico: itemForm.critico,
        obrigatorio: itemForm.obrigatorio,
        ativo: itemForm.ativo
      };

      // Handle reordering if order was changed
      if (editingItem.ordem !== itemForm.ordem) {
        // Exclude current item, sort remaining, insert at new order, reindexed
        const otherCertItems = checklistItems.filter(
          i => i.certificacao === itemForm.certificacao && i.id !== editingItem.id
        );
        otherCertItems.sort((a, b) => a.ordem - b.ordem);

        const targetIdx = Math.max(0, Math.min(otherCertItems.length, itemForm.ordem - 1));
        otherCertItems.splice(targetIdx, 0, itemToUpdate);

        // Reindex all orders
        const reindexedCertItems = otherCertItems.map((item, idx) => ({
          ...item,
          ordem: idx + 1
        }));

        const nonCertItems = checklistItems.filter(i => i.certificacao !== itemForm.certificacao);
        updatedItems = [...nonCertItems, ...reindexedCertItems];
      } else {
        // Just replace
        updatedItems = checklistItems.map(i => i.id === editingItem.id ? itemToUpdate : i);
      }
      triggerSuccess('Item de checklist atualizado!');
    } else {
      // Create new item
      const newItem: Omit<DynamicChecklistItem, 'id'> = {
        certificacao: itemForm.certificacao,
        grupo: itemForm.grupo,
        descricao: itemForm.descricao,
        ordem: itemForm.ordem,
        critico: itemForm.critico,
        obrigatorio: itemForm.obrigatorio,
        ativo: itemForm.ativo
      };

      const certItems = checklistItems.filter(i => i.certificacao === itemForm.certificacao);
      certItems.sort((a, b) => a.ordem - b.ordem);

      const inserted: DynamicChecklistItem = {
        ...newItem,
        id: Date.now() + Math.floor(Math.random() * 1000)
      } as DynamicChecklistItem;

      // Insert at the specified order index
      const targetIdx = Math.max(0, Math.min(certItems.length, itemForm.ordem - 1));
      certItems.splice(targetIdx, 0, inserted);

      // Reindex everything
      const reindexedCertItems = certItems.map((item, idx) => ({
        ...item,
        ordem: idx + 1
      }));

      const nonCertItems = checklistItems.filter(i => i.certificacao !== itemForm.certificacao);
      updatedItems = [...nonCertItems, ...reindexedCertItems];

      triggerSuccess('Novo item adicionado na posição solicitada!');
    }

    setChecklistItems(updatedItems);
    saveDynamicChecklistItems(updatedItems);
    setIsItemModalOpen(false);
    setErrorMessage(null);
  };

  const handleDeleteItem = (id: number, certName: string) => {
    if (window.confirm('Tem certeza que deseja remover este item? Todos os outros itens dessa certificação serão reordenados automaticamente.')) {
      // Filter out item
      const filtered = checklistItems.filter(item => item.id !== id);
      
      // Re-index remaining items of this certification
      const certItems = filtered.filter(item => item.certificacao === certName);
      certItems.sort((a, b) => a.ordem - b.ordem);
      const reindexedCertItems = certItems.map((item, idx) => ({
        ...item,
        ordem: idx + 1
      }));

      const nonCertItems = filtered.filter(item => item.certificacao !== certName);
      const finalItems = [...nonCertItems, ...reindexedCertItems];

      setChecklistItems(finalItems);
      saveDynamicChecklistItems(finalItems);
      triggerSuccess('Item removido e lista reordenada automaticamente.');
    }
  };

  const handleTriggerReorder = (certName: string) => {
    const certItems = checklistItems.filter(i => i.certificacao === certName);
    certItems.sort((a, b) => a.ordem - b.ordem);
    
    const reindexed = certItems.map((item, idx) => ({
      ...item,
      ordem: idx + 1
    }));

    const otherItems = checklistItems.filter(i => i.certificacao !== certName);
    const finalItems = [...otherItems, ...reindexed];

    setChecklistItems(finalItems);
    saveDynamicChecklistItems(finalItems);
    triggerSuccess('Sequência de ordens corrigida e salva!');
  };


  // SYSTEM ACTIONS
  const handleExportConfig = () => {
    const payload = {
      tipo: 'CLARO_CQ_CONFIGURACOES',
      certifications,
      checklistItems,
      profileRules,
      exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `config_claro_cq_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportChecklistOnly = () => {
    const payload = checklistItems.map(item => ({
      ID: item.id,
      Certificacao: item.certificacao,
      Grupo: item.grupo,
      Ordem: item.ordem,
      Pergunta: item.descricao,
      Critico: item.critico ? 'SIM' : 'NAO',
      Obrigatorio: item.obrigatorio ? 'SIM' : 'NAO',
      Ativo: item.ativo ? 'SIM' : 'NAO'
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `checklist_claro_cq_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFullBackup = () => {
    const evaluations = localStorage.getItem('claro_cq_certificacoes') || '[]';
    const evaluators = localStorage.getItem('claro_cq_cadastrados') || '[]';

    const payload = {
      tipo: 'CLARO_CQ_FULL_BACKUP',
      certifications,
      checklistItems,
      profileRules,
      evaluations: JSON.parse(evaluations),
      evaluators: JSON.parse(evaluators),
      backedUpAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `backup_completo_claro_cq_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>, isBackup: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        if (isBackup) {
          if (data.tipo !== 'CLARO_CQ_FULL_BACKUP') {
            alert('Arquivo inválido para restauração de backup completo!');
            return;
          }
          
          if (window.confirm('ATENÇÃO: Restaurar o backup substituirá TODAS as avaliações, técnicos e configurações existentes atualmente! Deseja prosseguir?')) {
            if (data.certifications) saveDynamicCertificacoes(data.certifications);
            if (data.checklistItems) saveDynamicChecklistItems(data.checklistItems);
            if (data.profileRules) localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(data.profileRules));
            if (data.evaluations) localStorage.setItem('claro_cq_certificacoes', JSON.stringify(data.evaluations));
            if (data.evaluators) localStorage.setItem('claro_cq_cadastrados', JSON.stringify(data.evaluators));
            
            alert('Backup restaurado com sucesso! O aplicativo será recarregado.');
            window.location.reload();
          }
        } else {
          if (data.tipo !== 'CLARO_CQ_CONFIGURACOES') {
            alert('Arquivo inválido para importação de configurações!');
            return;
          }

          if (window.confirm('Deseja importar e substituir as configurações atuais pelas configurações carregadas deste arquivo?')) {
            if (data.certifications) {
              setCertifications(data.certifications);
              saveDynamicCertificacoes(data.certifications);
            }
            if (data.checklistItems) {
              setChecklistItems(data.checklistItems);
              saveDynamicChecklistItems(data.checklistItems);
            }
            if (data.profileRules) {
              setProfileRules(data.profileRules);
              localStorage.setItem('claro_cq_certificacao_perfis', JSON.stringify(data.profileRules));
            }
            triggerSuccess('Configurações importadas e aplicadas!');
          }
        }
      } catch (err) {
        alert('Ocorreu um erro ao ler o arquivo JSON. Certifique-se de que é um JSON válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleResetData = () => {
    if (window.confirm('Tem certeza absoluta que deseja redefinir o sistema? Todos os dados (avaliações cadastradas, CQs e checklists personalizados) voltarão aos padrões originais de fábrica.')) {
      localStorage.removeItem('claro_cq_certificacoes');
      localStorage.removeItem('claro_cq_cadastrados');
      localStorage.removeItem('claro_cq_certificacao_perfis');
      localStorage.removeItem('claro_cq_selecionado');
      localStorage.removeItem('claro_analista_selecionado');
      localStorage.removeItem('claro_dynamic_certificacoes');
      localStorage.removeItem('claro_dynamic_checklist_items');
      window.location.reload();
    }
  };


  // Submenu configuration
  const menuItems = [
    { id: 'profiles', label: 'Perfis Permitidos', icon: Shield, desc: 'Regras de acesso por perfil' },
    { id: 'certifications', label: 'Certificações', icon: Award, desc: 'Cadastro de certificações' },
    { id: 'items', label: 'Itens da Certificação', icon: ClipboardList, desc: 'Perguntas e grupos do checklist' },
    { id: 'critical', label: 'Itens Críticos', icon: AlertTriangle, desc: 'Itens que reprovam automaticamente' },
    { id: 'actions', label: 'Ações do Sistema', icon: Database, desc: 'Backup, importações e limpeza' }
  ];

  // Filters calculation for Checklist items
  const activeCertItems = checklistItems.filter(i => i.certificacao === selectedCertFilter);
  const uniqueGroups = Array.from(new Set(activeCertItems.map(i => i.grupo).filter(Boolean)));
  const filteredChecklistItems = activeCertItems.filter(item => {
    if (selectedGroupFilter === 'todos') return true;
    return item.grupo === selectedGroupFilter;
  });

  // Critical items calculation
  const criticalChecklistItems = checklistItems.filter(item => item.critico && item.ativo);

  return (
    <div className="max-w-7xl mx-auto px-4 py-3 space-y-5 animate-fade-in text-left" id="settings-view">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-1 text-slate-500 hover:text-claro-dark transition-colors font-bold text-xs py-1 px-2 -ml-2 rounded-lg hover:bg-slate-100 cursor-pointer"
        id="btn-settings-back"
      >
        <ArrowLeft size={16} />
        <span>Voltar</span>
      </button>

      {/* Header */}
      <div className="border-b border-slate-200 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-claro-dark tracking-tight leading-none flex items-center gap-1.5">
            <Settings size={22} className="text-slate-500" />
            Configurações e Administração
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Módulo administrativo para gerenciar perfis, certificações dinâmicas, itens de checklist e dados do sistema.
          </p>
        </div>
      </div>

      {/* Grid Container for Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* SIDEBAR SUBMENU */}
        <div className="md:col-span-3 flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <h3 className="text-[10px] font-black uppercase text-slate-400 px-3 py-1.5 tracking-wider">
            Menu Administrativo
          </h3>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as ActiveTab);
                  setErrorMessage(null);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-left cursor-pointer select-none ${
                  isSelected
                    ? 'bg-claro-red text-white font-black shadow-md shadow-red-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-bold'
                }`}
              >
                <Icon size={18} className={isSelected ? 'text-white' : 'text-slate-400'} />
                <div className="flex-grow">
                  <p className="text-xs leading-none">{item.label}</p>
                  <p className={`text-[9px] mt-0.5 leading-tight font-medium ${isSelected ? 'text-red-100' : 'text-slate-400'}`}>
                    {item.desc}
                  </p>
                </div>
                <ChevronRight size={14} className={isSelected ? 'text-white/80' : 'text-slate-300'} />
              </button>
            );
          })}
        </div>

        {/* MAIN DISPLAY CONTENT PANEL */}
        <div className="md:col-span-9 flex flex-col bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-sm min-h-[480px]">
          
          {/* Status Messages */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 flex items-center gap-1.5 text-xs text-emerald-600 font-extrabold bg-emerald-50 p-3 rounded-xl border border-emerald-100"
              >
                <CheckCircle2 size={16} />
                <span>{successMessage}</span>
              </motion.div>
            )}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 flex items-center gap-1.5 text-xs text-red-600 font-extrabold bg-red-50 p-3 rounded-xl border border-red-100"
              >
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* TAB 1: PERFIS PERMITIDOS */}
          {activeTab === 'profiles' && (
            <div className="space-y-4 animate-fade-in flex flex-col h-full">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Shield size={18} className="text-claro-red" />
                  Perfis Permitidos por Certificação
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Defina quais tipos de avaliadores (CQ ou Analista) estão autorizados a aplicar e assinar as avaliações de cada tecnologia.
                </p>
              </div>

              <div className="space-y-4 divide-y divide-slate-100 pt-2 flex-grow">
                {certifications.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-8">Nenhuma certificação cadastrada no momento.</p>
                ) : (
                  certifications.map((cert) => {
                    const rule = profileRules[cert.nome] || 'CQ ou Analista';
                    return (
                      <div key={cert.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full inline-block" 
                              style={{ backgroundColor: cert.cor || '#E30613' }}
                            />
                            <h4 className="text-sm font-extrabold text-slate-800">
                              {cert.nome}
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5 max-w-md">
                            {cert.descricao || 'Sem descrição.'}
                          </p>
                        </div>

                        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0 self-start sm:self-center">
                          {(['Apenas CQ', 'Apenas Analista', 'CQ ou Analista'] as PerfilPermitido[]).map((r) => {
                            const isActive = rule === r;
                            return (
                              <button
                                key={r}
                                onClick={() => handleUpdateProfileRule(cert.nome, r)}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer select-none ${
                                  isActive
                                    ? 'bg-slate-800 text-white shadow-sm font-black'
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                                }`}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CERTIFICAÇÕES */}
          {activeTab === 'certifications' && (
            <div className="space-y-4 animate-fade-in flex flex-col h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <Award size={18} className="text-claro-red" />
                    Gerenciamento de Certificações
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Cadastre, configure, ative ou desative os tipos de certificação técnica disponíveis no sistema.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenCertModal()}
                  className="px-3.5 py-1.5 bg-claro-red hover:bg-red-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Nova Certificação</span>
                </button>
              </div>

              {/* Certifications Table */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden flex-grow bg-slate-50/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-150">
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Perfil Autorizado</th>
                        <th className="px-4 py-3 text-center">Nº de Itens</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-xs">
                      {certifications.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-400">
                            Nenhuma certificação criada. Clique no botão acima para adicionar.
                          </td>
                        </tr>
                      ) : (
                        certifications.map((cert) => {
                          const IconComp = getIconComponent(cert.icone);
                          const itemLength = checklistItems.filter(i => i.certificacao === cert.nome).length;
                          const rule = profileRules[cert.nome] || cert.perfilPermitido;
                          
                          return (
                            <tr key={cert.id} className="hover:bg-slate-50/50 bg-white">
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div 
                                    className="p-1.5 rounded-lg text-white"
                                    style={{ backgroundColor: cert.cor || '#E30613' }}
                                  >
                                    <IconComp size={14} />
                                  </div>
                                  <div>
                                    <span className="font-extrabold text-slate-800 block">
                                      {cert.nome}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium block max-w-xs truncate">
                                      {cert.descricao || 'Sem descrição cadastrada.'}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 font-bold text-slate-600">
                                {rule}
                              </td>
                              <td className="px-4 py-3.5 text-center font-black text-slate-700">
                                {itemLength}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide inline-block ${
                                  cert.ativa 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                }`}>
                                  {cert.ativa ? 'ATIVA' : 'INATIVA'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleOpenCertModal(cert)}
                                    className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                                    title="Editar Certificação"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCert(cert.id, cert.nome)}
                                    className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-claro-red rounded-lg transition-colors cursor-pointer"
                                    title="Excluir Certificação"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ITENS DA CERTIFICAÇÃO */}
          {activeTab === 'items' && (
            <div className="space-y-4 animate-fade-in flex flex-col h-full">
              
              {/* Filter Area */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <ClipboardList size={18} className="text-claro-red" />
                    Itens e Questões do Checklist
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Gerencie as perguntas avaliadas na prova prática, crie grupos de organização e defina a ordem de execução.
                  </p>
                </div>
                
                <button
                  onClick={() => handleOpenItemModal()}
                  disabled={certifications.length === 0}
                  className={`px-3.5 py-1.5 bg-claro-red hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer shrink-0`}
                >
                  <Plus size={14} />
                  <span>Novo Item</span>
                </button>
              </div>

              {/* Selector Bar */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150 grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Select Cert */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Certificação Alvo
                  </label>
                  <select
                    value={selectedCertFilter}
                    onChange={(e) => {
                      setSelectedCertFilter(e.target.value);
                      setSelectedGroupFilter('todos');
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 transition-all cursor-pointer"
                  >
                    {certifications.map(c => (
                      <option key={c.id} value={c.nome}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Select Group */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">
                    Grupo de Questões
                  </label>
                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 transition-all cursor-pointer"
                  >
                    <option value="todos">Todos os Grupos ({activeCertItems.length} itens)</option>
                    {uniqueGroups.map(grp => {
                      const count = activeCertItems.filter(i => i.grupo === grp).length;
                      return (
                        <option key={grp} value={grp}>{grp} ({count} itens)</option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Checklist Items Table */}
              <div className="flex flex-col flex-grow">
                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white mb-3">
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-150 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2.5 text-center w-12">Ord</th>
                          <th className="px-4 py-2.5">Pergunta / Item de Auditoria</th>
                          <th className="px-4 py-2.5 w-32">Grupo</th>
                          <th className="px-4 py-2.5 text-center w-20">Crítico</th>
                          <th className="px-4 py-2.5 text-center w-20">Ativo</th>
                          <th className="px-4 py-2.5 text-right w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-xs">
                        {filteredChecklistItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-10 text-slate-400">
                              Nenhum item encontrado para esta seleção. Adicione um novo item acima.
                            </td>
                          </tr>
                        ) : (
                          filteredChecklistItems
                            .sort((a, b) => a.ordem - b.ordem)
                            .map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 text-center font-black text-slate-600 bg-slate-50/30">
                                  #{item.ordem}
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-800 leading-relaxed">
                                  {item.descricao}
                                </td>
                                <td className="px-4 py-3 font-extrabold text-slate-500">
                                  {item.grupo || 'Sem Grupo'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {item.critico ? (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-red-50 text-claro-red border border-red-100 tracking-wide">
                                      CRÍTICO
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-bold text-[10px]">Não</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wide inline-block ${
                                    item.ativo 
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                      : 'bg-slate-100 text-slate-400 border border-slate-150'
                                  }`}>
                                    {item.ativo ? 'SIM' : 'NÃO'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleOpenItemModal(item)}
                                      className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                                      title="Editar Item"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id, item.certificacao)}
                                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-claro-red rounded-lg transition-colors cursor-pointer"
                                      title="Excluir Item"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reorder Action */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-150 mt-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                    <Info size={14} className="text-slate-400 shrink-0" />
                    <span>Se as ordens ficarem confusas ou descontínuas, o sistema pode corrigi-las.</span>
                  </div>
                  <button
                    onClick={() => handleTriggerReorder(selectedCertFilter)}
                    disabled={activeCertItems.length === 0}
                    className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all shrink-0 select-none disabled:opacity-40"
                  >
                    <RefreshCw size={12} />
                    <span>Recalcular Sequência</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ITENS CRÍTICOS */}
          {activeTab === 'critical' && (
            <div className="space-y-4 animate-fade-in flex flex-col h-full">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-claro-red" />
                  Visualização de Itens Críticos
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Localize e edite rapidamente todas as perguntas de checklists sinalizadas como críticas (que resultam em reprovação imediata do técnico em caso de não conformidade).
                </p>
              </div>

              {/* Critical Table */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden flex-grow bg-slate-50/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-150">
                        <th className="px-4 py-3">Certificação</th>
                        <th className="px-4 py-3">Grupo</th>
                        <th className="px-4 py-3">Pergunta / Descrição do Item Crítico</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-xs">
                      {criticalChecklistItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-400">
                            Nenhum item crítico cadastrado e ativo no sistema.
                          </td>
                        </tr>
                      ) : (
                        criticalChecklistItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 bg-white">
                            <td className="px-4 py-3.5 font-extrabold text-slate-800">
                              {item.certificacao}
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-500">
                              {item.grupo}
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-slate-700 leading-relaxed">
                              {item.descricao}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-red-50 text-claro-red border border-red-100 tracking-wide">
                                CRÍTICO
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => {
                                  // Open item modal for edit
                                  setSelectedCertFilter(item.certificacao);
                                  handleOpenItemModal(item);
                                }}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] font-black"
                                title="Editar Item Crítico"
                              >
                                <Edit2 size={12} />
                                <span>Editar</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AÇÕES DO SISTEMA */}
          {activeTab === 'actions' && (
            <div className="space-y-4 animate-fade-in flex flex-col h-full">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Database size={18} className="text-claro-red" />
                  Ações do Sistema e Segurança de Dados
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Gerencie a exportação, importação e backup completo do banco de dados local do seu navegador.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 flex-grow">
                
                {/* Switch profile */}
                <div className="p-4 border border-slate-150 bg-slate-50/40 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <LogOut size={14} className="text-slate-500" />
                      Trocar Perfil Atual
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1">
                      Saia da visão de administração ou do perfil de Analista para simular e operar na visão de Controle de Qualidade (CQ).
                    </p>
                  </div>
                  <button
                    onClick={onSwitchProfile}
                    className="py-2 px-3.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs transition-colors self-start flex items-center gap-1.5 cursor-pointer shadow-sm select-none"
                  >
                    <LogOut size={12} />
                    <span>Mudar de Perfil</span>
                  </button>
                </div>

                {/* Import / Export Configurations */}
                <div className="p-4 border border-slate-150 bg-slate-50/40 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Settings size={14} className="text-slate-500" />
                      Configurações Administrativas (JSON)
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1">
                      Exporte as regras de negócio, lista de certificações e checklists customizados. Útil para copiar entre computadores.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={handleExportConfig}
                      className="py-1.5 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-xs"
                    >
                      <Download size={12} />
                      <span>Exportar Configs</span>
                    </button>
                    
                    <label className="py-1.5 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-xs">
                      <Upload size={12} />
                      <span>Importar Configs</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={(e) => handleImportFile(e, false)} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                {/* Backup & Restore Data */}
                <div className="p-4 border border-slate-150 bg-slate-50/40 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Database size={14} className="text-slate-500" />
                      Backup Geral Completo
                    </h4>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1">
                      Crie um backup de segurança com 100% dos dados da ferramenta: incluindo todo o histórico de avaliações, técnicos, e checklists.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={handleFullBackup}
                      className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-xs"
                    >
                      <Download size={12} />
                      <span>Fazer Backup</span>
                    </button>
                    
                    <label className="py-1.5 px-3 bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100 font-extrabold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-xs">
                      <Upload size={12} />
                      <span>Restaurar Backup</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={(e) => handleImportFile(e, true)} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                {/* Reset App Data */}
                <div className="p-4 border border-red-150 bg-red-50/10 rounded-2xl flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="text-xs font-black text-claro-red uppercase tracking-wide flex items-center gap-1.5">
                      <RefreshCw size={14} className="text-claro-red" />
                      Limpar Todos os Dados
                    </h4>
                    <p className="text-[10px] text-red-400 font-semibold leading-relaxed mt-1">
                      Restaura as configurações originais de fábrica do app. Remove todas as avaliações e checklists personalizados.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleResetData}
                    className="py-2 px-3.5 bg-claro-red hover:bg-red-700 text-white font-extrabold rounded-xl text-xs transition-colors self-start flex items-center gap-1.5 cursor-pointer shadow-sm select-none"
                  >
                    <RefreshCw size={12} />
                    <span>Resetar Sistema</span>
                  </button>
                </div>

                {/* Additional Action: Export Checklist Sheet */}
                <div className="p-4 border border-slate-150 bg-slate-50/40 rounded-2xl flex flex-col justify-between space-y-3 sm:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                        <FileSpreadsheet size={14} className="text-emerald-600" />
                        Exportar Checklist Geral
                      </h4>
                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed mt-1">
                        Gere uma planilha JSON simplificada apenas com os itens de auditoria, grupos e graus de criticidade das perguntas para auditorias externas.
                      </p>
                    </div>
                    <button
                      onClick={handleExportChecklistOnly}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer select-none shadow-xs self-start"
                    >
                      <Download size={12} />
                      <span>Baixar Planilha de Perguntas</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: CERTIFICATION SAVE/EDIT */}
      {isCertModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <Award size={18} className="text-claro-red" />
                {editingCert ? 'Editar Certificação' : 'Nova Certificação'}
              </h3>
              <button 
                onClick={() => setIsCertModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {/* Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Nome da Certificação</label>
                <input
                  type="text"
                  placeholder="Ex: FTTH Empresarial"
                  value={certForm.nome}
                  onChange={(e) => setCertForm({ ...certForm, nome: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-all"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Descrição</label>
                <textarea
                  placeholder="Escreva uma breve descrição das competências avaliadas..."
                  rows={2}
                  value={certForm.descricao}
                  onChange={(e) => setCertForm({ ...certForm, descricao: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Default Allowed profile */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Perfil de Avaliação Padrão</label>
                <select
                  value={certForm.perfilPermitido}
                  onChange={(e) => setCertForm({ ...certForm, perfilPermitido: e.target.value as PerfilPermitido })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="CQ ou Analista">CQ ou Analista (Qualquer um pode assinar)</option>
                  <option value="Apenas CQ">Apenas Controle de Qualidade (CQ)</option>
                  <option value="Apenas Analista">Apenas Analista Técnico</option>
                </select>
              </div>

              {/* Theme Color Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500">Cor Temática Visual</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setCertForm({ ...certForm, cor: color.value })}
                      style={{ backgroundColor: color.value }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-105 border ${
                        certForm.cor === color.value 
                          ? 'ring-2 ring-slate-500 ring-offset-2 border-white'
                          : 'border-transparent'
                      }`}
                      title={color.label}
                    >
                      {certForm.cor === color.value && <Check size={14} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500">Ícone Representativo</label>
                <div className="grid grid-cols-5 gap-2">
                  {ICON_PRESETS.map((item) => {
                    const PresetIcon = item.icon;
                    const isSelected = certForm.icone === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setCertForm({ ...certForm, icone: item.name })}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer select-none ${
                          isSelected
                            ? 'border-claro-red bg-red-50/40 text-claro-red shadow-xs font-black'
                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        <PresetIcon size={16} />
                        <span className="text-[8px] font-extrabold leading-none">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Is active */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cert-active"
                  checked={certForm.ativa}
                  onChange={(e) => setCertForm({ ...certForm, ativa: e.target.checked })}
                  className="w-4 h-4 text-claro-red focus:ring-claro-red border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="cert-active" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Disponível para agendamento (Ativa)
                </label>
              </div>
            </div>

            {/* Error in modal */}
            {errorMessage && (
              <p className="text-xs font-extrabold text-claro-red">{errorMessage}</p>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsCertModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCert}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <Save size={14} />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: CHECKLIST ITEM SAVE/EDIT */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <ClipboardList size={18} className="text-claro-red" />
                {editingItem ? 'Editar Item de Auditoria' : 'Novo Item de Auditoria'}
              </h3>
              <button 
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              
              {/* Associated Cert */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Vincular à Certificação</label>
                <select
                  value={itemForm.certificacao}
                  onChange={(e) => setItemForm({ ...itemForm, certificacao: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-all cursor-pointer"
                >
                  {certifications.map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
              </div>

              {/* Descricao / Pergunta */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Descrição / Pergunta Técnica</label>
                <textarea
                  placeholder="Escreva a pergunta ou ação prática a ser auditada..."
                  rows={3}
                  value={itemForm.descricao}
                  onChange={(e) => setItemForm({ ...itemForm, descricao: e.target.value })}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Group Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Grupo / Categoria do Item</label>
                <input
                  type="text"
                  placeholder="Ex: Instalação Física, Banda Larga, Processos, etc."
                  value={itemForm.grupo}
                  onChange={(e) => setItemForm({ ...itemForm, grupo: e.target.value })}
                  list="suggested-groups"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-all"
                />
                <datalist id="suggested-groups">
                  {uniqueGroups.map(g => <option key={g} value={g} />)}
                  <option value="Processos" />
                  <option value="Instalação Física" />
                  <option value="Decodificador" />
                  <option value="Banda Larga" />
                  <option value="Telefone" />
                  <option value="Aplicativos" />
                  <option value="Atendimento Consultivo / TNPS" />
                </datalist>
                <p className="text-[9px] text-slate-400 font-medium">Insira um grupo existente ou digite para criar um novo grupo.</p>
              </div>

              {/* Ordem e Config */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Posição / Ordem</label>
                  <input
                    type="number"
                    min={1}
                    value={itemForm.ordem}
                    onChange={(e) => setItemForm({ ...itemForm, ordem: parseInt(e.target.value) || 1 })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-slate-300 focus:bg-white transition-all"
                  />
                  <p className="text-[8px] text-slate-400 font-semibold mt-0.5">Se inserir numa posição existente, os demais serão deslocados.</p>
                </div>

                <div className="flex flex-col justify-end gap-3.5 pb-2.5 pl-1">
                  {/* Is critical */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="item-critical"
                      checked={itemForm.critico}
                      onChange={(e) => setItemForm({ ...itemForm, critico: e.target.checked })}
                      className="w-4 h-4 text-claro-red focus:ring-claro-red border-slate-300 rounded cursor-pointer animate-pulse-subtle"
                    />
                    <label htmlFor="item-critical" className="text-xs font-black text-claro-red cursor-pointer select-none">
                      Item Crítico (Reprova imediato)
                    </label>
                  </div>

                  {/* Is active */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="item-active"
                      checked={itemForm.ativo}
                      onChange={(e) => setItemForm({ ...itemForm, ativo: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                    />
                    <label htmlFor="item-active" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Item Ativo na Auditoria
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Error inside modal */}
            {errorMessage && (
              <p className="text-xs font-extrabold text-claro-red">{errorMessage}</p>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <Save size={14} />
                <span>Salvar Item</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}

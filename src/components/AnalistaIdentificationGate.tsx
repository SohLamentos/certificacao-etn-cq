import React, { useState, useEffect } from 'react';
import { UserCheck, FileCheck, LogOut, ChevronRight, AlertCircle, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { CQ } from '../types';

interface AnalistaIdentificationGateProps {
  onSelectAnalista: (analista: CQ) => void;
  onBack: () => void;
}

export default function AnalistaIdentificationGate({ onSelectAnalista, onBack }: AnalistaIdentificationGateProps) {
  const [analistas, setAnalistas] = useState<CQ[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');

  // Load registered CQs/Analistas from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('claro_cq_cadastrados');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((item: any) => ({
          ...item,
          perfil: item.perfil || 'CQ'
        }));
        setAnalistas(migrated);
      } catch (e) {
        console.error('Error loading Analistas', e);
      }
    } else {
      // Default list if empty (including Thiago Anderson)
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
      setAnalistas(defaultCQs);
      localStorage.setItem('claro_cq_cadastrados', JSON.stringify(defaultCQs));
    }
  }, []);

  // Filter only active Analistas for selection
  const activeAnalistas = analistas.filter(item => item.perfil === 'Analista' && item.status === 'Ativo');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError('Por favor, selecione um Analista responsável.');
      return;
    }

    const found = activeAnalistas.find(item => item.id === selectedId);
    if (found) {
      onSelectAnalista(found);
    } else {
      setError('Analista selecionado inválido.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-claro-dark antialiased" id="analista-identification-gate">
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
          
          <div className="p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100 shadow-sm mb-2">
                <UserCheck size={30} />
              </div>
              <h2 className="text-2xl font-black text-claro-dark tracking-tight">
                Identificação do Analista
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Certificação Prática Claro
              </p>
            </div>

            {activeAnalistas.length === 0 ? (
              /* No Analistas available warning */
              <div className="space-y-6">
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-3 text-left">
                  <AlertCircle className="text-claro-red shrink-0 mt-0.5" size={20} />
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-red-900 uppercase tracking-wide">
                      Sem Analistas cadastrados
                    </h4>
                    <p className="text-xs font-semibold text-red-700 leading-relaxed">
                      Nenhum Analista ativo cadastrado no sistema. Vá em "Gerenciar Avaliadores" e cadastre um avaliador com perfil "Analista".
                    </p>
                  </div>
                </div>

                <button
                  onClick={onBack}
                  className="w-full py-3 border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Voltar</span>
                </button>
              </div>
            ) : (
              /* Analista Selection Form */
              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Selecione o Analista responsável <span className="text-claro-red">*</span>
                  </label>
                  <select
                    value={selectedId}
                    onChange={(e) => {
                      setSelectedId(e.target.value);
                      setError('');
                    }}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm bg-white font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-600"
                  >
                    <option value="">Selecione...</option>
                    {activeAnalistas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome} • {item.cidadeBase}
                      </option>
                    ))}
                  </select>
                  {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                </div>

                {/* Selected Analista detail snippet */}
                {(() => {
                  const currentAnalista = activeAnalistas.find(item => item.id === selectedId);
                  if (!currentAnalista) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center space-x-2 text-xs text-slate-500"
                    >
                      <MapPin size={14} className="text-slate-400" />
                      <span className="font-semibold">Base de Atuação: <strong className="text-slate-700">{currentAnalista.cidadeBase}</strong></span>
                    </motion.div>
                  );
                })()}

                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={!selectedId}
                    className={`w-full py-3.5 text-white font-black rounded-xl text-sm transition-all shadow-md flex items-center justify-center space-x-1.5 ${
                      selectedId 
                        ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 cursor-pointer' 
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <span>Entrar como Analista</span>
                    <ChevronRight size={16} className="stroke-[3]" />
                  </button>

                  <button
                    type="button"
                    onClick={onBack}
                    className="w-full py-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>Voltar</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-medium">
        <p>© 2026 S/A - Setor de Qualidade Claro.</p>
      </footer>
    </div>
  );
}

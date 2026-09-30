import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, Loader2, UserX } from 'lucide-react';
import { SafeUser, CQRole } from '../server/auth/types';
import { apiClient } from '../api/client';

interface LoginViewProps {
  onLoginSuccess: (user: SafeUser) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsAccessDenied(false);

    if (!login.trim() || !password) {
      setErrorMessage('Por favor, informe seu usuário e sua senha.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.login(login.trim(), password);

      if (!response.ok) {
        if (response.status === 403 || response.error === 'APPLICATION_ACCESS_DENIED') {
          setIsAccessDenied(true);
          setErrorMessage(
            response.message ||
              'Identidade autenticada na autoridade central ETN, porém ainda não possui liberação de acesso ao Certificação CQ. Solicite concessão a um administrador.'
          );
        } else if (response.status === 401) {
          setErrorMessage('Credenciais inválidas ou usuário inativo.');
        } else if (response.status === 502 || response.error === 'ETN_AUTH_UNAVAILABLE') {
          setErrorMessage('Serviço central de autenticação ETN temporariamente indisponível.');
        } else {
          setErrorMessage(response.message || 'Falha ao autenticar. Tente novamente.');
        }
        setLoading(false);
        return;
      }

      if (response.data && response.data.user) {
        const user = response.data.user;
        const cqAccess = response.data.cq_access;
        const roles = (cqAccess?.roles as CQRole[]) || ['CQ'];
        const primaryRole = roles[0] || 'CQ';

        const safeUser: SafeUser = {
          id: user.id,
          etn_user_id: user.id,
          login: user.login,
          name: user.name,
          role: primaryRole,
          roles,
          status: 'ACTIVE',
          must_change_password: false,
        };

        onLoginSuccess(safeUser);
      }
    } catch {
      setErrorMessage('Erro de comunicação com o servidor de autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-claro-dark antialiased">
      {/* Top Banner */}
      <header className="bg-claro-red text-white py-3 px-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5 select-none">
            <div className="bg-white text-claro-red p-1 rounded-full shadow-inner flex items-center justify-center">
              <ShieldCheck size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight leading-none text-white">
                Claro <span className="font-light text-red-100">CQ</span>
              </h1>
              <p className="text-[9px] text-red-200 font-medium tracking-wider uppercase leading-none mt-0.5">
                Controle de Qualidade
              </p>
            </div>
          </div>
          <span className="text-[11px] bg-black/20 text-red-100 py-1 px-3 rounded-full font-bold uppercase tracking-wider">
            Portal de Acesso Seguro
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2.5 bg-claro-red"></div>

          <div className="p-8 sm:p-10 space-y-7">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 bg-red-50 text-claro-red rounded-full flex items-center justify-center border border-red-100 shadow-sm mb-3">
                <ShieldCheck size={36} />
              </div>
              <h2 className="text-2xl font-black text-claro-dark tracking-tight">
                Certificação Prática CQ
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Autenticação de Usuário
              </p>
            </div>

            {/* Error Message Banner */}
            {errorMessage && (
              <div
                className={`p-4 rounded-2xl flex items-start space-x-3 text-left transition-all ${
                  isAccessDenied
                    ? 'bg-amber-50 border border-amber-200 text-amber-900'
                    : 'bg-red-50 border border-red-200 text-red-900'
                }`}
              >
                {isAccessDenied ? (
                  <UserX className="shrink-0 mt-0.5 text-amber-600" size={20} />
                ) : (
                  <AlertCircle className="shrink-0 mt-0.5 text-claro-red" size={20} />
                )}
                <div className="text-xs font-semibold leading-relaxed">
                  <p className="font-black uppercase tracking-wider mb-0.5">
                    {isAccessDenied ? 'Acesso Não Concedido (CQ)' : 'Não foi possível entrar'}
                  </p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5 text-left">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Login / Usuário <span className="text-claro-red">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Digite seu login"
                    autoComplete="username"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-white text-slate-900 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-claro-red disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  Senha <span className="text-claro-red">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold bg-white text-slate-900 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-claro-red disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-claro-red hover:bg-red-700 active:bg-red-800 text-white font-black rounded-xl text-sm uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar</span>
                      <ArrowRight size={18} className="stroke-[2.5]" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Security Notice */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-2.5 text-slate-600 text-xs">
              <ShieldCheck size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-left">
                <p className="font-bold text-slate-700">Acesso Restrito e Seguro</p>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Ambiente corporativo de certificação técnica. Suas credenciais são individuais e protegidas por auditoria.
                </p>
              </div>
            </div>

            <p className="text-[10px] text-center font-semibold text-slate-400 uppercase tracking-widest">
              Controle de Qualidade Claro • Conectando com Segurança
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-medium">
        <p>© 2026 Claro S/A - Setor de Controle de Qualidade (CQ). Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

import React from 'react';
import { CheckSquare, ShieldCheck, Home, Menu } from 'lucide-react';

interface HeaderProps {
  onGoHome: () => void;
  currentView: string;
  profile?: 'analista' | 'cq' | null;
  onToggleSidebar?: () => void;
}

export default function Header({ onGoHome, currentView, profile, onToggleSidebar }: HeaderProps) {
  return (
    <header className="bg-claro-red text-white shadow-md sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        {/* Brand/Logo Area */}
        <div className="flex items-center gap-2">
          {profile === 'analista' && onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1 rounded-md hover:bg-white/10 active:bg-white/20 text-white md:hidden transition-colors cursor-pointer mr-1"
              id="header-hamburger-btn"
            >
              <Menu size={20} />
            </button>
          )}
          <div 
            onClick={onGoHome} 
            className="flex items-center space-x-2.5 cursor-pointer select-none active:opacity-80 transition-opacity"
            id="header-logo-container"
          >
            <div className="bg-white text-claro-red p-1 rounded-full shadow-inner flex items-center justify-center">
              <ShieldCheck size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight leading-none">
                Claro <span className="font-light text-slate-100">CQ</span>
              </h1>
              <p className="text-[9px] text-red-100 font-medium tracking-wider uppercase leading-none mt-0.5">
                Certificação Prática
              </p>
            </div>
          </div>
        </div>

        {/* Action button if not on home screen */}
        {currentView !== 'home' && profile ? (
          <button
            onClick={onGoHome}
            className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white px-2.5 py-1 rounded-md text-xs font-semibold transition-colors duration-200"
            id="header-home-btn"
            title="Voltar para o Início"
          >
            <Home size={14} />
            <span className="hidden sm:inline">Início</span>
          </button>
        ) : (
          <div className="flex items-center space-x-1">
            <span className="text-[10px] bg-black/15 text-red-50 py-0.5 px-2.5 rounded-full font-bold">
              {profile === 'cq' ? 'Perfil CQ' : profile === 'analista' ? 'Perfil Analista' : 'Ambiente Local'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

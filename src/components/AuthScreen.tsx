import React, { useState } from "react";
import { loginWithGoogle } from "../firebase";
import { Hotel, KeyRound, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError("Erro ao autenticar. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-screen-container" className="min-h-screen flex items-center justify-center bg-luxury-100 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        id="auth-card" 
        className="max-w-md w-full bg-white rounded-2xl shadow-xl shadow-luxury-200/50 border border-luxury-200 overflow-hidden"
      >
        <div id="auth-header-pattern" className="bg-luxury-800 text-white p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brass-500 opacity-5 rounded-full transform translate-x-12 -translate-y-12"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full transform -translate-x-8 translate-y-8"></div>
          
          <div id="hotel-logo-wrapper" className="inline-flex items-center justify-center p-3.5 bg-neutral-900 border border-luxury-200/30 rounded-xl mb-4 text-brass-500 shadow-lg">
            <Hotel className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">Guest Relations</h2>
          <p className="text-luxury-200 text-sm mt-1 max-w-xs mx-auto">
            Plataforma Inteligente de Registro e Análise de Ocorrências Diárias
          </p>
        </div>

        <div id="auth-actions-panel" className="p-8">
          <div className="space-y-5">
            <div id="instruction-item" className="text-center text-sm text-neutral-600 mb-6">
              Insira as credenciais do seu e-mail corporativo associado para acessar o console de ocorrências.
            </div>

            {error && (
              <div id="auth-error-alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <button
              id="google-signin-btn"
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-luxury-800 hover:bg-neutral-900 text-white font-medium text-sm rounded-xl transition-all shadow-md focus:ring-2 focus:ring-brass-500 disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-brass-500" />
              {loading ? "Autenticando..." : "Entrar com Google"}
              <ArrowRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1" />
            </button>
          </div>

          <div id="auth-footer" className="mt-8 text-center">
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
              Uso Restrito • Equipe de Atendimento ao Hóspede
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

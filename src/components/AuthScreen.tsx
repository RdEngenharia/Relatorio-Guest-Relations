import React, { useState } from "react";
import { loginWithGoogle, loginWithEmail, registerWithEmail } from "../firebase";
import { Hotel, KeyRound, ArrowRight, Mail, Lock } from "lucide-react";
import { motion } from "motion/react";

interface AuthScreenProps {
  onLoginSuccess: () => void;
}

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await loginWithGoogle();
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err?.code === "auth/unauthorized-domain" || err?.message?.includes("unauthorized-domain")) {
        setError("Este domínio de visualização precisa ser autorizado no Firebase console. Por favor, use a opção de E-mail e Senha acima.");
      } else {
        setError("Erro ao autenticar com o Google. Use e-mail e senha abaixo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (isRegisterMode) {
        await registerWithEmail(email, password);
        setSuccessMsg("Conta corporativa criada com sucesso!");
        setTimeout(() => {
          onLoginSuccess();
        }, 1200);
      } else {
        await loginWithEmail(email, password);
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      const code = err?.code || "";
      if (code === "auth/wrong-password" || code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setError("E-mail ou senha inválidos. Por favor, verifique suas credenciais.");
      } else if (code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso na plataforma.");
      } else if (code === "auth/weak-password") {
        setError("A senha deve conter pelo menos 6 caracteres.");
      } else if (code === "auth/invalid-email") {
        setError("Por favor, digite um formato de e-mail válido.");
      } else {
        setError(err?.message || "Ocorreu um erro inesperado. Tente novamente.");
      }
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

        {/* Tab switch for Login / Register */}
        <div className="flex border-b border-luxury-200 bg-neutral-50">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(false);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              !isRegisterMode
                ? "border-luxury-800 text-luxury-800 bg-white"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            Acessar Conta
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(true);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
              isRegisterMode
                ? "border-luxury-800 text-luxury-800 bg-white"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            Cadastrar
          </button>
        </div>

        <div id="auth-actions-panel" className="p-8">
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div id="instruction-item" className="text-center text-xs text-neutral-500 mb-2">
              {isRegisterMode 
                ? "Crie uma nova conta usando e-mail e senha corporativa" 
                : "Insira as credenciais do seu e-mail corporativo para acessar"}
            </div>

            {error && (
              <div id="auth-error-alert" className="p-3.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-700 text-xs text-center font-medium">
                {error}
              </div>
            )}

            {successMsg && (
              <div id="auth-success-alert" className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 text-xs text-center font-medium">
                {successMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                E-mail Corporativo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@resort.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-luxury-200 text-sm rounded-xl focus:outline-hidden focus:border-luxury-800 focus:bg-white transition-all text-neutral-800"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-luxury-200 text-sm rounded-xl focus:outline-hidden focus:border-luxury-800 focus:bg-white transition-all text-neutral-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-luxury-800 hover:bg-neutral-900 text-white font-medium text-sm rounded-xl transition-all shadow-md focus:ring-2 focus:ring-brass-500 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-brass-500" />
              {loading 
                ? (isRegisterMode ? "Cadastrando..." : "Autenticando...") 
                : (isRegisterMode ? "Criar Conta Corporativa" : "Entrar com E-mail")
              }
            </button>
          </form>

          {/* Elegant Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-luxury-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[10px] font-bold tracking-wider text-neutral-400">
                Ou acesse com
              </span>
            </div>
          </div>

          <button
            id="google-signin-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-50 hover:bg-neutral-100 hover:text-neutral-900 text-neutral-700 font-medium text-sm border border-luxury-200 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Google Sign-In
          </button>

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

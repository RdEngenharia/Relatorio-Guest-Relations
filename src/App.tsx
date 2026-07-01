import React, { useState, useEffect } from "react";
import { auth, db, logoutUser } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, doc, getDocFromServer, writeBatch } from "firebase/firestore";
import { Occurrence } from "./types";

import AuthScreen from "./components/AuthScreen";
import DashboardView from "./components/DashboardView";
import CsvImporter from "./components/CsvImporter";

import { LayoutDashboard, Upload, LogOut, Hotel, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser]               = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [activeTab, setActiveTab]     = useState<"dashboard" | "import">("dashboard");

  useEffect(() => {
    async function testConnection() {
      try { await getDocFromServer(doc(db, "test", "connection")); }
      catch (error) { if (error instanceof Error && error.message.includes("the client is offline")) console.error("Firebase offline."); }
    }
    testConnection();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) { setOccurrences([]); return; }
    const unsub = onSnapshot(collection(db, "occurrences"), snap => {
      const list: Occurrence[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Occurrence));
      setOccurrences(list);
    }, err => console.error("Erro na leitura:", err));
    return () => unsub();
  }, [user]);

  const handleLogout = async () => {
    try { await logoutUser(); setUser(null); } catch (e) { console.error(e); }
  };

  // Apaga em batches de 400 (limite Firestore é 500 por batch)
  const deleteinBatches = async (ids: string[]) => {
    const BATCH_SIZE = 400;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      ids.slice(i, i + BATCH_SIZE).forEach(id => batch.delete(doc(db, "occurrences", id)));
      await batch.commit();
    }
  };

  const handleClearFlexspotData = async () => {
    const ids = occurrences
      .filter(occ => occ.ratings && Object.values(occ.ratings).some(v => v !== null && v !== undefined))
      .map(occ => occ.id);
    if (!ids.length) return;
    await deleteinBatches(ids);
  };

  const handleClearAllData = async () => {
    const ids = occurrences.map(occ => occ.id);
    if (!ids.length) return;
    await deleteinBatches(ids);
  };

  if (authLoading) {
    return (
      <div id="app-loading-gate" className="min-h-screen flex items-center justify-center bg-luxury-100 flex-col gap-3">
        <div className="w-10 h-10 border-4 border-luxury-200 border-t-brass-500 rounded-full animate-spin" />
        <span className="text-xs uppercase font-mono tracking-widest text-neutral-500 font-semibold">Inicializando Hotel Console...</span>
      </div>
    );
  }

  if (!user) return <AuthScreen onLoginSuccess={() => {}} />;

  return (
    <div id="guest-relations-app" className="min-h-screen flex flex-col bg-luxury-100/60 pb-12">
      {/* Header */}
      <header id="app-header" className="bg-luxury-800 text-white border-b border-luxury-900 shadow-md sticky top-0 z-55 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-neutral-900 border border-luxury-200/20 rounded-xl text-brass-500">
              <Hotel className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight font-display text-white">GUEST RELATIONS CONSOLE</h1>
              <p className="hidden sm:block text-[10px] text-neutral-400 font-serif tracking-wider">
                Reserva • Acomodação • Avaliações • Síntese Analítica
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[11px] font-bold text-neutral-100 line-clamp-1">{user.displayName || user.email}</span>
              <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-neutral-400 flex items-center justify-end gap-1">
                <UserCheck className="w-2.5 h-2.5 text-brass-500" /> Atendente Autorizado
              </span>
            </div>
            {user.photoURL
              ? <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-luxury-200 object-cover" />
              : <div className="w-8 h-8 rounded-full bg-brass-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">{String(user.displayName || user.email).charAt(0)}</div>
            }
            <button onClick={handleLogout} id="header-logout-btn"
              className="p-2 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer" title="Encerrar Sessão">
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Navegação — apenas 2 abas */}
      <nav id="app-navigation" className="bg-white border-b border-luxury-200 py-3 px-4 print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto gap-2 pr-4 pl-1">
          <button onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none shrink-0 ${activeTab === "dashboard" ? "bg-luxury-800 text-white shadow-xs" : "text-neutral-500 hover:bg-luxury-100"}`}>
            <LayoutDashboard className="w-4 h-4 text-brass-500" /> Dashboard
          </button>
          <button onClick={() => setActiveTab("import")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none shrink-0 ${activeTab === "import" ? "bg-luxury-800 text-white shadow-xs" : "text-neutral-500 hover:bg-luxury-100"}`}>
            <Upload className="w-4 h-4 text-brass-500" /> Importar Planilha
          </button>
        </div>
      </nav>

      {/* Conteúdo principal */}
      <main id="app-main-content" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <DashboardView occurrences={occurrences} onClearFlexspotData={handleClearFlexspotData} onClearAllData={handleClearAllData} />
            </motion.div>
          )}
          {activeTab === "import" && (
            <motion.div key="import" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="max-w-4xl mx-auto">
              <CsvImporter
                onImportFinished={() => setActiveTab("dashboard")}
                onCancel={() => setActiveTab("dashboard")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

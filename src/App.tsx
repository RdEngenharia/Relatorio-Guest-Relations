import React, { useState, useEffect } from "react";
import { auth, db, logoutUser } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, doc, getDocFromServer } from "firebase/firestore";
import { Occurrence } from "./types";

// Inner Components
import AuthScreen from "./components/AuthScreen";
import OccurrenceForm from "./components/OccurrenceForm";
import DashboardView from "./components/DashboardView";
import ReportGenerator from "./components/ReportGenerator";
import OccurrencesList from "./components/OccurrencesList";
import CsvImporter from "./components/CsvImporter";

// Icons
import { LayoutDashboard, PlusCircle, FileSpreadsheet, FileText, LogOut, Hotel, Sparkles, UserCheck, Upload } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "list" | "form" | "reports" | "import">("dashboard");
  const [editingOccurrence, setEditingOccurrence] = useState<Occurrence | null>(null);

  // Firestore connection checker mandated by Firebase Skill instructions
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (error) {
        if (error instanceof Error && error.message.includes("the client is offline")) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Listen to Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync occurrences list dynamically only when authenticated
  useEffect(() => {
    if (!user) {
      setOccurrences([]);
      return;
    }

    const unsubscribe = onSnapshot(
      collection(db, "occurrences"),
      (snapshot) => {
        const list: Occurrence[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Occurrence);
        });
        setOccurrences(list);
      },
      (error) => {
        console.error("Erro na leitura de ocorrências:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditRequest = (occ: Occurrence) => {
    setEditingOccurrence(occ);
    setActiveTab("form");
  };

  const handleSaveFinished = () => {
    setEditingOccurrence(null);
    setActiveTab("list");
  };

  const handleCancelEdit = () => {
    setEditingOccurrence(null);
    setActiveTab("list");
  };

  if (authLoading) {
    return (
      <div id="app-loading-gate" className="min-h-screen flex items-center justify-center bg-luxury-100 flex-col gap-3">
        <div className="w-10 h-10 border-4 border-luxury-200 border-t-brass-500 rounded-full animate-spin"></div>
        <span className="text-xs uppercase font-mono tracking-widest text-neutral-500 font-semibold">
          Inicializando Hotel Console...
        </span>
      </div>
    );
  }

  // Auth Gate
  if (!user) {
    return <AuthScreen onLoginSuccess={() => {}} />;
  }

  return (
    <div id="guest-relations-app" className="min-h-screen flex flex-col bg-luxury-100/60 pb-12">
      {/* Premium Header Layout */}
      <header id="app-header" className="bg-luxury-800 text-white border-b border-luxury-900 shadow-md sticky top-0 z-55 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-neutral-900 border border-luxury-200/20 rounded-xl text-brass-500">
              <Hotel className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight font-display text-white">
                GUEST RELATIONS CONSOLE
              </h1>
              <p className="hidden sm:block text-[10px] text-neutral-400 font-serif tracking-wider">
                Reserva • Acomodação • Ocorrência Diária • Síntese Analítica
              </p>
            </div>
          </div>

          {/* User profile & controls */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[11px] font-bold text-neutral-100 line-clamp-1">{user.displayName || user.email}</span>
              <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-neutral-400 flex items-center justify-end gap-1">
                <UserCheck className="w-2.5 h-2.5 text-brass-500" /> Atendente Autorizado
              </span>
            </div>

            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "Avatar"}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-luxury-200 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brass-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {String(user.displayName || user.email).charAt(0)}
              </div>
            )}

            <button
              onClick={handleLogout}
              id="header-logout-btn"
              className="p-2 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Encerrar Sessão"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav id="app-navigation" className="bg-white border-b border-luxury-200 py-3 px-4 print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto gap-2 pr-4 pl-1">
          <button
            onClick={() => { setActiveTab("dashboard"); setEditingOccurrence(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "dashboard"
                ? "bg-luxury-800 text-white shadow-xs"
                : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-brass-500" />
            Dashboard
          </button>

          <button
            onClick={() => { setActiveTab("list"); setEditingOccurrence(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "list"
                ? "bg-luxury-800 text-white shadow-xs"
                : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-brass-500" />
            Histórico Diário
          </button>

          <button
            onClick={() => { setActiveTab("form"); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "form"
                ? "bg-luxury-800 text-white shadow-xs"
                : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-brass-500" />
            {editingOccurrence ? "Editar Ocorrência" : "Lançar Ocorrência"}
          </button>

          <button
            onClick={() => { setActiveTab("reports"); setEditingOccurrence(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "reports"
                ? "bg-luxury-800 text-white shadow-xs"
                : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            <FileText className="w-4 h-4 text-brass-500" />
            Compilador (IA)
          </button>

          <button
            onClick={() => { setActiveTab("import"); setEditingOccurrence(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "import"
                ? "bg-luxury-800 text-white shadow-xs"
                : "text-neutral-500 hover:bg-luxury-100"
            }`}
          >
            <Upload className="w-4 h-4 text-brass-500" />
            Importar Planilha
          </button>
        </div>
      </nav>

      {/* Main Container Area */}
      <main id="app-main-content" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <DashboardView occurrences={occurrences} />
            </motion.div>
          )}

          {activeTab === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <OccurrencesList
                occurrences={occurrences}
                onEditRequested={handleEditRequest}
                onDeleteSuccess={() => {}}
              />
            </motion.div>
          )}

          {activeTab === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-w-3xl mx-auto"
            >
              <OccurrenceForm
                editingOccurrence={editingOccurrence}
                onSaveFinished={handleSaveFinished}
                onCancelEdit={handleCancelEdit}
              />
            </motion.div>
          )}

          {activeTab === "reports" && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ReportGenerator occurrences={occurrences} />
            </motion.div>
          )}

          {activeTab === "import" && (
            <motion.div
              key="import"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-w-4xl mx-auto"
            >
              <CsvImporter
                onImportFinished={() => setActiveTab("list")}
                onCancel={() => setActiveTab("list")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

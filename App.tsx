import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import OfferForm from './components/OfferForm';
import OfferDisplay from './components/OfferDisplay';
import Library from './components/Library';
import { ConfirmProvider } from './components/Confirm';
import { ToastProvider, useToasts } from './src/components/Toasts';
import { generateOfferText, generateIllustration, getApiUsage, API_DAILY_LIMIT, describeGenerationError, refreshAiStatus } from './services/mistralService';
import { api, getDemoUser, isDemoMode } from './services/api';
import { OfferInput, OfferData, SavedOffer, OfferCategory } from './types';

import { Loader2, Sparkles, Wand2, X, Save } from 'lucide-react';

const generateId = () => Math.random().toString(36).substring(2, 9);

const SavingModal = ({ isOpen, progress, onCancel }: { isOpen: boolean, progress: number, onCancel: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl shadow-2xl max-w-sm w-full mx-4 text-center relative overflow-hidden border border-slate-100 dark:border-slate-700">
        
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500"></div>
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-green-50 dark:bg-green-500/10 rounded-full flex items-center justify-center mb-6 text-green-500 relative group">
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping opacity-20"></div>
                <Save size={36} className="animate-pulse" />
            </div>
            
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Speichere Angebot</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-base leading-relaxed font-medium">
                Das Angebot wird in deiner Bibliothek gesichert...
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden relative">
                <div 
                    className="bg-gradient-to-r from-green-400 to-teal-500 h-full transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="text-xs text-slate-400 mt-2">{Math.round(progress)}%</p>
            
            <button 
              onClick={onCancel}
              className="mt-8 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium flex items-center gap-2 transition-colors px-4 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50"
            >
              <X size={16} />
              Abbrechen
            </button>
        </div>
      </div>
    </div>
  );
};

const GenerationModal = ({ isOpen, progress, onCancel }: { isOpen: boolean, progress: string, onCancel: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl shadow-2xl max-w-sm w-full mx-4 text-center relative overflow-hidden border border-slate-100 dark:border-slate-700">
        
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-slate-500/10 rounded-full blur-2xl"></div>

        <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-500/10 rounded-full flex items-center justify-center mb-6 text-slate-500 relative group">
                <div className="absolute inset-0 bg-slate-500/20 rounded-full animate-ping opacity-20"></div>
                <Sparkles className="absolute top-0 right-0 -mt-1 -mr-1 text-slate-400 animate-bounce" size={24} />
                <Wand2 size={36} className="animate-pulse" />
            </div>
            
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Zauberei im Gange</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 text-base leading-relaxed font-medium">
                {progress || "Die KI erstellt dein pädagogisches Konzept..."}
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-400 to-slate-600 w-1/2 animate-[slide_1.5s_ease-in-out_infinite] rounded-full"></div>
            </div>
            <style>{`
              @keyframes slide {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
            `}</style>
            
            <button 
              onClick={onCancel}
              className="mt-8 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium flex items-center gap-2 transition-colors px-4 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700/50"
            >
              <X size={16} />
              Abbrechen
            </button>
        </div>
      </div>
    </div>
  );
};

const AppContent = ({ isDarkMode, toggleTheme }: { isDarkMode: boolean, toggleTheme: () => void }) => {
  const navigate = useNavigate();
  const [currentOffer, setCurrentOffer] = useState<OfferData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [apiUsage, setApiUsage] = useState(getApiUsage());
  const isCancelledRef = useRef(false);

  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const saveAbortControllerRef = useRef<AbortController | null>(null);
  /** Erst true nach erstem erfolgreichen Speichern / wenn Angebot aus Bibliothek — steuert Autosave. */
  const librarySyncedRef = useRef(false);

  const updateApiUsage = () => {
    setApiUsage(getApiUsage());
  };
  const toasts = useToasts();

  /** Einmal beim Start klären, ob der Server einen Mistral-Schlüssel hat. */
  useEffect(() => {
    void refreshAiStatus();
  }, []);

  const handleCancelGeneration = () => {
    isCancelledRef.current = true;
    setIsGenerating(false);
  };

  const handleCancelSave = () => {
      if (saveAbortControllerRef.current) {
          saveAbortControllerRef.current.abort();
          saveAbortControllerRef.current = null;
      }
      setIsSaving(false);
      setSaveProgress(0);
  };

  const handleGenerate = async (input: OfferInput) => {
    isCancelledRef.current = false;
    librarySyncedRef.current = false;
    setIsGenerating(true);
    setGenerationProgress("Konzept wird geschrieben...");
    setCurrentOffer(null);

    try {
      // 1. Generate Text Content
      const partialOffer = await generateOfferText(input);
      if (isCancelledRef.current) return;

      updateApiUsage();
      
      let fullOffer: OfferData = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        input,
        title: partialOffer.title || 'Neues Angebot',
        materials: partialOffer.materials || [],
        goals: partialOffer.goals || [],
        preparation: partialOffer.preparation || '',
        steps: partialOffer.steps || [],
        kamishibaiScenes: partialOffer.kamishibaiScenes
      };

      // 2. Auto-Generate Images for Kamishibai (Sequential & Blocking)
      if (input.category === OfferCategory.KAMISHIBAI && fullOffer.kamishibaiScenes) {
        const scenes = fullOffer.kamishibaiScenes;
        const newScenes = [...scenes];
        
        for (let i = 0; i < scenes.length; i++) {
            if (isCancelledRef.current) return;
            setGenerationProgress(`Generiere Bild ${i + 1} von ${scenes.length}...`);
            try {
                const url = await generateIllustration(scenes[i].imagePrompt, '4:3');
                if (url) {
                    newScenes[i] = { ...newScenes[i], imageUrl: url };
                }
            } catch (e) {
                console.error(`Failed to generate image for scene ${i}`, e);
            } finally {
                updateApiUsage();
                // Small delay to be nice to the API and avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        fullOffer.kamishibaiScenes = newScenes;
      } else if (fullOffer.steps && fullOffer.steps.length > 0) {
        // Auto-Generate Images for Steps (for all other categories)
        const steps = fullOffer.steps;
        const newSteps = [...steps];

        for (let i = 0; i < steps.length; i++) {
            if (isCancelledRef.current) return;
            // Only generate if there is a prompt
            if (steps[i].imagePrompt) {
                setGenerationProgress(`Generiere Bild für Schritt ${i + 1} von ${steps.length}...`);
                try {
                    const url = await generateIllustration(steps[i].imagePrompt!, '1:1');
                    if (url) {
                        newSteps[i] = { ...newSteps[i], imageUrl: url };
                    }
                } catch (e) {
                    console.error(`Failed to generate image for step ${i}`, e);
                } finally {
                    updateApiUsage();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
        fullOffer.steps = newSteps;
      }

      if (isCancelledRef.current) return;

      setCurrentOffer(fullOffer);
      setIsGenerating(false);
      navigate('/angebot');
      await persistOfferToLibrary(fullOffer);

    } catch (error) {
      if (!isCancelledRef.current) {
        console.error("Generation error:", error);
        const msg = describeGenerationError(error);
        toasts.push({ type: 'error', message: msg.length > 420 ? `${msg.slice(0, 417)}…` : msg });
        setIsGenerating(false);
      }
    }
  };

  const persistOfferToLibrary = async (offer: OfferData): Promise<boolean> => {
    const newSavedOffer: SavedOffer = { ...offer, savedAt: Date.now() };
    setIsSaving(true);
    setSaveProgress(0);

    saveAbortControllerRef.current = new AbortController();

    const progressInterval = setInterval(() => {
      setSaveProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);

    try {
      await api.saveOffer(newSavedOffer, saveAbortControllerRef.current.signal);

      clearInterval(progressInterval);
      setSaveProgress(100);
      setCurrentOffer(newSavedOffer);
      librarySyncedRef.current = true;
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsSaving(false);
      setSaveProgress(0);
      toasts.push({ type: 'success', message: 'Angebot wurde in der Bibliothek gespeichert.' });
      return true;
    } catch (error: unknown) {
      clearInterval(progressInterval);
      const err = error as { name?: string };
      if (err?.name === 'AbortError') {
        console.log('Save cancelled');
      } else {
        console.error('Failed to save offer:', error);
        toasts.push({
          type: 'error',
          message: `Fehler beim Speichern: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        });
      }
      setIsSaving(false);
      setSaveProgress(0);
      return false;
    }
  };

  const handleSelectFromLibrary = (offer: SavedOffer) => {
    librarySyncedRef.current = true;
    setCurrentOffer(offer);
    navigate('/angebot');
  };

  /** Nachbearbeitung im Angebot: debounced Speichern in die Bibliothek. */
  useEffect(() => {
    if (!currentOffer || !librarySyncedRef.current || isSaving) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const payload: SavedOffer = { ...currentOffer, savedAt: Date.now() };
          await api.saveOffer(payload);
        } catch (e) {
          console.error(e);
          toasts.push({
            type: 'error',
            message: `Änderungen nicht gespeichert: ${e instanceof Error ? e.message : 'Unbekannt'}`,
          });
        }
      })();
    }, 1300);
    return () => window.clearTimeout(t);
  }, [currentOffer, isSaving]);

  // Manual Image Generation Handlers (Fallback or for non-Kamishibai)
  const handleGenerateStepImage = async (index: number, prompt: string) => {
    if (!currentOffer) return null;
    const url = await generateIllustration(prompt, '1:1');
    if (url) {
        const updatedOffer = { ...currentOffer };
        updatedOffer.steps[index].imageUrl = url;
        setCurrentOffer(updatedOffer);
    }
    updateApiUsage();
    return url;
  };

  const handleGenerateSceneImage = async (index: number, prompt: string) => {
    if (!currentOffer || !currentOffer.kamishibaiScenes) return null;
    const url = await generateIllustration(prompt, '4:3'); 
    if (url) {
        const updatedOffer = { ...currentOffer };
        if(updatedOffer.kamishibaiScenes) {
            updatedOffer.kamishibaiScenes[index].imageUrl = url;
        }
        setCurrentOffer(updatedOffer);
    }
    updateApiUsage();
    return url;
  };

  return (
    <Layout
      isDarkMode={isDarkMode}
      toggleTheme={toggleTheme}
      apiUsage={apiUsage}
      apiLimit={API_DAILY_LIMIT}
      demoName={isDemoMode() ? getDemoUser()?.name : undefined}
    >
      <GenerationModal isOpen={isGenerating} progress={generationProgress} onCancel={handleCancelGeneration} />
      <SavingModal isOpen={isSaving} progress={saveProgress} onCancel={handleCancelSave} />
      {isDemoMode() && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="mt-0.5 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Demo</span>
          <p className="leading-relaxed">
            Du siehst die Kita-Planer-Demo mit Beispieldaten von {getDemoUser()?.name ?? 'Max Muster'}.
            Alles, was du anlegst oder löschst, betrifft nur die Demo — eine Registrierung ist nicht nötig.
          </p>
        </div>
      )}
      <Routes>
        <Route path="/" element={
            <OfferForm onSubmit={handleGenerate} isGenerating={isGenerating} />
        } />
        
        <Route path="/angebot" element={
            currentOffer ? (
              <div className="relative animate-fade-in">
                <button 
                    onClick={() => navigate('/')}
                    className="mb-6 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-orange-500 dark:hover:text-orange-400 flex items-center gap-2 transition-colors"
                >
                    ← Zurück zum Formular
                </button>
                <OfferDisplay 
                    offer={currentOffer} 
                    onUpdate={(updatedOffer) => setCurrentOffer(updatedOffer)}
                    isAutoGenerating={false}
                    onGenerateImage={handleGenerateStepImage}
                    onGenerateSceneImage={handleGenerateSceneImage}
                />
              </div>
            ) : (
                <div className="text-center py-20 text-slate-500">
                    Kein Angebot ausgewählt. <button onClick={() => navigate('/')} className="text-orange-500 underline hover:text-orange-600">Neues erstellen</button>
                </div>
            )
        } />
        
        <Route path="/bibliothek" element={
          <Library 
            onSelect={handleSelectFromLibrary} 
          />
        } />
      </Routes>
    </Layout>
  );
};

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setIsDarkMode(storedTheme === 'dark');
    } else {
      setIsDarkMode(true); // Default to dark
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <Router>
      <ConfirmProvider>
        <ToastProvider>
        <AppContent isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        </ToastProvider>
        </ConfirmProvider>
    </Router>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { OfferData, OfferCategory, MaterialItem } from '../types';
import { CheckCircle, Clock, Users, Download, Scissors, Image as ImageIcon, Check, Edit2, FileText, Loader2 } from 'lucide-react';
import { useToasts } from '../src/components/Toasts';
import { preparationItemsForList } from '../utils/preparationFormat';
import { generatePDF } from '../utils/pdfGenerator';

interface OfferDisplayProps {
  offer: OfferData;
  onUpdate: (offer: OfferData) => void;
  isAutoGenerating?: boolean;
  onGenerateImage: (stepIndex: number, prompt: string) => Promise<string | null>;
  onGenerateSceneImage: (sceneIndex: number, prompt: string) => Promise<string | null>;
}

const PDFExportModal = ({ isOpen }: { isOpen: boolean }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md transition-all duration-300 animate-fade-in">
      <div className="bg-surface p-8 md:p-10 rounded-2xl shadow-card max-w-sm w-full mx-4 text-center relative overflow-hidden border border-line">
        
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-surface-2 rounded-full flex items-center justify-center mb-6 text-muted relative group">
                <div className="absolute inset-0 bg-line rounded-full animate-ping opacity-20"></div>
                <FileText size={36} className="animate-bounce" />
            </div>
            
            <h3 className="text-2xl font-bold text-ink mb-3">PDF wird erstellt</h3>
            <p className="text-muted mb-8 text-base leading-relaxed font-medium">
                Dein Angebot wird für den Druck vorbereitet...
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden relative">
                <div className="absolute inset-0 bg-accent/60 w-1/2 animate-[slide_1s_ease-in-out_infinite] rounded-full"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

const OfferDisplay: React.FC<OfferDisplayProps> = ({ offer, onUpdate, isAutoGenerating = false, onGenerateImage, onGenerateSceneImage }) => {
    const toasts = useToasts();
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);
  
  // Editing State
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);

  const isKamishibai = offer.input?.category === OfferCategory.KAMISHIBAI;
  const preparationItems = preparationItemsForList(offer.preparation);

  useEffect(() => {
    setEditingSection(null);
  }, [offer.id]);

  const handleGenerateStepImage = async (index: number, prompt: string) => {
    setLoadingImages(prev => ({...prev, [`step-${index}`]: true}));
    await onGenerateImage(index, prompt);
    setLoadingImages(prev => ({...prev, [`step-${index}`]: false}));
  };

  const handleGenerateSceneImage = async (index: number, prompt: string) => {
    setLoadingImages(prev => ({...prev, [`scene-${index}`]: true}));
    await onGenerateSceneImage(index, prompt);
    setLoadingImages(prev => ({...prev, [`scene-${index}`]: false}));
  };

  const handleExportPDF = async () => {
      setIsExporting(true);
      // Give React time to render the modal
      await new Promise(resolve => setTimeout(resolve, 800));
      
      try {
          // Wrap in another timeout to ensure browser paint
          setTimeout(() => {
              generatePDF(offer);
              setIsExporting(false);
          }, 100);
      } catch (e) {
          console.error(e);
          toasts.push({ type: 'error', message: 'Fehler beim PDF Export' });
          setIsExporting(false);
      }
  };

  // --- Editing Handlers ---

  const startEditing = (section: string, value: any) => {
      setEditingSection(section);
      setEditValue(value);
  };

  const cancelEditing = () => {
      setEditingSection(null);
      setEditValue(null);
  };

  const saveEditing = (section: string) => {
      const newOffer = { ...offer };

      if (section === 'title') {
          newOffer.title = editValue;
      } else if (section === 'goals') {
          newOffer.goals = editValue.split('\n')
            .map((g: string) => g.replace(/^[-•]\s*/, '').trim())
            .filter((g: string) => g !== '');
      } else if (section === 'materials') {
          newOffer.materials = editValue.split('\n').map((line: string) => {
              const match = line.match(/^(.*?)(?:\s*\((.*?)\))?$/);
              return {
                  item: match ? match[1].trim() : line.trim(),
                  amount: match && match[2] ? match[2].trim() : undefined
              };
          }).filter((m: MaterialItem) => m.item !== '');
      } else if (section === 'preparation') {
          newOffer.preparation = editValue;
      } else if (section.startsWith('scene-')) {
          const idx = parseInt(section.split('-')[1]);
          if (newOffer.kamishibaiScenes) {
              newOffer.kamishibaiScenes[idx] = { ...newOffer.kamishibaiScenes[idx], ...editValue };
          }
      } else if (section.startsWith('step-')) {
          const idx = parseInt(section.split('-')[1]);
          newOffer.steps[idx] = { ...newOffer.steps[idx], ...editValue };
      }

      onUpdate(newOffer);
      setEditingSection(null);
      setEditValue(null);
  };

  // Helper for Edit Buttons
  const EditBtn = ({ onClick }: { onClick: () => void }) => (
      <button onClick={onClick} className="p-1.5 text-muted hover:text-accent hover:bg-accent-soft rounded-full transition-colors" title="Bearbeiten">
          <Edit2 size={14} />
      </button>
  );

  const SaveCancelBtns = ({ onSave, onCancel }: { onSave: () => void, onCancel: () => void }) => (
      <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 rounded-lg transition-colors">Abbrechen</button>
          <button onClick={onSave} className="px-3 py-1.5 text-xs font-medium bg-accent text-on-accent hover:bg-accent-hover rounded-lg transition-colors flex items-center gap-1">
              <Check size={14} /> Speichern
          </button>
      </div>
  );

  return (
    <div className="space-y-6">
      <PDFExportModal isOpen={isExporting} />
      {/* Header Card */}
      <div className="bg-surface rounded-2xl shadow-card border border-line p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="flex-1">
             <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent-soft text-accent-ink text-xs font-bold tracking-wide uppercase mb-3">
                {offer.input?.category ?? '–'}
             </span>
             
             {editingSection === 'title' ? (
                 <div className="mb-4">
                     <input 
                        type="text" 
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full text-3xl md:text-4xl font-bold text-ink bg-surface-2 border border-line rounded-lg px-3 py-2 focus:ring-2 focus:ring-accent outline-none"
                     />
                     <SaveCancelBtns onSave={() => saveEditing('title')} onCancel={cancelEditing} />
                 </div>
             ) : (
                <div className="group flex items-start gap-3 mb-4">
                    <h1 className="text-3xl md:text-4xl font-bold text-ink leading-tight">{offer.title}</h1>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                        <EditBtn onClick={() => startEditing('title', offer.title)} />
                    </div>
                </div>
             )}

            <div className="flex flex-wrap items-center gap-6 text-muted text-sm font-medium">
                <span className="flex items-center gap-2"><Clock size={18} className="text-accent"/> {offer.input?.duration ?? '–'}</span>
                <span className="flex items-center gap-2"><Users size={18} className="text-accent"/> {offer.input?.targetGroup ?? '–'}</span>
            </div>
          </div>
          
          <div className="flex gap-3 w-full lg:w-auto">
             <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-surface-2 text-ink rounded-xl hover:bg-line font-medium transition-colors"
            >
                {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Meta Info */}
        <div className="space-y-6 xl:col-span-1">
            {/* Goals */}
            <div className="bg-surface rounded-2xl shadow-sm border border-line p-6 group">
                <div className="flex justify-between items-center mb-4 border-b border-line pb-3">
                    <h3 className="font-bold text-ink flex items-center gap-2">
                        <CheckCircle size={20} className="text-success" /> Pädagogische Ziele
                    </h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <EditBtn onClick={() => startEditing('goals', offer.goals.map(g => `- ${g}`).join('\n'))} />
                    </div>
                </div>
                
                {editingSection === 'goals' ? (
                    <div>
                        <textarea 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full h-48 bg-surface-2 border border-line rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent outline-none resize-none"
                            placeholder="Ein Ziel pro Zeile..."
                        />
                        <SaveCancelBtns onSave={() => saveEditing('goals')} onCancel={cancelEditing} />
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {offer.goals.map((goal, i) => (
                            <li key={i} className="text-sm text-muted leading-relaxed flex items-start gap-2">
                                <span className="block w-1.5 h-1.5 bg-success rounded-full mt-1.5 shrink-0"></span>
                                {goal}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Materials */}
            <div className="bg-surface rounded-2xl shadow-sm border border-line p-6 group">
                <div className="flex justify-between items-center mb-4 border-b border-line pb-3">
                    <h3 className="font-bold text-ink flex items-center gap-2">
                        <Scissors size={20} className="text-warn" /> Material
                    </h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <EditBtn onClick={() => startEditing('materials', offer.materials.map(m => m.amount ? `${m.item} (${m.amount})` : m.item).join('\n'))} />
                    </div>
                </div>

                {editingSection === 'materials' ? (
                    <div>
                        <textarea 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full h-48 bg-surface-2 border border-line rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent outline-none resize-none"
                            placeholder="Material (Menge) pro Zeile..."
                        />
                        <SaveCancelBtns onSave={() => saveEditing('materials')} onCancel={cancelEditing} />
                    </div>
                ) : (
                    <ul className="space-y-0">
                        {offer.materials.map((mat, i) => (
                            <li key={i} className="flex justify-between items-center text-sm text-muted border-b border-line py-2 last:border-0">
                                <span>{mat.item}</span>
                                {mat.amount && <span className="text-xs bg-surface-2 px-2 py-0.5 rounded text-muted">{mat.amount}</span>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>

        {/* Right Column: Steps / Content */}
        <div className="xl:col-span-2 space-y-6">
            
            {/* Preparation */}
            <div className="bg-surface rounded-2xl shadow-sm border border-line p-6 group">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-ink">Vorbereitung</h3>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <EditBtn onClick={() => startEditing('preparation', offer.preparation)} />
                    </div>
                </div>
                
                {editingSection === 'preparation' ? (
                    <div>
                        <textarea 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full h-32 bg-surface-2 border border-line rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent outline-none resize-none"
                        />
                        <SaveCancelBtns onSave={() => saveEditing('preparation')} onCancel={cancelEditing} />
                    </div>
                ) : preparationItems.length === 0 ? (
                    <p className="text-muted text-sm italic">Keine Vorbereitung angegeben.</p>
                ) : (
                    <ol className="list-decimal pl-5 space-y-2 text-muted leading-relaxed marker:text-accent marker:font-semibold">
                      {preparationItems.map((line, i) => (
                        <li key={i} className="pl-1">{line}</li>
                      ))}
                    </ol>
                )}
            </div>

            {/* Render Steps OR Kamishibai Scenes */}
            {isKamishibai ? (
                 <div className="space-y-8 mt-8">
                     <div className="flex items-center gap-4 mb-6">
                         <div className="h-px bg-line flex-1"></div>
                         <h2 className="text-2xl font-hand font-bold text-ink">Die Geschichte</h2>
                         <div className="h-px bg-line flex-1"></div>
                     </div>
                     
                     {offer.kamishibaiScenes?.map((scene, idx) => (
                        <div key={idx} className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden group hover:shadow-card transition-shadow">
                            <div className="p-4 bg-accent-soft border-b border-accent/20 flex justify-between items-center">
                                <span className="font-bold text-accent-ink">Szene {scene.sceneNumber}</span>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <EditBtn onClick={() => startEditing(`scene-${idx}`, { storyText: scene.storyText, imagePrompt: scene.imagePrompt })} />
                                </div>
                            </div>
                            
                            {editingSection === `scene-${idx}` ? (
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted uppercase mb-1">Erzähltext</label>
                                        <textarea 
                                            value={editValue.storyText}
                                            onChange={(e) => setEditValue({...editValue, storyText: e.target.value})}
                                            className="w-full h-32 bg-surface-2 border border-line rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted uppercase mb-1">Bildbeschreibung (Prompt)</label>
                                        <textarea 
                                            value={editValue.imagePrompt}
                                            onChange={(e) => setEditValue({...editValue, imagePrompt: e.target.value})}
                                            className="w-full h-20 bg-surface-2 border border-line rounded-lg p-3 text-xs focus:ring-2 focus:ring-accent outline-none"
                                        />
                                    </div>
                                    <SaveCancelBtns onSave={() => saveEditing(`scene-${idx}`)} onCancel={cancelEditing} />
                                </div>
                            ) : (
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Image Section */}
                                    <div className="aspect-[4/3] bg-surface-2 rounded-xl flex items-center justify-center relative overflow-hidden border border-line">
                                        {scene.imageUrl ? (
                                            <img src={scene.imageUrl} alt={`Szene ${scene.sceneNumber}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                                        ) : (
                                            <div className="text-center p-6 w-full">
                                                <p className="text-xs text-muted mb-4 italic line-clamp-4">{scene.imagePrompt}</p>
                                                
                                                {/* Auto-generating state or manual button */}
                                                {isAutoGenerating ? (
                                                    <div className="flex flex-col items-center justify-center text-accent gap-2 animate-pulse">
                                                        <Loader2 className="animate-spin" size={24} />
                                                        <span className="text-xs font-bold uppercase tracking-wider">Malt...</span>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleGenerateSceneImage(idx, scene.imagePrompt)}
                                                        disabled={loadingImages[`scene-${idx}`]}
                                                        className="bg-surface shadow-sm border border-line text-accent px-4 py-2 rounded-full text-sm font-medium transition-colors mx-auto hover:bg-accent-soft"
                                                    >
                                                        {loadingImages[`scene-${idx}`] ? 'Malt...' : 'Bild generieren'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {/* Text Section */}
                                    <div className="flex items-center">
                                        <p className="text-lg font-serif text-ink leading-loose whitespace-pre-wrap">
                                            "{scene.storyText}"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                     ))}
                 </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-ink">Ablauf</h2>
                    {offer.steps.map((step, idx) => (
                        <div key={idx} className="bg-surface rounded-xl shadow-sm border border-line overflow-hidden flex flex-col relative group">
                            
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-accent"></div>
                            
                            {editingSection === `step-${idx}` ? (
                                <div className="p-5 ml-2">
                                    <div className="mb-3">
                                        <label className="block text-xs font-bold text-muted uppercase mb-1">Anweisung</label>
                                        <textarea 
                                            value={editValue.instruction}
                                            onChange={(e) => setEditValue({...editValue, instruction: e.target.value})}
                                            className="w-full h-32 bg-surface-2 border border-line rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent outline-none"
                                        />
                                    </div>
                                    <SaveCancelBtns onSave={() => saveEditing(`step-${idx}`)} onCancel={cancelEditing} />
                                </div>
                            ) : (
                                <div className="p-5 flex-1 ml-2">
                                    <div className="flex justify-between items-start mb-2">
                                         <span className="text-xs font-bold text-accent uppercase tracking-wider">Schritt {step.step}</span>
                                         <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <EditBtn onClick={() => startEditing(`step-${idx}`, { instruction: step.instruction })} />
                                         </div>
                                    </div>
                                    <p className="text-ink leading-relaxed whitespace-pre-wrap">{step.instruction}</p>
                                    
                                    {/* Image for Step */}
                                    {step.imagePrompt && (
                                         <div className="mt-4">
                                            {step.imageUrl ? (
                                                <img src={step.imageUrl} alt={`Schritt ${step.step}`} className="w-full max-w-xs h-48 object-cover rounded-lg shadow-sm border border-line" />
                                            ) : (
                                                <button 
                                                    onClick={() => handleGenerateStepImage(idx, step.imagePrompt!)}
                                                    disabled={loadingImages[`step-${idx}`]}
                                                    className="flex items-center gap-2 text-xs font-medium text-accent bg-accent-soft px-4 py-2 rounded-lg hover:bg-accent/15 transition-colors border border-accent/25"
                                                >
                                                    <ImageIcon size={14} />
                                                    {loadingImages[`step-${idx}`] ? 'Visualisierung läuft...' : 'Dazu ein Bild generieren'}
                                                </button>
                                            )}
                                         </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default OfferDisplay;
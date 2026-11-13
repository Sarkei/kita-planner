import React, { useState } from 'react';
import { OfferInput, OfferCategory, TargetGroup } from '../types';
import { Sparkles, Loader2, Brush, BookOpen, Music, FlaskConical, Calendar, Check } from 'lucide-react';

interface OfferFormProps {
  onSubmit: (data: OfferInput) => void;
  isGenerating: boolean;
}

const OfferForm: React.FC<OfferFormProps> = ({ onSubmit, isGenerating }) => {
  const [formData, setFormData] = useState<OfferInput>({
    topic: '',
    category: OfferCategory.MORGENKREIS,
    targetGroup: TargetGroup.REGELGRUPPE,
    isBilingual: false,
    duration: '30 Min',
    groupSize: 10
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const getIconForCategory = (cat: OfferCategory) => {
    switch (cat) {
        case OfferCategory.BASTELN: return <Brush size={18} />;
        case OfferCategory.KAMISHIBAI: return <BookOpen size={18} />;
        case OfferCategory.MUSIK: return <Music size={18} />;
        case OfferCategory.EXPERIMENTE: return <FlaskConical size={18} />;
        default: return null;
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-line p-6 md:p-10 relative overflow-hidden transition-colors">
      
      <div className="relative z-10 mb-8">
        <p className="app-label">Eingabe</p>
        <p className="mt-2 text-muted">Lass die KI ein kreatives pädagogisches Konzept erstellen.</p>
      </div>
      
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-8 relative z-10">
        
        {/* Topic */}
        <div className="group">
          <label className="block text-sm font-semibold text-ink mb-2">
            Thema <span className="font-normal text-muted text-xs ml-1 opacity-80 group-hover:opacity-100 transition-opacity">(Optional - KI überrascht dich)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              name="topic"
              placeholder="z.B. Der Frühling erwacht, Tiere im Winter... (oder leer lassen)"
              value={formData.topic}
              onChange={handleChange}
              className="w-full px-5 py-4 pl-12 rounded-xl bg-surface-2 border border-line text-ink focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none shadow-sm placeholder:text-placeholder"
            />
            <Calendar className="absolute left-4 top-4 text-muted" size={20} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-3">Kategorie</label>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(OfferCategory).map((cat) => (
                <label key={cat} className={`
                  flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200
                  ${formData.category === cat 
                    ? 'border-accent bg-surface-2 text-ink shadow-sm ring-1 ring-accent' 
                    : 'border-line bg-surface text-muted hover:bg-surface-2'}
                `}>
                  <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name="category"
                        value={cat}
                        checked={formData.category === cat}
                        onChange={handleChange}
                        className="peer sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.category === cat ? 'border-accent bg-accent' : 'border-line-strong'}`}>
                        {formData.category === cat && <div className="w-2 h-2 bg-surface rounded-full"></div>}
                      </div>
                  </div>
                  <div className="flex items-center gap-3 font-medium">
                    {getIconForCategory(cat)}
                    {cat}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {/* Target Group */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Zielgruppe</label>
              <div className="relative">
                <select
                    name="targetGroup"
                    value={formData.targetGroup}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-xl bg-surface-2 border border-line text-ink focus:ring-2 focus:ring-accent outline-none appearance-none"
                >
                    {Object.values(TargetGroup).map(grp => (
                    <option key={grp} value={grp}>{grp}</option>
                    ))}
                </select>
                <div className="absolute right-5 top-1/2 transform -translate-y-1/2 pointer-events-none text-muted">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 {/* Duration */}
                <div>
                <label className="block text-sm font-semibold text-ink mb-2">Dauer</label>
                <select
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:ring-2 focus:ring-accent outline-none"
                >
                    <option>5 Min</option>
                    <option>10 Min</option>
                    <option>15 Min</option>
                    <option>20 Min</option>
                    <option>25 Min</option>
                    <option>30 Min</option>
                    <option>45 Min</option>
                    <option>60 Min</option>
                    <option>90 Min</option>
                </select>
                </div>

                {/* Group Size */}
                <div>
                <label className="block text-sm font-semibold text-ink mb-2">Kinder</label>
                <input
                    type="number"
                    name="groupSize"
                    min="1"
                    max="30"
                    value={formData.groupSize}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-line text-ink focus:ring-2 focus:ring-accent outline-none"
                />
                </div>
            </div>

             {/* Language Toggle */}
             <label className="flex items-center p-4 rounded-xl border border-line bg-surface-2 cursor-pointer hover:bg-surface-3 transition-colors">
                <div className="relative">
                    <input
                        type="checkbox"
                        id="isBilingual"
                        name="isBilingual"
                        checked={formData.isBilingual}
                        onChange={(e) => setFormData(prev => ({...prev, isBilingual: e.target.checked}))}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-line-strong rounded-full peer peer-focus:ring-4 peer-focus:ring-accent/30 peer-checked:after:translate-x-full peer-checked:after:border-line-strong after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-surface after:border-line-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </div>
                <div className="ml-3">
                    <span className="block text-sm font-medium text-ink">Bilingual (Deutsch/Englisch)</span>
                    <span className="block text-xs text-muted">Integriert englische Vokabeln</span>
                </div>
             </label>
          </div>
        </div>

        <div className="pt-4">
            <button
            type="submit"
            disabled={isGenerating}
            className={`
                w-full py-4 rounded-xl text-on-accent font-bold text-lg shadow-card transition-all transform hover:-translate-y-1
                flex items-center justify-center gap-3
                ${isGenerating ? 'bg-surface-3 text-muted cursor-not-allowed shadow-none' : 'bg-accent hover:bg-accent-hover'}
            `}
            >
            {isGenerating ? (
                <>
                <Loader2 className="animate-spin" />
                <span>KI erstellt Konzept...</span>
                </>
            ) : (
                <>
                <Sparkles className="fill-current" />
                <span>
                    {formData.category === OfferCategory.KAMISHIBAI ? 'Kamishibai Geschichte erstellen' : 'Pädagogisches Angebot generieren'}
                </span>
                </>
            )}
            </button>
        </div>
      </form>
    </div>
  );
};

export default OfferForm;
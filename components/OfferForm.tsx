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
    <div className="bg-white dark:bg-kita-cardDark rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 p-6 md:p-10 relative overflow-hidden transition-colors">
      
      <div className="relative z-10 mb-8">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Neues Angebot</h2>
        <p className="text-slate-500 dark:text-slate-400">Lass die KI ein kreatives pädagogisches Konzept erstellen.</p>
      </div>
      
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-8 relative z-10">
        
        {/* Topic */}
        <div className="group">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Thema <span className="font-normal text-slate-400 text-xs ml-1 opacity-80 group-hover:opacity-100 transition-opacity">(Optional - KI überrascht dich)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              name="topic"
              placeholder="z.B. Der Frühling erwacht, Tiere im Winter... (oder leer lassen)"
              value={formData.topic}
              onChange={handleChange}
              className="w-full px-5 py-4 pl-12 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all outline-none shadow-sm placeholder:text-slate-400"
            />
            <Calendar className="absolute left-4 top-4 text-slate-400" size={20} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Kategorie</label>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(OfferCategory).map((cat) => (
                <label key={cat} className={`
                  flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200
                  ${formData.category === cat 
                    ? 'border-slate-400 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-400' 
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'}
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
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.category === cat ? 'border-slate-500 bg-slate-500' : 'border-slate-300 dark:border-slate-600'}`}>
                        {formData.category === cat && <div className="w-2 h-2 bg-white rounded-full"></div>}
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
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Zielgruppe</label>
              <div className="relative">
                <select
                    name="targetGroup"
                    value={formData.targetGroup}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-slate-400 outline-none appearance-none"
                >
                    {Object.values(TargetGroup).map(grp => (
                    <option key={grp} value={grp}>{grp}</option>
                    ))}
                </select>
                <div className="absolute right-5 top-1/2 transform -translate-y-1/2 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 {/* Duration */}
                <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Dauer</label>
                <select
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-slate-400 outline-none"
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
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Kinder</label>
                <input
                    type="number"
                    name="groupSize"
                    min="1"
                    max="30"
                    value={formData.groupSize}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-slate-400 outline-none"
                />
                </div>
            </div>

             {/* Language Toggle */}
             <label className="flex items-center p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="relative">
                    <input
                        type="checkbox"
                        id="isBilingual"
                        name="isBilingual"
                        checked={formData.isBilingual}
                        onChange={(e) => setFormData(prev => ({...prev, isBilingual: e.target.checked}))}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-sky-300 dark:peer-focus:ring-sky-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-sky-500"></div>
                </div>
                <div className="ml-3">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">Bilingual (Deutsch/Englisch)</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">Integriert englische Vokabeln</span>
                </div>
             </label>
          </div>
        </div>

        <div className="pt-4">
            <button
            type="submit"
            disabled={isGenerating}
            className={`
                w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-orange-500/30 transition-all transform hover:-translate-y-1
                flex items-center justify-center gap-3
                ${isGenerating ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'}
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
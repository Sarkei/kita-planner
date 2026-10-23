export enum OfferCategory {
  MORGENKREIS = 'Morgenkreis',
  TURNEN = 'Turnen/Bewegung',
  BASTELN = 'Basteln/Kunst',
  EXPERIMENTE = 'Experimente/MINT',
  KAMISHIBAI = 'Kamishibai',
  MUSIK = 'Musik',
  GESCHICHTE = 'Geschichte vorlesen'
}

export enum TargetGroup {
  KRIPPE = 'Krippe (0-3 Jahre)',
  REGELGRUPPE = 'Regelgruppe (3-6 Jahre)',
  VORSCHULE = 'Vorschule (5-6 Jahre)'
}

export interface OfferInput {
  topic: string;
  category: OfferCategory;
  targetGroup: TargetGroup;
  isBilingual: boolean; // false = Deutsch, true = Deutsch & Englisch
  groupSize?: number;
  duration: string;
}

export interface MaterialItem {
  item: string;
  amount?: string;
}

export interface KamishibaiScene {
  sceneNumber: number;
  imagePrompt: string;
  storyText: string;
  imageUrl?: string; // Base64 or URL
}

export interface OfferData {
  id: string;
  createdAt: string;
  input: OfferInput;
  title: string;
  materials: MaterialItem[];
  goals: string[];
  preparation: string;
  steps: {
    step: number;
    instruction: string;
    imageUrl?: string; // For crafting steps
    imagePrompt?: string;
  }[];
  kamishibaiScenes?: KamishibaiScene[]; // Only if category is Kamishibai
}

export interface SavedOffer extends OfferData {
  savedAt: number;
}
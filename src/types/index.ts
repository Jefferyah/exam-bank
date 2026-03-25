export interface QuestionOption {
  label: string;
  text: string;
}

export interface AiSolveResult {
  answer: string;
  confidence: number;
  reasoning: string;
  explanation: string;
  keyPoints: string[];
}

export interface ExamConfig {
  domains?: string[];
  difficulty?: number[];
  count: number;
  tags?: string[];
  questionIds?: string[];
  wrongOnly?: boolean;
  favoriteOnly?: boolean;
}

export interface QuestionWithRelations {
  id: string;
  stem: string;
  type: string;
  options: string;
  answer: string;
  explanation: string;
  wrongOptionExplanations: string | null;
  extendedKnowledge: string | null;
  domain: string;
  chapter: string | null;
  difficulty: number;
  tags: string;
  version: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

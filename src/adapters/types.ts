export interface RepoFile {
  path: string;
  content: string;
}

export interface Section {
  id: string;
  title: string;
  content: string;
  children?: Section[];
}

export interface Exercise {
  id: string;
  type: 'qa' | 'mcq' | 'flashcard';
  question: string;
  answer: string;
  options?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export interface ParsedRepo {
  sections: Section[];
  exercises: Exercise[];
  totalItems: number;
}

export interface RepoAdapter {
  id: string;
  name: string;
  source: string;
  description: string;
  tags: string[];
  icon: string;
  parseContent(files: RepoFile[]): ParsedRepo;
}

export interface RepoManifestEntry {
  id: string;
  name: string;
  source: string;
  description: string;
  tags: string[];
  icon: string;
  sectionCount: number;
  exerciseCount: number;
  lastFetched: string;
}

export interface LibraryManifest {
  repos: RepoManifestEntry[];
  generatedAt: string;
}

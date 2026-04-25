export type Role = 'New_Employee' | 'Manager';

export type IntegrationProvider = 'jira' | 'github' | 'outlook' | 'google_calendar' | 'granola' | 'knowledge_base';
export type IntegrationStatus = 'active' | 'disabled' | 'error';

export interface IntegrationConfig {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  credentials: string; // always "••••••••" from API
  lastSyncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceDocument {
  title: string;
  section: string;
  provider?: IntegrationProvider;
  url?: string;
  description?: string;
}
export type StruggleType = 'HUMAN' | 'TECHNICAL' | 'BOTH' | 'NONE';
export type CheckInStatus = 'pending' | 'completed' | 'missed';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  managerId: string | null;
  startDate: string;
  isAtRisk?: boolean;
}

export interface CheckIn {
  id: string;
  employeeId: string;
  status: CheckInStatus;
  dueAt: string;
  completedAt: string | null;
  sentimentScore: number | null;
  struggleType: StruggleType | null;
  questions: string[];
  responses: string[] | null;
  routing: RoutingResult | null;
}

export interface RoutingResult {
  struggleType: StruggleType;
  cultureChampions?: CultureChampion[];
  kbAnswers?: KBAnswer[];
  githubContacts?: ContactSuggestion[];
  message: string;
}

export interface CultureValue {
  id: string;
  name: string;
  description: string;
}

export interface CultureChampion {
  userId: string;
  name: string;
  email: string;
  cultureValueId: string;
  cultureValueName: string;
  bio: string;
}

export interface KBAnswer {
  answer: string;
  citation: string;
  confidence: number;
}

export interface ContactSuggestion {
  name: string;
  githubUsername: string;
  lastCommitDate: string;
  filePath: string;
}

export interface SentimentTrend {
  checkinId: string;
  date: string;
  score: number;
}

export interface ClassificationResult {
  sentimentScore: number;
  struggleType: StruggleType;
  implicatedValues: string[];
  summary: string;
}

export interface PeerReview {
  id: string;
  reviewerId: string;
  subjectId: string;
  subjectName: string;
  status: string;
  questions: string[];
  responses: string[] | null;
  managerNotes: string | null;
  createdAt: string;
}


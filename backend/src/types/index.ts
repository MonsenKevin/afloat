export type Role = 'New_Employee' | 'Manager';
export type StruggleType = 'HUMAN' | 'TECHNICAL' | 'BOTH' | 'NONE';
export type CheckInStatus = 'pending' | 'completed' | 'missed';

// Integration types
export type IntegrationProvider = 'jira' | 'github' | 'outlook' | 'google_calendar' | 'granola' | 'knowledge_base';
export type IntegrationStatus = 'active' | 'disabled' | 'error';

export interface IndexedDocument {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  sourceId: string;
  title: string;
  content: string;
  url: string;
  fetchedAt: string;
}

export interface IntegrationConfig {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  encryptedCredentials: string;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// Per-provider credential interfaces
export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export interface GitHubCredentials {
  token: string;
  repos: string[];
}

export interface OutlookCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface GoogleCalendarCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface GranolaCredentials {
  apiKey: string;
}

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

// Structured document entry used in StructuredAnswer.documents
export interface StructuredDocument {
  title: string;
  section: string;
  provider?: IntegrationProvider;
  url?: string;
  description?: string;
}

// Express request augmentation (backend only)
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        managerId: string | null;
        orgId: string;
      };
    }
  }
}

export type CategoryStatus = "active" | "archived";
export type SessionStatus = "completed" | "deleted";
export type MemoCaptureState = "pending" | "saved" | "skipped";
export type SessionSource = "device" | "app";
export type PeriodRange = 7 | 30;

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Daily goal in minutes; 0 means none. */
  goal: number;
  /** Weekly goal in minutes; 0 or missing means none. */
  weeklyGoal?: number;
  status: CategoryStatus;
}

export interface Session {
  id: string;
  categoryId: string;
  startedAt: string;
  endedAt?: string;
  source: SessionSource;
  status: SessionStatus;
  memo?: string;
  memoCaptureState?: MemoCaptureState;
  memoCaptureCreatedAt?: string;
  memoUpdatedAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

/** A session narrowed to one calendar day, carrying that day's share of its span. */
export type DaySession = Session & { dayDurationMs: number };

export interface ActiveSession {
  id: string;
  categoryId: string;
  startedAt: string;
  source: SessionSource;
  status: "running";
}

export interface EvidenceItem {
  label: string;
  value: string;
}

export type ReflectionKey = "comparison" | "top-share" | "rhythm";

export interface ReflectionFact {
  key: ReflectionKey;
  type: string;
  message: string;
  description: string;
  evidence: string;
  evidenceItems: EvidenceItem[];
  insufficient?: boolean;
}

export interface CategoryShare {
  category: Category;
  minutes: number;
  sessionCount: number;
}

export interface PeriodBounds {
  start: Date;
  end: Date;
  range: PeriodRange;
}

export interface ReflectionStats {
  bounds: PeriodBounds;
  periodLabel: string;
  totalMinutes: number;
  activeDays: number;
  activeDayAverage: number;
  sessionCount: number;
  startedSessions: Session[];
  categories: CategoryShare[];
}

export interface ReflectionReport {
  range: PeriodRange;
  current: ReflectionStats;
  previous: ReflectionStats;
  periodLabel: string;
  facts: ReflectionFact[];
  fingerprint: string;
}

export interface AiReflectionSnapshot extends ReflectionFact {
  range: PeriodRange;
  periodLabel: string;
  fingerprint: string;
}

export interface AiReflection {
  headline: string;
  factIndex: number;
  factSnapshot: AiReflectionSnapshot;
  createdAt: string;
}

export interface CompanionSettings {
  voice: boolean;
  idleMinutes: number;
}

export type ToyFamily = "spike" | "bouncer";

/** Who this device's records belong to. No login: the toy you pick is your identity. */
export interface Profile {
  name: string;
  toy: ToyFamily;
  toyName: string;
  createdAt: string;
}

export interface AppState {
  profile: Profile | null;
  companion: CompanionSettings;
  categories: Category[];
  assignments: string[];
  sessions: Session[];
  activeSession: ActiveSession | null;
  historyRange: PeriodRange;
  reflectionRange: PeriodRange;
  aiReflection: AiReflection | null;
  updatedAt: string;
}

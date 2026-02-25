import { 
  StartupPhase, 
  StartupStatus, 
  DependencyType 
} from '../enums/startup-phase.enum';

export interface StartupPhaseConfig {
  phase: StartupPhase;
  name: string;
  dependencies: DependencyType[];
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface DependencyCheck {
  type: DependencyType;
  name: string;
  check: () => Promise<boolean>;
  timeout: number;
  critical: boolean;
}

export interface StartupReport {
  totalDuration: number;
  phases: PhaseReport[];
  overallStatus: StartupStatus;
  errors: string[];
  warnings: string[];
}

export interface PhaseReport {
  phase: StartupPhase;
  status: StartupStatus;
  duration: number;
  dependencies: DependencyReport[];
  errors: string[];
  warnings: string[];
}

export interface DependencyReport {
  type: DependencyType;
  name: string;
  status: StartupStatus;
  duration: number;
  error?: string;
}

export interface StartupMetrics {
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  phaseMetrics: Map<StartupPhase, number>;
  dependencyMetrics: Map<DependencyType, number>;
}

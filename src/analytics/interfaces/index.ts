export interface TrendItem {
  year: number;
  category: string;
  count: number;
}

export interface SupervisorStats {
  supervisorId: string;
  supervisorName: string;
  totalWorks: number;
  avgScore: number;
}

export interface ScoreDistribution {
  range: string;
  count: number;
}

export interface DashboardData {
  totalWorks: number;
  totalUsers: number;
  totalSupervisors: number;
  avgQualityScore: number;
  recentWorks: number;
}

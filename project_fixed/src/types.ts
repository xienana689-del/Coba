
export enum CameraType {
  SIMULATED = 'SIMULATED',
  WEBCAM = 'WEBCAM',
  STATIC = 'STATIC'
}

export interface NvrDevice {
  id: string; // e.g. "NVR-01"
  name: string; // e.g. "Main Warehouse"
  ip: string;
  port: string;
  username: string;
  password?: string;
  protocol: string;
  status: 'ONLINE' | 'OFFLINE' | 'AUTH_FAILURE';
  addedAt: number;
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  nvrId: string; // ID of the Network Video Recorder
  type: CameraType;
  sourceUrl?: string; // For simulated/static images
  isOnline: boolean;
  isRecording: boolean;
  statusChangedAt: number; // Timestamp when status (online/offline) last changed
  lastAnalysis?: AnalysisResult;
  lastUpdate: number;
}

export interface FaultRecord {
  id: string;
  cameraId: string;
  cameraName: string;
  location: string;
  nvrId: string;
  timeOff: number;
  timeOn?: number; // undefined if still active (offline)
  acknowledged: boolean;
}

export interface AnalysisResult {
  timestamp: string;
  summary: string;
  personCount: number;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedObjects: string[];
  anomalies: string[];
}

export interface Alert {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: number;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  thumbnail?: string; // Base64 of the frame
}

export interface ChartDataPoint {
  time: string;
  threatLevel: number; // 0-100
  events: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  lastActive: number;
  status: 'ACTIVE' | 'SUSPENDED';
}

import { Camera, CameraType, NvrDevice, User, Alert, FaultRecord } from '../types';

// Storage Keys
const KEYS = {
  CAMERAS: 'sentinel_cameras',
  NVRS: 'sentinel_nvrs',
  USERS: 'sentinel_users',
  ALERTS: 'sentinel_alerts',
  FAULTS: 'sentinel_faults',
  INIT: 'sentinel_initialized'
};

// Helper ID Generator
const generateId = () => Math.random().toString(36).substring(2, 15);

// --- SEED DATA GENERATORS ---
const generateInitialSystem = () => {
  const cameras: Camera[] = [];
  const nvrs: NvrDevice[] = [];
  
  // 10 NVRs
  const nvrConfigs = Array.from({ length: 10 }, (_, i) => ({
    id: `NVR-${(i + 1).toString().padStart(2, '0')}`,
    name: i < 3 ? 'Main Building Core' : i < 6 ? 'Warehouse Sector' : 'Perimeter Defense',
    location: i < 3 ? 'Main Building' : i < 6 ? 'Warehouse' : 'Perimeter',
    prefix: i < 3 ? 'MB' : i < 6 ? 'WH' : 'EXT',
    ip: `192.168.1.${50 + i}`
  }));

  let globalIndex = 1;
  
  nvrConfigs.forEach(nvr => {
    // Create NVR Record
    nvrs.push({
      id: nvr.id,
      name: `${nvr.name} ${nvr.id.split('-')[1]}`,
      ip: nvr.ip,
      port: '8000',
      username: 'admin',
      password: 'password123',
      protocol: 'ONVIF',
      status: 'ONLINE',
      addedAt: Date.now()
    });

    // Distribute ~38 cameras per NVR
    const count = 38 + Math.floor(Math.random() * 5); 
    
    for (let i = 1; i <= count; i++) {
      const isOffline = Math.random() > 0.98; 
      const downtime = isOffline ? Math.floor(Math.random() * (1000 * 60 * 60 * 5)) : 0;
      
      cameras.push({
        id: `cam-${globalIndex.toString().padStart(4, '0')}`,
        name: `${nvr.prefix}-CAM-${i.toString().padStart(2, '0')}`,
        location: `${nvr.location} Zone ${Math.ceil(i/5)}`,
        nvrId: nvr.id,
        type: CameraType.SIMULATED,
        sourceUrl: `https://picsum.photos/800/600?random=${globalIndex}`,
        isOnline: !isOffline,
        isRecording: !isOffline,
        statusChangedAt: Date.now() - (isOffline ? downtime : 1000 * 60 * 60 * 24 * (Math.random() * 10)),
        lastUpdate: Date.now()
      });
      globalIndex++;
    }
  });

  return { cameras, nvrs };
};

const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'System Admin', email: 'admin@sentinel.ai', role: 'ADMIN', lastActive: Date.now(), status: 'ACTIVE' },
  { id: 'u2', name: 'Officer Davis', email: 'davis.ops@sentinel.ai', role: 'OPERATOR', lastActive: Date.now() - 3600000, status: 'ACTIVE' },
  { id: 'u3', name: 'Analyst Chen', email: 'chen.intel@sentinel.ai', role: 'VIEWER', lastActive: Date.now() - 86400000, status: 'ACTIVE' },
  { id: 'u4', name: 'Temp Auditor', email: 'audit.ext@agency.gov', role: 'VIEWER', lastActive: Date.now() - 604800000, status: 'SUSPENDED' },
];

// --- DATABASE SERVICE API ---

export const db = {
  // Initialize Database (Seed if empty)
  initialize: () => {
    const isInit = localStorage.getItem(KEYS.INIT);
    if (!isInit) {
      console.log("Initializing Local Database...");
      const { cameras, nvrs } = generateInitialSystem();
      
      // Generate initial alerts/faults based on seeded offline cameras
      const initialFaults: FaultRecord[] = cameras.filter(c => !c.isOnline).map(c => ({
        id: generateId(),
        cameraId: c.id,
        cameraName: c.name,
        location: c.location,
        nvrId: c.nvrId,
        timeOff: c.statusChangedAt,
        timeOn: undefined,
        acknowledged: false
      }));

      const initialAlerts: Alert[] = cameras.filter(c => !c.isOnline).slice(0, 5).map(c => ({ 
        id: generateId(),
        cameraId: c.id,
        cameraName: c.name,
        timestamp: c.statusChangedAt,
        message: `Connection lost with ${c.nvrId}. Signal unavailable.`,
        severity: 'WARNING',
      }));

      localStorage.setItem(KEYS.CAMERAS, JSON.stringify(cameras));
      localStorage.setItem(KEYS.NVRS, JSON.stringify(nvrs));
      localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
      localStorage.setItem(KEYS.FAULTS, JSON.stringify(initialFaults));
      localStorage.setItem(KEYS.ALERTS, JSON.stringify(initialAlerts));
      localStorage.setItem(KEYS.INIT, 'true');
    }
  },

  // Read All Data
  getData: () => {
    return {
      cameras: JSON.parse(localStorage.getItem(KEYS.CAMERAS) || '[]') as Camera[],
      nvrs: JSON.parse(localStorage.getItem(KEYS.NVRS) || '[]') as NvrDevice[],
      users: JSON.parse(localStorage.getItem(KEYS.USERS) || '[]') as User[],
      alerts: JSON.parse(localStorage.getItem(KEYS.ALERTS) || '[]') as Alert[],
      faults: JSON.parse(localStorage.getItem(KEYS.FAULTS) || '[]') as FaultRecord[],
    };
  },

  // --- WRITE OPERATIONS ---

  saveCameras: (cameras: Camera[]) => {
    localStorage.setItem(KEYS.CAMERAS, JSON.stringify(cameras));
  },

  saveNvrs: (nvrs: NvrDevice[]) => {
    localStorage.setItem(KEYS.NVRS, JSON.stringify(nvrs));
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  saveAlerts: (alerts: Alert[]) => {
    localStorage.setItem(KEYS.ALERTS, JSON.stringify(alerts));
  },

  saveFaults: (faults: FaultRecord[]) => {
    localStorage.setItem(KEYS.FAULTS, JSON.stringify(faults));
  },

  // Factory Reset
  reset: () => {
    localStorage.clear();
    window.location.reload();
  },

  // Create Backup JSON
  createBackup: () => {
    const data = {
      cameras: JSON.parse(localStorage.getItem(KEYS.CAMERAS) || '[]'),
      nvrs: JSON.parse(localStorage.getItem(KEYS.NVRS) || '[]'),
      users: JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
      alerts: JSON.parse(localStorage.getItem(KEYS.ALERTS) || '[]'),
      faults: JSON.parse(localStorage.getItem(KEYS.FAULTS) || '[]'),
      timestamp: Date.now(),
      version: '1.0'
    };
    return JSON.stringify(data, null, 2);
  },

  // Restore Backup
  restoreBackup: (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      
      // Basic validation
      if (!data.cameras || !Array.isArray(data.cameras)) throw new Error("Invalid Format: Missing Cameras");
      if (!data.nvrs || !Array.isArray(data.nvrs)) throw new Error("Invalid Format: Missing NVRs");

      localStorage.setItem(KEYS.CAMERAS, JSON.stringify(data.cameras));
      localStorage.setItem(KEYS.NVRS, JSON.stringify(data.nvrs));
      localStorage.setItem(KEYS.USERS, JSON.stringify(data.users || []));
      localStorage.setItem(KEYS.ALERTS, JSON.stringify(data.alerts || []));
      localStorage.setItem(KEYS.FAULTS, JSON.stringify(data.faults || []));
      localStorage.setItem(KEYS.INIT, 'true');
      
      return true;
    } catch (e) {
      console.error("Restore failed:", e);
      return false;
    }
  }
};
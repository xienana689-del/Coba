import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, CameraType, AnalysisResult, Alert, FaultRecord, NvrDevice, User } from './types';
import CameraUnit from './components/CameraUnit';
import AlertsPanel from './components/AlertsPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import ToastSystem, { Toast, ToastType } from './components/ToastSystem';
import { db } from './services/databaseService';
import { 
  LayoutDashboard, Shield, BarChart3, Settings, Plus, Play, Pause, 
  Camera as CameraIcon, ChevronLeft, ChevronRight, Search, Server, 
  RefreshCw, CheckCircle2, AlertTriangle, MonitorPlay, X, Filter,
  HardDrive, Database, Cloud, Save, ExternalLink, Maximize2, Minimize2,
  Network, Lock, Globe, Router, Trash2, Pencil, PenLine, Users, UserCog,
  UserPlus, Mail, Ban, Check, RefreshCcw, Download, Upload, Laptop
} from 'lucide-react';

// Simple unique ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

const MAX_LIVE_CAMERAS = 32;

// Mock Storage Data (Static for now, could be db driven later)
const STORAGE_VOLUMES = [
  { id: 'VOL-01', name: 'Primary Cluster A', type: 'NVMe RAID 10', capacity: 64, used: 42.5, status: 'HEALTHY' },
  { id: 'VOL-02', name: 'Primary Cluster B', type: 'NVMe RAID 10', capacity: 64, used: 38.2, status: 'HEALTHY' },
  { id: 'VOL-ARCH', name: 'Cold Storage Array', type: 'HDD RAID 6', capacity: 250, used: 180.5, status: 'HEALTHY' },
  { id: 'VOL-BKUP', name: 'Offsite Backup', type: 'Cloud S3', capacity: 500, used: 210.1, status: 'SYNCING' },
];

export const App: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'settings'>('dashboard');
  
  // Application State
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [nvrs, setNvrs] = useState<NvrDevice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [faults, setFaults] = useState<FaultRecord[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  // Toast Notification State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Live Monitor State
  const [liveCameraIds, setLiveCameraIds] = useState<string[]>([]);
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const CAMERAS_PER_PAGE = 32;

  const [isScanning, setIsScanning] = useState(false);
  
  // NVR Form State (Add/Edit)
  const [showNvrModal, setShowNvrModal] = useState(false);
  const [isEditingNvr, setIsEditingNvr] = useState<string | null>(null); // NVR ID if editing
  const [nvrForm, setNvrForm] = useState({
    name: '',
    ip: '',
    port: '8000',
    username: 'admin',
    password: '',
    protocol: 'ONVIF'
  });
  const [isConnectingNvr, setIsConnectingNvr] = useState(false);

  // User Management State
  const [showUserModal, setShowUserModal] = useState(false);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
     name: '',
     email: '',
     role: 'OPERATOR' as 'ADMIN' | 'OPERATOR' | 'VIEWER',
  });

  // Delete Confirmation State
  const [deleteNvrId, setDeleteNvrId] = useState<string | null>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [addModalSearch, setAddModalSearch] = useState('');
  const [fullScreenCameraId, setFullScreenCameraId] = useState<string | null>(null);

  // File Input Ref for Restore
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Init DB (Seeds if empty)
    db.initialize();
    
    // 2. Load Data
    const data = db.getData();
    setCameras(data.cameras);
    setNvrs(data.nvrs);
    setUsers(data.users);
    setFaults(data.faults);
    setAlerts(data.alerts);
    
    // 3. Init Live View (Select first few cameras properly distributed)
    const initialLiveIds: string[] = [];
    const nvrCounts: Record<string, number> = {};
    for (const cam of data.cameras) {
      if (initialLiveIds.length >= MAX_LIVE_CAMERAS) break;
      const currentCount = nvrCounts[cam.nvrId] || 0;
      if (currentCount < 3) {
        initialLiveIds.push(cam.id);
        nvrCounts[cam.nvrId] = currentCount + 1;
      }
    }
    setLiveCameraIds(initialLiveIds);
    setIsLoaded(true);

    // 4. Listen for PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default browser banner
        e.preventDefault();
        // Stash the event so it can be triggered later
        setInstallPrompt(e);
    });

  }, []);

  // --- TOAST HELPER ---
  const addToast = (type: ToastType, title: string, message: string, duration = 5000) => {
    const newToast: Toast = { id: generateId(), type, title, message, duration };
    setToasts(prev => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- PERSISTENCE WRAPPERS ---
  const updateCameras = (newCameras: Camera[] | ((prev: Camera[]) => Camera[])) => {
      setCameras(prev => {
          const updated = typeof newCameras === 'function' ? newCameras(prev) : newCameras;
          db.saveCameras(updated);
          return updated;
      });
  };

  const updateNvrs = (newNvrs: NvrDevice[] | ((prev: NvrDevice[]) => NvrDevice[])) => {
    setNvrs(prev => {
        const updated = typeof newNvrs === 'function' ? newNvrs(prev) : newNvrs;
        db.saveNvrs(updated);
        return updated;
    });
  };

  const updateUsers = (newUsers: User[] | ((prev: User[]) => User[])) => {
    setUsers(prev => {
        const updated = typeof newUsers === 'function' ? newUsers(prev) : newUsers;
        db.saveUsers(updated);
        return updated;
    });
  };

  const updateAlerts = (newAlerts: Alert[] | ((prev: Alert[]) => Alert[])) => {
    setAlerts(prev => {
        const updated = typeof newAlerts === 'function' ? newAlerts(prev) : newAlerts;
        db.saveAlerts(updated);
        return updated;
    });
  };

  const updateFaults = (newFaults: FaultRecord[] | ((prev: FaultRecord[]) => FaultRecord[])) => {
    setFaults(prev => {
        const updated = typeof newFaults === 'function' ? newFaults(prev) : newFaults;
        db.saveFaults(updated);
        return updated;
    });
  };

  // Derived state
  const liveCameras = useMemo(() => cameras.filter(c => liveCameraIds.includes(c.id)), [cameras, liveCameraIds]);
  const fullScreenCamera = useMemo(() => cameras.find(c => c.id === fullScreenCameraId), [cameras, fullScreenCameraId]);
  const availableCameras = useMemo(() => {
    return cameras
      .filter(c => !liveCameraIds.includes(c.id))
      .filter(c => 
        addModalSearch === '' ||
        c.name.toLowerCase().includes(addModalSearch.toLowerCase()) ||
        c.location.toLowerCase().includes(addModalSearch.toLowerCase()) ||
        c.nvrId.toLowerCase().includes(addModalSearch.toLowerCase())
      );
  }, [cameras, liveCameraIds, addModalSearch]);

  // --- AUTOMATIC SIMULATION ENGINE ---
  useEffect(() => {
    if (!isLoaded) return;

    const interval = setInterval(() => {
      const now = Date.now();

      updateCameras(prevCameras => {
        let updatesOccurred = false;
        const changes: { type: 'REPAIR' | 'FAILURE' | 'NVR_FAILURE', camera?: Camera, nvrId?: string, message?: string }[] = [];
        const nvrIds = Array.from(new Set(prevCameras.map(c => c.nvrId)));
        
        // NVR Failure Simulation
        if (Math.random() < 0.002) {
           const targetNvr = nvrIds[Math.floor(Math.random() * nvrIds.length)];
           const nvrCameras = prevCameras.filter(c => c.nvrId === targetNvr);
           const isAlreadyDown = nvrCameras.every(c => !c.isOnline);
           
           if (!isAlreadyDown) {
              updatesOccurred = true;
              changes.push({ type: 'NVR_FAILURE', nvrId: targetNvr, message: `NVR Network Unreachable: ${targetNvr}` });
              // Mark NVR as offline in NVR State as well
              updateNvrs(curr => curr.map(n => n.id === targetNvr ? { ...n, status: 'OFFLINE' } : n));
              
              addToast('critical', 'Infrastructure Failure', `Critical connection loss to ${targetNvr}. Technician dispatch recommended.`, 8000);

              return prevCameras.map(c => {
                 if (c.nvrId === targetNvr) {
                    return { ...c, isOnline: false, isRecording: false, statusChangedAt: now };
                 }
                 return c;
              });
           }
        }

        const nextCameras = prevCameras.map(cam => {
          const roll = Math.random();
          // Auto-Repair
          if (!cam.isOnline && roll < 0.20) {
             // If NVR is marked offline, check if it should recover too
             const parentNvr = nvrs.find(n => n.id === cam.nvrId);
             if (parentNvr?.status === 'OFFLINE') {
                // Chance to repair NVR
                if (Math.random() > 0.5) return cam; // NVR still down
                updateNvrs(curr => curr.map(n => n.id === cam.nvrId ? { ...n, status: 'ONLINE' } : n));
             }

             updatesOccurred = true;
             const updatedCam = { ...cam, isOnline: true, isRecording: true, statusChangedAt: now };
             changes.push({ type: 'REPAIR', camera: updatedCam });
             return updatedCam;
          }
          // Individual Failure
          if (cam.isOnline && roll < 0.005) {
             updatesOccurred = true;
             const updatedCam = { ...cam, isOnline: false, isRecording: false, statusChangedAt: now };
             changes.push({ type: 'FAILURE', camera: updatedCam });
             return updatedCam;
          }
          return cam;
        });

        if (updatesOccurred) {
          // Toast for single camera failures (limit spam)
          const failures = changes.filter(c => c.type === 'FAILURE');
          if (failures.length > 0) {
              if (failures.length === 1 && failures[0].camera) {
                   addToast('warning', 'Signal Lost', `Video feed interrupted: ${failures[0].camera?.name}`);
              } else {
                   addToast('warning', 'Multiple Signals Lost', `${failures.length} cameras have gone offline.`);
              }
          }

          // Sync Faults
          updateFaults(prevFaults => {
             let nextFaults = [...prevFaults];
             changes.filter(c => c.type === 'NVR_FAILURE').forEach(change => {
                const relevantCams = prevCameras.filter(c => c.nvrId === change.nvrId);
                relevantCams.forEach(cam => {
                   const hasOpenFault = nextFaults.some(f => f.cameraId === cam.id && f.timeOn === undefined);
                   if (!hasOpenFault) {
                      nextFaults.push({
                         id: generateId(),
                         cameraId: cam.id,
                         cameraName: cam.name,
                         location: cam.location,
                         nvrId: cam.nvrId,
                         timeOff: now,
                         timeOn: undefined,
                         acknowledged: false
                      });
                   }
                });
             });
             changes.forEach(change => {
                // --- FIX TS18048: Assign to local const to ensure type safety in callback ---
                if (change.type === 'REPAIR' && change.camera) {
                   const camera = change.camera;
                   nextFaults = nextFaults.map(f => {
                      if (f.cameraId === camera.id && f.timeOn === undefined) {
                         return { ...f, timeOn: now };
                      }
                      return f;
                   });
                } else if (change.type === 'FAILURE' && change.camera) {
                   const camera = change.camera;
                   nextFaults.push({
                      id: generateId(),
                      cameraId: camera.id,
                      cameraName: camera.name,
                      location: camera.location,
                      nvrId: camera.nvrId,
                      timeOff: now,
                      timeOn: undefined,
                      acknowledged: false
                   });
                }
             });
             return nextFaults;
          });

          // Sync Alerts
          updateAlerts(prevAlerts => {
             const newAlerts: Alert[] = [];
             changes.filter(c => c.type === 'NVR_FAILURE').forEach(c => {
                 newAlerts.push({
                    id: generateId(),
                    cameraId: 'SYSTEM',
                    cameraName: c.nvrId || 'System',
                    timestamp: now,
                    message: c.message || 'Network Failure',
                    severity: 'CRITICAL'
                 });
             });
             changes.filter(c => c.type === 'FAILURE' && c.camera).forEach(c => {
                 if (c.camera) {
                    newAlerts.push({
                        id: generateId(),
                        cameraId: c.camera.id,
                        cameraName: c.camera.name,
                        timestamp: now,
                        message: `Connection lost with ${c.camera.nvrId}. Signal unavailable.`,
                        severity: 'WARNING'
                    });
                 }
             });
             return [...newAlerts, ...prevAlerts];
          });
          return nextCameras;
        }
        return prevCameras;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [nvrs, isLoaded]);

  const handleAnalysisResult = (cameraId: string, result: AnalysisResult, frame: string) => {
    updateCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, lastAnalysis: result, lastUpdate: Date.now() } : cam));
    
    if (result.threatLevel === 'CRITICAL') {
        addToast('critical', 'CRITICAL THREAT DETECTED', `${result.summary}. Location: ${cameras.find(c => c.id === cameraId)?.location}`, 10000);
    } else if (result.threatLevel === 'HIGH') {
        addToast('warning', 'High Threat Detected', `Suspicious activity on ${cameras.find(c => c.id === cameraId)?.name}.`);
    }

    if (['HIGH', 'CRITICAL'].includes(result.threatLevel) || result.anomalies.length > 0) {
      updateAlerts(prev => [{
        id: generateId(),
        cameraId,
        cameraName: cameras.find(c => c.id === cameraId)?.name || 'Unknown',
        timestamp: Date.now(),
        severity: result.threatLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        message: `${result.threatLevel}: ${result.anomalies.join(', ') || 'Suspicious activity'}`,
        thumbnail: frame
      }, ...prev]);
    }
  };

  const handleReconnect = (cameraId: string) => {
    const cam = cameras.find(c => c.id === cameraId);
    updateCameras(prev => prev.map(c => c.id === cameraId ? { ...c, isOnline: true, isRecording: true, statusChangedAt: Date.now() } : c));
    updateFaults(prev => prev.map(f => (f.cameraId === cameraId && f.timeOn === undefined) ? { ...f, timeOn: Date.now() } : f));
    updateAlerts(prev => prev.filter(a => a.cameraId !== cameraId));
    addToast('success', 'Connection Restored', `Signal recovered for ${cam?.name || cameraId}`);
  };

  const addWebcam = () => {
    if (liveCameraIds.length >= MAX_LIVE_CAMERAS) return alert("Maximum feeds reached.");
    const newCam: Camera = {
      id: `cam-${generateId()}`,
      name: `Local Feed ${cameras.length + 1}`,
      location: 'Local Device',
      nvrId: 'LOCAL',
      type: CameraType.WEBCAM,
      isOnline: true,
      isRecording: true,
      statusChangedAt: Date.now(),
      lastUpdate: Date.now()
    };
    updateCameras(prev => [newCam, ...prev]);
    setLiveCameraIds(prev => [newCam.id, ...prev]);
    addToast('success', 'Webcam Added', 'Local video feed is now active.');
  };
  
  const handlePinCamera = (cameraId: string) => {
    if (liveCameraIds.length >= MAX_LIVE_CAMERAS) return alert("Maximum feeds reached.");
    setLiveCameraIds(prev => [cameraId, ...prev]);
    addToast('info', 'Feed Monitored', 'Camera added to live view grid.');
  };

  const handleUnpinCamera = (cameraId: string) => setLiveCameraIds(prev => prev.filter(id => id !== cameraId));

  // --- PWA INSTALL HANDLER ---
  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        addToast('success', 'Installing...', 'The app is being added to your system.');
      } else {
        console.log('User dismissed the install prompt');
      }
      setInstallPrompt(null);
    });
  };

  // --- BACKUP & RESTORE HANDLERS ---
  const handleExportData = () => {
     const jsonStr = db.createBackup();
     const blob = new Blob([jsonStr], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `sentinel_backup_${new Date().toISOString().slice(0,10)}.json`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     addToast('success', 'Backup Downloaded', 'System configuration exported successfully.');
  };

  const handleImportTrigger = () => {
     if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = (event) => {
        if (event.target?.result) {
           const success = db.restoreBackup(event.target.result as string);
           if (success) {
              addToast('success', 'System Restored', 'Database restoration complete. Reloading...');
              setTimeout(() => window.location.reload(), 2000);
           } else {
              addToast('error', 'Restore Failed', 'Invalid backup file format.', 6000);
           }
        }
     };
     reader.readAsText(file);
     // Reset value to allow re-uploading same file if needed
     e.target.value = '';
  };

  // --- NVR MANAGEMENT (ADD/EDIT/DELETE) ---

  const openAddNvrModal = () => {
     setIsEditingNvr(null);
     setNvrForm({ name: '', ip: '', port: '8000', username: 'admin', password: '', protocol: 'ONVIF' });
     setShowNvrModal(true);
  };

  const openEditNvrModal = (nvr: NvrDevice) => {
     setIsEditingNvr(nvr.id);
     setNvrForm({
        name: nvr.name,
        ip: nvr.ip,
        port: nvr.port,
        username: nvr.username,
        password: nvr.password || '', 
        protocol: nvr.protocol
     });
     setShowNvrModal(true);
  };

  const promptDeleteNvr = (nvrId: string) => {
    setDeleteNvrId(nvrId);
  };

  const executeDeleteNvr = () => {
     if (!deleteNvrId) return;

     // 1. Remove NVR
     updateNvrs(prev => prev.filter(n => n.id !== deleteNvrId));
     
     // 2. Remove Cameras
     updateCameras(prev => prev.filter(c => c.nvrId !== deleteNvrId));
     
     // 3. Remove from Live View
     const camerasToRemove = cameras.filter(c => c.nvrId === deleteNvrId).map(c => c.id);
     setLiveCameraIds(prev => prev.filter(id => !camerasToRemove.includes(id)));

     updateAlerts(prev => [{
        id: generateId(),
        cameraId: 'SYSTEM',
        cameraName: 'System',
        timestamp: Date.now(),
        message: `NVR Deleted: ${deleteNvrId}. All associated devices removed.`,
        severity: 'INFO'
     }, ...prev]);
     
     addToast('info', 'Device Removed', `NVR ${deleteNvrId} and associated cameras deleted.`);
     setDeleteNvrId(null);
  };

  const handleSaveNvr = () => {
     if (!nvrForm.ip || !nvrForm.username || !nvrForm.password) {
        addToast('error', 'Form Error', 'Please fill in IP, Username, and Password.');
        return;
     }

     setIsConnectingNvr(true);

     // Credentials Check
     const isValidAuth = nvrForm.username === 'admin' && nvrForm.password === '12345';
     const isNetworkReachable = Math.random() > 0.1;
     
     setTimeout(() => {
        const isSuccess = isValidAuth && isNetworkReachable;
        const initialStatus = isSuccess ? 'ONLINE' : (!isNetworkReachable ? 'OFFLINE' : 'AUTH_FAILURE');

        if (isEditingNvr) {
           // --- UPDATE EXISTING NVR ---
           updateNvrs(prev => prev.map(n => n.id === isEditingNvr ? {
              ...n,
              name: nvrForm.name || n.name,
              ip: nvrForm.ip,
              port: nvrForm.port,
              username: nvrForm.username,
              password: nvrForm.password,
              protocol: nvrForm.protocol,
              status: initialStatus
           } : n));

           // If credentials/ip changed and failed, offline the cameras
           if (!isSuccess) {
              updateCameras(prev => prev.map(c => c.nvrId === isEditingNvr ? { ...c, isOnline: false } : c));
           } else {
               // Re-online cameras if successful
               updateCameras(prev => prev.map(c => c.nvrId === isEditingNvr ? { ...c, isOnline: true } : c));
           }

           updateAlerts(prev => [{
                id: generateId(),
                cameraId: 'SYSTEM',
                cameraName: 'System',
                timestamp: Date.now(),
                message: `NVR Configuration Updated: ${isEditingNvr}. Status: ${initialStatus}`,
                severity: isSuccess ? 'INFO' : 'WARNING'
            }, ...prev]);
           
           addToast(isSuccess ? 'success' : 'warning', 'Configuration Saved', `NVR ${isEditingNvr} updated. Status: ${initialStatus}`);

        } else {
           // --- ADD NEW NVR ---
           const ipSegment = nvrForm.ip.split('.').pop() || Math.floor(Math.random() * 100).toString();
           const newNvrId = `NVR-${ipSegment.padStart(3, '0')}`;
           
           const newNvr: NvrDevice = {
              id: newNvrId,
              name: nvrForm.name || `New NVR ${newNvrId}`,
              ip: nvrForm.ip,
              port: nvrForm.port,
              username: nvrForm.username,
              password: nvrForm.password,
              protocol: nvrForm.protocol,
              status: initialStatus,
              addedAt: Date.now()
           };

           updateNvrs(prev => [...prev, newNvr]);

           // Generate Cameras
           const newCameras: Camera[] = [];
           for (let i = 1; i <= 8; i++) {
              newCameras.push({
                 id: `cam-${generateId()}`,
                 name: `CAM-${i.toString().padStart(2, '0')}`,
                 location: nvrForm.name || `External IP ${nvrForm.ip}`,
                 nvrId: newNvrId,
                 type: CameraType.SIMULATED,
                 sourceUrl: `https://picsum.photos/800/600?random=${Date.now() + i}`,
                 isOnline: isSuccess,
                 isRecording: isSuccess,
                 statusChangedAt: Date.now(),
                 lastUpdate: Date.now()
              });
           }
           updateCameras(prev => [...prev, ...newCameras]);
           
           if (!isSuccess) {
               updateFaults(prev => {
                   const newFaults = [...prev];
                   newCameras.forEach(cam => {
                       newFaults.push({
                           id: generateId(),
                           cameraId: cam.id,
                           cameraName: cam.name,
                           location: cam.location,
                           nvrId: cam.nvrId,
                           timeOff: Date.now(),
                           timeOn: undefined,
                           acknowledged: false
                       });
                   });
                   return newFaults;
               });
           }
           
           updateAlerts(prev => [{
                id: generateId(),
                cameraId: 'SYSTEM',
                cameraName: 'System',
                timestamp: Date.now(),
                message: isSuccess ? `NVR Added: ${newNvrId}` : `NVR Added with Error: ${newNvrId}`,
                severity: isSuccess ? 'INFO' : 'CRITICAL'
            }, ...prev]);

           addToast(isSuccess ? 'success' : 'error', isSuccess ? 'NVR Added' : 'Connection Failed', isSuccess ? `Device ${newNvrId} connected with 8 channels.` : `Device added but unreachable. Check network.`);
        }
        
        setIsConnectingNvr(false);
        setShowNvrModal(false);
     }, 1500);
  };

  // --- USER MANAGEMENT LOGIC ---

  const handleOpenUserModal = () => {
    setIsUserFormOpen(false);
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({ name: user.name, email: user.email, role: user.role });
    setIsUserFormOpen(true);
  };

  const handleAddUser = () => {
    setEditingUserId(null);
    setUserForm({ name: '', email: '', role: 'OPERATOR' });
    setIsUserFormOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
       updateUsers(prev => prev.filter(u => u.id !== userId));
       addToast('info', 'User Deleted', 'Account removed from system.');
    }
  };

  const toggleUserStatus = (userId: string) => {
     updateUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' } : u));
     addToast('info', 'Status Updated', 'User access status changed.');
  };

  const handleSaveUser = () => {
     if (!userForm.name || !userForm.email) return addToast('error', 'Validation Error', 'Name and Email are required.');
     
     if (editingUserId) {
        updateUsers(prev => prev.map(u => u.id === editingUserId ? { ...u, ...userForm } : u));
        addToast('success', 'User Updated', 'Account details saved successfully.');
     } else {
        const newUser: User = {
           id: generateId(),
           ...userForm,
           lastActive: 0,
           status: 'ACTIVE'
        };
        updateUsers(prev => [...prev, newUser]);
        addToast('success', 'User Created', 'New user added to the system.');
     }
     setIsUserFormOpen(false);
  };

  const simulateNetworkDiscovery = () => {
    setIsScanning(true);
    setTimeout(() => {
      const newIdNum = (nvrs.length + 1).toString().padStart(2, '0');
      const newNvrId = `NVR-${newIdNum}`;
      const newNvr: NvrDevice = {
         id: newNvrId,
         name: `Auto-Discovered NVR ${newIdNum}`,
         ip: `192.168.1.${100 + nvrs.length}`,
         port: '8000',
         username: 'admin',
         password: 'password123',
         protocol: 'ONVIF',
         status: 'ONLINE',
         addedAt: Date.now()
      };
      updateNvrs(prev => [...prev, newNvr]);

      const newCameras: Camera[] = [];
      for (let i = 1; i <= 16; i++) {
         newCameras.push({
            id: `cam-${generateId()}`,
            name: `AUTO-CAM-${i.toString().padStart(2, '0')}`,
            location: 'New Extension',
            nvrId: newNvrId,
            type: CameraType.SIMULATED,
            sourceUrl: `https://picsum.photos/800/600?random=${Date.now() + i}`,
            isOnline: true,
            isRecording: true,
            statusChangedAt: Date.now(),
            lastUpdate: Date.now()
         });
      }
      updateCameras(prev => [...prev, ...newCameras]);
      setLiveCameraIds(prev => {
         const availableSlots = MAX_LIVE_CAMERAS - prev.length;
         if (availableSlots > 0) return [...prev, ...newCameras.slice(0, availableSlots).map(c => c.id)];
         return prev;
      });
      setIsScanning(false);
      updateAlerts(prev => [{
         id: generateId(),
         cameraId: 'SYSTEM',
         cameraName: 'System',
         timestamp: Date.now(),
         message: `Network Discovery: Found NVR (${newNvrId}) + 16 Cams.`,
         severity: 'INFO'
      }, ...prev]);
      addToast('success', 'Discovery Complete', `Found 1 NVR and 16 Cameras.`);
    }, 2500);
  };

  const paginatedCameras = useMemo(() => {
     const startIndex = (currentPage - 1) * CAMERAS_PER_PAGE;
     return liveCameras.slice(startIndex, startIndex + CAMERAS_PER_PAGE);
  }, [liveCameras, currentPage]);
  const totalPages = Math.ceil(liveCameras.length / CAMERAS_PER_PAGE) || 1;
  useEffect(() => { if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages); }, [totalPages, currentPage]);
  const liveMonitorIsFull = liveCameraIds.length >= MAX_LIVE_CAMERAS;

  if (!isLoaded) {
      return (
          <div className="flex h-screen w-full bg-gray-950 items-center justify-center text-white flex-col gap-4">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
              <p className="text-gray-400 text-sm font-mono animate-pulse">Initializing Database...</p>
          </div>
      )
  }

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans overflow-hidden">
      <ToastSystem toasts={toasts} removeToast={removeToast} />
      
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-gray-950 border-r border-gray-800 flex flex-col justify-between transition-all duration-300 z-30">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-800">
            <div className="relative">
              <div className="absolute -inset-1 bg-cyan-500 rounded-full blur opacity-25"></div>
              <Shield className="w-8 h-8 text-cyan-400 relative z-10" />
            </div>
            <span className="ml-3 font-bold text-lg tracking-wider hidden lg:block text-white">SENTINEL<span className="text-cyan-400">AI</span></span>
          </div>
          <nav className="mt-8 space-y-2 px-2 lg:px-4">
            <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Live Monitor" />
            <NavButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<BarChart3 />} label="Command Center" />
            <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="System Config" />
          </nav>
        </div>
        <div className="p-4 border-t border-gray-800 space-y-4">
          
          {/* --- NEW: VISIBLE INSTALL BUTTON --- */}
          {installPrompt && (
              <button 
                  onClick={handleInstallClick}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-600/50 hover:bg-blue-600 hover:text-white transition-all group animate-pulse-fast"
              >
                  <Laptop className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold hidden lg:block">Install App</span>
              </button>
          )}

          <div className="hidden lg:block bg-gray-900/50 rounded-lg p-3 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
               <span className="text-xs font-semibold text-gray-400 uppercase">System Status</span>
               <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cameras.some(c => !c.isOnline) ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                  <span className="text-[10px] text-gray-500">{cameras.some(c => !c.isOnline) ? 'Alert' : 'OK'}</span>
               </div>
            </div>
            <div className="text-[10px] text-gray-500 space-y-1">
               <p>Total Cams: {cameras.length}</p>
               <p>NVR Units: {nvrs.length}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950 relative">
        {activeTab === 'dashboard' && (
          <header className="h-16 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-6 z-20">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                Live Operations Center
                <span className={`text-xs px-2 py-0.5 rounded border ${liveMonitorIsFull ? 'bg-orange-900/20 border-orange-700 text-orange-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                   {liveCameras.length} / {MAX_LIVE_CAMERAS} Active
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-4">
                  <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-1">
                     <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30 text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
                     <span className="text-xs font-mono text-gray-500 mx-2 w-16 text-center">Page {currentPage}/{totalPages}</span>
                     <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 hover:bg-gray-800 rounded disabled:opacity-30 text-gray-400"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                  <div className="h-6 w-px bg-gray-800 mx-1"></div>
                  <button onClick={() => setAutoMonitor(!autoMonitor)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${autoMonitor ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'}`}>
                    {autoMonitor ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>AI Auto-Guard {autoMonitor ? 'ON' : 'OFF'}</span>
                  </button>
                  <div className="h-6 w-px bg-gray-800 mx-1"></div>
                  <div className="flex gap-2">
                    <button onClick={addWebcam} disabled={liveMonitorIsFull} title="Add Webcam" className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg border border-gray-700"><CameraIcon className="w-4 h-4 text-gray-300" /></button>
                    <button onClick={() => setShowAddModal(true)} disabled={liveMonitorIsFull} title="Library" className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-lg border border-gray-700"><Plus className="w-4 h-4 text-gray-300" /></button>
                  </div>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'dashboard' && (
            <div className="h-full flex flex-row">
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2 auto-rows-fr pb-20">
                  {paginatedCameras.map(cam => (
                    <div key={cam.id} className="min-h-0 aspect-[4/3] sm:aspect-video lg:aspect-auto relative group cursor-pointer hover:ring-1 hover:ring-cyan-500/50 transition-all rounded-xl" onDoubleClick={() => setFullScreenCameraId(cam.id)}>
                      <CameraUnit camera={cam} onAnalyze={handleAnalysisResult} autoMonitor={autoMonitor} />
                      <div className="absolute top-1 right-1 z-30 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={(e) => { e.stopPropagation(); setFullScreenCameraId(cam.id); }} className="p-1 bg-black/50 hover:bg-gray-700 text-white rounded-md backdrop-blur-sm"><Maximize2 className="w-3 h-3" /></button>
                         <button onClick={(e) => { e.stopPropagation(); handleUnpinCamera(cam.id); }} className="p-1 bg-black/50 hover:bg-red-600/80 text-white rounded-md backdrop-blur-sm"><X className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                  {paginatedCameras.length < CAMERAS_PER_PAGE && !liveMonitorIsFull && (
                    <button onClick={() => setShowAddModal(true)} className="border-2 border-dashed border-gray-800 hover:border-cyan-500/50 bg-gray-900/30 hover:bg-gray-900/50 rounded-lg flex flex-col items-center justify-center text-gray-600 hover:text-cyan-400 transition-all min-h-0 aspect-video group">
                      <div className="p-4 rounded-full bg-gray-900 group-hover:bg-cyan-950/30 transition-colors mb-4"><Plus className="w-8 h-8" /></div>
                      <span className="text-sm font-medium">Add to Monitor</span>
                    </button>
                  )}
                  {paginatedCameras.length === 0 && <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500"><MonitorPlay className="w-16 h-16 mb-4 opacity-20" /><p>No cameras pinned to Live Monitor.</p></div>}
                </div>
              </div>
              <AlertsPanel alerts={alerts} />
            </div>
          )}

          {activeTab === 'analytics' && (
            <AnalyticsDashboard cameras={cameras} faults={faults} onResolveFault={handleReconnect} alerts={alerts} onShowStorage={() => setShowStorageModal(true)} />
          )}

          {activeTab === 'settings' && (
             <div className="p-10 h-full overflow-y-auto">
               <div className="max-w-4xl mx-auto space-y-8">
                  <div>
                     <h2 className="text-2xl font-bold text-white mb-2">System Configuration</h2>
                     <p className="text-gray-400">Manage NVR connections and discovery protocols.</p>
                  </div>
                  
                  {/* --- NEW: INSTALLATION CARD (Backup location) --- */}
                  {installPrompt && (
                      <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-800/50 rounded-xl p-6 flex items-center justify-between shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                          <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
                                  <Laptop className="w-6 h-6 text-blue-400" />
                              </div>
                              <div>
                                  <h3 className="font-bold text-white text-lg">Install Sentinel AI</h3>
                                  <p className="text-sm text-gray-400">Run this dashboard as a standalone desktop application for better performance.</p>
                              </div>
                          </div>
                          <button 
                             onClick={handleInstallClick}
                             className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                          >
                             Install Application
                          </button>
                      </div>
                  )}

                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-900/10 rounded-full blur-3xl"></div>
                       <div className="flex justify-between items-center mb-6 relative z-10">
                          <div>
                             <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2"><Router className="w-5 h-5 text-cyan-400" /> Manual Device Addition</h3>
                             <p className="text-sm text-gray-500 mt-1">Add NVR or IPC via static IP address (IVMS Protocol).</p>
                          </div>
                          <button onClick={openAddNvrModal} className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 transition-all shadow-sm">
                             <Plus className="w-4 h-4" /> Add NVR Manually
                          </button>
                       </div>
                    </div>
                    
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                       <div className="flex justify-between items-center mb-6">
                          <div><h3 className="text-lg font-semibold text-gray-200">Auto-Discovery</h3><p className="text-sm text-gray-500">Scan local network for new ONVIF/RTSP compliant NVRs.</p></div>
                          <button onClick={simulateNetworkDiscovery} disabled={isScanning} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${isScanning ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20'}`}>
                             {isScanning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                             {isScanning ? 'Scanning Network...' : 'Scan for New Devices'}
                          </button>
                       </div>

                       <div className="bg-gray-950 rounded-lg border border-gray-800 p-4">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Server className="w-4 h-4" /> Connected Network Video Recorders (NVRs)</h4>
                          <div className="space-y-2">
                             {nvrs.map(nvr => {
                                const camCount = cameras.filter(c => c.nvrId === nvr.id).length;
                                return (
                                   <div key={nvr.id} className="flex justify-between items-center p-3 bg-gray-900/50 rounded border border-gray-800 hover:border-gray-700 transition-colors group">
                                      <div className="flex items-center gap-4">
                                         <div className={`w-2 h-2 rounded-full ${nvr.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
                                         <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-sm text-gray-200">{nvr.name}</span>
                                                <span className="text-[10px] text-gray-500 font-mono border border-gray-800 px-1 rounded bg-black/30">{nvr.id}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                                                <span>{nvr.ip}:{nvr.port}</span>
                                                <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                                                <span>{camCount} Channels</span>
                                            </div>
                                         </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                         {nvr.status === 'ONLINE' ? <CheckCircle2 className="w-4 h-4 text-emerald-500/50" /> : <AlertTriangle className="w-4 h-4 text-red-500/50" />}
                                         <div className="h-4 w-px bg-gray-800 mx-1"></div>
                                         <button onClick={() => openEditNvrModal(nvr)} className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors" title="Edit Configuration">
                                            <Pencil className="w-4 h-4" />
                                         </button>
                                         <button onClick={() => promptDeleteNvr(nvr.id)} className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors" title="Delete Device">
                                            <Trash2 className="w-4 h-4" />
                                         </button>
                                      </div>
                                   </div>
                                );
                             })}
                             {nvrs.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">No NVRs connected. Add a device to start.</div>}
                          </div>
                       </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                     <div onClick={() => setShowStorageModal(true)} className="bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer hover:border-gray-700 hover:bg-gray-800/80 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-yellow-500/10 via-transparent to-transparent"></div>
                        <h3 className="font-semibold text-gray-300 mb-2 group-hover:text-white flex items-center gap-2">Storage Management <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" /></h3>
                        <p className="text-sm text-gray-500 mb-4">Configure retention policies and backup targets.</p>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3"><div className="h-full bg-yellow-500 w-[55%] shadow-[0_0_10px_rgba(234,179,8,0.3)]"></div></div>
                        <div className="flex justify-between items-end">
                           <div className="flex flex-col"><span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Used</span><span className="text-lg font-mono text-gray-200">471 TB</span></div>
                           <div className="flex flex-col items-end"><span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total</span><span className="text-lg font-mono text-gray-200">878 TB</span></div>
                        </div>
                     </div>
                     
                     {/* ENABLED USER PERMISSIONS CARD */}
                     <div 
                       onClick={handleOpenUserModal}
                       className="bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer hover:border-gray-700 hover:bg-gray-800/80 transition-all group relative overflow-hidden"
                     >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/10 via-transparent to-transparent"></div>
                        <h3 className="font-semibold text-gray-300 mb-2 group-hover:text-white flex items-center gap-2">
                           User Permissions <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                        </h3>
                        <p className="text-sm text-gray-500">Manage access control lists and role-based security.</p>
                        <div className="flex -space-x-2 mt-4 items-center">
                           {users.slice(0, 3).map((u, i) => (
                             <div key={i} className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs font-bold text-gray-300 uppercase">
                               {u.name.charAt(0)}
                             </div>
                           ))}
                           {users.length > 3 && (
                             <div className="w-8 h-8 rounded-full bg-gray-600 border-2 border-gray-900 flex items-center justify-center text-[10px] text-white">
                               +{users.length - 3}
                             </div>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* DATA MANAGEMENT */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                          <Database className="w-5 h-5 text-gray-500" /> Database Management
                      </h3>
                      <div className="flex items-center justify-between p-4 bg-gray-950 rounded-lg border border-gray-800">
                          <div>
                              <p className="text-sm font-bold text-gray-300">Local Persistence</p>
                              <p className="text-xs text-gray-500 mt-1">
                                  Current data is stored in your browser's Local Storage. 
                                  <span className="text-emerald-500 ml-2 font-medium">● Connected</span>
                              </p>
                          </div>
                          
                          <div className="flex gap-2">
                              {/* Hidden File Input */}
                              <input 
                                  type="file" 
                                  ref={fileInputRef}
                                  onChange={handleFileChange}
                                  className="hidden" 
                                  accept=".json" 
                              />

                              <button 
                                 onClick={handleExportData}
                                 className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-colors text-xs font-bold uppercase tracking-wide"
                              >
                                 <Download className="w-3 h-3" /> Backup
                              </button>

                              <button 
                                 onClick={handleImportTrigger}
                                 className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-colors text-xs font-bold uppercase tracking-wide"
                              >
                                 <Upload className="w-3 h-3" /> Restore
                              </button>

                              <div className="w-px h-8 bg-gray-800 mx-1"></div>

                              <button 
                                 onClick={() => { 
                                     if(confirm("Are you sure? This will delete all NVRs, Users, and Events.")) { 
                                         db.reset(); 
                                         addToast('success', 'Factory Reset', 'System cleared. Reloading...', 3000); 
                                     } 
                                 }}
                                 className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40 transition-colors text-xs font-bold uppercase tracking-wide"
                              >
                                 <RefreshCcw className="w-3 h-3" /> Reset
                              </button>
                          </div>
                      </div>
                  </div>

               </div>
             </div>
          )}
        </div>
      </main>

      {/* --- ADD CAMERA MODAL --- */}
      {showAddModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-gray-800 rounded-lg"><CameraIcon className="w-5 h-5 text-cyan-400" /></div>
                     <div><h3 className="text-lg font-bold text-white leading-tight">Camera Library</h3><p className="text-xs text-gray-500">Select feed to pin to Live Monitor</p></div>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
               </div>
               <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10">
                  <div className="relative group">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-cyan-400 transition-colors" />
                     <input type="text" autoFocus placeholder="Search by name, location, or NVR ID..." className="w-full bg-black border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-gray-600" value={addModalSearch} onChange={e => setAddModalSearch(e.target.value)} />
                     {addModalSearch && <button onClick={() => setAddModalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="w-3 h-3" /></button>}
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-2 bg-gray-950">
                  {availableCameras.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-500">{addModalSearch ? <><Search className="w-12 h-12 mb-3 opacity-20" /><p>No cameras found matching "{addModalSearch}"</p></> : <><CheckCircle2 className="w-12 h-12 mb-3 opacity-20 text-emerald-500" /><p>All cameras are currently pinned.</p></>}</div> : <div className="grid grid-cols-1 gap-1">{availableCameras.map(cam => (<div key={cam.id} className="flex items-center justify-between p-3 hover:bg-gray-900 rounded-lg group transition-all border border-transparent hover:border-gray-800"><div className="flex items-center gap-4 min-w-0"><div className="w-12 h-9 rounded bg-gray-800 flex items-center justify-center text-gray-600 overflow-hidden relative shrink-0"><img src={cam.sourceUrl} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" alt="" /><CameraIcon className="w-4 h-4 absolute" /></div><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-bold text-gray-200 truncate group-hover:text-white transition-colors">{cam.name}</p>{!cam.isOnline && <AlertTriangle className="w-3 h-3 text-red-500" />}</div><div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5"><span className="truncate">{cam.location}</span><span className="w-1 h-1 rounded-full bg-gray-700"></span><span className="font-mono bg-gray-800 px-1.5 py-0.5 rounded text-[10px] text-gray-400 border border-gray-700">{cam.nvrId}</span></div></div></div><button onClick={() => handlePinCamera(cam.id)} className="ml-4 shrink-0 px-4 py-2 bg-gray-800 hover:bg-cyan-600 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2 group/btn"><Plus className="w-3 h-3 group-hover/btn:scale-110 transition-transform" /> Add</button></div>))}</div>}
               </div>
               <div className="p-3 bg-gray-900 border-t border-gray-800 text-[10px] text-gray-500 flex justify-between px-6"><span>{availableCameras.length} cameras available</span><span>{liveCameraIds.length} pinned / {MAX_LIVE_CAMERAS} max</span></div>
            </div>
         </div>
      )}

      {/* --- USER MANAGEMENT MODAL --- */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
           <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full h-[75vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
               {/* Header */}
               <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-900/20 border border-blue-900/50 rounded-lg"><Users className="w-5 h-5 text-blue-400" /></div>
                     <div><h3 className="text-lg font-bold text-white leading-tight">Access Control</h3><p className="text-xs text-gray-500">Manage user roles and permissions</p></div>
                  </div>
                  <button onClick={() => setShowUserModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
               </div>

               {/* Content */}
               <div className="flex-1 flex overflow-hidden">
                  {/* Left: User List */}
                  <div className={`flex-1 flex flex-col border-r border-gray-800 ${isUserFormOpen ? 'hidden md:flex' : ''}`}>
                      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                          <span className="text-xs font-bold text-gray-500 uppercase">{users.length} Users Found</span>
                          <button onClick={handleAddUser} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                              <UserPlus className="w-3 h-3" /> Add User
                          </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-950">
                          {users.map(user => (
                              <div key={user.id} onClick={() => handleEditUser(user)} className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${editingUserId === user.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900/50 border-transparent hover:bg-gray-900 hover:border-gray-800'}`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase ${user.status === 'ACTIVE' ? 'bg-gray-700 text-gray-300' : 'bg-red-900/20 text-red-500'}`}>
                                          {user.name.charAt(0)}
                                      </div>
                                      <div>
                                          <p className={`text-sm font-semibold ${user.status === 'ACTIVE' ? 'text-gray-200' : 'text-gray-500 line-through'}`}>{user.name}</p>
                                          <p className="text-xs text-gray-500">{user.email}</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                          user.role === 'ADMIN' ? 'bg-purple-900/20 text-purple-400 border-purple-900/50' :
                                          user.role === 'OPERATOR' ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' :
                                          'bg-gray-800 text-gray-400 border-gray-700'
                                      }`}>{user.role}</span>
                                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400" />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Right: User Form */}
                  <div className={`flex-1 bg-gray-900 flex flex-col ${!isUserFormOpen ? 'hidden md:flex items-center justify-center' : ''}`}>
                      {isUserFormOpen ? (
                          <div className="flex flex-col h-full">
                              <div className="p-6 border-b border-gray-800">
                                  <h4 className="text-lg font-bold text-white mb-1">{editingUserId ? 'Edit User' : 'Create New User'}</h4>
                                  <p className="text-sm text-gray-500">Configure account details and access level.</p>
                              </div>
                              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Full Name</label>
                                      <input type="text" placeholder="John Doe" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Email Address</label>
                                      <div className="relative">
                                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                          <input type="email" placeholder="john@company.com" className="w-full bg-black border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                                      </div>
                                  </div>
                                  <div className="space-y-1">
                                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Role & Permissions</label>
                                      <div className="grid grid-cols-1 gap-2">
                                          {['ADMIN', 'OPERATOR', 'VIEWER'].map((role) => (
                                              <div key={role} onClick={() => setUserForm({...userForm, role: role as any})} className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${userForm.role === role ? 'bg-blue-900/20 border-blue-500/50' : 'bg-black border-gray-800 hover:border-gray-600'}`}>
                                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${userForm.role === role ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}`}>
                                                      {userForm.role === role && <Check className="w-3 h-3 text-white" />}
                                                  </div>
                                                  <div>
                                                      <span className="text-sm font-bold text-gray-200 block">{role}</span>
                                                      <span className="text-xs text-gray-500 block">
                                                          {role === 'ADMIN' ? 'Full system access + User management' : 
                                                           role === 'OPERATOR' ? 'Live view, Playback, PTZ control' : 
                                                           'Read-only view access'}
                                                      </span>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                              <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
                                  {editingUserId ? (
                                      <div className="flex gap-2">
                                          <button onClick={() => toggleUserStatus(editingUserId)} className="p-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors" title="Suspend/Activate">
                                              <Ban className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => handleDeleteUser(editingUserId)} className="p-2 rounded-lg border border-red-900/30 hover:bg-red-900/20 text-red-500 transition-colors" title="Delete User">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  ) : <div></div>}
                                  <div className="flex gap-2">
                                      <button onClick={() => setIsUserFormOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancel</button>
                                      <button onClick={handleSaveUser} className="px-6 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 transition-all">
                                          {editingUserId ? 'Save Changes' : 'Create Account'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center p-8 text-gray-500">
                              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <UserCog className="w-8 h-8 opacity-50" />
                              </div>
                              <h4 className="text-lg font-bold text-gray-300 mb-1">Select a User</h4>
                              <p className="text-sm max-w-xs mx-auto">Select a user from the list to edit their details or create a new account.</p>
                          </div>
                      )}
                  </div>
               </div>
           </div>
        </div>
      )}

      {/* --- ADD/EDIT NVR MODAL --- */}
      {showNvrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
           <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                     <Server className="w-5 h-5 text-cyan-400" />
                     {isEditingNvr ? 'Edit Device Configuration' : 'Add NVR Manually'}
                  </h3>
                  <button onClick={() => setShowNvrModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-4">
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2"><PenLine className="w-3 h-3" /> Device Name / Label</label>
                     <input type="text" placeholder="e.g. Warehouse North Recorder" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20" value={nvrForm.name} onChange={(e) => setNvrForm({...nvrForm, name: e.target.value})} />
                  </div>

                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2"><Network className="w-3 h-3" /> IP Address</label>
                     <input type="text" placeholder="192.168.1.100" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20" value={nvrForm.ip} onChange={(e) => setNvrForm({...nvrForm, ip: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2"><Globe className="w-3 h-3" /> Port</label>
                        <input type="text" placeholder="8000" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20" value={nvrForm.port} onChange={(e) => setNvrForm({...nvrForm, port: e.target.value})} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">Protocol</label>
                        <select className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 appearance-none" value={nvrForm.protocol} onChange={(e) => setNvrForm({...nvrForm, protocol: e.target.value})}>
                           <option value="ONVIF">ONVIF</option>
                           <option value="HIKVISION">Hikvision</option>
                           <option value="DAHUA">Dahua</option>
                        </select>
                     </div>
                  </div>

                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2"><Shield className="w-3 h-3" /> Username</label>
                     <input type="text" placeholder="admin" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20" value={nvrForm.username} onChange={(e) => setNvrForm({...nvrForm, username: e.target.value})} />
                     <span className="text-[10px] text-gray-600 block pt-1">Default for simulation: admin</span>
                  </div>

                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2"><Lock className="w-3 h-3" /> Password</label>
                     <input type="password" placeholder="••••••••" className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20" value={nvrForm.password} onChange={(e) => setNvrForm({...nvrForm, password: e.target.value})} />
                     <span className="text-[10px] text-gray-600 block pt-1">Default for simulation: 12345</span>
                  </div>
              </div>

              <div className="p-5 border-t border-gray-800 bg-gray-900 flex justify-end gap-3">
                  <button onClick={() => setShowNvrModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">Cancel</button>
                  <button onClick={handleSaveNvr} disabled={isConnectingNvr} className="px-6 py-2 rounded-lg text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 transition-all flex items-center gap-2">
                     {isConnectingNvr ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                     {isConnectingNvr ? (isEditingNvr ? 'Updating...' : 'Connecting...') : (isEditingNvr ? 'Save Changes' : 'Add Device')}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL --- */}
      {deleteNvrId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
           <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                 <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50">
                    <Trash2 className="w-8 h-8 text-red-500" />
                 </div>
                 <h3 className="text-lg font-bold text-white mb-2">Delete Device?</h3>
                 <p className="text-sm text-gray-400 mb-6">
                    Are you sure you want to delete <span className="text-white font-mono">{deleteNvrId}</span>? 
                    <br/><br/>
                    This will permanently remove the NVR and all associated camera feeds from the system. This action cannot be undone.
                 </p>
                 <div className="flex gap-3 justify-center">
                    <button 
                       onClick={() => setDeleteNvrId(null)}
                       className="px-5 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors border border-gray-700"
                    >
                       Cancel
                    </button>
                    <button 
                       onClick={executeDeleteNvr}
                       className="px-5 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-colors flex items-center gap-2"
                    >
                       <Trash2 className="w-4 h-4" />
                       Confirm Delete
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* --- STORAGE MANAGEMENT MODAL --- */}
      {showStorageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
           <div className="bg-gray-950 border border-gray-800 rounded-xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
               <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                  <div className="flex items-center gap-3"><div className="p-2 bg-yellow-900/20 border border-yellow-900/50 rounded-lg"><HardDrive className="w-5 h-5 text-yellow-500" /></div><div><h3 className="text-lg font-bold text-white leading-tight">Storage Status</h3><p className="text-xs text-gray-500">Volume health & retention metrics</p></div></div>
                  <button onClick={() => setShowStorageModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-gray-900 p-4 rounded-xl border border-gray-800"><div className="flex items-center gap-2 mb-2 text-gray-400"><Database className="w-4 h-4" /><span className="text-xs font-bold uppercase">Total Capacity</span></div><p className="text-3xl font-mono text-white">878 <span className="text-base text-gray-500">TB</span></p></div>
                     <div className="bg-gray-900 p-4 rounded-xl border border-gray-800"><div className="flex items-center gap-2 mb-2 text-gray-400"><Save className="w-4 h-4" /><span className="text-xs font-bold uppercase">Allocated Used</span></div><p className="text-3xl font-mono text-yellow-400">471 <span className="text-base text-gray-500">TB</span></p><div className="w-full bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden"><div className="bg-yellow-500 h-full w-[54%]"></div></div></div>
                     <div className="bg-gray-900 p-4 rounded-xl border border-gray-800"><div className="flex items-center gap-2 mb-2 text-gray-400"><Cloud className="w-4 h-4" /><span className="text-xs font-bold uppercase">Retention Policy</span></div><p className="text-3xl font-mono text-white">30 <span className="text-base text-gray-500">Days</span></p><p className="text-xs text-emerald-500 mt-1">Compliant</p></div>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                     <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/50"><h4 className="font-semibold text-gray-200">Physical Volume Status</h4></div>
                     <table className="w-full text-left text-sm text-gray-400">
                        <thead className="bg-gray-950 text-xs uppercase font-semibold text-gray-500"><tr><th className="px-6 py-4">Volume ID</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Usage</th><th className="px-6 py-4">Status</th></tr></thead>
                        <tbody className="divide-y divide-gray-800">
                           {STORAGE_VOLUMES.map(vol => (
                              <tr key={vol.id} className="hover:bg-gray-800/30 transition-colors">
                                 <td className="px-6 py-4"><div className="font-medium text-gray-200">{vol.name}</div><div className="text-xs font-mono text-gray-500">{vol.id}</div></td>
                                 <td className="px-6 py-4 font-mono text-xs">{vol.type}</td>
                                 <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-24 bg-gray-800 h-2 rounded-full overflow-hidden"><div className={`h-full rounded-full ${vol.used/vol.capacity > 0.8 ? 'bg-red-500' : 'bg-cyan-600'}`} style={{ width: `${(vol.used/vol.capacity)*100}%` }}></div></div><span className="text-xs font-mono">{vol.used} / {vol.capacity} TB</span></div></td>
                                 <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${vol.status === 'HEALTHY' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 'bg-blue-950/30 text-blue-400 border-blue-900/50'}`}>{vol.status === 'HEALTHY' ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3 animate-spin" />}{vol.status}</span></td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  <div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-lg flex gap-3 items-start"><div className="p-1 bg-blue-900/30 rounded"><Server className="w-4 h-4 text-blue-400" /></div><div><h5 className="text-sm font-semibold text-blue-200">Redundancy Check Passed</h5><p className="text-xs text-blue-400/80 mt-1">All RAID arrays are synchronized. Hot-spare drives are available in slot 4 and 8 of Expansion Bay 2.</p></div></div>
               </div>
               <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-end"><button onClick={() => setShowStorageModal(false)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">Done</button></div>
           </div>
        </div>
      )}

      {/* --- FULL SCREEN CAMERA MODAL --- */}
      {fullScreenCamera && (
         <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in zoom-in-95 duration-200" onDoubleClick={() => setFullScreenCameraId(null)}>
             <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/90 to-transparent z-50 flex justify-between items-start p-4 pointer-events-none">
                 <div className="pointer-events-auto bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
                     <CameraIcon className="w-5 h-5 text-cyan-400" />
                     <div><span className="text-sm font-bold text-white block leading-none">{fullScreenCamera.name}</span><span className="text-[10px] text-gray-400 font-mono block leading-none mt-0.5">{fullScreenCamera.location}</span></div>
                 </div>
                 <button onClick={() => setFullScreenCameraId(null)} className="pointer-events-auto p-2 bg-black/50 hover:bg-gray-800 text-white rounded-full backdrop-blur-md border border-white/10 transition-colors group" title="Exit Fullscreen"><Minimize2 className="w-6 h-6 group-hover:scale-90 transition-transform" /></button>
             </div>
             <div className="flex-1 p-2 md:p-4"><CameraUnit camera={fullScreenCamera} onAnalyze={handleAnalysisResult} autoMonitor={autoMonitor} /></div>
         </div>
      )}

    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${active ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-900/50' : 'text-gray-400 hover:bg-gray-900 hover:text-gray-100'}`}>
    <span className={`${active ? 'text-cyan-400' : 'text-gray-500 group-hover:text-gray-300'}`}>{React.cloneElement(icon, { size: 20 })}</span>
    <span className="ml-3 font-medium text-sm hidden lg:block">{label}</span>
  </button>
);
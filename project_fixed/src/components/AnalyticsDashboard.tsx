import React, { useMemo, useState } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Camera, Alert, FaultRecord } from '../types';
import { 
  Server, Wifi, WifiOff, Activity, HardDrive, 
  AlertTriangle, CheckCircle2, Clock, Info, ExternalLink,
  ChevronUp, ChevronDown, RefreshCw, X, Camera as CameraIcon,
  ListX, Download, PlugZap
} from 'lucide-react';

interface AnalyticsDashboardProps {
  cameras: Camera[];
  faults: FaultRecord[];
  onResolveFault: (cameraId: string) => void;
  alerts: Alert[];
  onShowStorage: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ cameras, faults, onResolveFault, alerts, onShowStorage }) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  // --- Data Computation ---
  
  // 1. System Status
  const totalCameras = cameras.length;
  const onlineCameras = cameras.filter(c => c.isOnline).length;
  const offlineCameras = cameras.filter(c => !c.isOnline).length;
  const healthPercentage = totalCameras > 0 ? (onlineCameras / totalCameras) * 100 : 0;
  
  // Get list of active and resolved faults for the report
  // Filter out duplicates if any, showing latest faults
  const faultList = useMemo(() => {
    return [...faults].sort((a, b) => b.timeOff - a.timeOff);
  }, [faults]);

  // Count distinct NVRs
  const uniqueNVRs = useMemo(() => {
     return new Set(cameras.map(c => c.nvrId)).size;
  }, [cameras]);

  // 2. Chart Data: Network Health (Donut)
  const healthData = [
    { name: 'Online', value: onlineCameras, color: '#10b981' }, // Emerald-500
    { name: 'Offline', value: offlineCameras, color: '#ef4444' }  // Red-500
  ];

  // 3. Chart Data: Problem Areas (Offline Duration)
  // Only show cameras that are offline, sorted by longest downtime
  const problemAreasData = useMemo(() => {
    return cameras
      .filter(c => !c.isOnline)
      .map(c => {
        const rawDowntime = (Date.now() - c.statusChangedAt) / (1000 * 60); // Calculate in MINUTES
        // Ensure strictly non-negative and handle "Just now" cases (0 minutes) by giving a tiny value for visibility
        const downtimeMins = Math.max(0.1, parseFloat(rawDowntime.toFixed(1)));
        
        return {
          name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
          fullLocation: `${c.location} (${c.nvrId})`,
          downtimeMins: downtimeMins,
          displayDowntime: rawDowntime < 1 ? '< 1' : rawDowntime.toFixed(0)
        };
      })
      .sort((a, b) => b.downtimeMins - a.downtimeMins)
      .slice(0, 5); // Top 5 worst offenders
  }, [cameras]);

  // 4. Activity Log (Simulated for "Complex" look)
  const activityLog = [
    { id: 1, action: 'System Sync', user: 'System', time: 'Just now', type: 'info' },
    { id: 2, action: 'Config Update', user: 'Admin', time: '14 min ago', type: 'success' },
    { id: 3, action: 'NVR-02 Backup', user: 'System', time: '1 hr ago', type: 'info' },
    { id: 4, action: 'User Login', user: 'Officer Davis', time: '2 hrs ago', type: 'info' },
  ];

  // 5. Active Alerts (Sorted by severity/time)
  const activeAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => b.timestamp - a.timestamp);
  }, [alerts]);

  const getExactDurationStr = (start: number, end: number | undefined) => {
    const durationMs = (end || Date.now()) - start;
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Function to download Report as formatted XLS (HTML Table)
  const downloadReport = () => {
    // Generate Table Rows
    const tableRows = faultList.map((fault, index) => {
        // Mocking IP based on NVR ID logic for consistency
        const nvrNum = parseInt(fault.nvrId.replace('NVR-', '')) || 0;
        const ipMock = `192.168.1.${50 + nvrNum}`; 
        
        // Format Time Off (JAM MATI)
        const dateOff = new Date(fault.timeOff);
        const jamMati = dateOff.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        // Format Time On (JAM HIDUP)
        const jamHidup = fault.timeOn 
            ? new Date(fault.timeOn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) 
            : '-';
        
        const durasi = getExactDurationStr(fault.timeOff, fault.timeOn);

        return `
          <tr>
            <td style="border: 1px solid black; text-align: center;">${fault.nvrId}</td>
            <td style="border: 1px solid black; text-align: center;"></td>
            <td style="border: 1px solid black; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid black;">${fault.cameraName}</td>
            <td style="border: 1px solid black; text-align: center;">${ipMock}</td>
            <td style="border: 1px solid black; text-align: center;"></td>
            <td style="border: 1px solid black;">${fault.location}</td>
            <td style="border: 1px solid black; text-align: center;">${jamMati}</td>
            <td style="border: 1px solid black; text-align: center;">${jamHidup}</td>
            <td style="border: 1px solid black; text-align: center;">${durasi}</td>
          </tr>
        `;
    }).join('');

    // Construct full HTML content compatible with Excel
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>System Faults</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body>
        <table style="font-family: Arial, sans-serif; font-size: 11pt; border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #5B9BD5; color: white; font-weight: bold; text-align: center;">
              <th style="border: 1px solid black; padding: 5px; width: 80px;">NVR</th>
              <th style="border: 1px solid black; padding: 5px; width: 50px;">SLOT</th>
              <th style="border: 1px solid black; padding: 5px; width: 40px;">NO</th>
              <th style="border: 1px solid black; padding: 5px; width: 200px;">NAMA CCTV</th>
              <th style="border: 1px solid black; padding: 5px; width: 120px;">IP ADDRESS</th>
              <th style="border: 1px solid black; padding: 5px; width: 80px;">PANEL</th>
              <th style="border: 1px solid black; padding: 5px; width: 150px;">LOKASI</th>
              <th style="border: 1px solid black; padding: 5px; width: 100px;">JAM MATI 1</th>
              <th style="border: 1px solid black; padding: 5px; width: 100px;">JAM HIDUP 1</th>
              <th style="border: 1px solid black; padding: 5px; width: 100px;">DURASI</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Download as .xls file
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `System_Faults_Report_${new Date().toISOString().slice(0,10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-y-auto custom-scrollbar relative">
      
      {/* Header Bar */}
      <div className="px-8 py-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            CCTV Command Center
            <span className="text-xs font-normal text-gray-500 border border-gray-700 rounded px-2 py-0.5 ml-2">v2.5.0</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Real-time infrastructure monitoring and anomaly detection</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
             <div className="text-xs text-gray-500 uppercase font-semibold">Last Sync</div>
             <div className="text-sm font-mono text-cyan-400">{new Date().toLocaleTimeString()}</div>
          </div>
          <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-[1920px] mx-auto w-full">
        
        {/* Row 1: KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard 
            title="Total Cameras"
            value={totalCameras}
            icon={<Server className="w-6 h-6 text-blue-400" />}
            trend="+2 Installed"
            trendDir="up"
            color="blue"
            footer={`${uniqueNVRs} NVRs Connected`}
          />
          <KpiCard 
            title="Online Systems"
            value={onlineCameras}
            icon={<CheckCircle2 className="w-6 h-6 text-emerald-400" />}
            trend={`${healthPercentage.toFixed(1)}% Uptime`}
            trendDir="neutral"
            color="emerald"
            footer="Optimal Performance"
          />
          <KpiCard 
            title="Offline / Faults"
            value={offlineCameras}
            icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
            trend={offlineCameras > 0 ? "Action Required" : "System Healthy"}
            trendDir={offlineCameras > 0 ? "down" : "neutral"}
            color={offlineCameras > 0 ? "red" : "gray"}
            footer={offlineCameras > 0 ? "Click to view details" : `${problemAreasData.length} Areas Impacted`}
            isAlert={offlineCameras > 0}
            onClick={() => setShowOfflineModal(true)}
            isClickable={true}
          />
          <KpiCard 
            title="NVR Storage Health"
            value="HEALTHY"
            icon={<HardDrive className="w-6 h-6 text-yellow-400" />}
            trend="12TB Free"
            trendDir="neutral"
            color="yellow"
            footer="Retention: 30 Days"
            onClick={onShowStorage}
            isClickable={true}
          />
        </div>

        {/* Row 2: Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[400px]">
          
          {/* Network Health (Donut) - 4 Columns */}
          <div className="lg:col-span-4 bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col shadow-lg relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-900"></div>
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Network Health
                </h3>
                <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">Real-time</span>
             </div>
             
             <div className="flex-1 relative min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={healthData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {healthData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                       contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                       itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-4xl font-bold text-white">{healthPercentage.toFixed(0)}%</span>
                   <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Online</span>
                </div>
             </div>
             
             <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                   <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                   <span className="text-sm text-gray-300">Online ({onlineCameras})</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="w-3 h-3 rounded-full bg-red-500"></span>
                   <span className="text-sm text-gray-300">Offline ({offlineCameras})</span>
                </div>
             </div>
          </div>

          {/* Problem Areas (Bar Chart) - 8 Columns */}
          <div className="lg:col-span-8 bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col shadow-lg relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-900"></div>
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                   <WifiOff className="w-4 h-4 text-red-500" />
                   Problem Areas (Downtime Duration)
                </h3>
                {offlineCameras === 0 && (
                   <span className="text-xs bg-green-900/20 text-green-400 border border-green-900/50 px-3 py-1 rounded-full font-medium">
                     All Systems Normal
                   </span>
                )}
             </div>

             <div className="flex-1 w-full min-h-[250px]">
               {problemAreasData.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart 
                      data={problemAreasData} 
                      layout="vertical" 
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                   >
                     <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={true} opacity={0.3} />
                     <XAxis 
                        type="number" 
                        stroke="#6b7280" 
                        fontSize={12} 
                        tickFormatter={(val) => `${val}m`} 
                        domain={[0, 'auto']} 
                     />
                     <YAxis 
                        type="category" 
                        dataKey="name" 
                        stroke="#9ca3af" 
                        fontSize={12} 
                        width={120}
                        tick={{fill: '#e5e7eb'}} 
                     />
                     <RechartsTooltip 
                        cursor={{fill: '#1f2937', opacity: 0.5}}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-gray-950 border border-gray-700 p-3 rounded shadow-xl">
                                <p className="text-white font-bold">{data.name}</p>
                                <p className="text-gray-400 text-xs mb-2">{data.fullLocation}</p>
                                <p className="text-red-400 text-sm">Downtime: {data.displayDowntime} mins</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                     />
                     <Bar dataKey="downtimeMins" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={32} />
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-gray-600 border border-dashed border-gray-800 rounded bg-gray-950/30">
                    <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500/20" />
                    <p className="text-sm">No active downtime incidents reported.</p>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Row 3: Lists (Alerts & Activity) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Alerts Table (2 Cols) */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl shadow-lg flex flex-col overflow-hidden">
             <div className="p-4 border-b border-gray-800 bg-gray-900/80 flex justify-between items-center">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-orange-400" />
                   Active Alerts
                </h3>
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">
                  {activeAlerts.length} Active
                </span>
             </div>
             
             <div className="flex-1 overflow-auto max-h-[300px]">
               <table className="w-full text-left text-sm text-gray-400">
                 <thead className="bg-gray-950 text-gray-500 uppercase font-medium text-xs sticky top-0">
                   <tr>
                     <th className="px-4 py-3">Severity</th>
                     <th className="px-4 py-3">Time</th>
                     <th className="px-4 py-3">Camera / Source</th>
                     <th className="px-4 py-3">Message</th>
                     <th className="px-4 py-3 text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                   {activeAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-600 italic">
                          No active alerts. System running normally.
                        </td>
                      </tr>
                   ) : (
                     activeAlerts.map((alert) => (
                       <tr key={alert.id} className="hover:bg-gray-800/50 transition-colors">
                         <td className="px-4 py-3">
                           <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                             alert.severity === 'CRITICAL' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 
                             alert.severity === 'WARNING' ? 'bg-orange-900/20 text-orange-400 border-orange-900/50' : 
                             'bg-blue-900/20 text-blue-400 border-blue-900/50'
                           }`}>
                             {alert.severity}
                           </span>
                         </td>
                         <td className="px-4 py-3 font-mono text-xs">
                           {new Date(alert.timestamp).toLocaleTimeString()}
                         </td>
                         <td className="px-4 py-3 font-medium text-gray-300">
                           {alert.cameraName}
                         </td>
                         <td className="px-4 py-3">
                           {alert.message}
                         </td>
                         <td className="px-4 py-3 text-right">
                           <button 
                             onClick={() => setSelectedAlert(alert)}
                             className="text-cyan-400 hover:text-cyan-300 text-xs font-medium flex items-center justify-end gap-1 ml-auto cursor-pointer"
                           >
                             View <ExternalLink className="w-3 h-3" />
                           </button>
                         </td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
             </div>
          </div>

          {/* Activity Log (1 Col) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg flex flex-col overflow-hidden">
             <div className="p-4 border-b border-gray-800 bg-gray-900/80">
                <h3 className="font-semibold text-gray-200 flex items-center gap-2">
                   <Clock className="w-4 h-4 text-gray-400" />
                   Recent Activity Log
                </h3>
             </div>
             <div className="flex-1 overflow-auto p-4 space-y-4 max-h-[300px]">
                {activityLog.map((log) => (
                   <div key={log.id} className="flex gap-3 items-start">
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                         log.type === 'success' ? 'bg-emerald-500' :
                         log.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                      }`}></div>
                      <div>
                         <p className="text-sm text-gray-300 font-medium">{log.action}</p>
                         <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span>{log.user}</span>
                            <span>•</span>
                            <span>{log.time}</span>
                         </div>
                      </div>
                   </div>
                ))}
                
                {/* Simulated older logs filler */}
                <div className="flex gap-3 items-start opacity-50">
                    <div className="mt-1 w-2 h-2 rounded-full bg-gray-600 flex-shrink-0"></div>
                    <div>
                        <p className="text-sm text-gray-400">System Auto-Check</p>
                        <span className="text-xs text-gray-600">System • 3 hrs ago</span>
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* --- OFFLINE DEVICES / FAULTS REPORT MODAL --- */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all animate-in fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-5xl w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
             {/* Header */}
             <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      <ListX className="w-6 h-6 text-red-500" />
                      System Faults Report
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Detailed history of device connectivity issues.</p>
                </div>
                <button 
                    onClick={() => setShowOfflineModal(false)} 
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
             </div>
             
             {/* Content */}
             <div className="flex-1 overflow-y-auto p-0">
                <table className="w-full text-left text-sm text-gray-400">
                   <thead className="bg-gray-900 text-gray-500 uppercase font-medium text-xs sticky top-0 z-10 shadow-sm">
                      <tr>
                         <th className="px-6 py-4 bg-gray-900">Device</th>
                         <th className="px-6 py-4 bg-gray-900">Location</th>
                         <th className="px-6 py-4 bg-gray-900">NVR ID</th>
                         <th className="px-6 py-4 bg-gray-900">Time Off</th>
                         <th className="px-6 py-4 bg-gray-900">Time On</th>
                         <th className="px-6 py-4 bg-gray-900">Status</th>
                         <th className="px-6 py-4 bg-gray-900 text-right">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-800">
                      {faultList.map(fault => (
                         <tr key={fault.id} className={`hover:bg-gray-800/50 transition-colors ${fault.timeOn ? 'opacity-75' : ''}`}>
                            <td className="px-6 py-4 font-semibold text-white">
                               <div className="flex items-center gap-2">
                                  <CameraIcon className={`w-4 h-4 ${fault.timeOn ? 'text-green-500' : 'text-red-500'}`} />
                                  {fault.cameraName}
                               </div>
                            </td>
                            <td className="px-6 py-4 text-gray-300">{fault.location}</td>
                            <td className="px-6 py-4 font-mono text-xs">{fault.nvrId}</td>
                            <td className="px-6 py-4 font-mono text-gray-300">
                               {new Date(fault.timeOff).toLocaleTimeString()}
                            </td>
                            <td className="px-6 py-4 font-mono text-gray-300">
                               {fault.timeOn ? (
                                   <span className="text-green-400">{new Date(fault.timeOn).toLocaleTimeString()}</span>
                               ) : '-'}
                            </td>
                            <td className="px-6 py-4">
                               {fault.timeOn ? (
                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-950/40 text-green-500 border border-green-900/50">
                                      <CheckCircle2 className="w-3 h-3" />
                                      RESOLVED
                                   </span>
                               ) : (
                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/40 text-red-500 border border-red-900/50">
                                      <WifiOff className="w-3 h-3" />
                                      OFFLINE
                                   </span>
                               )}
                            </td>
                            <td className="px-6 py-4 text-right">
                               {!fault.timeOn && (
                                   <button 
                                      onClick={() => onResolveFault(fault.cameraId)}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white transition-all border border-gray-700 hover:border-blue-500"
                                   >
                                      <PlugZap className="w-3 h-3" />
                                      Reconnect
                                   </button>
                               )}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             
             {/* Footer */}
             <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-end gap-3">
                <button 
                   onClick={() => setShowOfflineModal(false)}
                   className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                   Close
                </button>
                <button 
                   onClick={downloadReport}
                   className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-gray-900 hover:bg-gray-200 shadow-lg flex items-center gap-2 transition-colors"
                >
                   <Download className="w-4 h-4" />
                   Download Fault Report
                </button>
             </div>
          </div>
        </div>
      )}

      {/* --- Evidence Review Modal --- */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all animate-in fade-in">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Security Alert Details
                </h3>
                <button 
                    onClick={() => setSelectedAlert(null)} 
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-sm text-gray-400">Camera Source</p>
                        <p className="text-lg font-bold text-white">{selectedAlert.cameraName}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Timestamp</p>
                        <p className="text-lg font-mono text-cyan-400">{new Date(selectedAlert.timestamp).toLocaleString()}</p>
                    </div>
                </div>
                
                <div className="bg-black border border-gray-800 rounded-lg overflow-hidden aspect-video mb-4 flex items-center justify-center relative">
                    {selectedAlert.thumbnail ? (
                        <img src={selectedAlert.thumbnail} className="w-full h-full object-contain" alt="Evidence" />
                    ) : (
                        <div className="flex flex-col items-center text-gray-600">
                            <div className="w-16 h-16 mb-2 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center">
                                <CameraIcon className="w-8 h-8" />
                            </div>
                            <span>No snapshot evidence available</span>
                        </div>
                    )}
                    <div className="absolute top-2 right-2 px-2 py-1 bg-red-600/90 text-white text-xs font-bold rounded shadow-lg backdrop-blur-sm">
                        {selectedAlert.severity} THREAT
                    </div>
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase font-bold mb-1">Analysis Report</p>
                    <p className="text-sm text-gray-200 leading-relaxed">{selectedAlert.message}</p>
                </div>
            </div>
            <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-3">
                <button 
                    onClick={() => setSelectedAlert(null)} 
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                >
                    Close
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/20 transition-colors">
                    Export Report
                </button>
            </div>
            </div>
        </div>
      )}

    </div>
  );
};

// --- Subcomponents ---

const KpiCard = ({ title, value, icon, trend, trendDir, color, footer, isAlert, onClick, isClickable }: any) => {
  const colors: Record<string, string> = {
    blue: 'border-l-4 border-l-blue-500',
    emerald: 'border-l-4 border-l-emerald-500',
    red: 'border-l-4 border-l-red-500',
    yellow: 'border-l-4 border-l-yellow-500',
    gray: 'border-l-4 border-l-gray-600',
  };

  const trendColor = trendDir === 'up' ? 'text-emerald-400' : trendDir === 'down' ? 'text-red-400' : 'text-gray-400';
  const TrendIcon = trendDir === 'up' ? ChevronUp : trendDir === 'down' ? ChevronDown : Info;

  return (
    <div 
        onClick={onClick}
        className={`bg-gray-900 rounded-lg p-5 shadow-lg border border-gray-800 relative overflow-hidden group hover:border-gray-700 transition-all ${colors[color]} ${isClickable ? 'cursor-pointer hover:bg-gray-800/80 active:scale-[0.98]' : ''}`}
    >
      {isAlert && (
         <div className="absolute top-0 right-0 p-2 animate-pulse">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
         </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div>
           <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
           <h2 className="text-3xl font-bold text-white mt-1 group-hover:scale-105 transition-transform origin-left">{value}</h2>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg group-hover:bg-gray-800/80 transition-colors">
          {icon}
        </div>
      </div>

      <div className="border-t border-gray-800 pt-3 flex items-center justify-between">
         <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{trend}</span>
         </div>
         <span className="text-[10px] text-gray-500 uppercase font-semibold">{footer}</span>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
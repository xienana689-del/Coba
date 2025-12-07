import React from 'react';
import { Alert } from '../types';
import { AlertTriangle, Clock, Camera } from 'lucide-react';

interface AlertsPanelProps {
  alerts: Alert[];
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
  return (
    <div className="h-full flex flex-col bg-gray-900 border-l border-gray-800 w-80">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
        <h2 className="text-sm font-bold text-gray-100 uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Event Log
        </h2>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{alerts.length}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
             <ShieldCheck className="w-8 h-8 opacity-20" />
             <p className="text-xs">System Secure. No active threats.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded p-3 transition-colors group">
              <div className="flex justify-between items-start mb-1">
                 <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      alert.severity === 'CRITICAL' ? 'bg-red-500' :
                      alert.severity === 'WARNING' ? 'bg-orange-500' : 'bg-blue-500'
                    }`}></span>
                    <span className="text-xs font-bold text-gray-300">{alert.cameraName}</span>
                 </div>
                 <span className="text-[10px] text-gray-500 font-mono">
                   {new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                 </span>
              </div>
              
              <p className="text-xs text-gray-300 mb-2 font-medium leading-relaxed">
                {alert.message}
              </p>
              
              {alert.thumbnail && (
                <div className="relative rounded overflow-hidden mt-2 border border-gray-700 h-20 w-full bg-black group-hover:border-gray-500 transition-colors">
                  <img src={alert.thumbnail} alt="Evidence" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Simple Icon component for the empty state
const ShieldCheck = (props: any) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
);

export default AlertsPanel;
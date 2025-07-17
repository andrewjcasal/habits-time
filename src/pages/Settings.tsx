import { useState, useEffect } from 'react';
import { Clock, Save, RotateCcw } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

const Settings = () => {
  const { settings, loading, error, updateSettings } = useSettings();
  const [workHoursStart, setWorkHoursStart] = useState('07:00');
  const [workHoursEnd, setWorkHoursEnd] = useState('23:00');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await updateSettings({
        work_hours_start: workHoursStart + ':00',
        work_hours_end: workHoursEnd + ':00',
      });
      
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Error saving settings');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setWorkHoursStart('07:00');
    setWorkHoursEnd('23:00');
    setSaveMessage('');
  };

  // Load settings when they change
  useEffect(() => {
    if (settings) {
      setWorkHoursStart(settings.work_hours_start.substring(0, 5));
      setWorkHoursEnd(settings.work_hours_end.substring(0, 5));
    }
  }, [settings]);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Header */}
      <nav className="h-5 border-b border-neutral-200 bg-white flex items-center px-4 flex-shrink-0">
        <h1 className="text-lg font-semibold text-neutral-900">Settings</h1>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-8">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-neutral-600">Loading settings...</span>
            </div>
          )}
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          
          {!loading && (
            <>
          {/* Work Hours Section */}
          <div className="bg-white border border-neutral-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-5 h-5 text-neutral-600" />
              <h2 className="text-xl font-semibold text-neutral-900">Work Hours</h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-neutral-600">
                Set your work hours range for scheduling non-session project tasks. 
                This affects when tasks can be automatically scheduled in your calendar.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={workHoursStart}
                    onChange={(e) => setWorkHoursStart(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={workHoursEnd}
                    onChange={(e) => setWorkHoursEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <strong>Preview:</strong> Tasks can be scheduled between{' '}
                  {new Date(`1970-01-01T${workHoursStart}`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}{' '}
                  and{' '}
                  {new Date(`1970-01-01T${workHoursEnd}`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Save Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </button>
            
            <div className="flex items-center gap-3">
              {saveMessage && (
                <span className={`text-sm ${
                  saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'
                }`}>
                  {saveMessage}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;
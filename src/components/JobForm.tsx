import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

// Types
import { JobApplication } from '../types';

interface JobFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: JobApplication;
}

export const JobForm = ({ isOpen, onClose, onSubmit, initialData }: JobFormProps) => {
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    dateApplied: '',
    status: 'applied',
    url: '',
    notes: ''
  });
  
  // Load initial data if provided (for editing)
  useEffect(() => {
    if (initialData) {
      setFormData({
        company: initialData.company.name,
        position: initialData.position,
        dateApplied: new Date(initialData.applied_date).toISOString().split('T')[0],
        status: initialData.status,
        url: initialData.url || '',
        notes: initialData.notes || ''
      });
    } else {
      // Reset form for new entries
      setFormData({
        company: '',
        position: '',
        dateApplied: new Date().toISOString().split('T')[0], // Default to today
        status: 'applied',
        url: '',
        notes: ''
      });
    }
  }, [initialData, isOpen]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submissionData = {
      ...formData,
      applied_date: formData.dateApplied,
      ...(initialData && { id: initialData.id }) // Preserve ID for updates
    };
    
    onSubmit(submissionData);
  };
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-lg shadow-lg w-full max-w-md"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {initialData ? 'Edit Application' : 'Add Application'}
            </h2>
            <button 
              onClick={onClose}
              className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-neutral-700 mb-1">
                Company
              </label>
              <input 
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="input"
                placeholder="Company name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-neutral-700 mb-1">
                Position
              </label>
              <input 
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className="input"
                placeholder="Job title"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="dateApplied" className="block text-sm font-medium text-neutral-700 mb-1">
                  Date Applied
                </label>
                <input 
                  type="date"
                  id="dateApplied"
                  name="dateApplied"
                  value={formData.dateApplied}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-neutral-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="select"
                  required
                >
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="rejected">Rejected</option>
                  <option value="offered">Offered</option>
                  <option value="accepted">Accepted</option>
                </select>
              </div>
            </div>
            
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-neutral-700 mb-1">
                Job URL (Optional)
              </label>
              <input 
                type="url"
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                className="input"
                placeholder="https://example.com/job"
              />
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-neutral-700 mb-1">
                Notes (Optional)
              </label>
              <textarea 
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="input !h-24 resize-none"
                placeholder="Add any notes about this application..."
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-2">
              <button 
                type="button"
                onClick={onClose}
                className="btn btn-outline"
              >
                Cancel
              </button>
              
              <button 
                type="submit"
                className="btn btn-primary"
              >
                {initialData ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};
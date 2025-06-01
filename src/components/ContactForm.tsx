import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

// Types
import { Contact } from '../types';

interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: Contact;
}

export const ContactForm = ({ isOpen, onClose, onSubmit, initialData }: ContactFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    notes: '',
    lastContactDate: ''
  });
  
  // Load initial data if provided (for editing)
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        company: initialData.company || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        notes: initialData.notes || '',
        lastContactDate: initialData.lastContactDate 
          ? new Date(initialData.lastContactDate).toISOString().split('T')[0]
          : ''
      });
    } else {
      // Reset form for new entries
      setFormData({
        name: '',
        company: '',
        email: '',
        phone: '',
        notes: '',
        lastContactDate: ''
      });
    }
  }, [initialData, isOpen]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      lastContactDate: formData.lastContactDate 
        ? new Date(formData.lastContactDate).getTime()
        : null,
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
              {initialData ? 'Edit Contact' : 'Add Contact'}
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
              <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">
                Name
              </label>
              <input 
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input"
                placeholder="Contact name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-neutral-700 mb-1">
                Company (Optional)
              </label>
              <input 
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="input"
                placeholder="Company name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                  Email (Optional)
                </label>
                <input 
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                  placeholder="email@example.com"
                />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 mb-1">
                  Phone (Optional)
                </label>
                <input 
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input"
                  placeholder="(123) 456-7890"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="lastContactDate" className="block text-sm font-medium text-neutral-700 mb-1">
                Last Contact Date (Optional)
              </label>
              <input 
                type="date"
                id="lastContactDate"
                name="lastContactDate"
                value={formData.lastContactDate}
                onChange={handleChange}
                className="input"
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
                placeholder="Add any notes about this contact..."
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
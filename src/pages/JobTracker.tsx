import { useState, useEffect } from 'react';
import { 
  Trash2, 
  Edit, 
  Filter, 
  Download, 
  Mail, 
  Phone, 
  ExternalLink,
  Calendar,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import { Tabs } from '../components/Tabs';
import { JobForm } from '../components/JobForm';
import { ContactForm } from '../components/ContactForm';
import { ConfirmDialog } from '../components/ConfirmDialog';

// Types
import { JobApplication, Contact } from '../types';

const JobTracker = () => {
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingItem, setEditingItem] = useState<JobApplication | Contact | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: number, type: 'application' | 'contact'} | null>(null);
  const [isAddingApplication, setIsAddingApplication] = useState(false);
  const [newApplication, setNewApplication] = useState({
    company: '',
    position: '',
    status: 'applied'
  });

  // Load data from localStorage
  useEffect(() => {
    const savedApplications = localStorage.getItem('job-applications');
    if (savedApplications) {
      setApplications(JSON.parse(savedApplications));
    }
    
    const savedContacts = localStorage.getItem('job-contacts');
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    }
  }, []);
  
  // Save data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('job-applications', JSON.stringify(applications));
  }, [applications]);
  
  useEffect(() => {
    localStorage.setItem('job-contacts', JSON.stringify(contacts));
  }, [contacts]);
  
  const handleAddApplication = (application: Omit<JobApplication, 'id'>) => {
    const newApplication = {
      ...application,
      id: Date.now()
    };
    
    setApplications([newApplication, ...applications]);
    setShowJobForm(false);
  };

  const handleQuickAdd = () => {
    if (!newApplication.company || !newApplication.position) return;

    const application = {
      ...newApplication,
      id: Date.now(),
      dateApplied: Date.now(),
      status: 'applied'
    };

    setApplications([application, ...applications]);
    setNewApplication({ company: '', position: '', status: 'applied' });
    setIsAddingApplication(false);
  };
  
  const handleUpdateApplication = (updatedApplication: JobApplication) => {
    const updatedApplications = applications.map(app => 
      app.id === updatedApplication.id ? updatedApplication : app
    );
    
    setApplications(updatedApplications);
    setShowJobForm(false);
    setEditingItem(null);
  };
  
  const handleAddContact = (contact: Omit<Contact, 'id'>) => {
    const newContact = {
      ...contact,
      id: Date.now()
    };
    
    setContacts([newContact, ...contacts]);
    setShowContactForm(false);
  };
  
  const handleUpdateContact = (updatedContact: Contact) => {
    const updatedContacts = contacts.map(contact => 
      contact.id === updatedContact.id ? updatedContact : contact
    );
    
    setContacts(updatedContacts);
    setShowContactForm(false);
    setEditingItem(null);
  };
  
  const handleEditClick = (item: JobApplication | Contact, type: 'application' | 'contact') => {
    setEditingItem(item);
    if (type === 'application') {
      setShowJobForm(true);
    } else {
      setShowContactForm(true);
    }
  };
  
  const handleDeleteClick = (id: number, type: 'application' | 'contact') => {
    setItemToDelete({ id, type });
    setShowConfirmDelete(true);
  };
  
  const confirmDelete = () => {
    if (itemToDelete) {
      if (itemToDelete.type === 'application') {
        setApplications(applications.filter(app => app.id !== itemToDelete.id));
      } else {
        setContacts(contacts.filter(contact => contact.id !== itemToDelete.id));
      }
      setShowConfirmDelete(false);
      setItemToDelete(null);
    }
  };
  
  // Filter applications based on status
  const filteredApplications = statusFilter === 'all' 
    ? applications 
    : applications.filter(app => app.status === statusFilter);
    
  // Export data as CSV
  const exportData = () => {
    const dataToExport = activeTab === 'applications' ? applications : contacts;
    
    // Create CSV content
    let csvContent = '';
    
    if (activeTab === 'applications') {
      csvContent = 'Company,Position,Date Applied,Status,URL,Notes\n';
      dataToExport.forEach((item: any) => {
        csvContent += `"${item.company}","${item.position}","${new Date(item.dateApplied).toLocaleDateString()}","${item.status}","${item.url || ''}","${item.notes || ''}"\n`;
      });
    } else {
      csvContent = 'Name,Company,Email,Phone,Notes,Last Contact Date\n';
      dataToExport.forEach((item: any) => {
        csvContent += `"${item.name}","${item.company || ''}","${item.email || ''}","${item.phone || ''}","${item.notes || ''}","${item.lastContactDate ? new Date(item.lastContactDate).toLocaleDateString() : ''}"\n`;
      });
    }
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Job Tracker</h1>
          <p className="text-sm text-neutral-600">Track your applications and networking contacts</p>
        </div>
        
        <button 
          className="btn btn-outline btn-sm"
          onClick={exportData}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </button>
      </div>
      
      {/* Tabs */}
      <Tabs 
        tabs={[
          { id: 'applications', label: 'Applications', count: applications.length },
          { id: 'contacts', label: 'Contacts', count: contacts.length }
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />
      
      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Filter className="h-3.5 w-3.5 text-neutral-500" />
              <select
                className="select !py-1 !text-sm !w-auto"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="rejected">Rejected</option>
                <option value="offered">Offered</option>
                <option value="accepted">Accepted</option>
              </select>
            </div>
            
            <p className="text-xs text-neutral-500">
              Showing {filteredApplications.length} of {applications.length} applications
            </p>
          </div>
          
          {/* Quick Add Form */}
          {isAddingApplication ? (
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                placeholder="Company"
                className="input !py-1 !text-sm"
                value={newApplication.company}
                onChange={e => setNewApplication({ ...newApplication, company: e.target.value })}
              />
              <input
                type="text"
                placeholder="Position"
                className="input !py-1 !text-sm"
                value={newApplication.position}
                onChange={e => setNewApplication({ ...newApplication, position: e.target.value })}
              />
              <button
                onClick={handleQuickAdd}
                className="btn btn-primary btn-sm"
              >
                Add
              </button>
              <button
                onClick={() => setIsAddingApplication(false)}
                className="btn btn-outline btn-sm !p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingApplication(true)}
              className="btn btn-outline btn-sm mb-2"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Quick Add
            </button>
          )}
          
          {/* Applications List */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">Company</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">Position</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">Applied</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-neutral-500">Status</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(application => (
                  <tr key={application.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-2 px-3">
                      <div className="font-medium text-sm">{application.company}</div>
                      {application.url && (
                        <a 
                          href={application.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:text-primary-800 flex items-center mt-0.5"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Job
                        </a>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-sm">{application.position}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-sm text-neutral-600">
                        {new Date(application.dateApplied).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                        application.status === 'applied' 
                          ? 'bg-primary-100 text-primary-800' 
                          : application.status === 'interviewing' 
                            ? 'bg-secondary-100 text-secondary-800' 
                            : application.status === 'rejected' 
                              ? 'bg-error-100 text-error-800' 
                              : application.status === 'offered' 
                                ? 'bg-warning-100 text-warning-800' 
                                : 'bg-success-100 text-success-800'
                      }`}>
                        {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => handleEditClick(application, 'application')}
                          className="p-1 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(application.id, 'application')}
                          className="p-1 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      
      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-neutral-600">
              {contacts.length} total contacts
            </div>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowContactForm(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Contact
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {contacts.map(contact => (
                <motion.div
                  key={contact.id}
                  className="card bg-white !p-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="flex justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{contact.name}</h3>
                      {contact.company && (
                        <p className="text-sm text-neutral-600">{contact.company}</p>
                      )}
                      
                      <div className="mt-2 space-y-1">
                        {contact.email && (
                          <div className="flex items-center text-xs text-neutral-600">
                            <Mail className="h-3 w-3 mr-1" />
                            <a 
                              href={`mailto:${contact.email}`}
                              className="hover:text-primary-600"
                            >
                              {contact.email}
                            </a>
                          </div>
                        )}
                        
                        {contact.phone && (
                          <div className="flex items-center text-xs text-neutral-600">
                            <Phone className="h-3 w-3 mr-1" />
                            <a 
                              href={`tel:${contact.phone}`}
                              className="hover:text-primary-600"
                            >
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        
                        {contact.lastContactDate && (
                          <div className="flex items-center text-xs text-neutral-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            Last Contact: {new Date(contact.lastContactDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-1">
                      <button 
                        onClick={() => handleEditClick(contact, 'contact')}
                        className="p-1 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      
                      <button 
                        onClick={() => handleDeleteClick(contact.id, 'contact')}
                        className="p-1 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
      
      {/* Forms */}
      <JobForm 
        isOpen={showJobForm} 
        onClose={() => {
          setShowJobForm(false);
          setEditingItem(null);
        }}
        onSubmit={editingItem ? handleUpdateApplication : handleAddApplication}
        initialData={editingItem as JobApplication}
      />
      
      <ContactForm
        isOpen={showContactForm}
        onClose={() => {
          setShowContactForm(false);
          setEditingItem(null);
        }}
        onSubmit={editingItem ? handleUpdateContact : handleAddContact}
        initialData={editingItem as Contact}
      />
      
      <ConfirmDialog
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false);
          setItemToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Confirm Delete"
        message={`Are you sure you want to delete this ${itemToDelete?.type}? This action cannot be undone.`}
      />
    </div>
  );
};

export default JobTracker;
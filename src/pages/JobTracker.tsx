import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Filter, 
  Download, 
  Users, 
  Calendar, 
  Mail, 
  Phone, 
  ExternalLink
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Job Tracker</h1>
          <p className="text-neutral-600 mt-1">Track your applications and networking contacts</p>
        </div>
        
        <div className="flex space-x-2">
          <button 
            className="btn btn-outline"
            onClick={exportData}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={() => activeTab === 'applications' ? setShowJobForm(true) : setShowContactForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add {activeTab === 'applications' ? 'Application' : 'Contact'}
          </button>
        </div>
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
              <Filter className="h-4 w-4 text-neutral-500" />
              <select
                className="select !w-auto"
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
            
            <p className="text-sm text-neutral-500">
              Showing {filteredApplications.length} of {applications.length} applications
            </p>
          </div>
          
          {/* Applications List */}
          <div className="space-y-4">
            <AnimatePresence>
              {filteredApplications.length > 0 ? (
                filteredApplications.map(application => (
                  <motion.div
                    key={application.id}
                    className="card bg-white"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="flex flex-col md:flex-row justify-between">
                      <div>
                        <div className="flex items-center">
                          <h3 className="font-medium text-lg">{application.company}</h3>
                          <span className={`ml-2 badge ${
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
                        </div>
                        <p className="text-neutral-700">{application.position}</p>
                        
                        <div className="flex items-center mt-2 text-sm text-neutral-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          Applied: {new Date(application.dateApplied).toLocaleDateString()}
                          
                          {application.url && (
                            <a 
                              href={application.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="ml-4 text-primary-600 hover:text-primary-800 flex items-center"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Job Link
                            </a>
                          )}
                        </div>
                        
                        {application.notes && (
                          <p className="mt-2 text-sm text-neutral-600 line-clamp-2">
                            {application.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-start mt-3 md:mt-0 space-x-2">
                        <button 
                          onClick={() => handleEditClick(application, 'application')}
                          className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded-md"
                          aria-label="Edit application"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        <button 
                          onClick={() => handleDeleteClick(application.id, 'application')}
                          className="p-2 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 rounded-md"
                          aria-label="Delete application"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="card bg-white text-center py-12">
                  <p className="text-neutral-600">No applications found</p>
                  <button 
                    className="btn btn-primary mt-4"
                    onClick={() => setShowJobForm(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Application
                  </button>
                </div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
      
      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <AnimatePresence>
            {contacts.length > 0 ? (
              contacts.map(contact => (
                <motion.div
                  key={contact.id}
                  className="card bg-white"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="flex flex-col md:flex-row justify-between">
                    <div>
                      <h3 className="font-medium text-lg">{contact.name}</h3>
                      {contact.company && (
                        <p className="text-neutral-700">{contact.company}</p>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 mt-2">
                        {contact.email && (
                          <div className="flex items-center text-sm text-neutral-600">
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
                          <div className="flex items-center text-sm text-neutral-600">
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
                          <div className="flex items-center text-sm text-neutral-500 md:col-span-2 mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            Last Contact: {new Date(contact.lastContactDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      
                      {contact.notes && (
                        <p className="mt-2 text-sm text-neutral-600 line-clamp-2">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-start mt-3 md:mt-0 space-x-2">
                      <button 
                        onClick={() => handleEditClick(contact, 'contact')}
                        className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded-md"
                        aria-label="Edit contact"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      
                      <button 
                        onClick={() => handleDeleteClick(contact.id, 'contact')}
                        className="p-2 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 rounded-md"
                        aria-label="Delete contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="card bg-white text-center py-12">
                <p className="text-neutral-600">No contacts found</p>
                <button 
                  className="btn btn-primary mt-4"
                  onClick={() => setShowContactForm(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Contact
                </button>
              </div>
            )}
          </AnimatePresence>
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
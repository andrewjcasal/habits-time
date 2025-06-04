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
  X,
  Bell,
  BellRing
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import { Tabs } from '../components/Tabs';
import { JobForm } from '../components/JobForm';
import { ContactForm } from '../components/ContactForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FeedItem } from '../components/FeedItem';
import { Autocomplete } from '../components/Autocomplete';

// Types
import { JobApplication, Contact } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const JobTracker = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingItem, setEditingItem] = useState<JobApplication | Contact | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: number, type: 'application' | 'contact'} | null>(null);
  const [positions, setPositions] = useState<string[]>([]);
  const [newApplication, setNewApplication] = useState({
    company: '',
    position: '',
    status: 'applied'
  });
  const [feedItems, setFeedItems] = useState([
    {
      id: 1,
      type: 'connection' as const,
      title: 'John Smith viewed your profile',
      description: 'Engineering Manager at Google',
      timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
      url: 'https://linkedin.com/in/johnsmith',
      read: false
    },
    {
      id: 2,
      type: 'job_view' as const,
      title: 'Your application was viewed',
      description: 'Sr. Full Stack Engineer at Meta',
      timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      read: false
    },
    {
      id: 3,
      type: 'message' as const,
      title: 'New message from Sarah Lee',
      description: 'Thanks for connecting! I'd love to chat about opportunities at...',
      timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      url: 'https://linkedin.com/in/sarahlee',
      read: true
    }
  ]);

  // Load data from Supabase
  useEffect(() => {
    fetchApplications();
    fetchPositions();
    
    const savedContacts = localStorage.getItem('job-contacts');
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    }
  }, []);

  const fetchPositions = async () => {
    const { data, error } = await supabase
      .from('bolt_positions')
      .select('title')
      .order('title');

    if (error) {
      console.error('Error fetching positions:', error);
      return;
    }

    setPositions(data.map(p => p.title));
  };
  
  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from('bolt_applications')
      .select(`
        *,
        company:bolt_companies(*),
        position:bolt_positions(title)
      `)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching applications:', error);
      return;
    }
    
    setApplications(data.map(app => ({
      ...app,
      position: app.position.title
    })) || []);
  };
  
  // Save contacts to localStorage when they change
  useEffect(() => {
    localStorage.setItem('job-contacts', JSON.stringify(contacts));
  }, [contacts]);
  
  const handleAddApplication = async () => {
    if (!newApplication.company || !newApplication.position || !user) return;

    try {
      // First, get or create the company
      let { data: companies, error: companyError } = await supabase
        .from('bolt_companies')
        .select('id')
        .eq('name', newApplication.company)
        .limit(1);
        
      let companyId;
      
      if (companyError) throw companyError;
      
      if (!companies || companies.length === 0) {
        // Create new company
        const { data: newCompany, error: createError } = await supabase
          .from('bolt_companies')
          .insert({ name: newApplication.company })
          .select('id')
          .single();
          
        if (createError) throw createError;
        companyId = newCompany.id;
      } else {
        companyId = companies[0].id;
      }

      // Get or create position
      let { data: positionData, error: positionError } = await supabase
        .from('bolt_positions')
        .select('id')
        .eq('title', newApplication.position)
        .limit(1);

      if (positionError) throw positionError;

      let positionId;
      if (!positionData || positionData.length === 0) {
        const { data: newPosition, error: createPositionError } = await supabase
          .from('bolt_positions')
          .insert({ title: newApplication.position })
          .select('id')
          .single();

        if (createPositionError) throw createPositionError;
        positionId = newPosition.id;
      } else {
        positionId = positionData[0].id;
      }
      
      // Create application
      const { error: applicationError } = await supabase
        .from('bolt_applications')
        .insert({
          company_id: companyId,
          position_id: positionId,
          status: 'applied',
          applied_date: new Date().toISOString(),
          user_id: user.id
        });
        
      if (applicationError) throw applicationError;
      
      // Refresh applications
      await fetchApplications();
      await fetchPositions();
      
      // Reset form
      setNewApplication({ company: '', position: '', status: 'applied' });
      
    } catch (error) {
      console.error('Error adding application:', error);
    }
  };
  
  const handleUpdateApplication = async (updatedApplication: JobApplication) => {
    try {
      const { error } = await supabase
        .from('bolt_applications')
        .update({
          status: updatedApplication.status,
          applied_date: updatedApplication.applied_date,
          url: updatedApplication.url,
          notes: updatedApplication.notes
        })
        .eq('id', updatedApplication.id);

      if (error) throw error;

      await fetchApplications();
      setShowJobForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating application:', error);
    }
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
  
  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'application') {
        const { error } = await supabase
          .from('bolt_applications')
          .delete()
          .eq('id', itemToDelete.id);

        if (error) throw error;
        await fetchApplications();
      } else {
        setContacts(contacts.filter(contact => contact.id !== itemToDelete.id));
      }
      
      setShowConfirmDelete(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting item:', error);
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
        csvContent += `"${item.company.name}","${item.position}","${new Date(item.applied_date).toLocaleDateString()}","${item.status}","${item.url || ''}","${item.notes || ''}"\n`;
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

  const handleMarkRead = (id: number) => {
    setFeedItems(items =>
      items.map(item =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  };

  const unreadCount = feedItems.filter(item => !item.read).length;
  
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
          { id: 'contacts', label: 'Contacts', count: contacts.length },
          { id: 'feed', label: 'Feed', count: unreadCount }
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
          
          {/* Applications List */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">Company</th>
                  <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">Position</th>
                  <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">Applied</th>
                  <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">Status</th>
                  <th className="text-right py-1 px-2 text-xs font-medium text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Quick Add Form */}
                <tr className="border-b border-neutral-100">
                  <td className="py-1 px-2">
                    <input
                      type="text"
                      placeholder="Company"
                      className="input !py-1 !text-sm w-full"
                      value={newApplication.company}
                      onChange={e => setNewApplication({ ...newApplication, company: e.target.value })}
                    />
                  </td>
                  <td className="py-1 px-2">
                    <Autocomplete
                      value={newApplication.position}
                      onChange={value => setNewApplication({ ...newApplication, position: value })}
                      onSelect={value => setNewApplication({ ...newApplication, position: value })}
                      options={positions}
                      placeholder="Position"
                      className="!py-1 !text-sm w-full"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm text-neutral-500">Today</span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="inline-block rounded-full px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800">
                      Applied
                    </span>
                  </td>
                  <td className="py-1 px-2 text-right">
                    <button
                      onClick={handleAddApplication}
                      disabled={!newApplication.company || !newApplication.position}
                      className="btn btn-primary btn-sm"
                    >
                      Add
                    </button>
                  </td>
                </tr>
                
                {/* Applications List */}
                {filteredApplications.map(application => (
                  <tr key={application.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-1 px-2">
                      <div className="font-medium text-sm">{application.company.name}</div>
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
                    <td className="py-1 px-2">
                      <span className="text-sm">{application.position}</span>
                    </td>
                    <td className="py-1 px-2">
                      <span className="text-sm text-neutral-600">
                        {new Date(application.applied_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-1 px-2">
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
                    <td className="py-1 px-2 text-right">
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

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {feedItems.map(item => (
              <FeedItem 
                key={item.id} 
                item={item} 
                onMarkRead={handleMarkRead} 
              />
            ))}
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
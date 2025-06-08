import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from "react-router-dom";
import InterviewHistory from "./InterviewHistory";
import Actions from "./Actions";
import Todos from "./Todos";
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
  BellRing,
  Briefcase,
  Users as UsersIcon,
  Rss,
  History,
  Zap,
  CheckSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Components
import { SecondaryNav } from "../components/SecondaryNav";
import { JobForm } from "../components/JobForm";
import { ContactForm } from "../components/ContactForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FeedItem } from "../components/FeedItem";
import { Autocomplete } from "../components/Autocomplete";
import { ContactsTab } from "../components/ContactsTab";

// Types
import { JobApplication, Contact, NetworkingAction } from "../types";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

// Feed Item type to avoid collision with the component
interface FeedActivityItem {
  id: string;
  type: "connection" | "job_view" | "message";
  title: string;
  description?: string;
  created_at: string;
  url?: string;
  read: boolean;
}

const JobTracker = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("applications");
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showJobForm, setShowJobForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingItem, setEditingItem] = useState<
    JobApplication | Contact | null
  >(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: "application" | "contact";
  } | null>(null);
  const [contactActions, setContactActions] = useState<NetworkingAction[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [newApplication, setNewApplication] = useState({
    company: "",
    position: "",
    status: "applied",
  });
  const [feedItems, setFeedItems] = useState<FeedActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [secondaryNavVisible, setSecondaryNavVisible] = useState(false);

  // Check if we're on a nested route
  const isNestedRoute =
    location.pathname.includes("/interview-history") ||
    location.pathname.includes("/actions") ||
    location.pathname.includes("/todos");

  // Load data
  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchPositions();
      fetchFeedItems();
      fetchContacts();
    }
  }, [user]);

  const fetchFeedItems = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("bolt_feed")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching feed:", error);
      return;
    }

    setFeedItems(data || []);
    setUnreadCount(data?.filter((item) => !item.read).length || 0);
  };

  const handleMarkRead = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("bolt_feed")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error marking feed item as read:", error);
      return;
    }

    await fetchFeedItems();
  };

  const fetchPositions = async () => {
    const { data, error } = await supabase
      .from("bolt_positions")
      .select("title")
      .order("title");

    if (error) {
      console.error("Error fetching positions:", error);
      return;
    }

    setPositions(data.map((p) => p.title));
  };

  const fetchContacts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("bolt_contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contacts:", error);
      return;
    }

    setContacts(data || []);
  };

  const fetchContactActions = async (contactId: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("actions")
      .select("*")
      .eq("contact_id", contactId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contact actions:", error);
      return;
    }

    setContactActions(data || []);
  };

  const fetchApplications = async () => {
    const { data, error } = await supabase
      .from("bolt_applications")
      .select(
        `
        *,
        company:bolt_companies(*),
        position:bolt_positions(title)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching applications:", error);
      return;
    }

    setApplications(
      data.map((app) => ({
        ...app,
        position: app.position.title,
      })) || []
    );
  };

  // Save contacts to localStorage when they change
  useEffect(() => {
    localStorage.setItem("job-contacts", JSON.stringify(contacts));
  }, [contacts]);

  const handleAddApplication = async () => {
    if (!newApplication.company || !newApplication.position || !user) return;

    try {
      // First, get or create the company
      let { data: companies, error: companyError } = await supabase
        .from("bolt_companies")
        .select("id")
        .eq("name", newApplication.company)
        .limit(1);

      let companyId;

      if (companyError) throw companyError;

      if (!companies || companies.length === 0) {
        // Create new company
        const { data: newCompany, error: createError } = await supabase
          .from("bolt_companies")
          .insert({ name: newApplication.company })
          .select("id")
          .single();

        if (createError) throw createError;
        companyId = newCompany.id;
      } else {
        companyId = companies[0].id;
      }

      // Get or create position
      let { data: positionData, error: positionError } = await supabase
        .from("bolt_positions")
        .select("id")
        .eq("title", newApplication.position)
        .limit(1);

      if (positionError) throw positionError;

      let positionId;
      if (!positionData || positionData.length === 0) {
        const { data: newPosition, error: createPositionError } = await supabase
          .from("bolt_positions")
          .insert({ title: newApplication.position })
          .select("id")
          .single();

        if (createPositionError) throw createPositionError;
        positionId = newPosition.id;
      } else {
        positionId = positionData[0].id;
      }

      // Create application
      const { error: applicationError } = await supabase
        .from("bolt_applications")
        .insert({
          company_id: companyId,
          position_id: positionId,
          status: "applied",
          applied_date: new Date().toISOString(),
          user_id: user.id,
        });

      if (applicationError) throw applicationError;

      // Refresh applications
      await fetchApplications();
      await fetchPositions();

      // Reset form
      setNewApplication({ company: "", position: "", status: "applied" });
    } catch (error) {
      console.error("Error adding application:", error);
    }
  };

  const handleUpdateApplication = async (
    updatedApplication: JobApplication
  ) => {
    try {
      const { error } = await supabase
        .from("bolt_applications")
        .update({
          status: updatedApplication.status,
          applied_date: updatedApplication.applied_date,
          url: updatedApplication.url,
          notes: updatedApplication.notes,
        })
        .eq("id", updatedApplication.id);

      if (error) throw error;

      await fetchApplications();
      setShowJobForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating application:", error);
    }
  };

  const handleAddContact = async (
    contact: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at">
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("bolt_contacts").insert({
        ...contact,
        user_id: user.id,
      });

      if (error) throw error;

      await fetchContacts();
      setShowContactForm(false);
    } catch (error) {
      console.error("Error adding contact:", error);
    }
  };

  const handleUpdateContact = async (updatedContact: Contact) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("bolt_contacts")
        .update({
          name: updatedContact.name,
          company: updatedContact.company,
          role: updatedContact.role,
          email: updatedContact.email,
          phone: updatedContact.phone,
          notes: updatedContact.notes,
          last_contact_date: updatedContact.last_contact_date,
        })
        .eq("id", updatedContact.id)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchContacts();
      setShowContactForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating contact:", error);
    }
  };

  const handleEditClick = (
    item: JobApplication | Contact,
    type: "application" | "contact"
  ) => {
    setEditingItem(item);
    if (type === "application") {
      setShowJobForm(true);
    } else {
      setShowContactForm(true);
    }
  };

  const handleDeleteClick = (id: string, type: "application" | "contact") => {
    setItemToDelete({ id, type });
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !user) return;

    try {
      if (itemToDelete.type === "application") {
        const { error } = await supabase
          .from("bolt_applications")
          .delete()
          .eq("id", itemToDelete.id);

        if (error) throw error;
        await fetchApplications();
      } else {
        const { error } = await supabase
          .from("bolt_contacts")
          .delete()
          .eq("id", itemToDelete.id)
          .eq("user_id", user.id);

        if (error) throw error;
        await fetchContacts();
      }

      setShowConfirmDelete(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  // Filter applications based on status
  const filteredApplications =
    statusFilter === "all"
      ? applications
      : applications.filter((app) => app.status === statusFilter);

  // Export data as CSV
  const exportData = () => {
    const dataToExport = activeTab === "applications" ? applications : contacts;

    // Create CSV content
    let csvContent = "";

    if (activeTab === "applications") {
      csvContent = "Company,Position,Date Applied,Status,URL,Notes\n";
      dataToExport.forEach((item: any) => {
        csvContent += `"${item.company.name}","${item.position}","${new Date(
          item.applied_date
        ).toLocaleDateString()}","${item.status}","${item.url || ""}","${
          item.notes || ""
        }"\n`;
      });
    } else {
      csvContent = "Name,Company,Email,Phone,Notes,Last Contact Date\n";
      dataToExport.forEach((item: any) => {
        csvContent += `"${item.name}","${item.company || ""}","${
          item.email || ""
        }","${item.phone || ""}","${item.notes || ""}","${
          item.lastContactDate
            ? new Date(item.lastContactDate).toLocaleDateString()
            : ""
        }"\n`;
      });
    }

    // Create download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative flex h-full max-w-7xl mx-auto">
      {/* Hover trigger for secondary nav on mobile */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 z-20 md:hidden"
        onMouseEnter={() => setSecondaryNavVisible(true)}
      />

      {/* Secondary Navigation */}
      <SecondaryNav
        items={[
          {
            id: "applications",
            label: "Applications",
            count: applications.length,
            icon: <Briefcase className="h-3 w-3" />,
            href: isNestedRoute ? "/job-tracker" : undefined,
          },
          {
            id: "contacts",
            label: "Contacts",
            count: contacts.length,
            icon: <UsersIcon className="h-3 w-3" />,
            href: isNestedRoute ? "/job-tracker" : undefined,
          },
          {
            id: "feed",
            label: "Feed",
            count: unreadCount,
            icon: <Rss className="h-3 w-3" />,
            href: isNestedRoute ? "/job-tracker" : undefined,
          },
          {
            id: "history",
            label: "History",
            count: 3,
            icon: <History className="h-3 w-3" />,
            href: "/job-tracker/interview-history",
          },
          {
            id: "todos",
            label: "To-dos",
            count: 0,
            icon: <CheckSquare className="h-3 w-3" />,
            href: "/job-tracker/todos",
          },
          {
            id: "actions",
            label: "Actions",
            count: 4,
            icon: <Zap className="h-3 w-3" />,
            href: "/job-tracker/actions",
          },
        ]}
        activeItem={
          isNestedRoute
            ? location.pathname.includes("/interview-history")
              ? "history"
              : location.pathname.includes("/todos")
              ? "todos"
              : "actions"
            : activeTab
        }
        onChange={setActiveTab}
        isVisible={secondaryNavVisible}
        onMouseEnter={() => setSecondaryNavVisible(true)}
        onMouseLeave={() => setSecondaryNavVisible(false)}
      />

      {/* Main Content Area */}
      <div
        className="flex-1 space-y-4 p-1"
        onMouseEnter={() => setSecondaryNavVisible(false)}
      >
        <Routes>
          <Route path="interview-history" element={<InterviewHistory />} />
          <Route path="todos" element={<Todos />} />
          <Route path="actions" element={<Actions />} />
          <Route
            path="*"
            element={
              // Render main job tracker content
              <>
                {/* Header */}
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-xl font-semibold text-neutral-900">
                      {activeTab === "applications"
                        ? "Job Applications"
                        : activeTab === "contacts"
                        ? "Contacts"
                        : "Activity Feed"}
                    </h1>
                  </div>

                  <button
                    className="btn btn-outline btn-sm"
                    onClick={exportData}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export
                  </button>
                </div>

                {/* Applications Tab */}
                {activeTab === "applications" && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Filter className="h-3.5 w-3.5 text-neutral-500" />
                        <select
                          className="select !py-1 !text-sm !w-auto"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
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
                        Showing {filteredApplications.length} of{" "}
                        {applications.length} applications
                      </p>
                    </div>

                    {/* Applications List */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-neutral-200">
                            <th className="text-left py-1 px-1 text-xs font-medium text-neutral-500">
                              Company
                            </th>
                            <th className="text-left py-1 px-1 text-xs font-medium text-neutral-500">
                              Position
                            </th>
                            <th className="text-left py-1 px-1 text-xs font-medium text-neutral-500">
                              Applied
                            </th>
                            <th className="text-left py-1 px-1 text-xs font-medium text-neutral-500">
                              Status
                            </th>
                            <th className="text-right py-1 px-1 text-xs font-medium text-neutral-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Quick Add Form */}
                          <tr className="border-b border-neutral-100">
                            <td className="py-1 px-1">
                              <input
                                type="text"
                                placeholder="Company"
                                className="!py-1 !text-sm w-full"
                                value={newApplication.company}
                                onChange={(e) =>
                                  setNewApplication({
                                    ...newApplication,
                                    company: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td className="py-1 px-1">
                              <Autocomplete
                                value={newApplication.position}
                                onChange={(value) =>
                                  setNewApplication({
                                    ...newApplication,
                                    position: value,
                                  })
                                }
                                onSelect={(value) =>
                                  setNewApplication({
                                    ...newApplication,
                                    position: value,
                                  })
                                }
                                options={positions}
                                placeholder="Position"
                                className="!py-1 !text-sm w-full"
                              />
                            </td>
                            <td className="py-1 px-1">
                              <span className="text-sm text-neutral-500">
                                Today
                              </span>
                            </td>
                            <td className="py-1 px-1">
                              <span className="inline-block rounded-full px-1 py-0.5 text-xs font-medium bg-primary-100 text-primary-800">
                                A
                              </span>
                            </td>
                            <td className="py-1 px-1 text-right">
                              <button
                                onClick={handleAddApplication}
                                disabled={
                                  !newApplication.company ||
                                  !newApplication.position
                                }
                                className="btn btn-primary btn-sm text-xs px-2 py-0.5"
                              >
                                Add
                              </button>
                            </td>
                          </tr>

                          {/* Applications List */}
                          {filteredApplications.map((application) => (
                            <tr
                              key={application.id}
                              className="border-b border-neutral-100 hover:bg-neutral-50"
                            >
                              <td className="py-1 px-1">
                                <div className="font-medium text-sm">
                                  {application.company.name}
                                </div>
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
                              <td className="py-1 px-1">
                                <span className="text-sm">
                                  {application.position}
                                </span>
                              </td>
                              <td className="py-1 px-1">
                                <span className="text-sm text-neutral-600">
                                  {new Date(
                                    application.applied_date
                                  ).toLocaleDateString("en-US", {
                                    month: "numeric",
                                    day: "numeric",
                                  })}
                                </span>
                              </td>
                              <td className="py-1 px-1">
                                <span
                                  className={`inline-block rounded-full px-1 py-0.5 text-xs font-medium ${
                                    application.status === "applied"
                                      ? "bg-primary-100 text-primary-800"
                                      : application.status === "interviewing"
                                      ? "bg-secondary-100 text-secondary-800"
                                      : application.status === "rejected"
                                      ? "bg-error-100 text-error-800"
                                      : application.status === "offered"
                                      ? "bg-warning-100 text-warning-800"
                                      : "bg-success-100 text-success-800"
                                  }`}
                                >
                                  {application.status.charAt(0).toUpperCase()}
                                </span>
                              </td>
                              <td className="py-1 px-1 text-right">
                                <div className="flex items-center justify-end">
                                  <button
                                    onClick={() =>
                                      handleEditClick(
                                        application,
                                        "application"
                                      )
                                    }
                                    className="p-1 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteClick(
                                        application.id.toString(),
                                        "application"
                                      )
                                    }
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
                {activeTab === "contacts" && (
                  <ContactsTab
                    contacts={contacts}
                    onAddContact={() => setShowContactForm(true)}
                    onEditContact={(contact) =>
                      handleEditClick(contact, "contact")
                    }
                    onDeleteContact={(contactId) =>
                      handleDeleteClick(contactId, "contact")
                    }
                    onFetchContactActions={fetchContactActions}
                    contactActions={contactActions}
                  />
                )}

                {/* Feed Tab */}
                {activeTab === "feed" && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                      {feedItems.map((item) => (
                        <FeedItem
                          key={item.id}
                          item={item}
                          onMarkRead={handleMarkRead}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            }
          />
        </Routes>
      </div>

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
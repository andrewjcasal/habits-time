import React, { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Calendar, User, Building } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Contact, NetworkingAction } from "../types";

interface NewAction {
  contact_id: string;
  action_taken: string;
  follow_up_date: string;
  note: string;
}

const Actions = () => {
  const { user } = useAuth();
  const [actions, setActions] = useState<NetworkingAction[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAction, setEditingAction] = useState<NetworkingAction | null>(
    null
  );
  const [newAction, setNewAction] = useState<NewAction>({
    contact_id: "",
    action_taken: "",
    follow_up_date: "",
    note: "",
  });

  useEffect(() => {
    if (user) {
      fetchActions();
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("bolt_contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  };

  const fetchActions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("actions")
        .select(
          `
          *,
          contact:bolt_contacts(*)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error("Error fetching actions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const actionData = {
        contact_id: newAction.contact_id || null,
        action_taken: newAction.action_taken,
        note: newAction.note,
        user_id: user.id,
        follow_up_date: newAction.follow_up_date || null,
      };

      if (editingAction) {
        const { error } = await supabase
          .from("actions")
          .update(actionData)
          .eq("id", editingAction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("actions").insert([actionData]);
        if (error) throw error;
      }

      await fetchActions();
      resetForm();
    } catch (error) {
      console.error("Error saving action:", error);
    }
  };

  const handleEdit = (action: NetworkingAction) => {
    setEditingAction(action);
    setNewAction({
      contact_id: action.contact_id || "",
      action_taken: action.action_taken,
      note: action.note || "",
      follow_up_date: action.follow_up_date || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from("actions").delete().eq("id", id);

      if (error) throw error;
      await fetchActions();
    } catch (error) {
      console.error("Error deleting action:", error);
    }
  };

  const resetForm = () => {
    setNewAction({
      contact_id: "",
      action_taken: "",
      note: "",
      follow_up_date: "",
    });
    setEditingAction(null);
    setShowForm(false);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Ongoing";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-neutral-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Networking Actions
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary btn-sm"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Action
        </button>
      </div>

      {/* Actions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Date
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Note
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Contact
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Company
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Role
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Action Taken
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Follow-Up Date
              </th>
              <th className="text-right py-1 px-2 text-xs font-medium text-neutral-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {actions.map((action, index) => (
                <motion.tr
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-neutral-100 hover:bg-neutral-50"
                >
                  <td className="py-1 px-2">
                    <span className="text-sm">
                      {formatDate(action.created_at)}
                    </span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm">{action.note}</span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm font-medium">
                      {action.contact.name}
                    </span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm">{action.contact.company}</span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm">
                      {action.contact.company.applications?.[0].position.title}
                    </span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm">{action.action_taken}</span>
                  </td>
                  <td className="py-1 px-2">
                    <span
                      className={`text-sm ${
                        action.follow_up_date
                          ? "text-neutral-600"
                          : "text-neutral-500 italic"
                      }`}
                    >
                      {formatDate(action.follow_up_date)}
                    </span>
                  </td>
                  <td className="py-1 px-2 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => handleEdit(action)}
                        className="p-1 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(action.id)}
                        className="p-1 text-neutral-500 hover:text-error-600 hover:bg-neutral-100 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {/* Empty state */}
        {actions.length === 0 && (
          <div className="p-8 text-center">
            <User className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-600">No networking actions yet</p>
            <p className="text-sm text-neutral-500 mt-1">
              Start tracking your outreach and networking activities
            </p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={resetForm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit} className="p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  {editingAction ? "Edit Action" : "Add New Action"}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      required
                      className="input w-full"
                      value={newAction.contact_name}
                      onChange={(e) =>
                        setNewAction({
                          ...newAction,
                          contact_name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      required
                      className="input w-full"
                      value={newAction.company}
                      onChange={(e) =>
                        setNewAction({ ...newAction, company: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      required
                      className="input w-full"
                      value={newAction.role}
                      onChange={(e) =>
                        setNewAction({ ...newAction, role: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Action Taken
                    </label>
                    <textarea
                      required
                      className="input w-full min-h-[80px]"
                      value={newAction.action_taken}
                      onChange={(e) =>
                        setNewAction({
                          ...newAction,
                          action_taken: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Follow-Up Date (Optional)
                    </label>
                    <input
                      type="date"
                      className="input w-full"
                      value={newAction.follow_up_date}
                      onChange={(e) =>
                        setNewAction({
                          ...newAction,
                          follow_up_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    {editingAction ? "Update" : "Add"} Action
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Actions;

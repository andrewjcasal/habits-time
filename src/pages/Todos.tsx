import React, { useState, useEffect } from "react";
import { Plus, Check, Edit, Trash2, Calendar, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Company, Contact, TodoType } from "../types";

interface Todo {
  id: number;
  user_id: string;
  contact_id?: string;
  contact?: Contact;
  note: string;
  status: "pending" | "completed";
  created_at: string;
  updated_at: string;
  company: Company;
  todo_type: TodoType;
}

interface NewTodo {
  contact_id: string;
  note: string;
}

const Todos = () => {
  const { user } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [newTodo, setNewTodo] = useState<NewTodo>({
    contact_id: "",
    note: "",
  });

  useEffect(() => {
    if (user) {
      fetchTodos();
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

  const fetchTodos = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("todos")
        .select(
          `
          *,
          company:bolt_companies(id, name, applications:bolt_applications(position:bolt_positions(title))),
          todo_type:todo_types(id, name, script)
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      console.log("data", data);
      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error("Error fetching todos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTodo) return;

    try {
      // Complete the todo and create action with selected contact
      await handleComplete(editingTodo, newTodo.contact_id || null);
      resetForm();
    } catch (error) {
      console.error("Error completing todo:", error);
    }
  };

  const handleComplete = async (
    todo: Todo,
    contactId: string | null = null
  ) => {
    try {
      // Use the database function to complete todo and create action
      const { data, error } = await supabase.rpc("complete_todo_with_action", {
        p_todo_id: todo.id,
        p_contact_id: contactId,
      });

      if (error) throw error;

      // Check if the function returned an error
      if (data && !data.success) {
        throw new Error(data.error || "Failed to complete todo");
      }

      await fetchTodos();
    } catch (error) {
      console.error("Error completing todo:", error);
    }
  };

  const handleCompleteWithContact = (todo: Todo) => {
    setEditingTodo(todo);
    setNewTodo({
      contact_id: "",
      note: todo.note,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from("todos").delete().eq("id", id);

      if (error) throw error;
      await fetchTodos();
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  const resetForm = () => {
    setNewTodo({
      contact_id: "",
      note: "",
    });
    setEditingTodo(null);
    setShowForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
  };

  const getActionDisplayName = (todo: Todo) => {
    if (todo.todo_type.name === "comment") {
      return "Comment";
    } else if (todo.todo_type.name === "ask_for_intro") {
      return "Ask for intro";
    }
  };

  const getContactName = (todo: Todo) => {
    if (
      todo.company &&
      typeof todo.company === "object" &&
      todo.todo_type.name
    ) {
      return getActionDisplayName(todo) + " - " + todo.company.name;
    }
    return "No company";
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
            Follow-up To-dos
          </h1>
        </div>
      </div>

      {/* Todos Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Date Added
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Action
              </th>
              <th className="text-left py-1 px-2 text-xs font-medium text-neutral-500">
                Note
              </th>
              <th className="text-right py-1 px-2 text-xs font-medium text-neutral-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {todos.map((todo, index) => (
                <motion.tr
                  key={todo.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className={`border-b border-neutral-100 hover:bg-neutral-50 ${
                    todo.status === "completed" ? "opacity-60" : ""
                  }`}
                >
                  <td className="py-1 px-2">
                    <span className="text-sm">
                      {formatDate(todo.created_at)}
                    </span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm font-medium">
                      {getContactName(todo)}
                    </span>
                  </td>
                  <td className="py-1 px-2">
                    <span className="text-sm">{todo.note}</span>
                  </td>
                  <td className="py-1 px-2 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {todo.status === "pending" && (
                        <button
                          onClick={() => handleComplete(todo, null)}
                          className="p-1 text-neutral-500 hover:text-success-600 hover:bg-neutral-100 rounded"
                          title="Mark as completed"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCompleteWithContact(todo)}
                        className="p-1 text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 rounded"
                        title="Complete with contact"
                      >
                        <User className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(todo.id)}
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
        {todos.length === 0 && (
          <div className="p-8 text-center">
            <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-600">No to-dos yet</p>
            <p className="text-sm text-neutral-500 mt-1">
              Add follow-up actions to track and convert to networking
              activities
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1"
            onClick={resetForm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit} className="p-2">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Complete To-do
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Script
                    </label>
                    <p className="text-sm text-neutral-500 mb-2">
                      {editingTodo?.todo_type?.script
                        .replace("[Company]", editingTodo?.company?.name || "")
                        .replace(
                          "[Role]",
                          editingTodo?.company?.applications?.[0].position
                            .title || ""
                        )}
                    </p>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Contact (Optional)
                    </label>
                    <select
                      className="input w-full"
                      value={newTodo.contact_id}
                      onChange={(e) =>
                        setNewTodo({
                          ...newTodo,
                          contact_id: e.target.value,
                        })
                      }
                    >
                      <option value="">Select a contact...</option>
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name}{" "}
                          {contact.company && `(${contact.company})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Note
                    </label>
                    <textarea
                      required
                      className="input w-full !h-24 resize-none"
                      value={newTodo.note}
                      onChange={(e) =>
                        setNewTodo({ ...newTodo, note: e.target.value })
                      }
                      placeholder="e.g., Comment on their LinkedIn post about the new product launch and ask for an intro to their hiring manager"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Complete To-do
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

export default Todos;

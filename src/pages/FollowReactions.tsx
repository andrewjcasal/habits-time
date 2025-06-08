import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Check,
  X,
  ExternalLink,
  Calendar,
  User,
  Heart,
  MessageCircle,
  Share,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

interface LinkedinPost {
  id: number;
  created_at: string;
  author: string;
  notes: string;
  reacted_by: string;
}

const FollowReactions = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<LinkedinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPost, setNewPost] = useState({
    author: "",
    reacted_by: "",
    notes: "",
  });

  // Fetch posts from Supabase
  const fetchPosts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("linkedin_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching posts:", error);
        return;
      }

      setPosts(data || []);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchPosts();
    }
  }, [user]);

  const handleAddPost = async () => {
    if (!newPost.author || !newPost.reacted_by || !user) return;

    try {
      const { data, error } = await supabase
        .from("linkedin_posts")
        .insert([
          {
            author: newPost.author,
            reacted_by: newPost.reacted_by,
            notes: newPost.notes,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Error adding post:", error);
        return;
      }

      // Add to local state
      setPosts([data, ...posts]);

      // Reset form
      setNewPost({
        author: "",
        reacted_by: "",
        notes: "",
      });
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding post:", error);
    }
  };

  const handleStartEdit = (id: number, field: string, value: string) => {
    setEditingId(id);
    setEditingField(field);
    setEditingValue(value);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingField || !user) return;

    try {
      const { error } = await supabase
        .from("linkedin_posts")
        .update({ [editingField]: editingValue })
        .eq("id", editingId);

      if (error) {
        console.error("Error updating post:", error);
        return;
      }

      // Update local state
      setPosts(
        posts.map((post) =>
          post.id === editingId
            ? { ...post, [editingField]: editingValue }
            : post
        )
      );
    } catch (error) {
      console.error("Error updating post:", error);
    }

    setEditingId(null);
    setEditingField(null);
    setEditingValue("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditingValue("");
  };

  const handleDeletePost = async (id: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("linkedin_posts")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting post:", error);
        return;
      }

      // Remove from local state
      setPosts(posts.filter((post) => post.id !== id));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-7xl mx-auto p-1">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Follow Reactions
          </h1>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn-primary text-sm px-1 py-0.5"
        >
          Add Post
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card bg-white p-1"
          >
            <h3 className="text-lg font-medium mb-1">Add New Post Reaction</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Post Author
                </label>
                <input
                  type="text"
                  value={newPost.author}
                  onChange={(e) =>
                    setNewPost({
                      ...newPost,
                      author: e.target.value,
                    })
                  }
                  className="w-full"
                  placeholder="Who wrote the post?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Reacted By
                </label>
                <input
                  type="text"
                  value={newPost.reacted_by}
                  onChange={(e) =>
                    setNewPost({
                      ...newPost,
                      reacted_by: e.target.value,
                    })
                  }
                  className="w-full"
                  placeholder="Who reacted to the post?"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newPost.notes}
                  onChange={(e) =>
                    setNewPost({
                      ...newPost,
                      notes: e.target.value,
                    })
                  }
                  className="w-full"
                  rows={3}
                  placeholder="Any notes about this post or reaction..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-1 mt-1">
              <button
                onClick={() => setShowAddForm(false)}
                className="btn btn-outline text-sm px-1 py-0.5"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPost}
                disabled={!newPost.author || !newPost.reacted_by}
                className="btn btn-primary text-sm px-1 py-0.5"
              >
                Add Post
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Posts List */}
      <div className="space-y-4">
        <AnimatePresence>
          {posts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="card p-1 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-1 mb-0.5">
                    <div className="flex items-center space-x-2">
                      {editingId === post.id &&
                      editingField === "reacted_by" ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input !py-1 !text-sm"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="text-green-600"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="font-medium text-neutral-900 cursor-pointer hover:text-primary-600 text-sm"
                          onClick={() =>
                            handleStartEdit(
                              post.id,
                              "reacted_by",
                              post.reacted_by
                            )
                          }
                        >
                          {post.reacted_by}
                        </span>
                      )}
                    </div>

                    <span className="text-neutral-500 text-sm">reacted to</span>

                    {editingId === post.id && editingField === "author" ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="input !py-1 !text-sm"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          className="text-green-600"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className="font-medium text-neutral-700 cursor-pointer hover:text-primary-600 text-sm"
                        onClick={() =>
                          handleStartEdit(post.id, "author", post.author)
                        }
                      >
                        {post.author}'s post
                      </span>
                    )}
                  </div>

                  {post.notes && (
                    <div className="mb-0.5">
                      {editingId === post.id && editingField === "notes" ? (
                        <div className="flex items-start space-x-2">
                          <textarea
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="input !py-1 !text-sm flex-1"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={handleSaveEdit}
                              className="text-green-600"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="text-sm text-neutral-600"
                          onClick={() =>
                            handleStartEdit(post.id, "notes", post.notes)
                          }
                        >
                          <strong>Notes:</strong> {post.notes}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center text-xs text-neutral-500 space-x-4">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="text-neutral-400 hover:text-red-500 ml-4"
                >
                  <Trash2 className="h-2 w-2" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {posts.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-neutral-300" />
            <p>No LinkedIn post reactions tracked yet.</p>
            <p className="text-sm">
              Click "Add Post" to start tracking reactions from people you
              follow.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowReactions;

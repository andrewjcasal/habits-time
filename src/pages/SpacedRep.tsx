import { useState, useEffect } from 'react';
import { ChevronRight, Check, Clock, RotateCcw, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { format, isPast } from 'date-fns';

// Components
import { ProgressRing } from '../components/ProgressRing';

// Supabase
import { supabase, Problem, ProblemCategory, Attempt, ProblemWithAttempt } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const SpacedRep = () => {
  const { user } = useAuth();
  const [currentProblem, setCurrentProblem] = useState<ProblemWithAttempt | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ProblemWithAttempt[]>([]);
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);
  
  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("bolt_categories")
        .select("*")
        .order("name");

      if (categoriesData) {
        setCategories(categoriesData);
      }

      // First, fetch all problems
      const { data: allProblems, error: problemsError } = await supabase
        .from("bolt_problems")
        .select("*");

      if (problemsError) throw problemsError;

      // Then fetch all attempts for the current user
      const { data: attempts, error: attemptsError } = await supabase
        .from("bolt_attempts")
        .select("*")
        .eq('user_id', user.id);

      if (attemptsError) throw attemptsError;

      if (allProblems) {
        const now = new Date().toISOString();
        const reviewQueue = allProblems.map(problem => {
          const attempt = attempts?.find(a => a.problem_id === problem.id);
          return {
            ...problem,
            attempt
          };
        }).filter(problem => {
          // Include problem if:
          // 1. No attempt exists (never attempted) OR
          // 2. Has attempt and is due for review
          return !problem.attempt || 
                 (problem.attempt.next_review && problem.attempt.next_review <= now);
        });

        setReviewQueue(reviewQueue);
        if (reviewQueue.length > 0 && !currentProblem) {
          setCurrentProblem(reviewQueue[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (completed: boolean) => {
    if (!currentProblem || !user) return;

    const now = new Date();
    let nextLevel = completed ? ((currentProblem.attempt?.level ?? -1) + 1) : 0;
    let nextReview: Date | null = null;

    // Calculate next review date based on level
    if (completed) {
      const daysToAdd =
        {
          0: 1, // Review tomorrow
          1: 2, // Review in 2 days
          2: 4, // Review in 4 days
          3: 7, // Review in 7 days
          4: 16, // Review in 16 days
          5: 30, // Review in 30 days
          6: 60, // Review in 60 days
        }[nextLevel] || null;

      if (daysToAdd) {
        nextReview = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }
    }

    try {
      if (currentProblem.attempt) {
        // Update existing attempt
        await supabase
          .from("bolt_attempts")
          .update({
            completed,
            level: nextLevel,
            last_attempted: now.toISOString(),
            next_review: nextReview?.toISOString() || null,
          })
          .eq("id", currentProblem.attempt.id)
          .eq("user_id", user.id);
      } else {
        // Create new attempt
        await supabase
          .from("bolt_attempts")
          .insert({
            problem_id: currentProblem.id,
            user_id: user.id,
            completed,
            level: nextLevel,
            last_attempted: now.toISOString(),
            next_review: nextReview?.toISOString() || null,
          });
      }

      // Move to next problem in queue
      const nextProblem = reviewQueue.find((p) => p.id !== currentProblem?.id);
      setCurrentProblem(nextProblem || null);
      setReviewQueue(reviewQueue.filter((p) => p.id !== currentProblem?.id));

      // Refresh data
      fetchData();
    } catch (error) {
      console.error("Error updating attempt:", error);
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Neetcode 150</h1>
          <p className="text-neutral-600 mt-1">Master coding interview problems with spaced repetition</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-neutral-600">
            Problems to review today: <span className="font-medium">{reviewQueue.length}</span>
          </div>
          
          <ProgressRing 
            progress={Math.round((150 - reviewQueue.length) / 150 * 100)} 
            size={48} 
            strokeWidth={4} 
            color="#3B82F6" 
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Problem */}
        <div className="lg:col-span-2">
          {currentProblem ? (
            <motion.div 
              className="card bg-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-medium">{currentProblem.title}</h2>
                  <div className="flex items-center mt-1">
                    <span 
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        currentProblem.difficulty === 'Easy' 
                          ? 'bg-success-500' 
                          : currentProblem.difficulty === 'Medium' 
                            ? 'bg-warning-500' 
                            : 'bg-error-500'
                      }`} 
                    />
                    <span className="text-sm text-neutral-600">{currentProblem.difficulty}</span>
                    <span className="text-sm text-neutral-400 mx-2">•</span>
                    <span className="text-sm text-neutral-600">
                      Level {currentProblem.attempt?.level ?? 0}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleComplete(true)}
                    className="btn btn-primary !p-2"
                    aria-label="Mark as complete"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => handleComplete(false)}
                    className="btn btn-outline !p-2"
                    aria-label="Mark as incomplete"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-1">Problem Description</h3>
                <p className="text-neutral-600 text-sm">
                  {currentProblem.description || 'Visit the problem link to see the full description.'}
                </p>
                
                {currentProblem.url && (
                  <a 
                    href={currentProblem.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Solve on Leetcode →
                  </a>
                )}
              </div>
              
              <div className="mb-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-1">Your Notes</h3>
                <textarea 
                  className="input !h-32 resize-none"
                  placeholder="Add your notes, solutions, or reminders here..."
                  value={currentProblem.attempt?.notes || ''}
                  onChange={async (e) => {
                    if (!currentProblem.attempt?.id || !user) return;
                    try {
                      await supabase
                        .from("bolt_attempts")
                        .update({ notes: e.target.value })
                        .eq("id", currentProblem.attempt.id)
                        .eq("user_id", user.id);
                    } catch (error) {
                      console.error('Error updating notes:', error);
                    }
                  }}
                />
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-2">Related Concepts</h3>
                <div className="flex flex-wrap gap-1">
                  {currentProblem.tags?.map((tag, index) => (
                    <span 
                      key={index} 
                      className="badge bg-primary-50 text-primary-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="card bg-white text-center py-12">
              <p className="text-neutral-600">No problems to review right now!</p>
              <p className="text-sm text-neutral-500 mt-2">
                Come back later when you have problems due for review.
              </p>
            </div>
          )}
        </div>
        
        {/* Review Queue */}
        <div className="lg:col-span-1">
          <div className="card bg-white">
            <h2 className="text-lg font-medium mb-4">Review Queue</h2>
            
            {reviewQueue.length > 0 ? (
              <div className="space-y-3">
                {reviewQueue.map(problem => (
                  <motion.div
                    key={problem.id}
                    className={`p-3 rounded-md border transition-colors cursor-pointer ${
                      currentProblem?.id === problem.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-neutral-200 hover:border-primary-300'
                    }`}
                    onClick={() => setCurrentProblem(problem)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{problem.title}</h3>
                        <div className="flex items-center mt-1 text-sm text-neutral-500">
                          {problem.attempt ? (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              Due: {format(new Date(problem.attempt.next_review!), 'MMM d')}
                            </>
                          ) : (
                            'Not attempted yet'
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-center text-neutral-500 py-8">
                No problems in queue
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpacedRep;
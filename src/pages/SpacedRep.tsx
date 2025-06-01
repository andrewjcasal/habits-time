import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Clock, RotateCcw, Search } from 'lucide-react';
import { motion } from 'framer-motion';

// Components
import ProblemCard from '../components/ProblemCard';
import { ProgressRing } from '../components/ProgressRing';

// Utils
import { getNeetcodeProblems } from '../utils/neetcodeData';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Types
import { Problem } from '../types';

// Algorithm categories
const categories = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Binary Search',
  'Linked List',
  'Trees',
  'Tries',
  'Heap / Priority Queue',
  'Backtracking',
  'Graphs',
  'Advanced Graphs',
  'Dynamic Programming',
  '1D Dynamic Programming',
  '2D Dynamic Programming',
  'Greedy',
  'Intervals',
  'Math & Geometry',
  'Bit Manipulation'
];

const SpacedRep = () => {
  const [problems, setProblems] = useLocalStorage<Problem[]>('neetcode-progress', []);
  const [filteredProblems, setFilteredProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showProblemDetails, setShowProblemDetails] = useState(false);
  
  const itemsPerPage = 8;
  
  // Fetch Neetcode problems on first load
  useEffect(() => {
    const fetchProblems = async () => {
      if (problems.length === 0) {
        const neetcodeProblems = getNeetcodeProblems();
        setProblems(neetcodeProblems);
        setFilteredProblems(neetcodeProblems);
      } else {
        setFilteredProblems(problems);
      }
    };
    
    fetchProblems();
  }, [problems, setProblems]);
  
  // Filter problems based on search query and category
  useEffect(() => {
    let filtered = [...problems];
    
    if (searchQuery) {
      filtered = filtered.filter(problem => 
        problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        problem.difficulty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        problem.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(problem => problem.category === selectedCategory);
    }
    
    setFilteredProblems(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchQuery, selectedCategory, problems]);
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredProblems.length / itemsPerPage);
  const currentProblems = filteredProblems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Calculate statistics
  const totalCompleted = problems.filter(p => p.completed).length;
  const completionPercentage = Math.round((totalCompleted / problems.length) * 100) || 0;
  
  const handleProblemClick = (problem: Problem) => {
    setSelectedProblem(problem);
    setShowProblemDetails(true);
  };
  
  const handleStatusChange = (problemId: number, completed: boolean) => {
    const updatedProblems = problems.map(p => 
      p.id === problemId 
        ? { 
            ...p, 
            completed, 
            lastAttempted: Date.now(),
            dueDate: completed ? Date.now() + (3 * 24 * 60 * 60 * 1000) : p.dueDate // 3 days later if completed
          } 
        : p
    );
    
    setProblems(updatedProblems);
    
    if (selectedProblem && selectedProblem.id === problemId) {
      setSelectedProblem({
        ...selectedProblem,
        completed,
        lastAttempted: Date.now(),
        dueDate: completed ? Date.now() + (3 * 24 * 60 * 60 * 1000) : selectedProblem.dueDate
      });
    }
  };
  
  const resetProblemProgress = () => {
    if (selectedProblem) {
      const updatedProblems = problems.map(p => 
        p.id === selectedProblem.id 
          ? { 
              ...p, 
              completed: false,
              lastAttempted: null,
              dueDate: null,
              notes: ''
            } 
          : p
      );
      
      setProblems(updatedProblems);
      setSelectedProblem({
        ...selectedProblem,
        completed: false,
        lastAttempted: null,
        dueDate: null,
        notes: ''
      });
    }
  };
  
  const updateNotes = (problemId: number, notes: string) => {
    const updatedProblems = problems.map(p => 
      p.id === problemId ? { ...p, notes } : p
    );
    
    setProblems(updatedProblems);
    
    if (selectedProblem && selectedProblem.id === problemId) {
      setSelectedProblem({
        ...selectedProblem,
        notes
      });
    }
  };
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Neetcode 150</h1>
          <p className="text-neutral-600 mt-1">Master coding interview problems with spaced repetition</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <ProgressRing 
            progress={completionPercentage} 
            size={48} 
            strokeWidth={4} 
            color="#3B82F6" 
          />
          <div>
            <p className="text-sm font-medium text-neutral-900">Progress</p>
            <p className="text-lg font-semibold text-primary-600">{totalCompleted} / {problems.length}</p>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Search by title, difficulty, or category..."
              className="input pl-10"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="select"
        >
          <option value="all">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>
      
      {/* Problem Grid and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {currentProblems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentProblems.map(problem => (
                <ProblemCard
                  key={problem.id}
                  problem={problem}
                  onClick={() => handleProblemClick(problem)}
                  onStatusChange={handleStatusChange}
                  isSelected={selectedProblem?.id === problem.id}
                />
              ))}
            </div>
          ) : (
            <div className="card bg-white text-center py-12">
              <p className="text-neutral-600">No problems match your search criteria</p>
              <button 
                className="btn btn-primary mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-md hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
        
        {/* Problem Details Panel */}
        <div className={`lg:block ${showProblemDetails ? 'block' : 'hidden'}`}>
          {selectedProblem ? (
            <motion.div 
              className="card bg-white sticky top-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-medium">{selectedProblem.title}</h2>
                  <div className="flex items-center mt-1">
                    <span 
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        selectedProblem.difficulty === 'Easy' 
                          ? 'bg-success-500' 
                          : selectedProblem.difficulty === 'Medium' 
                            ? 'bg-warning-500' 
                            : 'bg-error-500'
                      }`} 
                    />
                    <span className="text-sm text-neutral-600">{selectedProblem.difficulty}</span>
                    <span className="text-sm text-neutral-400 mx-2">•</span>
                    <span className="text-sm text-neutral-600">{selectedProblem.category}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleStatusChange(selectedProblem.id, !selectedProblem.completed)}
                    className={`btn ${selectedProblem.completed ? 'btn-secondary' : 'btn-primary'} !p-2`}
                    aria-label={selectedProblem.completed ? "Mark as incomplete" : "Mark as complete"}
                  >
                    <Check size={16} />
                  </button>
                  
                  <button
                    onClick={resetProblemProgress}
                    className="btn btn-outline !p-2"
                    aria-label="Reset progress"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              
              {selectedProblem.lastAttempted && (
                <div className="flex items-center mb-4 text-sm text-neutral-500">
                  <Clock size={14} className="mr-1" />
                  Last attempted: {new Date(selectedProblem.lastAttempted).toLocaleDateString()}
                </div>
              )}
              
              <div className="mb-4">
                <h3 className="text-sm font-medium text-neutral-700 mb-1">Problem Description</h3>
                <p className="text-neutral-600 text-sm">
                  {selectedProblem.description || 'Visit the problem link to see the full description.'}
                </p>
                
                {selectedProblem.url && (
                  <a 
                    href={selectedProblem.url} 
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
                  value={selectedProblem.notes || ''}
                  onChange={e => updateNotes(selectedProblem.id, e.target.value)}
                />
              </div>
              
              {/* Tags/Concepts */}
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-2">Related Concepts</h3>
                <div className="flex flex-wrap gap-1">
                  {selectedProblem.tags?.map((tag, index) => (
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
              <p className="text-neutral-600">Select a problem to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpacedRep;
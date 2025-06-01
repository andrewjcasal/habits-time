import { InterviewType } from '../types';

// Generate interview prompts based on type and job description
export const generateInterviewPrompts = (
  type: InterviewType, 
  jobDescription: string, 
  forceNew: boolean = false
): string[] => {
  // In a real application, this would use AI to generate personalized prompts
  // based on the job description and interview type
  
  const codingPrompts = [
    "Implement a function to find the longest substring without repeating characters in a given string.",
    "Design a data structure that supports insertion, deletion, and random access with O(1) complexity.",
    "Write a function to determine if a binary tree is balanced.",
    "Implement a function to find the kth largest element in an unsorted array.",
    "Design a simplified version of a URL shortener service.",
    "Implement a basic algorithm for detecting a cycle in a linked list."
  ];
  
  const systemDesignPrompts = [
    "Design a scalable social media news feed system that can handle millions of users.",
    "Design a distributed file storage system like Dropbox or Google Drive.",
    "Design a notification service that can handle millions of notifications per day.",
    "Design a scalable e-commerce product catalog system.",
    "Design a URL shortener service with analytics capabilities.",
    "Design a real-time chat application that supports group messaging."
  ];
  
  const apiDesignPrompts = [
    "Design a RESTful API for a blog platform with posts, comments, and user authentication.",
    "Create a GraphQL schema for an e-commerce platform with products, carts, and orders.",
    "Design an API for a task management system with projects, tasks, and user assignments.",
    "Design a real-time API for a collaborative document editing system.",
    "Create an API for a social media platform with posts, comments, and user profiles.",
    "Design a versioned API for a financial application with transactions and accounts."
  ];
  
  let selectedPrompts: string[] = [];
  
  switch (type) {
    case 'coding':
      selectedPrompts = codingPrompts;
      break;
    case 'systemDesign':
      selectedPrompts = systemDesignPrompts;
      break;
    case 'apiDesign':
      selectedPrompts = apiDesignPrompts;
      break;
  }
  
  // Shuffle the prompts to get different ones each time if forceNew is true
  if (forceNew) {
    // Fisher-Yates shuffle
    for (let i = selectedPrompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selectedPrompts[i], selectedPrompts[j]] = [selectedPrompts[j], selectedPrompts[i]];
    }
  }
  
  // Return the top 3 prompts
  return selectedPrompts.slice(0, 3);
};
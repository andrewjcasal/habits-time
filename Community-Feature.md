# Community Feature Specification

## Overview

A comprehensive community management system for tracking relationships, communication preferences, and shared experiences.

## Core Components

### 1. People List Page

- Display list of friends/contacts
- Each person is clickable to navigate to their individual page

### 2. Individual Person Page

Each person's page contains:

#### Communication Preferences

- **Situations**: Different contexts for communication
- **Contact Methods**: Phone, email, text preferences per situation
- **Best Times**: When to reach out to them
- **Conversation Topics**: What to talk about with them

#### Relationship Data

- **Groups**: What groups/communities they belong to
- **Shared Experiences**: Past experiences together
- **Individual Experiences**: Their personal experiences that matter to the relationship
- **Opportunities**: Current opportunities being shared with them
- **Development**: How these opportunities are progressing

#### AI Insights

- **Chatbot Integration**: AI assistance for relationship management
- **Connection Importance**: Why it's important to maintain this relationship
- **Mutual Value**: What we offer each other

## Technical Implementation

### Navigation

- Add "Community" item to left navigation
- Route to `/community` for main list
- Route to `/community/[personId]` for individual pages

### Data Structure

```
Person {
  id: string
  name: string
  situations: Situation[]
  groups: Group[]
  sharedExperiences: Experience[]
  individualExperiences: Experience[]
  opportunities: Opportunity[]
  connectionImportance: string
  mutualValue: {
    whatIOfferThem: string[]
    whatTheyOfferMe: string[]
  }
}

Situation {
  name: string
  preferredContact: 'phone' | 'email' | 'text'
  bestTimes: string[]
  topics: string[]
}

Group {
  name: string
  description: string
}

Experience {
  title: string
  description: string
  date: Date
}

Opportunity {
  title: string
  description: string
  status: 'proposed' | 'in-progress' | 'completed'
  development: string
}
```

### Pages

1. **Community List** (`/community`)
   - Grid or list view of all people
   - Search/filter functionality
   - Quick stats per person

2. **Person Detail** (`/community/[personId]`)
   - Full relationship dashboard
   - Editable sections for all data
   - AI chatbot integration for advice
   - Communication history/notes

### Features

- **Smart Recommendations**: AI suggestions for when and how to reach out
- **Relationship Tracking**: Timeline of interactions and developments
- **Group Management**: Organize people by communities/groups
- **Opportunity Pipeline**: Track shared projects and opportunities

# Social Posting Feature Plan

## Overview
Add social posting functionality to the community page with network management and post creation/tracking capabilities.

## UI Structure

### Community Page Layout
- **Two Tabs at Top:**
  - "Network" (existing functionality)
  - "Social Posting" (new)

### Social Posting Tab Layout
- **Left Sidebar:** Social accounts list
  - X (Twitter) account(s) - start with this
  - LinkedIn accounts - add later
  - Each account shows profile info and connection status

- **Right Main Area:** Posts feed
  - Scrollable blog-style list of posts
  - Each post shows:
    - Content preview
    - Platform (X/LinkedIn)
    - Engagement metrics (likes, replies, etc.)
    - Last updated timestamp
    - History of engagement updates

- **Top Right:** "Create New Post" button
  - Opens modal with stepper workflow

## Database Schema

### `socials` table
```sql
- id (primary key)
- user_id (foreign key)
- platform (enum: 'twitter', 'linkedin')
- username
- profile_url
- is_active (boolean)
- knowledge (text) -- AI-generated summary of best practices for this user/platform
- created_at
- updated_at
```

### `social_posts` table
```sql
- id (primary key)
- user_id (foreign key)
- social_id (foreign key to socials table)
- content (text)
- hashtags (text) -- comma-separated hashtags like "#buildinpublic,#startup"
- platform (enum: 'twitter', 'linkedin')
- status (enum: 'draft', 'posted', 'scheduled')
- likes_count (integer, default 0)
- replies_count (integer, default 0)
- shares_count (integer, default 0)
- created_at
- updated_at
- posted_at (nullable)
```

### `social_post_engagement_history` table
```sql
- id (primary key)
- social_post_id (foreign key)
- likes_count (integer)
- replies_count (integer)
- shares_count (integer)
- recorded_at (timestamp)
- notes (text, optional)
```

## Post Creation Modal - Stepper Workflow

### Step 1: Topic Input
- **Title:** "What do you want to write about?"
- **Input:** Large textarea for user to describe their topic/idea
- **Next Button:** Proceeds to Step 2

### Step 2: AI-Generated Clarifying Questions
- **Process:** 
  - Send user's topic + knowledge base context to OpenAI
  - Generate 3 specific clarifying questions
- **UI:** 
  - Display the 3 questions
  - 3 textarea fields for user answers
  - Questions should help refine tone, audience, key points
- **Next Button:** Proceeds to Step 3

### Step 3: Post Preview & Editing
- **Main Textarea:** Generated post content (editable)
- **Hashtag Suggestions:** AI-generated relevant hashtags (e.g., #buildinpublic, #startup, #productivity)
- **AI Assistance Options:**
  - "Adjust for tone" button
  - "Improve clarity" button
  - "Suggest hashtags" button
  - Each generates alternative version
- **Version History:**
  - Show previous versions
  - Allow switching between versions
  - User can edit any version
- **Submit Button:** Saves post to database

## Post Management Features

### Engagement Tracking
- **Manual Update:** User can update likes, replies, shares
- **History Tracking:** Each update saves to engagement history
- **Display Format:** "8 likes, 3 replies, Updated Jul 20"
- **History View:** Click to see historical engagement data

### Post List Features
- **Filtering:** By platform, date, engagement level
- **Sorting:** Latest, most engaged, oldest
- **Search:** Find posts by content
- **Status Indicators:** Draft, Posted, Scheduled

## Knowledge Base Integration

### Socials Knowledge Base
- **Knowledge Column**: Each social account maintains an AI-generated summary of best practices
- **Example Knowledge**: "Add an exciting hook", "write something authentic", "use personal stories", "include actionable insights"
- **Auto-Updates**: Knowledge summary updates based on:
  - Post performance patterns
  - Engagement history analysis  
  - User's successful content themes
  - Platform-specific best practices

### Content Context
- Previous successful posts analyzed for patterns
- User's writing style and voice preferences
- Audience engagement preferences
- Platform-specific optimization tips

## Implementation Phases

### Phase 1: Basic Structure
1. Add tabs to community page
2. Create database tables
3. Basic social accounts management
4. Simple post list view

### Phase 2: Post Creation
1. Implement 3-step modal
2. OpenAI integration for questions and content generation
3. Post preview and editing functionality
4. Save drafts and posts

### Phase 3: Engagement Tracking
1. Manual engagement updates
2. Engagement history tracking
3. History visualization
4. Analytics and insights

### Phase 4: Enhanced Features
1. LinkedIn integration preparation
2. Advanced AI tone adjustments
3. Scheduling functionality (UI only)
4. Export/copy functionality improvements

## Design Consistency

### Spacing and Layout
- **Consistent Padding**: Match existing app spacing patterns
- **Grid System**: Use same grid/spacing units as other pages
- **Component Spacing**: Follow established margin/padding standards
- **Typography**: Maintain consistent text sizing and line heights
- **Interactive Elements**: Button sizes, hover states, and focus styles should match app patterns

## Technical Considerations

### OpenAI Integration
- API calls for clarifying questions generation
- Content generation and refinement
- Tone and clarity adjustments
- Rate limiting and error handling

### State Management
- Modal state for stepper workflow
- Post editing state with version history
- Engagement update optimistic updates

### UI Components Needed
- Tabbed interface component
- Multi-step modal/stepper
- Social account cards
- Post list items with engagement metrics
- Engagement history timeline
- AI assistance buttons and feedback

## Future Enhancements
- Actual API posting to X/LinkedIn
- Automated engagement tracking
- Analytics dashboard
- Content calendar view
- Team collaboration features
- Content templates and saved drafts
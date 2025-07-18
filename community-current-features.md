# Community Features - Current Implementation

## Overview
The Community feature is a comprehensive people and relationship management system that allows users to track their network, manage contacts, and record shared experiences.

## Existing Functionalities

### 1. Community List Page (`/community`)

**Features:**
- **Header Section**: 
  - Page title: "Community"
  - Subtitle: "Your network of people and connections"

- **Search & Add Controls**:
  - Search bar with placeholder "Search people, companies, or roles..."
  - Search filters by: name, company, role, email
  - "Add Person" button with plus icon

- **Add Person Form** (Inline):
  - Toggle-able form that appears in-page
  - Fields: Name* (required), Email, Phone, Company, Role
  - Form actions: Add Person, Cancel
  - Uses grid layout (2 columns on md+ screens)

- **People List Display**:
  - Shows all people in a bordered card layout
  - Each person card shows:
    - Avatar circle with initials (blue background)
    - Person name (clickable to navigate to detail page)
    - Role and company (when available)
    - Contact method icons (email, phone) when available
  - Empty state with Users icon and helpful messaging
  - Loading state with spinner
  - Error state with red alert styling

### 2. Person Detail Page (`/community/:personId`)

**Navigation & Header:**
- Back arrow button to return to community list
- Person avatar (larger, with initials)
- Person name as page title
- Role and company display
- Edit/Cancel toggle button

**Edit Mode:**
- Complete form for editing person details:
  - Basic info: Name*, Email, Phone, Company, Role
  - Social links: LinkedIn URL, Twitter URL, Website URL
  - Notes: Multi-line text area
- Save Changes and Cancel buttons
- Delete Person button (with confirmation)

**Display Mode - Two Column Layout:**

**Left Column (2/3 width) - Experiences Section:**
- Section header with clock icon and "Experiences" title
- "Add Experience" button 
- Experience cards showing:
  - Title and date
  - Type badges (shared, individual, meeting, event, other) with color coding
  - Location (when provided)
  - Connection strength indicator with icons and colors:
    - Strengthened (green, trending up icon)
    - Maintained (blue, minus icon)  
    - Weakened (red, trending down icon)
    - Neutral (gray, minus icon)
  - Description text
  - Attendees list (when provided)
  - Delete button per experience
- Empty state when no experiences exist
- Loading state with spinner

**Right Column (1/3 width) - Notes Section:**
- "Notes" header
- Person notes display (or empty state message)

### 3. Add Experience Modal

**Modal Features:**
- Overlay modal with white background
- Header with person name: "Add Experience with [Name]"
- Close button (X icon)

**Form Fields:**
- **Title & Date Row**: Title* (required), Date* (required, date picker)
- **Type & Location Row**: 
  - Type dropdown: Shared Experience, Individual Experience, Meeting, Event, Other
  - Location text input
- **Other Attendees**: 
  - Inline tag-based attendee selector
  - Search/autocomplete from existing people
  - Selected attendees appear as removable tags
  - Dropdown list of matching people
- **Description**: Multi-line textarea

**Styling:**
- Compact form with smaller padding (px-2 py-1.5)
- Smaller border radius (rounded vs rounded-lg)
- Smaller text (text-sm)
- Form actions: Cancel (gray), Save (blue)

### 4. Data Management

**People Management:**
- Create new people with basic contact info
- Edit existing people (all fields)
- Delete people (with confirmation)
- Search/filter people by multiple criteria

**Experience Management:**
- Add experiences linked to specific people
- Each experience includes: title, date, type, location, description, attendees
- Experiences are sorted by date (most recent first)
- Delete individual experiences
- Attendee selection from existing people database

### 5. Database Integration

**People Table:**
- Fields: id, user_id, name, email, phone, company, role, notes, linkedin_url, twitter_url, website_url, created_at, updated_at
- User isolation (experiences only shown for authenticated user)

**Experiences Table:**
- Fields: id, user_id, person_id, title, description, experience_date, type, location, attendees, connection_strength, created_at, updated_at
- Linked to specific people via person_id
- User isolation (experiences only shown for authenticated user)

### 6. Navigation Integration
- "Community" navigation item in main app navigation
- Routing: `/community` (list), `/community/:personId` (detail)

## Requested Changes

### Multi-Participant Experience Sharing
Currently, when creating a shared experience with multiple attendees:
- Attendees are stored as a text string in the `attendees` field
- Experience only appears on the primary person's page 
- Other attendees don't see this shared experience on their individual pages

**Requested Enhancement:**
- When creating a shared experience with selected attendees, the experience should appear on all participants' individual pages
- Need to create a many-to-many relationship between experiences and people
- Requires database schema changes (junction table) and updated experience creation logic

### Technical Requirements for Enhancement:
1. Create `experience_participants` junction table
2. Update experience creation to handle multiple participants
3. Update experience queries to show all experiences where person is a participant
4. Maintain backward compatibility with existing single-person experiences
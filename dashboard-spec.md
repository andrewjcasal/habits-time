# Dashboard Specification

## Overview

The dashboard serves as the main landing page with a Medium-like interface featuring daily reflections and behavioral insights.

## Layout Structure

### Main Container

- Clean, minimal design with ample white space
- Maximum width: 1200px, centered
- Responsive design for mobile and desktop

### Header Section

- **Generate Reflection Button**
  - Prominent, styled button at top of page
  - Text: "Generate Today's Reflection"
  - Triggers OpenAI edge function
  - Loading state while generating
  - Disabled state if already generated today

### Content Area (Two Column Layout)

#### Left Column (Main Content - 2/3 width)

- **Daily Reflection Section**
  - Generated via OpenAI edge function
  - 2-3 paragraphs in serif font (Georgia, Times, serif)
  - Typography:
    - Font size: 18-20px
    - Line height: 1.6-1.8
    - Color: #2c3e50 (dark gray)
    - Paragraph spacing: 24px
  - Content tone: Encouraging, compassionate, growth-oriented
  - Emphasizes habits as tools, imperfection as normal, resilience

#### Right Column (Sidebar - 1/3 width)

- **Behaviors List**
  - Title: "Behaviors to Consider"
  - Simple list format
  - Each behavior shows:
    - Name (bold)
    - Description (smaller text)
    - Category tag (optional, colored)
  - No actions/checkboxes - purely informational
  - Scrollable if list is long

## Visual Design

### Typography

- **Headings**: Inter, -apple-system, sans-serif
- **Body/Reflection**: Georgia, Times, serif
- **UI Elements**: Inter, -apple-system, sans-serif

### Color Palette

- Background: #fefefe (off-white)
- Text: #2c3e50 (dark gray)
- Accent: #3498db (blue)
- Borders: #ecf0f1 (light gray)
- Categories: Soft colors (#e8f5e8, #fff3cd, #f8d7da, etc.)

### Spacing

- Page margins: 40px
- Column gap: 60px
- Section spacing: 48px
- Element spacing: 24px

## Data Requirements

### Reflection Generation Input

- Last 3 days of `habits_notes` entries
- Completed habits from last 2-3 days
- User's current habit streak information

### Behaviors Display

- Fetch from `behaviors` table
- Order by category, then name
- Show description and category

## Edge Function Specification

### Function: `generate-daily-reflection`

- **Input**:
  - User ID
  - Date range for habit data
- **Process**:
  1. Query recent habits_notes
  2. Query completed habits
  3. Generate reflection via OpenAI
  4. Store reflection (optional caching)
- **Output**:
  - Generated reflection text
  - Metadata (generation timestamp)

### OpenAI Prompt Template

```
Based on the following habit tracking data from the last few days, write a thoughtful 2-3 paragraph daily reflection. The tone should be encouraging and compassionate, emphasizing that:
- Habits are tools for growth, not rigid rules
- Imperfection and falling off track is part of the journey
- What matters is getting back on track, not being perfect
- Small, consistent actions compound over time

Recent habit notes: [habits_notes data]
Recent completed habits: [completed habits data]

Write in a warm, Medium-style blog post tone with serif typography in mind.
```

## Component Structure

```
Dashboard
├── Header
│   └── GenerateReflectionButton
├── MainContent
│   ├── ReflectionSection
│   │   ├── ReflectionText (serif)
│   │   └── GenerationTimestamp
│   └── BehaviorsSidebar
│       ├── SectionTitle
│       └── BehaviorsList
│           └── BehaviorItem[]
└── Footer (optional)
```

## States to Handle

1. **No reflection generated**: Show placeholder or previous reflection
2. **Generating reflection**: Loading state with spinner
3. **Reflection generated**: Display new reflection
4. **Error generating**: Show error message and retry option
5. **No behaviors**: Empty state for behaviors list

## Responsive Design

### Desktop (>1024px)

- Two column layout as described
- Full typography scale

### Tablet (768-1024px)

- Maintain two columns but reduce gaps
- Slightly smaller typography

### Mobile (<768px)

- Stack columns vertically
- Reflection first, then behaviors below
- Adjust typography for readability
- Maintain serif font for reflection

## Future Enhancements

- Save/favorite reflections
- Share reflections
- Reflection history view
- Customizable behaviors list
- Personal reflection prompts
- Integration with habit completion data

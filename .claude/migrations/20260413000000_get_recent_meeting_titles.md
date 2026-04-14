# Migration: get_recent_meeting_titles

Creates a PostgreSQL function `get_recent_meeting_titles` that returns aggregated meeting title suggestions server-side.

## What it does
- Groups meeting titles by name for a given user
- Counts total usage and recent usage (last 2 weeks)
- Returns results sorted by recency and frequency
- Replaces client-side title aggregation in MeetingModal

## File
`sql/migrations/20260413000000_get_recent_meeting_titles.sql`

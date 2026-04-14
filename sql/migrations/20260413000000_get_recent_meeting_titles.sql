-- Returns aggregated previous meeting titles for quick-add suggestions
CREATE OR REPLACE FUNCTION get_recent_meeting_titles(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS TABLE (
  title text,
  count bigint,
  recent_count bigint,
  last_used timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.title,
    COUNT(*)::bigint AS count,
    COUNT(*) FILTER (WHERE m.start_time >= NOW() - INTERVAL '2 weeks')::bigint AS recent_count,
    MAX(m.start_time) AS last_used
  FROM cassian_meetings m
  WHERE m.user_id = p_user_id
    AND m.title IS NOT NULL
    AND m.title <> ''
  GROUP BY m.title
  ORDER BY
    -- Prioritize titles used in the last 2 weeks
    (COUNT(*) FILTER (WHERE m.start_time >= NOW() - INTERVAL '2 weeks') > 0) DESC,
    COUNT(*) FILTER (WHERE m.start_time >= NOW() - INTERVAL '2 weeks') DESC,
    COUNT(*) DESC,
    m.title ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

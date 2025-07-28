-- Add billable hours settings to user_settings table
ALTER TABLE user_settings 
ADD COLUMN billable_hours_enabled BOOLEAN DEFAULT false,
ADD COLUMN default_hourly_rate DECIMAL(8,2) DEFAULT 65.00,
ADD COLUMN weekly_revenue_target DECIMAL(10,2) DEFAULT 1000.00;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.billable_hours_enabled IS 'Enable automatic billable hours tracking and placeholder task generation';
COMMENT ON COLUMN user_settings.default_hourly_rate IS 'Default hourly rate for placeholder billable tasks (USD)';
COMMENT ON COLUMN user_settings.weekly_revenue_target IS 'Weekly revenue target for billable hours calculation (USD)';
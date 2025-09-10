-- Add 'coworking' option to the custom_category check constraint
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_custom_category_check;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_custom_category_check 
CHECK (custom_category IN ('convenience', 'social', 'trip', 'coworking'));
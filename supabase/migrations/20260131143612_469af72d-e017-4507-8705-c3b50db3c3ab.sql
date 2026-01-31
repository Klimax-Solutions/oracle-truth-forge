-- Add DELETE policy for super_admins on profiles table
CREATE POLICY "Super admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_super_admin());

-- Add DELETE policy for super_admins on user_cycles table
CREATE POLICY "Super admins can delete user_cycles"
ON public.user_cycles
FOR DELETE
USING (is_super_admin());

-- Add DELETE policy for super_admins on user_custom_variables
CREATE POLICY "Super admins can delete user_custom_variables"
ON public.user_custom_variables
FOR DELETE
USING (is_super_admin());

-- Add DELETE policy for super_admins on user_variable_types
CREATE POLICY "Super admins can delete user_variable_types"
ON public.user_variable_types
FOR DELETE
USING (is_super_admin());

-- Add DELETE policy for super_admins on user_personal_trades
CREATE POLICY "Super admins can delete user_personal_trades"
ON public.user_personal_trades
FOR DELETE
USING (is_super_admin());

-- Add DELETE policy for super_admins on user_executions
CREATE POLICY "Super admins can delete user_executions"
ON public.user_executions
FOR DELETE
USING (is_super_admin());
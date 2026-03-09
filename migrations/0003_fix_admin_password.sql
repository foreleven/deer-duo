-- Migration: 0003_fix_admin_password
-- Reset the built-in admin account's password_hash and salt to the correct
-- PBKDF2-SHA256 values (100 000 iterations, 256-bit key) that match the
-- default development credentials defined in migration 0001.
-- NOTE: This is a development-only default. Change the admin password
--       immediately after deploying to any production environment.
UPDATE users
SET password_hash = '1734f186dc6e48c93cfb64aeaa28d5942a94c8bf8631621212c739f938faf8e1',
    salt          = 'a7f3d2e1b4c5906f82d14e3b7a0c9e8f'
WHERE username = 'admin';

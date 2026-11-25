-- Carts.UserID must stay a *logical* reference to homecare.users.user_id
-- (cross-database). A real InnoDB FOREIGN KEY on techxpertstore.carts.UserID
-- breaks signed-in cart create/merge/PayU checkout:
--   guest carts (UserID NULL) work;
--   INSERT/UPDATE with a Homecare user_id → ER_NO_REFERENCED_ROW_2;
--   Bearer + guest cartId at checkout → 403 "Not authorized to access this cart".
--
-- Confirmed on green: CONSTRAINT `fk_cart_user`
--   FOREIGN KEY (`UserID`) REFERENCES `users` (`ID`) ON DELETE SET NULL
--
-- Run on techxpertstore_green (and blue if present) after backup:

ALTER TABLE carts DROP FOREIGN KEY fk_cart_user;

-- If the name differs on another env:
--   SELECT CONSTRAINT_NAME
--   FROM information_schema.KEY_COLUMN_USAGE
--   WHERE TABLE_SCHEMA = DATABASE()
--     AND TABLE_NAME = 'carts'
--     AND COLUMN_NAME = 'UserID'
--     AND REFERENCED_TABLE_NAME IS NOT NULL;
--   ALTER TABLE carts DROP FOREIGN KEY <name>;

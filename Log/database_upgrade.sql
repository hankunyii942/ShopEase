-- ============================================================
-- ShopEase — 数据库升级 SQL
-- 在 phpMyAdmin 的 SQL 标签里执行这段即可
-- 作用：给已有的 users 表添加两个新列
-- ============================================================

ALTER TABLE `users`
  ADD COLUMN `security_question` VARCHAR(200) DEFAULT NULL AFTER `phone`,
  ADD COLUMN `security_answer`   VARCHAR(255) DEFAULT NULL AFTER `security_question`;

-- ============================================================
-- 执行完成后，users 表的结构应该是：
--   id, name, email, password, phone,
--   security_question,   ← 新增
--   security_answer,     ← 新增
--   address, created_at
-- ============================================================

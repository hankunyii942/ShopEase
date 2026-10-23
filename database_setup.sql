-- ============================================================
-- ShopEase 完整数据库建表 SQL
-- 在 phpMyAdmin 的 SQL 标签里直接执行这整段
-- ============================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(100) NOT NULL,
  `email`      VARCHAR(150) NOT NULL UNIQUE,
  `password`   VARCHAR(255) NOT NULL,
  `phone`      VARCHAR(20)  DEFAULT NULL,
  `address`    TEXT         DEFAULT NULL,
  `created_at` DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 产品表
CREATE TABLE IF NOT EXISTS `products` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `name`           VARCHAR(200) NOT NULL,
  `price`          DECIMAL(10,2) NOT NULL,
  `original_price` DECIMAL(10,2) DEFAULT NULL,
  `image`          TEXT          DEFAULT NULL,
  `category`       VARCHAR(50)   DEFAULT NULL,
  `rating`         DECIMAL(3,1)  DEFAULT 5.0,
  `reviews`        INT           DEFAULT 0,
  `stock`          INT           DEFAULT 0,
  `description`    TEXT          DEFAULT NULL,
  `specs`          TEXT          DEFAULT NULL,
  `created_at`     DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 订单表
CREATE TABLE IF NOT EXISTS `orders` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`          INT           DEFAULT NULL,
  `total_price`      DECIMAL(10,2) NOT NULL,
  `status`           VARCHAR(30)   DEFAULT 'Processing',
  `payment_method`   VARCHAR(30)   DEFAULT NULL,
  `shipping_name`    VARCHAR(100)  NOT NULL,
  `shipping_phone`   VARCHAR(20)   NOT NULL,
  `shipping_address` TEXT          NOT NULL,
  `tracking_number`  VARCHAR(30)   DEFAULT NULL,
  `created_at`       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 订单明细表
CREATE TABLE IF NOT EXISTS `order_items` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `order_id`     INT           NOT NULL,
  `product_id`   INT           NOT NULL,
  `product_name` VARCHAR(200)  NOT NULL,
  `quantity`     INT           NOT NULL,
  `price`        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 购物车表
CREATE TABLE IF NOT EXISTS `cart` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity`   INT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. 产品评价表
CREATE TABLE IF NOT EXISTS `reviews` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT  NOT NULL,
  `user_id`    INT  DEFAULT NULL,
  `user_name`  VARCHAR(100) NOT NULL,
  `rating`     INT NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
  `comment`    TEXT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 愿望清单表
CREATE TABLE IF NOT EXISTS `wishlist` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `product_id` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 插入示例产品数据（8个产品）
-- ============================================================
INSERT INTO `products`
  (`name`, `price`, `original_price`, `image`, `category`, `rating`, `reviews`, `stock`, `description`, `specs`)
VALUES
(
  'iPhone 15 Pro Max 256GB', 9999.00, 10999.00,
  'https://cdn.dummyjson.com/products/images/smartphones/iPhone%2013%20Pro/1.png',
  'electronics', 4.8, 12580, 50,
  'A17 Pro chip, titanium design, 5x optical zoom',
  '["6.7-inch display","256GB storage","5G network","Titanium frame"]'
),
(
  'MacBook Pro 14-inch M3 Chip', 14999.00, 16999.00,
  'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400',
  'electronics', 4.9, 8920, 30,
  'M3 chip, 16GB RAM, 512GB SSD',
  '["14-inch Liquid Retina XDR","M3 chip","16GB unified memory","512GB SSD"]'
),
(
  'Sony WH-1000XM5 Headphones', 2499.00, 2899.00,
  'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400',
  'audio', 4.7, 5640, 100,
  'Industry-leading noise cancellation, 30-hour battery',
  '["Active noise cancellation","30-hour battery","Touch controls","Multi-point"]'
),
(
  'Nike Air Max 270 Shoes', 899.00, 1099.00,
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
  'fashion', 4.6, 3250, 200,
  'Breathable mesh design, Max Air cushioning',
  '["Breathable mesh","Max Air","Rubber outsole","Multiple colors"]'
),
(
  'Canon EOS R6 Mark II Camera', 15999.00, 17999.00,
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400',
  'electronics', 4.9, 1820, 15,
  '24.2MP full-frame, 40fps continuous shooting',
  '["24.2MP sensor","Full-frame CMOS","40fps burst","8K video"]'
),
(
  'Dyson V15 Detect Vacuum', 4999.00, 5499.00,
  'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400',
  'home', 4.8, 4560, 80,
  'Laser dust detection, 60-minute runtime',
  '["Laser detection","60-min runtime","5-stage filter","Smart sensors"]'
),
(
  'Samsung Galaxy S24 Ultra', 8999.00, 9999.00,
  'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400',
  'electronics', 4.7, 9340, 60,
  'Snapdragon 8 Gen 3, 200MP camera, S Pen',
  '["6.8-inch AMOLED","512GB storage","200MP camera","S Pen included"]'
),
(
  'Sony PlayStation 5', 3999.00, 4499.00,
  'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=400',
  'electronics', 4.9, 15620, 25,
  'Ultra-high speed SSD, ray tracing, 4K gaming',
  '["825GB SSD","Ray tracing","4K 120Hz","DualSense controller"]'
);

-- ============================================================
-- 插入每个产品的示例评价
-- ============================================================
INSERT INTO `reviews` (`product_id`, `user_name`, `rating`, `comment`, `created_at`) VALUES
(1, 'James T.',  5, 'Best iPhone I have ever owned. The camera is incredible!', '2026-01-20'),
(1, 'Lisa M.',   5, 'Titanium frame feels premium. Battery life is amazing.',   '2026-01-15'),
(1, 'Kevin R.',  4, 'Great phone overall. A little pricey but worth it.',        '2026-01-10'),
(2, 'Sarah L.',  5, 'M3 chip is blazing fast. Perfect for video editing.',       '2026-01-18'),
(2, 'David K.',  5, 'Best laptop I have ever used. Display is stunning.',        '2026-01-12'),
(2, 'Anna W.',   4, 'Excellent build quality. The keyboard is a joy to type on.','2025-12-30'),
(3, 'Mike S.',   5, 'Noise cancellation is out of this world. Worth every cent.','2026-01-22'),
(3, 'Emily C.',  4, 'Very comfortable for long sessions. Great sound quality.',  '2026-01-08'),
(3, 'Tom B.',    5, 'Best headphones I have ever bought. Highly recommend!',     '2025-12-25'),
(4, 'Chris P.',  4, 'Super comfortable for everyday wear. Runs a bit large.',    '2026-01-19'),
(4, 'Rachel N.', 5, 'Love the cushioning! Great for running and casual wear.',   '2026-01-05'),
(4, 'Jake H.',   4, 'Stylish and comfortable. Good value for the price.',        '2025-12-28'),
(5, 'Peter G.',  5, 'Image quality is absolutely breathtaking. A pro camera.',  '2026-01-16'),
(5, 'Sophia L.', 5, 'The autofocus is incredibly fast. Perfect for wildlife.',  '2026-01-03'),
(5, 'Mark D.',   4, 'Great camera. Battery could be better but very capable.',  '2025-12-20'),
(6, 'Helen F.',  5, 'Picks up dust I never knew existed. Super powerful.',       '2026-01-21'),
(6, 'Brian T.',  4, 'Very effective vacuum. A bit heavy but does the job well.', '2026-01-09'),
(6, 'Carol M.',  5, 'The laser detection feature is genius. Love this product.','2025-12-31'),
(7, 'Alex J.',   5, 'S Pen is so useful. Camera is absolutely incredible.',     '2026-01-23'),
(7, 'Mia C.',    4, 'Great flagship phone. Display is gorgeous and bright.',     '2026-01-11'),
(7, 'Ryan K.',   5, 'Best Android phone available. No complaints at all!',       '2026-01-02'),
(8, 'Nathan S.', 5, '4K gaming is unreal. Load times are almost zero now!',     '2026-01-24'),
(8, 'Olivia T.', 5, 'The DualSense controller is next level. Haptics are amazing.','2026-01-14'),
(8, 'Liam W.',   4, 'Great console. Wish there were more exclusive titles.',     '2025-12-29');

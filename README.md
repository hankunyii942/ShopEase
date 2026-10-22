# ShopEase - E-Commerce Platform

A full-stack web-based e-commerce platform built as my Final Year Project at Universiti Kebangsaan Malaysia (UKM).

## Tech Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** PHP
- **Database:** MySQL

## Features
- User registration & login (Session-based authentication)
- Product listing, search & filtering
- Shopping cart with real-time price calculation
- Order management & tracking
- Wishlist (database-synced)
- Admin dashboard
- Streamlined one-page checkout
- Multiple payment methods (Alipay, WeChat Pay, Apple Pay)

## Bug Fixes
- Fixed order ID type mismatch (String vs Integer) causing strict equality failure
- Fixed missing admin role field in users table causing permission validation failure
- Migrated wishlist from localStorage to database for multi-device sync
接口自动化测试代码见：https://github.com/hankunyii942/shopease-api-autotest

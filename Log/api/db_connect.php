<?php
// api/db_connect.php
// 数据库连接配置 — 所有 API 文件都引用这个


define('DB_HOST', 'localhost');   // 主机，XAMPP 默认是 localhost
define('DB_USER', 'root');        // phpMyAdmin 默认用户名是 root
define('DB_PASS', '');            // XAMPP 默认密码是空的
define('DB_NAME', 'shopease_db'); // 你在 phpMyAdmin 创建的数据库名

function getDB() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

    // 检查连接是否成功
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database connection failed: ' . $conn->connect_error
        ]);
        exit;
    }

    // 设置字符编码，支持中文和特殊字符
    $conn->set_charset('utf8mb4');
    return $conn;
}
?>

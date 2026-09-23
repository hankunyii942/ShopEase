<?php
// api/products.php
// GET  ?action=list                      — product list
// GET  ?action=single&id=N               — one product
// GET  ?action=reviews&product_id=N      — product reviews
// POST ?action=add_review                — submit review
// POST ?action=create                    — admin create product
// POST ?action=update                    — admin update product
// POST ?action=delete                    — admin delete product

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once 'db_connect.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$action = ($method === 'GET') ? ($_GET['action'] ?? 'list') : ($_GET['action'] ?? '');

// helper: cast a DB row to proper types
function castProduct($row) {
    $row['id']             = (int)   $row['id'];
    $row['price']          = (float) $row['price'];
    $row['original_price'] = (float) $row['original_price'];
    $row['rating']         = (float) $row['rating'];
    $row['reviews']        = (int)   $row['reviews'];
    $row['stock']          = (int)   $row['stock'];
    $row['specs']          = json_decode($row['specs'] ?? '[]', true);
    return $row;
}

// ══════════════════════════════════════════
// GET list
// ══════════════════════════════════════════
if ($method === 'GET' && $action === 'list') {
    $category = $_GET['category'] ?? '';
    $search   = $_GET['search']   ?? '';

    $sql    = "SELECT * FROM products WHERE 1=1";
    $params = [];
    $types  = '';

    if ($category && $category !== 'all') {
        $sql     .= " AND category = ?";
        $params[] = $category;
        $types   .= 's';
    }
    if ($search) {
        $like     = '%' . $search . '%';
        $sql     .= " AND (name LIKE ? OR description LIKE ?)";
        $params[] = $like;
        $params[] = $like;
        $types   .= 'ss';
    }
    $sql .= " ORDER BY id ASC";

    $stmt = $db->prepare($sql);
    if ($types) { $stmt->bind_param($types, ...$params); }
    $stmt->execute();
    $result   = $stmt->get_result();
    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = castProduct($row);
    }
    $stmt->close();
    echo json_encode(['success' => true, 'products' => $products]);

// ══════════════════════════════════════════
// GET single
// ══════════════════════════════════════════
} elseif ($method === 'GET' && $action === 'single') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { echo json_encode(['success' => false, 'message' => 'Missing id']); exit; }

    $stmt = $db->prepare("SELECT * FROM products WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) { echo json_encode(['success' => false, 'message' => 'Product not found']); exit; }
    echo json_encode(['success' => true, 'product' => castProduct($row)]);

// ══════════════════════════════════════════
// GET reviews
// ══════════════════════════════════════════

} elseif ($method === 'GET' && $action === 'reviews') {
    $pid = (int)($_GET['product_id'] ?? 0);
    if (!$pid) { echo json_encode(['success' => false, 'message' => 'Missing product_id']); exit; }

    $stmt = $db->prepare(
        "SELECT user_name, rating, comment, created_at
         FROM reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 20"
    );
    $stmt->bind_param("i", $pid);
    $stmt->execute();
    $result  = $stmt->get_result();
    $reviews = [];
    while ($r = $result->fetch_assoc()) { $reviews[] = $r; }
    $stmt->close();
    echo json_encode(['success' => true, 'reviews' => $reviews]);

// ══════════════════════════════════════════
// POST add_review
// ══════════════════════════════════════════
// 功能：提交评论 校验必填字段和评分范围(1-5)后插入reviews表
} elseif ($method === 'POST' && $action === 'add_review') {
    $data      = json_decode(file_get_contents('php://input'), true);
    $productId = (int)($data['product_id'] ?? 0);
    $userName  = trim($data['user_name']   ?? '');
    $rating    = (int)($data['rating']     ?? 5);
    $comment   = trim($data['comment']     ?? '');
    $userId    = isset($data['user_id']) && $data['user_id'] ? (int)$data['user_id'] : null;

    if (!$productId || !$userName || !$comment) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']); exit;
    }
    if ($rating < 1 || $rating > 5) {
        echo json_encode(['success' => false, 'message' => 'Rating must be 1–5']); exit;
    }

    $stmt = $db->prepare(
        "INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("iiiss", $productId, $userId, $userName, $rating, $comment);
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Review submitted successfully!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to submit review']);
    }
    $stmt->close();

// ══════════════════════════════════════════
// POST create (admin)
// ══════════════════════════════════════════
} elseif ($method === 'POST' && $action === 'create') {
    $data          = json_decode(file_get_contents('php://input'), true);
    $name          = trim($data['name']           ?? '');
    $price         = (float)($data['price']        ?? 0);
    $origPrice     = (float)($data['original_price'] ?? $price);
    $image         = trim($data['image']          ?? '');
    $category      = trim($data['category']       ?? '');
    $rating        = (float)($data['rating']       ?? 5.0);
    $reviewsCnt    = (int)($data['reviews']        ?? 0);
    $stock         = (int)($data['stock']          ?? 0);
    $description   = trim($data['description']    ?? '');
    $specsRaw      = $data['specs']               ?? [];

    if (!$name || $price <= 0 || !$category || !$description) {
        echo json_encode(['success' => false, 'message' => 'Name, price, category and description are required']);
        exit;
    }

    // specs: accept comma-separated string or array
    if (is_string($specsRaw)) {
        $specsArr = array_values(array_filter(array_map('trim', explode(',', $specsRaw))));
    } else {
        $specsArr = array_values(array_filter(array_map('trim', (array)$specsRaw)));
    }
    $specsJson = json_encode($specsArr);

    $stmt = $db->prepare(
        "INSERT INTO products (name, price, original_price, image, category, rating, reviews, stock, description, specs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("sddsssdiss", $name, $price, $origPrice, $image, $category, $rating, $reviewsCnt, $stock, $description, $specsJson);

    if ($stmt->execute()) {
        $newId = $db->insert_id;
        echo json_encode(['success' => true, 'message' => 'Product created!', 'id' => $newId]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Create failed: ' . $stmt->error]);
    }
    $stmt->close();

// ══════════════════════════════════════════
// POST update (admin)
// ══════════════════════════════════════════
} elseif ($method === 'POST' && $action === 'update') {
    $data        = json_decode(file_get_contents('php://input'), true);
    $id          = (int)($data['id']             ?? 0);
    $name        = trim($data['name']            ?? '');
    $price       = (float)($data['price']         ?? 0);
    $origPrice   = (float)($data['original_price'] ?? $price);
    $image       = trim($data['image']           ?? '');
    $category    = trim($data['category']        ?? '');
    $rating      = (float)($data['rating']        ?? 5.0);
    $stock       = (int)($data['stock']           ?? 0);
    $description = trim($data['description']     ?? '');
    $specsRaw    = $data['specs']                ?? [];

    if (!$id || !$name || $price <= 0 || !$category || !$description) {
        echo json_encode(['success' => false, 'message' => 'All fields are required']);
        exit;
    }

    if (is_string($specsRaw)) {
        $specsArr = array_values(array_filter(array_map('trim', explode(',', $specsRaw))));
    } else {
        $specsArr = array_values(array_filter(array_map('trim', (array)$specsRaw)));
    }
    $specsJson = json_encode($specsArr);

    $stmt = $db->prepare(
        "UPDATE products
         SET name=?, price=?, original_price=?, image=?, category=?, rating=?, stock=?, description=?, specs=?
         WHERE id=?"
    );
    $stmt->bind_param("sddssdissi", $name, $price, $origPrice, $image, $category, $rating, $stock, $description, $specsJson, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Product updated!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Update failed: ' . $stmt->error]);
    }
    $stmt->close();

// ══════════════════════════════════════════
// POST delete (admin)
// ══════════════════════════════════════════
} elseif ($method === 'POST' && $action === 'delete') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = (int)($data['id'] ?? 0);

    if (!$id) { echo json_encode(['success' => false, 'message' => 'Missing id']); exit; }

    $stmt = $db->prepare("DELETE FROM products WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Product deleted!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Delete failed: ' . $stmt->error]);
    }
    $stmt->close();

} else {
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
}

$db->close();
?>

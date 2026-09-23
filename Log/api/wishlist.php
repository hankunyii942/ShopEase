<?php
// api/wishlist.php
// GET  ?user_id=N          — get wishlist for user
// POST ?action=add         — add product to wishlist
// POST ?action=remove      — remove product from wishlist

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once 'db_connect.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET') {
    $userId = (int)($_GET['user_id'] ?? 0);
    if (!$userId) { echo json_encode(['success' => false, 'message' => 'Missing user_id']); exit; }

    $stmt = $db->prepare("SELECT product_id FROM wishlist WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $ids    = [];
    while ($row = $result->fetch_assoc()) { $ids[] = (int)$row['product_id']; }
    $stmt->close();
    echo json_encode(['success' => true, 'product_ids' => $ids]);

} elseif ($method === 'POST' && $action === 'add') {
    $data      = json_decode(file_get_contents('php://input'), true);
    $userId    = (int)($data['user_id']    ?? 0);
    $productId = (int)($data['product_id'] ?? 0);

    if (!$userId || !$productId) { echo json_encode(['success' => false, 'message' => 'Missing fields']); exit; }

    // ignore duplicate
    $stmt = $db->prepare("INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $userId, $productId);
    $stmt->execute();
    $stmt->close();
    echo json_encode(['success' => true, 'message' => 'Added to wishlist']);

} elseif ($method === 'POST' && $action === 'remove') {
    $data      = json_decode(file_get_contents('php://input'), true);
    $userId    = (int)($data['user_id']    ?? 0);
    $productId = (int)($data['product_id'] ?? 0);

    if (!$userId || !$productId) { echo json_encode(['success' => false, 'message' => 'Missing fields']); exit; }

    $stmt = $db->prepare("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?");
    $stmt->bind_param("ii", $userId, $productId);
    $stmt->execute();
    $stmt->close();
    echo json_encode(['success' => true, 'message' => 'Removed from wishlist']);

} else {
    echo json_encode(['success' => false, 'message' => 'Unknown request']);
}

$db->close();
?>

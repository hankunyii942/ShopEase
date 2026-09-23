<?php
// api/orders.php
// POST (no action)              — create order
// GET                           — list all orders
// POST ?action=update_status    — admin update order status

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once 'db_connect.php';
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ══════════════════════════════════════════
// POST — create order
// ══════════════════════════════════════════
if ($method === 'POST' && $action === '') {
    $data     = json_decode(file_get_contents('php://input'), true);
    $items    = $data['items']            ?? [];
    $total    = (float)($data['total_price']     ?? 0);
    $payment  = $data['payment_method']   ?? 'card';
    $shipName = $data['shipping_name']    ?? '';
    $shipPhone= $data['shipping_phone']   ?? '';
    $shipAddr = $data['shipping_address'] ?? '';
    $userId   = isset($data['user_id']) && $data['user_id'] ? (int)$data['user_id'] : null;

    if (!$shipName || !$shipPhone || !$shipAddr || empty($items) || $total <= 0) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    $tracking = 'TRK' . strtoupper(substr(str_shuffle('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), 0, 9));

    $stmt = $db->prepare(
        "INSERT INTO orders (user_id, total_price, payment_method, shipping_name, shipping_phone, shipping_address, tracking_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("idsssss", $userId, $total, $payment, $shipName, $shipPhone, $shipAddr, $tracking);

    if (!$stmt->execute()) {
        echo json_encode(['success' => false, 'message' => 'Failed to create order: ' . $stmt->error]);
        $stmt->close();
        exit;
    }
    $orderId = $db->insert_id;
    $stmt->close();

    $itemStmt = $db->prepare(
        "INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)"
    );
    foreach ($items as $item) {
        $pid   = (int)($item['id']       ?? 0);
        $pname = $item['name']           ?? 'Unknown';
        $qty   = (int)($item['quantity'] ?? 1);
        $price = (float)($item['price']  ?? 0);
        $itemStmt->bind_param("iisid", $orderId, $pid, $pname, $qty, $price);
        $itemStmt->execute();
    }
    $itemStmt->close();

    // reduce stock for each item
    foreach ($items as $item) {
        $pid = (int)($item['id']       ?? 0);
        $qty = (int)($item['quantity'] ?? 1);
        if ($pid > 0) {
            $sStmt = $db->prepare("UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?");
            $sStmt->bind_param("ii", $qty, $pid);
            $sStmt->execute();
            $sStmt->close();
        }
    }

    echo json_encode([
        'success'  => true,
        'order_id' => $orderId,
        'tracking' => $tracking,
        'message'  => 'Order created successfully!'
    ]);

// ══════════════════════════════════════════
// POST ?action=update_status — admin
// ══════════════════════════════════════════
// 功能：更新订单状态
} elseif ($method === 'POST' && $action === 'update_status') {
    $data     = json_decode(file_get_contents('php://input'), true);
    $orderId  = (int)($data['order_id'] ?? 0);
    $status   = trim($data['status']   ?? '');
    $allowed  = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

    if (!$orderId || !$status) {
        echo json_encode(['success' => false, 'message' => 'Missing order_id or status']); exit;
    }
    if (!in_array($status, $allowed)) {
        echo json_encode(['success' => false, 'message' => 'Invalid status value']); exit;
    }

    $stmt = $db->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->bind_param("si", $status, $orderId);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Order status updated!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Update failed: ' . $stmt->error]);
    }
    $stmt->close();

// ══════════════════════════════════════════
// GET — list all orders with items
// ══════════════════════════════════════════
} elseif ($method === 'GET') {
    $result = $db->query("SELECT * FROM orders ORDER BY id DESC");
    $orders = [];
    while ($row = $result->fetch_assoc()) { $orders[] = $row; }

    foreach ($orders as &$order) {
        $oid  = (int)$order['id'];
        $stmt = $db->prepare(
            "SELECT oi.product_id, oi.product_name AS name, oi.quantity, oi.price, p.image
             FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?"
        );
        $stmt->bind_param("i", $oid);
        $stmt->execute();
        $res   = $stmt->get_result();
        $items = [];
        while ($item = $res->fetch_assoc()) {
            $items[] = [
                'id'       => (int)$item['product_id'],
                'name'     => $item['name'],
                'quantity' => (int)$item['quantity'],
                'price'    => (float)$item['price'],
                'image'    => $item['image'] ?? ''
            ];
        }
        $stmt->close();
        $order['items'] = $items;
    }
    unset($order);

    echo json_encode(['success' => true, 'orders' => $orders]);

} else {
    echo json_encode(['success' => false, 'message' => 'Unknown request']);
}

$db->close();
?>

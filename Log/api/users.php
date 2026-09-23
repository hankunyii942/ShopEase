<?php
// api/users.php
// Actions: register | login | forgot_step1 | forgot_step2

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

require_once 'db_connect.php';
$db = getDB();

$data   = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

// ══════════════════════════════════════════
// REGISTER
// ══════════════════════════════════════════
if ($action === 'register') {
    $name       = trim($data['name']              ?? '');
    $email      = trim($data['email']             ?? '');
    $password   =      $data['password']          ?? '';
    $phone      = trim($data['phone']             ?? '');
    $security_q = trim($data['security_question'] ?? '');
    $security_a = trim($data['security_answer']   ?? '');

    if (!$name || !$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Please fill in all required fields']);
        exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email format']);
        exit;
    }
    if (strlen($password) < 6) {
        echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
        exit;
    }
    if (!$security_q || !$security_a) {
        echo json_encode(['success' => false, 'message' => 'Please set a security question and answer']);
        exit;
    }

    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'This email is already registered. Please login instead.']);
        $stmt->close();
        exit;
    }
    $stmt->close();

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
    $hashedAnswer   = password_hash(strtolower($security_a), PASSWORD_BCRYPT);
    // First registered user becomes admin
    $countResult = $db->query("SELECT COUNT(*) AS cnt FROM users");
    $countRow    = $countResult->fetch_assoc();
    $role        = ($countRow['cnt'] == 0) ? 'admin' : 'customer';

    $stmt = $db->prepare(
        "INSERT INTO users (name, email, password, phone, security_question, security_answer, role)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("sssssss", $name, $email, $hashedPassword, $phone, $security_q, $hashedAnswer, $role);

    if ($stmt->execute()) {
        $newId = $db->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'Account created successfully! Welcome to ShopEase.',
            'user'    => ['id' => $newId, 'name' => $name, 'email' => $email, 'role' => $role]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
    }
    $stmt->close();

// ══════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════
} elseif ($action === 'login') {
    $email    = trim($data['email']    ?? '');
    $password =      $data['password'] ?? '';

    if (!$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Please enter your email and password']);
        exit;
    }

    $stmt = $db->prepare("SELECT id, name, email, password, role FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user   = $result->fetch_assoc();
    $stmt->close();

    if (!$user || !password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Incorrect email or password. Please try again.']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Login successful! Welcome back, ' . $user['name'] . '.',
        'user'    => [
            'id'    => $user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'] ?? 'customer'
        ]
    ]);

// ══════════════════════════════════════════
// FORGOT PASSWORD STEP 1
// ══════════════════════════════════════════
} elseif ($action === 'forgot_step1') {
    $email = trim($data['email'] ?? '');

    if (!$email) {
        echo json_encode(['success' => false, 'message' => 'Please enter your email address']);
        exit;
    }

    $stmt = $db->prepare("SELECT id, security_question FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user   = $result->fetch_assoc();
    $stmt->close();

    if (!$user || !$user['security_question']) {
        echo json_encode(['success' => false, 'message' => 'Email not found or no security question set']);
        exit;
    }

    echo json_encode([
        'success'           => true,
        'security_question' => $user['security_question']
    ]);

// ══════════════════════════════════════════
// FORGOT PASSWORD STEP 2
// ══════════════════════════════════════════
} elseif ($action === 'forgot_step2') {
    $email       = trim($data['email']           ?? '');
    $answer      = trim($data['security_answer'] ?? '');
    $newPassword =      $data['new_password']    ?? '';

    if (!$email || !$answer || !$newPassword) {
        echo json_encode(['success' => false, 'message' => 'All fields are required']);
        exit;
    }
    if (strlen($newPassword) < 6) {
        echo json_encode(['success' => false, 'message' => 'New password must be at least 6 characters']);
        exit;
    }

    $stmt = $db->prepare("SELECT id, security_answer FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user   = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        echo json_encode(['success' => false, 'message' => 'Email not found']);
        exit;
    }

    if (!password_verify(strtolower($answer), $user['security_answer'])) {
        echo json_encode(['success' => false, 'message' => 'Security answer is incorrect']);
        exit;
    }

    $newHashed = password_hash($newPassword, PASSWORD_BCRYPT);
    $stmt = $db->prepare("UPDATE users SET password = ? WHERE email = ?");
    $stmt->bind_param("ss", $newHashed, $email);
    $stmt->execute();
    $stmt->close();

    echo json_encode(['success' => true, 'message' => 'Password reset successfully! You can now login.']);

} else {
    echo json_encode(['success' => false, 'message' => 'Unknown action: ' . $action]);
}

$db->close();
?>

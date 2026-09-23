// ===== CATEGORIES (static - no DB needed) =====
const CATEGORIES = [
  { id: 'all', name: 'All Products', icon: '📦' },
  { id: 'electronics', name: 'Electronics', icon: '💻' },
  { id: 'fashion', name: 'Fashion', icon: '👕' },
  { id: 'home', name: 'Home & Living', icon: '🏠' },
  { id: 'audio', name: 'Audio', icon: '🎧' }
];

// ===== STATE =====
const _savedUser = sessionStorage.getItem('shopease_user');

let state = {
  page: 'home',
  products: [],       // loaded from DB
  cart: [],
  wishlist: [],       // product IDs, synced to DB when logged in
  orders: [],
  user: _savedUser ? JSON.parse(_savedUser) : null,
  selectedProduct: null,
  selectedOrder: null,
  searchQuery: '',
  category: 'all',
  sortBy: 'featured',
  priceMax: 20000,
  isCheckout: false,
  authMode: 'login',
  paymentMethod: 'alipay',
  reviewRating: 0,
  forgotEmail: '',
  productsLoaded: false
};

// ===== HELPERS =====
function $(id) { return document.getElementById(id); }
// 功能：折扣计算
function getDiscount(p) {
  if (!p.original_price || p.original_price <= p.price) return 0;
  return Math.round((1 - p.price / p.original_price) * 100);
}
// 功能：购物车总价
function getTotalItems() { return state.cart.reduce((s, i) => s + i.quantity, 0); }
function getTotalPrice() { return state.cart.reduce((s, i) => s + i.price * i.quantity, 0); }
function isAdmin() { return state.user && state.user.role === 'admin'; }

function getFilteredProducts() {
  return state.products.filter(p => {
    const q = state.searchQuery.toLowerCase();
    const matchText = p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchCat = state.category === 'all' || p.category === state.category;
    const matchPrice = p.price <= state.priceMax;
    return matchText && matchCat && matchPrice;
  }).sort((a, b) => {
    if (state.sortBy === 'price-low') return a.price - b.price;
    if (state.sortBy === 'price-high') return b.price - a.price;
    if (state.sortBy === 'rating') return b.rating - a.rating;
    if (state.sortBy === 'popular') return b.reviews - a.reviews;
    return 0;
  });
}

// ===== LOAD PRODUCTS FROM DB =====
function loadProducts(callback) {
  fetch('api/products.php?action=list')
    .then(r => r.json())
    .then(data => {
      if (data.success && Array.isArray(data.products)) {
        state.products = data.products;
      }
      state.productsLoaded = true;
      if (callback) callback();
    })
    .catch(() => {
      state.productsLoaded = true;
      if (callback) callback();
    });
}

// ===== NAVIGATION =====
function goTo(page) {
  state.page = page;
  state.isCheckout = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
}

function toggleSidebar() {
  const s = $('sidebar');
  if (s) s.classList.toggle('open');
}
// 功能：加入购物车
// ===== CART =====
function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  // 功能：超出库存提示
  const existing = state.cart.find(i => i.id === productId);
  if (existing) {
    if (existing.quantity >= product.stock) { showToast('Maximum stock reached!'); return; }
    state.cart = state.cart.map(i => i.id === productId ? { ...i, quantity: i.quantity + 1 } : i);
  } else {
    state.cart.push({ ...product, quantity: 1 });
  }
  updateCartBadge();
  showToast('Added to cart! 🛒');
}
// 功能：改数量
function updateQty(productId, change) {
  state.cart = state.cart.map(i => {
    if (i.id === productId) {
      const q = i.quantity + change;
      return q > 0 ? { ...i, quantity: q } : null;
    }
    return i;
  }).filter(Boolean);
  renderCart();
  updateCartBadge();
}
// 功能：删购物车商品
function removeFromCart(productId) {
  state.cart = state.cart.filter(i => i.id !== productId);
  renderCart();
  updateCartBadge();
}

function updateCartBadge() {
  const badge = $('cart-badge');
  const total = getTotalItems();
  if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'flex' : 'none'; }
}

// ===== WISHLIST =====
function loadWishlistFromDB() {
  if (!state.user) return;
  fetch('api/wishlist.php?user_id=' + state.user.id)
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        state.wishlist = data.product_ids || [];
        updateWishBadge();
        // re-render current page to update heart icons
        if (state.page === 'wishlist') renderWishlistPage();
      }
    })
    .catch(() => { });
}

function toggleWishlist(productId) {
  const inWish = state.wishlist.includes(productId);
  if (inWish) {
    state.wishlist = state.wishlist.filter(id => id !== productId);
    if (state.user) {
      fetch('api/wishlist.php?action=remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: state.user.id, product_id: productId })
      }).catch(() => { });
    }
  } else {
    state.wishlist.push(productId);
    if (state.user) {
      fetch('api/wishlist.php?action=add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: state.user.id, product_id: productId })
      }).catch(() => { });
    }
  }
  updateWishBadge();
}

function updateWishBadge() {
  const badge = $('wish-badge');
  const total = state.wishlist.length;
  if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'flex' : 'none'; }
}

// ===== TOAST =====
function showToast(msg) {
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ===== AUTH =====
function openAuthModal(mode) {
  state.authMode = mode || 'login';
  showAuthSection();
  $('modal-auth').classList.add('open');
  renderAuthModal();
}

function closeAuthModal() {
  $('modal-auth').classList.remove('open');
  ['auth-email', 'auth-password', 'auth-name', 'auth-phone', 'auth-security-a',
    'forgot-email', 'forgot-answer', 'forgot-new-pw'].forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });
  const sq = $('auth-security-q');
  if (sq) sq.value = '';
  hideError('auth-error');
  hideError('forgot-error1');
  hideError('forgot-error2');
  showForgotStep(1);
  state.forgotEmail = '';
}

function showAuthSection() {
  $('auth-section').style.display = 'block';
  $('forgot-section').style.display = 'none';
  $('auth-title').textContent = state.authMode === 'login' ? 'Login' : 'Create Account';
}

function switchAuthMode() {
  state.authMode = state.authMode === 'login' ? 'register' : 'login';
  hideError('auth-error');
  renderAuthModal();
}

function renderAuthModal() {
  const isLogin = state.authMode === 'login';
  $('auth-title').textContent = isLogin ? 'Login' : 'Create Account';
  $('auth-register-fields').style.display = isLogin ? 'none' : 'block';
  $('auth-submit-btn').textContent = isLogin ? 'Login' : 'Create Account';
  $('auth-switch-btn').textContent = isLogin
    ? "Don't have an account? Register"
    : 'Already have an account? Login';
  const fw = $('forgot-link-wrap');
  if (fw) fw.style.display = isLogin ? 'block' : 'none';
}

function showError(elId, msg) {
  const el = $(elId);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideError(elId) {
  const el = $(elId);
  if (el) el.style.display = 'none';
}
// 登录注册核心函数
// 功能：登录/注册二合一根据 state.authMode 判断当前是"登录"还是"注册"模式，
// 用同一个表单、同一个提交按钮，只是校验规则和请求体不同
function handleAuth(e) {
  e.preventDefault();
  hideError('auth-error');

  const email = $('auth-email').value.trim();
  const pwd = $('auth-password').value;
  const name = $('auth-name') ? $('auth-name').value.trim() : '';
  const phone = $('auth-phone') ? $('auth-phone').value.trim() : '';
  const secQ = $('auth-security-q') ? $('auth-security-q').value : '';
  const secA = $('auth-security-a') ? $('auth-security-a').value.trim() : '';

  if (!email || !pwd) { showError('auth-error', 'Please fill in email and password'); return; }
  if (state.authMode === 'register' && !name) { showError('auth-error', 'Please enter your name'); return; }
  if (pwd.length < 6) { showError('auth-error', 'Password must be at least 6 characters'); return; }
  if (state.authMode === 'register' && !secQ) { showError('auth-error', 'Please select a security question'); return; }
  if (state.authMode === 'register' && !secA) { showError('auth-error', 'Please enter your security answer'); return; }

  const btn = $('auth-submit-btn');
  const orig = btn.textContent;
  btn.textContent = 'Please wait...';
  btn.disabled = true;

  const payload = state.authMode === 'login'
    ? { action: 'login', email, password: pwd }
    : {
      action: 'register', name, email, password: pwd, phone,
      security_question: secQ, security_answer: secA
    };

  fetch('api/users.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(data => {
      btn.textContent = orig;
      btn.disabled = false;
      if (data.success) {
        state.user = data.user;
        sessionStorage.setItem('shopease_user', JSON.stringify(data.user));
        closeAuthModal();
        renderHeader();
        loadWishlistFromDB();
        showToast(state.authMode === 'login'
          ? 'Welcome back, ' + data.user.name + '! 👋'
          : 'Account created! Welcome, ' + data.user.name + '! 🎉');
      } else {
        showError('auth-error', data.message || 'Operation failed. Please try again.');
      }
    })
    .catch(() => {
      btn.textContent = orig;
      btn.disabled = false;
      // fallback mode (no XAMPP)
      const fbUser = {
        id: Date.now(),
        email: email,
        name: name || email.split('@')[0],
        role: 'customer'
      };
      state.user = fbUser;
      sessionStorage.setItem('shopease_user', JSON.stringify(fbUser));
      closeAuthModal();
      renderHeader();
      showToast(state.authMode === 'login' ? 'Welcome back! 👋' : 'Account created! 🎉');
    });
}
// 【功能：退出登录】清空
function logout() {
  state.user = null;
  state.wishlist = [];
  sessionStorage.removeItem('shopease_user');
  state.page = 'home';
  renderHeader();
  render();
  showToast('You have been logged out.');
}

// ===== FORGOT PASSWORD =====
function switchToForgot() {
  $('auth-section').style.display = 'none';
  $('forgot-section').style.display = 'block';
  $('auth-title').textContent = 'Reset Password';
  showForgotStep(1);
  hideError('forgot-error1');
  hideError('forgot-error2');
  const fe = $('forgot-email');
  if (fe) fe.value = '';
}
// 功能：找回密码-第1步验证邮箱→返回密保问题
function showForgotStep(step) {
  $('forgot-step1').style.display = step === 1 ? 'block' : 'none';
  $('forgot-step2').style.display = step === 2 ? 'block' : 'none';
}

function forgotStep1() {
  hideError('forgot-error1');
  const email = $('forgot-email').value.trim();
  if (!email) { showError('forgot-error1', 'Please enter your email address'); return; }

  const btn = $('btn-forgot-next');
  btn.textContent = 'Checking...';
  btn.disabled = true;

  fetch('api/users.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'forgot_step1', email })
  })
    .then(r => r.json())
    .then(data => {
      btn.textContent = 'Next →';
      btn.disabled = false;
      if (data.success) {
        state.forgotEmail = email;
        $('forgot-question-display').textContent = '🔒 ' + data.security_question;
        $('forgot-answer').value = '';
        $('forgot-new-pw').value = '';
        hideError('forgot-error2');
        showForgotStep(2);
      } else {
        showError('forgot-error1', data.message || 'Email not found.');
      }
    })
    .catch(() => {
      btn.textContent = 'Next →';
      btn.disabled = false;
      showError('forgot-error1', 'Cannot connect to server. Make sure XAMPP is running.');
    });
}
// 功能：找回密码-第2步验证密保答案→允许改新密码
function forgotStep2() {
  hideError('forgot-error2');
  const answer = $('forgot-answer').value.trim();
  const newPw = $('forgot-new-pw').value;

  if (!answer) { showError('forgot-error2', 'Please enter your security answer'); return; }
  if (newPw.length < 6) { showError('forgot-error2', 'New password must be at least 6 characters'); return; }

  const btn = $('btn-forgot-reset');
  btn.textContent = 'Resetting...';
  btn.disabled = true;

  fetch('api/users.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'forgot_step2',
      email: state.forgotEmail,
      security_answer: answer,
      new_password: newPw
    })
  })
    .then(r => r.json())
    .then(data => {
      btn.textContent = 'Reset Password';
      btn.disabled = false;
      if (data.success) {
        showToast('Password reset! Please login with your new password. 🎉');
        backToLogin();
      } else {
        showError('forgot-error2', data.message || 'Reset failed. Please try again.');
      }
    })
    .catch(() => {
      btn.textContent = 'Reset Password';
      btn.disabled = false;
      showError('forgot-error2', 'Cannot connect to server. Make sure XAMPP is running.');
    });
}

function toggleForgotPw() {
  const inp = $('forgot-new-pw');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function backToLogin() {
  state.authMode = 'login';
  showForgotStep(1);
  showAuthSection();
  renderAuthModal();
  state.forgotEmail = '';
}

// ===== ORDER =====
function placeOrder(e) {
  e.preventDefault();
  const name = $('ship-name').value.trim();
  const phone = $('ship-phone').value.trim();
  const address = $('ship-address').value.trim();

  if (!name || !phone || !address) { showToast('Please fill in all shipping information'); return; }

  const cartSnapshot = [...state.cart];
  const totalSnapshot = getTotalPrice();

  const btn = document.querySelector('.btn-place-order');
  if (btn) { btn.textContent = 'Processing...'; btn.disabled = true; }

  fetch('api/orders.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: cartSnapshot,
      total_price: totalSnapshot,
      payment_method: state.paymentMethod,
      shipping_name: name,
      shipping_phone: phone,
      shipping_address: address,
      user_id: state.user ? state.user.id : null
    })
  })
    .then(r => r.json())
    .then(data => {
      if (btn) { btn.textContent = 'Place Order'; btn.disabled = false; }
      if (data.success) {
        _finishOrder(data.order_id, data.tracking, name, phone, address, cartSnapshot, totalSnapshot);
        // refresh products to get updated stock
        loadProducts(() => { });
      } else {
        showToast('Order failed: ' + (data.message || 'Unknown error'));
      }
    })
    .catch(() => {
      if (btn) { btn.textContent = 'Place Order'; btn.disabled = false; }
      _finishOrder(null, null, name, phone, address, cartSnapshot, totalSnapshot);
    });
}
// 功能：下单成功后的收尾处理 清空购物车、跳转到"我的订单"页、显示成功提示
function _finishOrder(apiOrderId, apiTracking, name, phone, address, cartSnapshot, totalSnapshot) {
  const order = {
    id: apiOrderId || Date.now(),
    items: cartSnapshot,
    total: totalSnapshot,
    status: 'Processing',
    date: new Date().toLocaleDateString(),
    shipping: { name, phone, address },
    trackingNumber: apiTracking || ('TRK' + Math.random().toString(36).substr(2, 9).toUpperCase()),
    estimatedDelivery: new Date(Date.now() + 3 * 86400000).toLocaleDateString()
  };
  state.orders.unshift(order);
  state.cart = [];
  state.isCheckout = false;
  state.page = 'orders';
  updateCartBadge();
  render();
  showToast('Order placed successfully! 🎉');
}
// 功能：订单追踪弹窗每次打开都重新最新状态
function openTrackingModal(orderId) {
  // Fetch latest status from DB so changes made in Admin are reflected immediately
  fetch('api/orders.php')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.orders) {
        state.orders = data.orders.map(o => {
          const local = state.orders.find(s => s.id == o.id);
          return {
            id: o.id,
            items: (o.items && o.items.length > 0) ? o.items : (local ? local.items : []),
            total: parseFloat(o.total_price),
            status: o.status || 'Processing',
            date: new Date(o.created_at).toLocaleDateString(),
            shipping: { name: o.shipping_name, phone: o.shipping_phone, address: o.shipping_address },
            trackingNumber: o.tracking_number || ('TRK' + o.id),
            estimatedDelivery: new Date(new Date(o.created_at).getTime() + 3 * 86400000).toLocaleDateString()
          };
        });
      }
      state.selectedOrder = state.orders.find(o => o.id == orderId);
      $('modal-tracking').classList.add('open');
      renderTrackingModal();
    })
    .catch(() => {
      // fallback: use in-memory state
      state.selectedOrder = state.orders.find(o => o.id == orderId);
      $('modal-tracking').classList.add('open');
      renderTrackingModal();
    });
}

function closeTrackingModal() {
  $('modal-tracking').classList.remove('open');
}
//功能：物流时间线UI 把订单状态映射成"已完成几个步骤"
function renderTrackingModal() {
  const o = state.selectedOrder;
  if (!o) return;
  $('track-number').textContent = o.trackingNumber;
  $('track-delivery').textContent = o.estimatedDelivery;
  $('track-ship-name').textContent = o.shipping.name;
  $('track-ship-phone').textContent = o.shipping.phone;
  $('track-ship-address').textContent = o.shipping.address;

  // update timeline dots based on status
  // 0=Order Placed, 1=Payment Confirmed, 2=Processing, 3=Shipped, 4=Delivered
  const statusMap = {
    'Order Placed': 0,
    'Payment Confirmed': 1,
    'Processing': 2,
    'Shipped': 3,
    'Delivered': 4,
    'Cancelled': 0
  };
  const currentStep = statusMap[o.status] ?? 2;
  // scope only to this modal, not whole document
  const modal = $('modal-tracking');
  const dots = modal ? modal.querySelectorAll('.step-dot') : [];
  dots.forEach((dot, i) => {
    dot.className = 'step-dot';
    if (i < currentStep) {
      dot.classList.add('done');
      dot.textContent = '✓';
    } else if (i === currentStep) {
      dot.classList.add('active');
      dot.textContent = '⋯';
    } else {
      dot.classList.add('pending');
      dot.textContent = '○';
    }
  });
}

// ===== REVIEW FORM =====
function toggleReviewForm() {
  const wrap = $('review-form-wrap');
  if (!wrap) return;
  const hidden = wrap.style.display === 'none' || wrap.style.display === '';
  if (hidden) {
    if (!state.user) { showToast('Please login to write a review 👤'); openAuthModal('login'); return; }
    wrap.style.display = 'block';
    state.reviewRating = 0;
    updateStarUI(0);
    const ta = $('review-comment');
    if (ta) ta.value = '';
  } else {
    wrap.style.display = 'none';
  }
}

function updateStarUI(val) {
  document.querySelectorAll('.star-rating .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.val) <= val);
  });
}

function submitReview() {
  if (!state.selectedProduct) return;
  if (state.reviewRating === 0) { showToast('Please select a star rating'); return; }
  const comment = $('review-comment') ? $('review-comment').value.trim() : '';
  if (!comment) { showToast('Please write a comment'); return; }

  const payload = {
    product_id: state.selectedProduct.id,
    user_id: state.user ? state.user.id : null,
    user_name: state.user ? state.user.name : 'Anonymous',
    rating: state.reviewRating,
    comment: comment
  };

  fetch('api/products.php?action=add_review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => { });
  // 功能：显示评论每次进详情页都重新该商品最新评论列表
  // optimistic update
  const newReview = {
    user_name: payload.user_name,
    rating: state.reviewRating,
    comment: comment,
    created_at: new Date().toISOString().split('T')[0]
  };
  if (!state.selectedProduct._reviews) state.selectedProduct._reviews = [];
  state.selectedProduct._reviews.unshift(newReview);

  toggleReviewForm();
  renderReviewsList();
  showToast('Review submitted! Thank you 🙏');
}

function renderReviewsList() {
  const reviewsList = $('reviews-list');
  if (!reviewsList || !state.selectedProduct) return;

  // load from DB
  fetch('api/products.php?action=reviews&product_id=' + state.selectedProduct.id)
    .then(r => r.json())
    .then(data => {
      const reviews = data.success ? data.reviews : [];
      if (reviews.length === 0) {
        reviewsList.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;padding:12px 0">No reviews yet. Be the first to review!</p>';
        return;
      }
      reviewsList.innerHTML = reviews.map(r => {
        const stars = parseInt(r.rating) || 5;
        const dateStr = r.created_at ? r.created_at.split('T')[0].split(' ')[0] : '';
        return `
          <div class="review-item">
            <div class="review-item-header">
              <span class="review-item-user">${escHtml(r.user_name)}</span>
              <span class="review-item-date">${dateStr}</span>
            </div>
            <div class="review-item-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
            <p class="review-item-comment">${escHtml(r.comment)}</p>
          </div>`;
      }).join('');
    })
    .catch(() => {
      reviewsList.innerHTML = '<p style="color:var(--color-text-secondary);font-size:14px;padding:12px 0">Could not load reviews.</p>';
    });
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== RENDER FUNCTIONS =====
function renderHeader() {
  const nav = $('header-nav');
  const total = getTotalItems();
  const wTotal = state.wishlist.length;
  nav.innerHTML = `
    <button onclick="goTo('products')">🗂 Products</button>
    ${state.user ? `<button onclick="goTo('orders')">📦 Orders</button>` : ''}
    <button class="wish-btn-nav" onclick="goTo('wishlist')" title="Wishlist">
      🤍<span id="wish-badge" class="cart-badge" style="display:${wTotal > 0 ? 'flex' : 'none'}">${wTotal}</span>
    </button>
    <button class="cart-btn" onclick="goTo('cart')">
      🛒<span id="cart-badge" class="cart-badge" style="display:${total > 0 ? 'flex' : 'none'}">${total}</span>
    </button>
    ${state.user ? `
      <div class="user-menu">
        <button>👤 ${escHtml(state.user.name)}</button>
        <div class="user-dropdown">
          ${isAdmin() ? `<button onclick="goTo('admin')">⚙️ Admin Dashboard</button>` : ''}
          <button class="danger" onclick="logout()">🚪 Logout</button>
        </div>
      </div>
    ` : `<button class="btn-login" onclick="openAuthModal('login')">Login</button>`}
  `;
}

function renderHomePage() {
  const featured = state.products.slice(0, 3);
  $('home-featured').innerHTML = featured.map(productCardHTML).join('');
  $('home-categories').innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn ${state.category === c.id ? 'active' : ''}" onclick="selectCategory('${c.id}')">
      <div class="cat-icon">${c.icon}</div>
      <span>${c.name}</span>
    </button>`).join('');
}

function selectCategory(catId) {
  state.category = catId;
  state.page = 'products';
  render();
}

function productCardHTML(p) {
  const discount = getDiscount(p);
  const inWish = state.wishlist.includes(p.id);
  return `
    <div class="product-card">
      <div class="product-img-wrap">
        <img src="${p.image || ''}" alt="${escHtml(p.name)}" loading="lazy"
             onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'">
        ${discount > 0 ? `<span class="badge-discount">${discount}% OFF</span>` : ''}
        ${p.stock < 20 && p.stock > 0 ? `<span class="badge-stock">Only ${p.stock} left!</span>` : ''}
        ${p.stock === 0 ? `<span class="badge-stock" style="background:#6b7280">Out of stock</span>` : ''}
        <button class="btn-wish" onclick="toggleWishlistUI(${p.id}, this)"
                title="${inWish ? 'Remove from wishlist' : 'Add to wishlist'}">${inWish ? '❤️' : '🤍'}</button>
      </div>
      <div class="product-body">
        <div class="product-name">${escHtml(p.name)}</div>
        <div class="product-desc">${escHtml(p.description || '')}</div>
        <div class="product-rating">
          <span class="stars">★ ${p.rating}</span>
          <span class="review-count">(${(p.reviews || 0).toLocaleString()} reviews)</span>
        </div>
        <div class="product-price">
          <span class="price-current">$${p.price.toLocaleString()}</span>
          ${p.original_price > p.price
      ? `<span class="price-original">$${p.original_price.toLocaleString()}</span>` : ''}
        </div>
        <div class="product-actions">
          <button class="btn-detail" onclick="viewProduct(${p.id})">View Details</button>
          <button class="btn-cart" onclick="addToCart(${p.id})" title="Add to cart"
                  ${p.stock === 0 ? 'disabled style="opacity:.4;cursor:not-allowed"' : ''}>🛒</button>
        </div>
      </div>
    </div>`;
}

function toggleWishlistUI(productId, btn) {
  toggleWishlist(productId);
  const inWish = state.wishlist.includes(productId);
  btn.textContent = inWish ? '❤️' : '🤍';
  showToast(inWish ? 'Added to wishlist! ❤️' : 'Removed from wishlist');
}

function viewProduct(productId) {
  state.selectedProduct = state.products.find(p => p.id === productId);
  state.page = 'detail';
  render();
}

function renderProductsPage() {
  const products = getFilteredProducts();

  $('sidebar-cats').innerHTML = CATEGORIES.map(c => `
    <button class="filter-btn ${state.category === c.id ? 'active' : ''}"
            onclick="state.category='${c.id}';renderProductsPage()">
      ${c.icon} ${c.name}
    </button>`).join('');

  document.querySelectorAll('.price-preset').forEach(btn => {
    btn.onclick = function () {
      state.priceMax = parseInt(this.dataset.max);
      renderProductsPage();
    };
  });

  $('price-range').value = state.priceMax;
  $('price-display').textContent = '$0 – $' + state.priceMax.toLocaleString();
  $('sort-select').value = state.sortBy;

  const cat = CATEGORIES.find(c => c.id === state.category);
  $('products-header').textContent = cat ? cat.name : 'All Products';
  $('products-count').textContent = products.length + ' products found';

  if (products.length > 0) {
    $('products-grid').innerHTML = products.map(productCardHTML).join('');
    $('products-empty').style.display = 'none';
    $('products-grid').style.display = 'grid';
  } else {
    $('products-grid').style.display = 'none';
    $('products-empty').style.display = 'block';
  }
}

function renderDetailPage() {
  const p = state.selectedProduct;
  if (!p) return;

  const inWish = state.wishlist.includes(p.id);
  const specs = Array.isArray(p.specs) ? p.specs : [];
  const origPrice = p.original_price || 0;

  $('detail-img').src = p.image || '';
  $('detail-img').onerror = function () { this.src = 'https://via.placeholder.com/400x300?text=No+Image'; };
  $('detail-img').alt = p.name;
  $('detail-title').textContent = p.name;
  $('detail-meta').innerHTML = `
    <span style="color:#f59e0b;font-weight:600">★ ${p.rating}</span>
    <span>${(p.reviews || 0).toLocaleString()} reviews</span>
    <span style="color:${p.stock === 0 ? '#ef4444' : p.stock < 20 ? '#f97316' : '#16a34a'}">
      ${p.stock === 0 ? '✗ Out of stock' : p.stock < 20 ? '⚠️ Only ' + p.stock + ' left!' : '✓ In stock: ' + p.stock}
    </span>`;
  $('detail-desc').textContent = p.description || '';
  $('detail-specs').innerHTML = specs.map(s => `<li>${escHtml(s)}</li>`).join('');
  $('detail-price').innerHTML = `$${p.price.toLocaleString()}${origPrice > p.price ? `<small>$${origPrice.toLocaleString()}</small>` : ''}`;
  $('detail-wish-btn').className = `btn-wish-detail ${inWish ? 'active' : ''}`;
  $('detail-wish-btn').textContent = inWish ? '❤️' : '🤍';

  $('detail-add-cart-btn').onclick = () => addToCart(p.id);
  $('detail-add-cart-btn').disabled = p.stock === 0;
  if (p.stock === 0) $('detail-add-cart-btn').style.opacity = '0.4';
  else $('detail-add-cart-btn').style.opacity = '1';

  $('detail-wish-btn').onclick = () => {
    toggleWishlist(p.id);
    const nowIn = state.wishlist.includes(p.id);
    $('detail-wish-btn').className = `btn-wish-detail ${nowIn ? 'active' : ''}`;
    $('detail-wish-btn').textContent = nowIn ? '❤️' : '🤍';
    showToast(nowIn ? 'Added to wishlist! ❤️' : 'Removed from wishlist');
  };

  const wrap = $('review-form-wrap');
  if (wrap) wrap.style.display = 'none';

  renderReviewsList();

  document.querySelectorAll('.star-rating .star').forEach(star => {
    star.onclick = function () { state.reviewRating = parseInt(this.dataset.val); updateStarUI(state.reviewRating); };
    star.onmouseover = function () { updateStarUI(parseInt(this.dataset.val)); };
    star.onmouseout = function () { updateStarUI(state.reviewRating); };
  });
}

function renderCart() {
  const wrap = $('cart-items');
  const summary = $('cart-summary');

  if (state.cart.length === 0) {
    $('cart-empty').style.display = 'block';
    wrap.style.display = 'none';
    if (summary) summary.style.display = 'none';
    return;
  }

  $('cart-empty').style.display = 'none';
  wrap.style.display = 'block';
  if (summary) summary.style.display = 'block';

  wrap.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img src="${item.image || ''}" alt="${escHtml(item.name)}"
           onerror="this.src='https://via.placeholder.com/90x90?text=IMG'">
      <div class="cart-item-info">
        <h4>${escHtml(item.name)}</h4>
        <p>${escHtml(item.description || '')}</p>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateQty(${item.id},-1)">−</button>
        <span class="qty-num">${item.quantity}</span>
        <button class="qty-btn" onclick="updateQty(${item.id},1)">+</button>
      </div>
      <div class="cart-item-price">
        <div class="big">$${(item.price * item.quantity).toLocaleString()}</div>
        <div class="small">Unit: $${item.price.toLocaleString()}</div>
      </div>
      <button class="btn-remove" onclick="removeFromCart(${item.id})">Remove</button>
    </div>`).join('');

  $('cart-total').textContent = '$' + getTotalPrice().toLocaleString();
  $('cart-count').textContent = getTotalItems() + ' items';
}

function renderCheckout() {
  $('checkout-items').innerHTML = state.cart.map(item => `
    <div class="order-summary-row">
      <span>${escHtml(item.name)} × ${item.quantity}</span>
      <span>$${(item.price * item.quantity).toLocaleString()}</span>
    </div>`).join('');
  $('checkout-total').textContent = '$' + getTotalPrice().toLocaleString();
  if (state.user && $('ship-name') && !$('ship-name').value) {
    $('ship-name').value = state.user.name || '';
  }
}

function renderOrders() {
  const wrap = $('orders-list');

  fetch('api/orders.php')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.orders && data.orders.length > 0) {
        state.orders = data.orders.map(o => {
          const local = state.orders.find(s => s.id == o.id);
          const items = (o.items && o.items.length > 0) ? o.items : (local ? local.items : []);
          return {
            id: o.id,
            items: items,
            total: parseFloat(o.total_price),
            status: o.status || 'Processing',
            date: new Date(o.created_at).toLocaleDateString(),
            shipping: { name: o.shipping_name, phone: o.shipping_phone, address: o.shipping_address },
            trackingNumber: o.tracking_number || ('TRK' + o.id),
            estimatedDelivery: new Date(new Date(o.created_at).getTime() + 3 * 86400000).toLocaleDateString()
          };
        });
      }
      _paintOrders(wrap);
    })
    .catch(() => _paintOrders(wrap));
}

function _paintOrders(wrap) {
  if (state.orders.length === 0) {
    $('orders-empty').style.display = 'block';
    wrap.style.display = 'none';
    return;
  }
  $('orders-empty').style.display = 'none';
  wrap.style.display = 'block';
  wrap.innerHTML = state.orders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <h3>Order #${order.id}</h3>
          <p>Placed on ${order.date}</p>
          <p>Tracking: <strong>${order.trackingNumber}</strong></p>
        </div>
        <span class="status-badge status-${(order.status || 'processing').toLowerCase()}">${order.status}</span>
      </div>
      <div class="order-items">
        ${order.items.slice(0, 2).map(item => `
          <div class="order-item">
            <img src="${item.image || ''}" alt="${escHtml(item.name)}"
                 onerror="this.src='https://via.placeholder.com/60x60?text=IMG'">
            <div class="order-item-info">
              <p>${escHtml(item.name)}</p>
              <small>Qty: ${item.quantity}</small>
            </div>
            <strong>$${(item.price * item.quantity).toLocaleString()}</strong>
          </div>`).join('')}
        ${order.items.length > 2 ? `<p style="font-size:13px;color:#6b7280;padding:4px 0">+${order.items.length - 2} more items</p>` : ''}
      </div>
      <div class="order-footer">
        <div>
          <div class="order-total-label">Total Amount</div>
          <div class="order-total-amount">$${order.total.toLocaleString()}</div>
        </div>
        <button class="btn-track" onclick="openTrackingModal(${order.id})">Track Order</button>
      </div>
    </div>`).join('');
}

function renderWishlistPage() {
  const wishItems = state.products.filter(p => state.wishlist.includes(p.id));
  if (wishItems.length === 0) {
    $('wishlist-empty').style.display = 'block';
    $('wishlist-grid').style.display = 'none';
    return;
  }
  $('wishlist-empty').style.display = 'none';
  $('wishlist-grid').style.display = 'grid';
  $('wishlist-grid').innerHTML = wishItems.map(productCardHTML).join('');
}

// ===== ADMIN =====
function renderAdmin() {
  // Only admin can see this page
  if (!isAdmin()) { goTo('home'); return; }
  // 功能：Admin统计 总销售额/订单数/
  fetch('api/orders.php')
    .then(r => r.json())
    .then(data => {
      if (data.success && data.orders) {
        state.orders = data.orders.map(o => ({
          id: o.id,
          items: o.items || [],
          total: parseFloat(o.total_price),
          status: o.status || 'Processing',
          date: new Date(o.created_at).toLocaleDateString(),
          shipping: { name: o.shipping_name, phone: o.shipping_phone, address: o.shipping_address },
          trackingNumber: o.tracking_number || ('TRK' + o.id),
          estimatedDelivery: new Date(new Date(o.created_at).getTime() + 3 * 86400000).toLocaleDateString()
        }));
      }
      _paintAdmin();
    })
    .catch(() => _paintAdmin());
}

function _paintAdmin() {
  const totalSales = state.orders.reduce((s, o) => s + o.total, 0);
  const totalOrders = state.orders.length;
  const avg = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0;

  $('admin-sales').textContent = '$' + totalSales.toLocaleString();
  $('admin-orders').textContent = totalOrders;
  $('admin-avg').textContent = '$' + avg;
  $('admin-wishlist').textContent = state.wishlist.length;

  // Orders table
  $('admin-table-body').innerHTML = state.orders.map(o => `
    <tr>
      <td><code>#${o.id}</code></td>
      <td>${escHtml(o.shipping.name)}</td>
      <td>${o.date}</td>
      <td>
        <select class="status-select" onchange="adminUpdateStatus(${o.id}, this.value)"
                style="padding:4px 8px;border:2px solid #e5e7eb;border-radius:6px;font-size:12px;outline:none;cursor:pointer">
          ${['Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s =>
    `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
  ).join('')}
        </select>
      </td>
      <td><strong>$${o.total.toLocaleString()}</strong></td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:32px">No orders yet</td></tr>';

  // Products table
  if ($('admin-products-body')) {
    $('admin-products-body').innerHTML = state.products.map((p, i) => `
      <tr style="border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
        <td style="padding:10px 14px">
          <div style="display:flex;align-items:center;gap:10px">
            <img src="${p.image || ''}" alt="${escHtml(p.name)}"
                 style="width:40px;height:40px;object-fit:cover;border-radius:6px"
                 onerror="this.src='https://via.placeholder.com/40x40?text=IMG'">
            <span style="font-size:13px;font-weight:600">${escHtml(p.name)}</span>
          </div>
        </td>
        <td style="padding:10px 14px;font-size:13px;color:#6b7280;text-transform:capitalize">${p.category}</td>
        <td style="padding:10px 14px;font-size:14px;color:#ef4444;font-weight:700">$${p.price.toLocaleString()}</td>
        <td style="padding:10px 14px;font-size:13px;color:${p.stock < 20 ? '#ef4444' : '#374151'}">${p.stock}</td>
        <td style="padding:10px 14px;font-size:13px;color:#f59e0b">★ ${p.rating}</td>
        <td style="padding:10px 14px;display:flex;gap:6px">
          <button onclick="openEditModal(${p.id})"
                  style="background:#eff6ff;color:#2563eb;border:none;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">Edit</button>
          <button onclick="adminDeleteProduct(${p.id})"
                  style="background:#fee2e2;color:#ef4444;border:none;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">Delete</button>
        </td>
      </tr>`).join('');
  }
}
// 功能：Admin改订单状态
function adminUpdateStatus(orderId, newStatus) {
  fetch('api/orders.php?action=update_status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, status: newStatus })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('Order #' + orderId + ' updated to ' + newStatus + ' ✓');
        const order = state.orders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
      } else {
        showToast('Update failed: ' + (data.message || 'error'));
      }
    })
    .catch(() => showToast('Cannot connect to server'));
}
// 功能：Admin删商品
function adminDeleteProduct(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  if (!confirm('Delete "' + p.name + '"? This cannot be undone.')) return;

  fetch('api/products.php?action=delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: productId })
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast('Product deleted ✓');
        loadProducts(() => { renderAdmin(); });
      } else {
        showToast('Delete failed: ' + (data.message || 'error'));
      }
    })
    .catch(() => showToast('Cannot connect to server'));
}

// ===== PRODUCT MODAL (Add / Edit) =====
function openAddModal() {
  const modal = $('modal-product');
  if (!modal) return;
  $('product-modal-title').textContent = 'Add New Product';
  $('pf-id').value = '';
  $('pf-name').value = '';
  $('pf-price').value = '';
  $('pf-orig-price').value = '';
  $('pf-image').value = '';
  $('pf-category').value = 'electronics';
  $('pf-rating').value = '5.0';
  $('pf-stock').value = '0';
  $('pf-description').value = '';
  $('pf-specs').value = '';
  modal.classList.add('open');
}

function openEditModal(productId) {
  const p = state.products.find(x => x.id === productId);
  if (!p) return;
  const modal = $('modal-product');
  if (!modal) return;
  $('product-modal-title').textContent = 'Edit Product';
  $('pf-id').value = p.id;
  $('pf-name').value = p.name;
  $('pf-price').value = p.price;
  $('pf-orig-price').value = p.original_price || p.price;
  $('pf-image').value = p.image || '';
  $('pf-category').value = p.category;
  $('pf-rating').value = p.rating;
  $('pf-stock').value = p.stock;
  $('pf-description').value = p.description || '';
  $('pf-specs').value = Array.isArray(p.specs) ? p.specs.join(', ') : '';
  modal.classList.add('open');
}

function closeProductModal() {
  const modal = $('modal-product');
  if (modal) modal.classList.remove('open');
}
// 功能：Admin保存商品
function saveProduct(e) {
  e.preventDefault();
  const id = $('pf-id').value;
  const name = $('pf-name').value.trim();
  const price = parseFloat($('pf-price').value);
  const origPrice = parseFloat($('pf-orig-price').value) || price;
  const image = $('pf-image').value.trim();
  const category = $('pf-category').value;
  const rating = parseFloat($('pf-rating').value);
  const stock = parseInt($('pf-stock').value);
  const description = $('pf-description').value.trim();
  const specsRaw = $('pf-specs').value.trim();

  if (!name || !price || !category || !description) {
    showToast('Please fill in all required fields');
    return;
  }

  const specsArr = specsRaw ? specsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const isEdit = !!id;
  const action = isEdit ? 'update' : 'create';
  const payload = { name, price, original_price: origPrice, image, category, rating, stock, description, specs: specsArr };
  if (isEdit) payload.id = parseInt(id);

  const btn = $('pf-submit-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  fetch('api/products.php?action=' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(data => {
      btn.textContent = 'Save Product';
      btn.disabled = false;
      if (data.success) {
        showToast(isEdit ? 'Product updated! ✓' : 'Product added! ✓');
        closeProductModal();
        loadProducts(() => { renderAdmin(); });
      } else {
        showToast('Error: ' + (data.message || 'Save failed'));
      }
    })
    .catch(() => {
      btn.textContent = 'Save Product';
      btn.disabled = false;
      showToast('Cannot connect to server');
    });
}

// ===== MAIN RENDER =====
function render() {
  if (!state.productsLoaded) {
    // show loading spinner
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    return;
  }

  if (state.isCheckout) { showPage('page-checkout'); renderCheckout(); return; }

  switch (state.page) {
    case 'home': showPage('page-home'); renderHomePage(); break;
    case 'products': showPage('page-products'); renderProductsPage(); break;
    case 'detail': showPage('page-detail'); renderDetailPage(); break;
    case 'cart': showPage('page-cart'); renderCart(); break;
    case 'orders': showPage('page-orders'); renderOrders(); break;
    case 'wishlist': showPage('page-wishlist'); renderWishlistPage(); break;
    case 'admin':
      if (!isAdmin()) { goTo('home'); return; }
      showPage('page-admin');
      renderAdmin();
      break;
    default: showPage('page-home');
  }
}

// ===== EVENT BINDINGS =====
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();

  // load products from DB first, then render
  loadProducts(() => {
    render();
    // if user is logged in, load their wishlist
    if (state.user) loadWishlistFromDB();
  });

  $('logo').onclick = () => goTo('home');

  // search
  $('search-input').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  $('search-btn').onclick = doSearch;
  $('search-clear').onclick = () => {
    $('search-input').value = '';
    state.searchQuery = '';
    $('search-clear').style.display = 'none';
    if (state.page === 'products') renderProductsPage();
  };
  $('search-input').addEventListener('input', function () {
    state.searchQuery = this.value;
    $('search-clear').style.display = this.value ? 'block' : 'none';
  });

  // auth modal
  $('modal-auth').addEventListener('click', e => { if (e.target === $('modal-auth')) closeAuthModal(); });
  $('auth-form').addEventListener('submit', handleAuth);
  $('auth-switch-btn').addEventListener('click', switchAuthMode);
  $('auth-close-btn').addEventListener('click', closeAuthModal);
  $('pw-toggle').addEventListener('click', () => {
    const inp = $('auth-password');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    $('pw-toggle').textContent = inp.type === 'password' ? '👁' : '🙈';
  });

  // checkout
  $('checkout-form').addEventListener('submit', placeOrder);

  // tracking modal
  $('modal-tracking').addEventListener('click', e => { if (e.target === $('modal-tracking')) closeTrackingModal(); });
  $('tracking-close').addEventListener('click', closeTrackingModal);

  // product modal (admin)
  const pm = $('modal-product');
  if (pm) {
    pm.addEventListener('click', e => { if (e.target === pm) closeProductModal(); });
    $('product-form').addEventListener('submit', saveProduct);
  }

  // price range slider
  $('price-range').addEventListener('input', function () {
    state.priceMax = parseInt(this.value);
    $('price-display').textContent = '$0 – $' + state.priceMax.toLocaleString();
    renderProductsPage();
  });

  // sort
  $('sort-select').addEventListener('change', function () {
    state.sortBy = this.value;
    renderProductsPage();
  });

  // payment method
  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      state.paymentMethod = this.dataset.method;
      document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // clear filters
  $('clear-filters-btn').onclick = () => {
    state.searchQuery = '';
    state.category = 'all';
    state.priceMax = 20000;
    $('search-input').value = '';
    $('search-clear').style.display = 'none';
    renderProductsPage();
  };

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAuthModal(); closeTrackingModal(); closeProductModal(); }
  });

  // back to top
  const bt = $('back-to-top');
  window.addEventListener('scroll', () => {
    if (bt) bt.classList.toggle('visible', window.scrollY > 400);
  });
});

function doSearch() {
  state.searchQuery = $('search-input').value.trim();
  if (state.searchQuery) { state.page = 'products'; render(); }
}

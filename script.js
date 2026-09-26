/* ==========================================================================
   UPPALAPATIFARMS — GLOBAL STATE & INTERACTIVE LOGIC
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. GLOBAL STATE & CONSTANTS
// --------------------------------------------------------------------------
const frameCount = 1149;
let currentView = 'cinematic'; // 'cinematic' | 'home'
let useVideo = false;
let images = new Array(frameCount).fill(null);
let targetFrame = 0;
let currentFrameFloat = 0;
let targetTime = 0;
let currentTime = 0;
let cinematicSelectedSize = '500';
let cinematicSelectedPrice = 649;

// Global Shared Cart State (persisted in localStorage)
let cart = JSON.parse(localStorage.getItem('uppalapati_cart') || '[]');

// Products Definition (Single Source of Truth)
const PRODUCTS = {
    'ghee-500': {
        id: 'ghee-500',
        name: 'UppalapatiFarms Ghee',
        size: '500 ml',
        price: 649,
        image: 'assets/ghee_500ml.jpg'
    },
    'ghee-100': {
        id: 'ghee-100',
        name: 'UppalapatiFarms Ghee',
        size: '100 ml',
        price: 149,
        image: 'assets/ghee_100ml.jpg'
    }
};

// DOM Element References
const canvas = document.getElementById('frame-canvas');
const context = canvas ? canvas.getContext('2d') : null;
const video = document.getElementById('scroll-video');
const cinematicOverlay = document.getElementById('cinematic-buy-overlay');
const scrollIndicator = document.getElementById('scroll-indicator');

// --------------------------------------------------------------------------
// 2. VIEW SWITCHER (CINEMATIC vs NORMAL HOMEPAGE)
// --------------------------------------------------------------------------
function switchView(viewName) {
    currentView = viewName;
    const cinematicView = document.getElementById('cinematic-view');
    const homepageView = document.getElementById('homepage-view');
    const navHome = document.getElementById('nav-home');
    const navStory = document.getElementById('nav-story');
    const navGhee = document.getElementById('nav-ghee');
    const navContact = document.getElementById('nav-contact');

    // Reset active nav highlights
    [navHome, navStory, navGhee, navContact].forEach(link => link && link.classList.remove('active'));

    if (viewName === 'cinematic') {
        document.body.className = 'view-cinematic';
        if (cinematicView) cinematicView.style.display = 'block';
        if (homepageView) homepageView.style.display = 'none';
        if (navStory) navStory.classList.add('active');
        
        window.scrollTo(0, 0);
        resizeCanvas();
        updateScroll();
    } else { // 'home'
        document.body.className = 'view-home';
        if (cinematicView) cinematicView.style.display = 'none';
        if (homepageView) homepageView.style.display = 'block';
        if (navHome) navHome.classList.add('active');
        
        window.scrollTo(0, 0);
    }
}

function navigateToGhee() {
    if (currentView !== 'home') {
        switchView('home');
        setTimeout(() => scrollToGhee(), 100);
    } else {
        scrollToGhee();
    }
    const navGhee = document.getElementById('nav-ghee');
    if (navGhee) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        navGhee.classList.add('active');
    }
}

function scrollToGhee() {
    const sec = document.getElementById('ghee-section');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });
}

function navigateToContact() {
    if (currentView !== 'home') {
        switchView('home');
        setTimeout(() => {
            const sec = document.getElementById('contact-section');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    } else {
        const sec = document.getElementById('contact-section');
        if (sec) sec.scrollIntoView({ behavior: 'smooth' });
    }
    const navContact = document.getElementById('nav-contact');
    if (navContact) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        navContact.classList.add('active');
    }
}

// --------------------------------------------------------------------------
// 3. CINEMATIC FRAME SEQUENCE & VIDEO ENGINE
// --------------------------------------------------------------------------
const currentFramePath = index => (
    `https://res.cloudinary.com/f1nvqibv/image/upload/frame-${index.toString().padStart(4, '0')}.webp`
);

// Progressive / Lazy Frame Loader Engine
const LOOK_AHEAD = 40;
const LOOK_BEHIND = 15;
const MAX_CACHE_SIZE = 180;
let lastCenteredIndex = -1;

function loadFrame(idx) {
    if (idx < 0 || idx >= frameCount) return null;
    if (!images[idx]) {
        const img = new Image();
        img.decoding = 'async';
        img.src = currentFramePath(idx + 1);
        images[idx] = img;
    }
    return images[idx];
}

function updateFrameWindow(centerIndex) {
    if (Math.abs(centerIndex - lastCenteredIndex) < 2 && lastCenteredIndex !== -1) return;
    lastCenteredIndex = centerIndex;

    const start = Math.max(0, centerIndex - LOOK_BEHIND);
    const end = Math.min(frameCount - 1, centerIndex + LOOK_AHEAD);

    for (let i = start; i <= end; i++) {
        loadFrame(i);
    }

    // Memory optimization: evict frames furthest from view if cache exceeds limit
    let activeIndices = [];
    for (let i = 0; i < frameCount; i++) {
        if (images[i]) activeIndices.push(i);
    }

    if (activeIndices.length > MAX_CACHE_SIZE) {
        activeIndices.sort((a, b) => Math.abs(b - centerIndex) - Math.abs(a - centerIndex));
        const numToEvict = activeIndices.length - MAX_CACHE_SIZE;
        for (let k = 0; k < numToEvict; k++) {
            const evictIdx = activeIndices[k];
            if (evictIdx < start - 10 || evictIdx > end + 10) {
                images[evictIdx].src = '';
                images[evictIdx] = null;
            }
        }
    }
}

// Immediately load initial frame window (frames 1..30)
for (let i = 0; i < 30; i++) {
    loadFrame(i);
}

if (video) {
    video.addEventListener('loadedmetadata', () => {
        useVideo = true;
        updateScroll();
    });
    video.addEventListener('error', () => {
        useVideo = false;
    });
}

const FRAME_ASPECT_RATIO = 16 / 9;

function resizeCanvas() {
    if (!canvas || currentView !== 'cinematic') return;
    
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // Calculate 16:9 CSS rendering dimensions
    let cssW = vw;
    let cssH = vw / FRAME_ASPECT_RATIO;
    
    if (cssH < vh) {
        cssH = vh;
        cssW = vh * FRAME_ASPECT_RATIO;
    }
    
    cssW = Math.ceil(cssW);
    cssH = Math.ceil(cssH);

    // Apply explicit CSS 16:9 bounds
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    
    // Calculate 16:9 internal resolution buffer (scaled with DPR, minimum 1920x1080)
    const internalW = Math.max(1920, Math.round(cssW * dpr));
    const internalH = Math.round(internalW / FRAME_ASPECT_RATIO);
    
    if (canvas.width !== internalW || canvas.height !== internalH) {
        canvas.width = internalW;
        canvas.height = internalH;
    }
    
    render();
}

function drawCover(source, srcWidth, srcHeight) {
    if (!context || !srcWidth || !srcHeight) return;
    
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Direct 16:9 1-to-1 draw onto 16:9 canvas buffer
    context.drawImage(
        source, 
        0, 0, srcWidth, srcHeight,
        0, 0, canvas.width, canvas.height
    );
}

function render() {
    if (currentView !== 'cinematic') return;

    if (useVideo && video && video.readyState >= 2) {
        drawCover(video, video.videoWidth, video.videoHeight);
    } else {
        const frameIndex = Math.min(frameCount - 1, Math.max(0, Math.floor(currentFrameFloat)));
        
        updateFrameWindow(frameIndex);
        
        const img = images[frameIndex];
        
        if (img && img.complete && img.naturalWidth > 0) {
            drawCover(img, img.naturalWidth, img.naturalHeight);
        } else {
            for (let diff = 1; diff < frameCount; diff++) {
                const prevIndex = frameIndex - diff;
                if (prevIndex >= 0) {
                    const prev = images[prevIndex];
                    if (prev && prev.complete && prev.naturalWidth > 0) {
                        drawCover(prev, prev.naturalWidth, prev.naturalHeight);
                        break;
                    }
                }
                const nextIndex = frameIndex + diff;
                if (nextIndex < frameCount) {
                    const next = images[nextIndex];
                    if (next && next.complete && next.naturalWidth > 0) {
                        drawCover(next, next.naturalWidth, next.naturalHeight);
                        break;
                    }
                }
            }
        }
    }
}

function updateScroll() {
    if (currentView !== 'cinematic') return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const maxScrollTop = Math.max(1, (document.documentElement.scrollHeight || 1) - window.innerHeight);
    const scrollFraction = Math.max(0, Math.min(1, scrollTop / maxScrollTop));
    
    if (useVideo && video && video.duration) {
        targetTime = scrollFraction * video.duration;
    } else {
        targetFrame = scrollFraction * (frameCount - 1);
    }

    // Toggle Cinematic Buy Overlay when reaching final Ghee shot (> 80% scroll)
    if (scrollFraction >= 0.8) {
        if (cinematicOverlay) cinematicOverlay.classList.add('active');
        if (scrollIndicator) scrollIndicator.style.opacity = '0';
    } else {
        if (cinematicOverlay) cinematicOverlay.classList.remove('active');
        if (scrollIndicator) scrollIndicator.style.opacity = '1';
    }
}

function animate() {
    if (currentView === 'cinematic') {
        if (useVideo && video && video.duration) {
            currentTime += (targetTime - currentTime) * 0.08;
            if (Math.abs(targetTime - currentTime) < 0.0005) currentTime = targetTime;
            if (Math.abs(video.currentTime - currentTime) > 0.005) video.currentTime = currentTime;
        } else {
            currentFrameFloat += (targetFrame - currentFrameFloat) * 0.08;
            if (Math.abs(targetFrame - currentFrameFloat) < 0.001) currentFrameFloat = targetFrame;
        }
        render();
    }
    requestAnimationFrame(animate);
}

// --------------------------------------------------------------------------
// 4. SHARED GLOBAL CART SYSTEM
// --------------------------------------------------------------------------
function saveCart() {
    localStorage.setItem('uppalapati_cart', JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    // 1. Update Cart Badge Count
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const badge = document.getElementById('cart-badge-count');
    if (badge) badge.innerText = totalCount;

    // 2. Render Cart Items inside Drawer
    const container = document.getElementById('cart-items-container');
    const cartFooter = document.getElementById('cart-footer');

    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-state">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                </svg>
                <h4>Your cart is empty</h4>
                <p>Explore our pure handcrafted Ghee products and add them to your cart.</p>
            </div>
        `;
        if (cartFooter) cartFooter.style.display = 'none';
        return;
    }

    if (cartFooter) cartFooter.style.display = 'block';

    let html = '';
    let subtotal = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;

        html += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <span class="cart-item-size">${item.size}</span>
                    <div class="cart-item-row">
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="changeQty('${item.id}', -1)">-</button>
                            <span class="qty-val">${item.qty}</span>
                            <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
                        </div>
                        <div class="cart-item-price">₹${itemTotal}</div>
                    </div>
                    <button class="remove-item-btn" onclick="removeFromCart('${item.id}')">Remove</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    if (subtotalEl) subtotalEl.innerText = `₹${subtotal}`;
    if (totalEl) totalEl.innerText = `₹${subtotal}`;
}

function addToCart(id, name, size, price, image) {
    const existingIndex = cart.findIndex(item => item.id === id);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({ id, name, size, price, image, qty: 1 });
    }
    saveCart();
    toggleCartDrawer(true);
    openToast(`Added ${name} (${size}) to cart!`);
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        removeFromCart(id);
    } else {
        saveCart();
    }
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart();
}

// Cinematic Card Size Selection & Add to Cart
function selectCinematicSize(size, price, element) {
    cinematicSelectedSize = size;
    cinematicSelectedPrice = price;
    document.querySelectorAll('.size-pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
}

function addCinematicToCart() {
    const productId = `ghee-${cinematicSelectedSize}`;
    const product = PRODUCTS[productId];
    if (product) {
        addToCart(product.id, product.name, product.size, product.price, product.image);
    }
}

// --------------------------------------------------------------------------
// 5. DRAWER & MODAL MANAGERS
// --------------------------------------------------------------------------
function toggleCartDrawer(open) {
    const drawer = document.getElementById('cart-drawer');
    const backdrop = document.getElementById('cart-backdrop');
    if (open) {
        if (drawer) drawer.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
    } else {
        if (drawer) drawer.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    }
}

function openCheckout() {
    if (cart.length === 0) return;
    toggleCartDrawer(false);

    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const summaryTotal = document.getElementById('checkout-summary-total');
    if (summaryTotal) summaryTotal.innerText = `₹${subtotal}`;

    const modal = document.getElementById('checkout-backdrop');
    if (modal) modal.classList.add('active');
}

function closeCheckout() {
    const modal = document.getElementById('checkout-backdrop');
    if (modal) modal.classList.remove('active');
}

function selectPayment(element) {
    document.querySelectorAll('.payment-radio').forEach(r => r.classList.remove('active'));
    element.classList.add('active');
}

function handleCheckoutSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const address = document.getElementById('cust-address').value;
    const city = document.getElementById('cust-city').value;

    const orderId = `UF-${Math.floor(10000 + Math.random() * 90000)}`;
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

    const confirmationDetails = document.getElementById('confirmation-details');
    if (confirmationDetails) {
        let itemsSummary = cart.map(i => `${i.name} (${i.size}) × ${i.qty}`).join('<br>');
        confirmationDetails.innerHTML = `
            <div style="background: #fcf8f2; padding: 20px; border-radius: 16px; margin-bottom: 24px; text-align: left; font-size: 0.9rem;">
                <p><strong>Deliver To:</strong> ${name}, ${phone}</p>
                <p><strong>Address:</strong> ${address}, ${city}</p>
                <hr style="margin: 12px 0; border: none; border-top: 1px dashed #e8ded2;">
                <p><strong>Items:</strong><br>${itemsSummary}</p>
                <hr style="margin: 12px 0; border: none; border-top: 1px dashed #e8ded2;">
                <p style="font-size: 1.1rem; color: #8e5d0f;"><strong>Total Amount: ₹${subtotal}</strong> (COD)</p>
            </div>
        `;
    }

    const orderIdBadge = document.getElementById('confirmed-order-id');
    if (orderIdBadge) orderIdBadge.innerText = `ORDER ID: #${orderId}`;

    closeCheckout();
    
    // Clear global cart
    cart = [];
    saveCart();

    const confirmModal = document.getElementById('confirmation-backdrop');
    if (confirmModal) confirmModal.classList.add('active');
}

function closeConfirmation() {
    const confirmModal = document.getElementById('confirmation-backdrop');
    if (confirmModal) confirmModal.classList.remove('active');
    switchView('home');
}

function handleContactSubmit(e) {
    e.preventDefault();
    openToast("Thank you for reaching out! We will contact you shortly.");
    e.target.reset();
}

function openToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// --------------------------------------------------------------------------
// 6. EVENT LISTENERS & INITIALIZATION
// --------------------------------------------------------------------------
window.addEventListener('scroll', updateScroll, { passive: true });
window.addEventListener('resize', resizeCanvas);

// Initialize Global State
updateCartUI();
switchView('cinematic');
animate();

const loginPage = document.getElementById('login-page');
const appPage = document.getElementById('app-page');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const nameInput = document.getElementById('name');
const mobileInput = document.getElementById('mobile');
const passInput = document.getElementById('password');
const content = document.getElementById('content');
const deleteBtn = document.getElementById('delete-btn');
const downloadBtn = document.getElementById('download-btn');

function initApp() {
    const socket = io();
    socket.on('authenticated', () => {
        content.innerHTML = '<h3>Connected to WhatsApp</h3>';
    });
    socket.on('qr', (qr) => {
        content.innerHTML = '<h3>Scan this QR with WhatsApp</h3><canvas id="qr-canvas"></canvas>';
        QRCode.toCanvas(document.getElementById('qr-canvas'), qr, { width: 300 });
    });
    socket.on('logout', () => {
        content.innerHTML = '<h3>Session ended. Please scan again.</h3>';
    });
    socket.on('logUpdate', (lines) => {
        content.innerHTML = lines.join('<br>');
    });

    deleteBtn.onclick = () => fetch('/api/delete-log', { method: 'DELETE' });
    downloadBtn.onclick = () => window.location.href = '/api/download-log';
}

// Try auto-login on page load
fetch('/api/log').then(res => {
    if (res.ok) {
        loginPage.style.display = 'none';
        appPage.style.display = '';
        initApp();
    }
});

// Manual login
loginBtn.onclick = () => {
    fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: nameInput.value,
            mobile: mobileInput.value,
            password: passInput.value
        })
    }).then(res => {
        if (res.ok) {
            loginPage.style.display = 'none';
            appPage.style.display = '';
            initApp();
        } else {
            res.text().then(t => loginError.innerText = t);
        }
    });
};

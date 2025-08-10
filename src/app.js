// 前端逻辑：连接 WebSocket，处理画板和聊天

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let role = '';
let word = '';
let ws;

let setWordDiv = document.getElementById('setWord');
const btnGuesser = document.getElementById('btnGuesser');
const btnPainter = document.getElementById('btnPainter');
let userRoleValue = 'guesser';
let myUserId = '';

function connectWS() {
    // 自动适配当前网页域名和端口，支持 http/https
    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + (location.port ? ':' + location.port : '');
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
        addMsg('已连接服务器', 'system');
        ws.send(JSON.stringify({ type: 'chooseRole', role: userRoleValue }));
    };
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'role') {
            role = msg.role;
            setWordDiv.style.display = role === 'painter' ? '' : 'none';
            // 聊天输入框和发送按钮，画者和猜词者都可见
            document.getElementById('input').style.display = '';
            document.getElementById('send').style.display = '';
            // 画板是否可绘制
            canvas.style.pointerEvents = role === 'painter' ? 'auto' : 'none';
            document.getElementById('clearCanvas').style.display = role === 'painter' ? '' : 'none';
        }
        if (msg.type === 'word') {
            word = msg.word;
            document.getElementById('word').innerText = role === 'painter' ? '请画：' + word : (word ? '当前题目已设置' : '');
        }
        if (msg.type === 'draw') {
            drawLine(msg.x0, msg.y0, msg.x1, msg.y1, msg.color);
        }
        if (msg.type === 'clear') {
            clearCanvasLocal();
        }
        if (msg.type === 'chat') {
            // 判断是否自己发的
            const user = msg.user && msg.user === myUserId ? 'me' : '';
            addMsg((msg.user ? msg.user + ': ' : '') + msg.text, 'chat', user);
        }
        if (msg.type === 'correct') {
            addMsg('🎉 ' + msg.user + ' 猜对了！词语是：' + msg.word, 'system');
        }
        if (msg.type === 'userId') {
            myUserId = msg.userId;
        }
    };
    ws.onerror = function(e) {
        addMsg('❌ WebSocket连接失败，请检查网络、端口或穿透设置！');
    };
    ws.onclose = function(e) {
        addMsg('⚠️ WebSocket连接已关闭');
    };
}


btnGuesser.onclick = function() {
    userRoleValue = 'guesser';
    btnGuesser.classList.add('selected');
    btnPainter.classList.remove('selected');
    ws.send(JSON.stringify({ type: 'chooseRole', role: userRoleValue }));
};
btnPainter.onclick = function() {
    userRoleValue = 'painter';
    btnPainter.classList.add('selected');
    btnGuesser.classList.remove('selected');
    ws.send(JSON.stringify({ type: 'chooseRole', role: userRoleValue }));
};

// 默认高亮猜词者
btnGuesser.classList.add('selected');

document.getElementById('submitWord').onclick = function() {
    const customWord = document.getElementById('customWord').value.trim();
    if (customWord) {
        ws.send(JSON.stringify({ type: 'setWord', word: customWord }));
        document.getElementById('customWord').value = '';
    }
};

function addMsg(text, type, user) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.innerHTML = text;
    if (type === 'system') {
        div.className = 'msg-system';
    } else if (type === 'chat') {
        div.className = user === 'me' ? 'msg-chat msg-right' : 'msg-chat msg-left';
    } else if (type === 'correct') {
        div.className = 'msg-system';
        div.style.background = 'linear-gradient(90deg,#e0f7fa,#fffbe6)';
        div.style.color = '#e67e22';
        div.style.fontWeight = 'bold';
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    setTimeout(() => div.classList.remove('msg-animate'), 600);
    messages.scrollTop = messages.scrollHeight;
}



function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    // 计算缩放比例
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// 鼠标绘画
canvas.addEventListener('mousedown', e => {
    if (role !== 'painter') return;
    drawing = true;
    const pos = getCanvasPos(e.clientX, e.clientY);
    lastX = pos.x;
    lastY = pos.y;
});
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);
let lastX, lastY;
canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    drawLine(lastX, lastY, pos.x, pos.y, '#333', true);
    lastX = pos.x;
    lastY = pos.y;
});

// 手机触摸绘画
canvas.addEventListener('touchstart', function(e) {
    if (role !== 'painter') return;
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getCanvasPos(touch.clientX, touch.clientY);
    drawing = true;
    lastX = pos.x;
    lastY = pos.y;
});
canvas.addEventListener('touchend', function(e) {
    drawing = false;
});
canvas.addEventListener('touchcancel', function(e) {
    drawing = false;
});
canvas.addEventListener('touchmove', function(e) {
    if (!drawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getCanvasPos(touch.clientX, touch.clientY);
    drawLine(lastX, lastY, pos.x, pos.y, '#333', true);
    lastX = pos.x;
    lastY = pos.y;
});

function drawLine(x0, y0, x1, y1, color, emit) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();
    if (!emit) return;
    ws.send(JSON.stringify({ type: 'draw', x0, y0, x1, y1, color }));
}

function clearCanvasLocal() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

document.getElementById('clearCanvas').onclick = function() {
    clearCanvasLocal();
    ws.send(JSON.stringify({ type: 'clear' }));
};

document.getElementById('send').onclick = () => {
    const input = document.getElementById('input');
    const text = input.value.trim();
    if (!text) return;
    ws.send(JSON.stringify({ type: 'chat', text }));
    input.value = '';
};

document.getElementById('input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('send').click();
});

connectWS();

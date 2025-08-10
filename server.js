// 简易 Node.js WebSocket 服务端
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/public/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200);
            res.end(data);
        }
    });
});


const wss = new WebSocket.Server({ server });
let users = [];
let currentWord = '';

wss.on('connection', (ws) => {
    const userId = '用户' + Math.floor(Math.random() * 1000);
    ws.send(JSON.stringify({ type: 'userId', userId }));
    let role = 'guesser';
    users.push({ ws, userId, role });

    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg); } catch { return; }
        // 用户选择身份
        if (data.type === 'chooseRole') {
            role = data.role;
            users.forEach(u => { if (u.ws === ws) u.role = role; });
            ws.send(JSON.stringify({ type: 'role', role }));
            ws.send(JSON.stringify({ type: 'word', word: currentWord }));
        }
        // 画者设置题目
        if (data.type === 'setWord' && role === 'painter') {
            currentWord = data.word;
            users.forEach(u => {
                u.ws.send(JSON.stringify({ type: 'word', word: currentWord }));
            });
        }
        // 清空画布
        if (data.type === 'clear' && role === 'painter') {
            users.forEach(u => {
                u.ws.send(JSON.stringify({ type: 'clear' }));
            });
        }
        // 画线
        if (data.type === 'draw' && role === 'painter') {
            users.forEach(u => {
                if (u.ws !== ws) u.ws.send(JSON.stringify({ type: 'draw', ...data }));
            });
        }
        // 聊天和猜词
        if (data.type === 'chat') {
            if (data.text === currentWord && currentWord) {
                users.forEach(u => {
                    u.ws.send(JSON.stringify({ type: 'correct', user: userId, word: currentWord }));
                });
                // 新一轮，题目清空
                currentWord = '';
                users.forEach(u => {
                    u.ws.send(JSON.stringify({ type: 'word', word: currentWord }));
                });
            } else {
                users.forEach(u => {
                    u.ws.send(JSON.stringify({ type: 'chat', user: userId, text: data.text }));
                });
            }
        }
    });

    // 初始身份
    ws.send(JSON.stringify({ type: 'role', role }));
    ws.send(JSON.stringify({ type: 'word', word: role === 'painter' ? currentWord : '' }));

    ws.on('close', () => {
        users = users.filter(u => u.ws !== ws);
    });
});

server.listen(3000, '0.0.0.0', () => {
    console.log('服务器已启动：http://0.0.0.0:3000');
});

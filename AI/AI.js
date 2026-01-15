const chatDiv = document.getElementById("chat");
const chatScroll = document.querySelector(".chat-scroll");
const input = document.getElementById("msg");
const sendBtn = document.getElementById("sendBtn");
const imageInput = document.getElementById("imageInput");
const fileInput = document.getElementById("fileInput");
const audioInput = document.getElementById("audioInput");
const attachmentPreview = document.getElementById("attachmentPreview");

const attachments = [];
const KIND_ICON = {
    image: "🖼",
    file: "📁",
    audio: "🎤"
};

// 聊天记录存储键名
const STORAGE_KEY = "aichat_history";

// 从 localStorage 加载聊天记录
function loadChatHistory() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const messages = JSON.parse(saved);
            messages.forEach(msg => {
                renderMessage(msg.role, msg.content, msg.attachments || []);
            });
            chatScroll.scrollTop = chatScroll.scrollHeight;
        } catch (e) {
            console.error("加载聊天记录失败:", e);
        }
    }
}

// 保存聊天记录到 localStorage
function saveChatHistory(role, content, files = []) {
    const saved = localStorage.getItem(STORAGE_KEY);
    let messages = saved ? JSON.parse(saved) : [];
    // 只保存轻量的附件元数据（不存文件本身）
    const meta = files.map(f => ({ kind: f.kind, name: f.name }));
    messages.push({ role, content, attachments: meta, timestamp: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// 渲染消息到页面（将换行符转换为 HTML）
function renderMessage(role, content, files = []) {
    const wrapper = document.createElement("div");
    wrapper.className = `message ${role}`;
    // 将换行符转换为 <br/>，并转义 HTML 防止 XSS
    const htmlContent = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = htmlContent;

    if (files.length) {
        const list = document.createElement("div");
        list.className = "message-attachments";
        files.forEach(f => {
            const card = document.createElement("div");
            card.className = "attachment-card";
            if (f.kind === "image" && f.url) {
                const img = document.createElement("img");
                img.src = f.url;
                img.alt = f.name;
                card.appendChild(img);
            } else if (f.kind === "audio" && f.url) {
                const audioEl = document.createElement("audio");
                audioEl.controls = true;
                audioEl.src = f.url;
                card.appendChild(audioEl);
            }
            const label = document.createElement("div");
            label.className = "attachment-label";
            label.textContent = `${KIND_ICON[f.kind] || "📎"} ${f.name}`;
            card.appendChild(label);
            list.appendChild(card);
        });
        contentDiv.appendChild(list);
    }

    wrapper.appendChild(contentDiv);
    chatDiv.appendChild(wrapper);
}

// 添加消息（渲染 + 保存）
function appendMessage(role, content, files = []) {
    renderMessage(role, content, files);
    saveChatHistory(role, content, files);
    chatScroll.scrollTop = chatScroll.scrollHeight;
}

async function send() {
    const message = input.value.trim();
    if ((message.length === 0 && attachments.length === 0) || sendBtn.disabled) {
        input.focus();
        return;
    }

    sendBtn.disabled = true;

    try {
        const outgoingFiles = attachments.map(a => ({
            id: a.id,
            kind: a.kind,
            name: a.name,
            url: a.url
        }));
        appendMessage("user", message || "（无文本）", outgoingFiles);

        const fd = new FormData();
        fd.append("message", message);
        attachments.forEach(a => {
            if (a.file) {
                fd.append("files", a.file, a.name);
            }
        });
        input.value = "";
        clearAttachments();

        const resp = await fetch("http://127.0.0.1:5000/chat/upload", {
            method: "POST",
            body: fd
        });

        if (!resp.ok) {
            throw new Error("网络错误");
        }

        const data = await resp.json();
        const replyText = formatResults(data);
        appendMessage("assistant", replyText || "（无响应）");
    } catch (err) {
        appendMessage("assistant", `抱歉，发生错误：${err.message}`);
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

// 根据内容自动调整输入框高度（最多 10 行）
input.addEventListener("input", () => {
    input.style.height = "auto";
    const maxHeight = 10 * 20; // 约 10 行
    const next = Math.min(input.scrollHeight, maxHeight);
    input.style.height = next + "px";
});

function startNewChat() {
    if (confirm("确定要开始新对话吗？当前聊天记录将被清空。")) {
        chatDiv.innerHTML = "";
        localStorage.removeItem(STORAGE_KEY);
        chatScroll.scrollTop = chatScroll.scrollHeight;
    }
}

function selectImage() {
    if (imageInput) imageInput.click();
}

function selectFile() {
    if (fileInput) fileInput.click();
}

function selectAudio() {
    if (audioInput) audioInput.click();
}

function handleFiles(kind, fileList) {
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).forEach(file => {
        attachments.push({
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            kind,
            name: file.name,
            file,
            url: URL.createObjectURL(file)
        });
    });
    renderAttachments();
}

function renderAttachments() {
    if (!attachmentPreview) return;
    attachmentPreview.innerHTML = "";
    attachments.forEach(item => {
        const pill = document.createElement("div");
        pill.className = "attachment-pill";
        pill.innerHTML = `
            <span>${KIND_ICON[item.kind] || "📎"} ${item.name}</span>
            <button class="attachment-remove" aria-label="移除附件" data-id="${item.id}">×</button>
        `;
        attachmentPreview.appendChild(pill);
    });
    attachmentPreview.querySelectorAll(".attachment-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            removeAttachment(btn.dataset.id);
        });
    });
}

function removeAttachment(id) {
    const idx = attachments.findIndex(item => item.id === id);
    if (idx !== -1) {
        if (attachments[idx].url) {
            URL.revokeObjectURL(attachments[idx].url);
        }
        attachments.splice(idx, 1);
        renderAttachments();
    }
}

function clearAttachments() {
    // 释放 blob URL 以避免泄露
    attachments.forEach(item => {
        if (item.url) URL.revokeObjectURL(item.url);
    });
    attachments.splice(0, attachments.length);
    renderAttachments();
    if (imageInput) imageInput.value = "";
    if (fileInput) fileInput.value = "";
    if (audioInput) audioInput.value = "";
}

// 页面加载时恢复聊天记录
document.addEventListener("DOMContentLoaded", () => {
    loadChatHistory();
    if (imageInput) {
        imageInput.addEventListener("change", (e) => handleFiles("image", e.target.files));
    }
    if (fileInput) {
        fileInput.addEventListener("change", (e) => handleFiles("file", e.target.files));
    }
    if (audioInput) {
        audioInput.addEventListener("change", (e) => handleFiles("audio", e.target.files));
    }
});

function formatResults(data) {
    if (!data) return "";
    if (Array.isArray(data.results)) {
        return data.results.map(r => {
            if (r.error) return `⚠️ ${r.name || "未知文件"}：${r.error}`;
            if (r.kind === "image") return `🖼 ${r.name}\n${r.reply || "（无响应）"}`;
            if (r.kind === "audio") return `🎤 ${r.name}\n转写：${r.transcript || "（无转写）"}`;
            if (r.kind === "file") return `📁 ${r.name}\n${r.reply || "（无响应）"}`;
            if (r.kind === "text") return r.reply || "";
            return `${r.name || "附件"}\n${r.reply || ""}`;
        }).join("\n\n");
    }
    // 兼容旧结构
    return data.reply || "";
}




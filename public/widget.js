(function () {
  "use strict";

  // Resolve config from the script tag that loaded us.
  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf("/widget.js") !== -1) return scripts[i];
      }
      return null;
    })();
  if (!script) return;

  var jobId = script.getAttribute("data-mirror-job-id");
  if (!jobId) {
    console.warn("[mirror-widget] missing data-mirror-job-id");
    return;
  }
  var apiOrigin = script.getAttribute("data-mirror-origin") || new URL(script.src, location.href).origin;

  // Don't double-mount if proxied page is reloaded with cached widget reference.
  if (window.__MIRROR_WIDGET_MOUNTED__) return;
  window.__MIRROR_WIDGET_MOUNTED__ = true;

  function api(path) {
    return apiOrigin.replace(/\/$/, "") + path;
  }

  var visitorId =
    (function () {
      try {
        var k = "mirror-visitor-id";
        var v = localStorage.getItem(k);
        if (!v) {
          v = "vis_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
          localStorage.setItem(k, v);
        }
        return v;
      } catch (_) {
        return "vis_anon";
      }
    })();

  var ctx = null; // populated from /api/jobs/{id}/context
  var messages = []; // { role, content }
  var sending = false;

  // ---- Build the chrome ----
  var host = document.createElement("div");
  host.id = "mirror-widget-root";
  host.style.cssText = "all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;";
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: "open" });

  var STYLES = `
    :host, * { box-sizing: border-box; }
    .bubble {
      width: 60px; height: 60px; border-radius: 50%;
      background: var(--brand, #0E5C5C);
      color: white;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      transition: transform 0.15s ease;
      border: none;
    }
    .bubble:hover { transform: scale(1.05); }
    .bubble svg { width: 28px; height: 28px; }
    .panel {
      position: absolute; right: 0; bottom: 76px;
      width: 360px; max-width: calc(100vw - 24px); height: 520px; max-height: calc(100vh - 100px);
      background: white; border-radius: 16px;
      box-shadow: 0 24px 48px rgba(0,0,0,0.25);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      color: #1a1a1a;
    }
    .panel.open { display: flex; }
    .header {
      background: var(--brand, #0E5C5C);
      color: white; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .header .title { font-weight: 600; font-size: 14px; }
    .header .sub { font-size: 11px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .close {
      background: transparent; border: none; color: white; cursor: pointer;
      font-size: 22px; line-height: 1; padding: 0 4px;
    }
    .messages {
      flex: 1; overflow-y: auto; padding: 14px; background: #f7f7f8;
      display: flex; flex-direction: column; gap: 8px;
    }
    .msg { max-width: 85%; padding: 8px 12px; border-radius: 14px; font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; }
    .msg.user { align-self: flex-end; background: var(--brand, #0E5C5C); color: white; border-bottom-right-radius: 4px; }
    .msg.assistant { align-self: flex-start; background: white; color: #1a1a1a; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
    .msg.error { background: #fff5f5; color: #b00020; border: 1px solid #fbb; }
    .typing { display: inline-flex; gap: 4px; }
    .typing span { width: 6px; height: 6px; border-radius: 50%; background: #999; animation: blink 1.2s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }
    form {
      display: flex; gap: 8px; padding: 10px; border-top: 1px solid #eee; background: white;
    }
    input.q {
      flex: 1; border: 1px solid #ddd; border-radius: 999px; padding: 8px 14px;
      font-size: 14px; outline: none; font-family: inherit;
    }
    input.q:focus { border-color: var(--brand, #0E5C5C); }
    button.send {
      background: var(--brand, #0E5C5C); color: white; border: none;
      border-radius: 999px; padding: 8px 16px; cursor: pointer; font-weight: 600; font-size: 13px;
      font-family: inherit;
    }
    button.send:disabled { opacity: 0.5; cursor: default; }
    .badge { font-size: 10px; text-align: center; padding: 4px; background: #fafafa; color: #888; border-top: 1px solid #eee; }
  `;

  var styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  shadow.appendChild(styleEl);

  var bubbleBtn = document.createElement("button");
  bubbleBtn.className = "bubble";
  bubbleBtn.setAttribute("aria-label", "Open chat");
  bubbleBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6 2 11c0 2.5 1.2 4.8 3.2 6.4L4 22l4.8-1.2c1 .3 2.1.4 3.2.4 5.5 0 10-4 10-9.2C22 6 17.5 2 12 2z"/></svg>';

  var panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="header">
      <div>
        <div class="sub">Loading…</div>
        <div class="title">Chat with our team</div>
      </div>
      <button type="button" class="close" aria-label="Close">×</button>
    </div>
    <div class="messages"></div>
    <form>
      <input class="q" type="text" placeholder="Ask a question…" autocomplete="off" />
      <button type="submit" class="send" disabled>Send</button>
    </form>
    <div class="badge">Mirror pilot · powered by AI</div>
  `;

  shadow.appendChild(bubbleBtn);
  shadow.appendChild(panel);

  var subEl = panel.querySelector(".sub");
  var titleEl = panel.querySelector(".title");
  var closeBtn = panel.querySelector(".close");
  var msgsEl = panel.querySelector(".messages");
  var formEl = panel.querySelector("form");
  var inputEl = panel.querySelector("input.q");
  var sendBtn = panel.querySelector("button.send");

  function open() { panel.classList.add("open"); inputEl.focus(); }
  function close() { panel.classList.remove("open"); }
  bubbleBtn.addEventListener("click", function () {
    if (panel.classList.contains("open")) close();
    else open();
  });
  closeBtn.addEventListener("click", close);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function appendMessage(role, text, opts) {
    opts = opts || {};
    var el = document.createElement("div");
    el.className = "msg " + role + (opts.error ? " error" : "");
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  function appendTyping() {
    var el = document.createElement("div");
    el.className = "msg assistant";
    el.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  // ---- Bootstrap: fetch context ----
  fetch(api("/api/jobs/" + encodeURIComponent(jobId) + "/context"))
    .then(function (r) {
      if (!r.ok) throw new Error("Could not load practice context (" + r.status + ")");
      return r.json();
    })
    .then(function (data) {
      ctx = data.practiceContext;
      var brand = (ctx && ctx.brand) || {};
      if (brand.primary) {
        host.style.setProperty("--brand", brand.primary);
        // Also propagate into shadow root by setting on bubble + panel inline
        bubbleBtn.style.background = brand.primary;
        panel.querySelector(".header").style.background = brand.primary;
      }
      subEl.textContent = ctx.name || "Practice";
      titleEl.textContent = "Chat with our team";
      sendBtn.disabled = false;
      var greeting =
        "Hi! I'm the " +
        (ctx.name || "practice") +
        " assistant. Ask me about treatments, prices, our team or to book an appointment.";
      appendMessage("assistant", greeting);
    })
    .catch(function (err) {
      subEl.textContent = "Offline";
      appendMessage("assistant", err.message || "Chatbot unavailable.", { error: true });
    });

  // ---- Send ----
  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending || !ctx) return;
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    send(text);
  });

  function send(text) {
    sending = true;
    sendBtn.disabled = true;
    inputEl.disabled = true;
    messages.push({ role: "user", content: text });
    appendMessage("user", text);

    var typingEl = appendTyping();
    var assistantEl = null;
    var assistantBuf = "";

    fetch(api("/api/chat-widget"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: jobId, visitorId: visitorId, messages: messages }),
    })
      .then(function (res) {
        if (!res.ok || !res.body) {
          throw new Error("Chat error " + res.status);
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) return;
            var piece = decoder.decode(chunk.value, { stream: true });
            if (!assistantEl) {
              typingEl.remove();
              assistantEl = appendMessage("assistant", "");
            }
            assistantBuf += piece;
            assistantEl.textContent = assistantBuf;
            msgsEl.scrollTop = msgsEl.scrollHeight;
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        if (assistantBuf) messages.push({ role: "assistant", content: assistantBuf });
        else if (typingEl) typingEl.remove();
      })
      .catch(function (err) {
        if (typingEl && typingEl.parentNode) typingEl.remove();
        appendMessage("assistant", err.message || "Something went wrong.", { error: true });
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
      });
  }
})();

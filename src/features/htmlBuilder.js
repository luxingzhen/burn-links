import { env } from "cloudflare:workers";

// 预处理环境变量
const HOME_ICON = env.HOME_ICON || "https://workers.cloudflare.com/resources/logo/logo.svg";
const TITLE = env.TITLE || "阅后即焚";
const BACKGROUND = env.BACKGROUND
const BACKGROUND_VERTICAL = env.BACKGROUND_VERTICAL
const TURNSTILE_SITE_KEY = env.TURNSTILE_SITE_KEY; // 获取 Site Key

// 样式表
const styles = `
<style type="text/css">
    html, body {width: 100%; height: 100%; margin: 0; padding: 0; overflow-x: hidden;}
    body {
      background-color: #ffffff; color: #000000; 
      font-family:-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue",Arial, sans-serif; 
      font-size: 16px; line-height: 1.7em; -webkit-font-smoothing: antialiased; 
      text-align: center; background-size: cover; background-position: center center; 
      background-repeat: no-repeat; background-attachment: fixed; backdrop-filter: blur(3px);
    }
    h1 { text-align: center; font-weight:700; margin: 16px 0; font-size: 32px; color:#000000; line-height: 1.25;}
    p {font-size: 20px; font-weight: 400; margin: 8px 0;}
    a { color: #2c7cb0; text-decoration: none; transition: color 0.15s ease; }
    a:hover{color: #f4a15d}
    .container {
      max-width: 700px; min-height: 450px; margin: 50px auto;
      background: #eff1f26a; padding: 25px; border-radius: 18px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); backdrop-filter: blur(4px);
    }
    input[type="url"], input[type="number"], input[type="text"], textarea {
      padding: 15px; border: 3px solid #ccc;
      border-radius: 5px; margin-bottom: 20px; margin-top: 10px;
      box-sizing: border-box;
    }
    input.url-input {
      width: 80%;
    }
    textarea.text-output {
      width: 80%; height: 160px; resize: none; font-size: 16px; font-family: inherit;
    }
    input.visits-input {
      width: 150px;
    }
    .settings-row {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 2rem;
      margin-top: 20px;
    }
    .setting-item {
      text-align: center;
    }
    .copy-button {
      background-color: #2c7cb0; color: white; padding: 15px 25px;
      border: none; border-radius: 80px; cursor: pointer; font-size: 16px;
      transition: background-color 0.3s ease; margin-top: 20px;
    }
    .copy-button:hover { background-color: #f4a15d; }
    .top-banner {
      display: flex; position: fixed; top: 0; left: 0; width: 100%;
      padding: 12px 24px; background-color: rgba(255, 255, 255, 0.74);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); z-index: 1000; opacity: 0.8;
    }
    .brand { display: flex; align-items: center; gap: 16px; }
    .brand a { display: flex; align-items: center; gap: 16px; text-decoration: none; color: inherit; }
    .top-banner-logo { width: 32px; height: 32px; }
    .top-banner-title { margin: 0; font-size: 1.5em; font-weight: bold; }
    .expire-toggle { margin: 15px 0; text-align: center; }
    .expire-toggle label { display: inline-block; position: relative; cursor: pointer; }
    .expire-toggle input[type="checkbox"] { display: none; }
    .slider { position: relative; display: inline-block; width: 60px; height: 30px; background-color: #5cb85c; border-radius: 15px; transition: all 0.3s ease; }
    .slider:before { content: ""; position: absolute; left: 4px; top: 4px; width: 22px; height: 22px; background-color: white; border-radius: 50%; transition: all 0.3s ease; }
    input:checked + .slider { background-color: #ff4d4d; }
    input:checked + .slider:before { transform: translateX(30px); }
    .gorgeous-blue-gradient {
      font-weight: bold; background: linear-gradient( to right, #007bff, #17a2b8, #0056b3, #66ccff, #007bff );
      background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent;
      animation: blueGradientFlow 5s linear infinite;
    }
    @keyframes blueGradientFlow { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
    .form-row { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    @media screen and (max-width: 700px) {
      .container, body { backdrop-filter: blur(1px); }
      .top-banner { display: none; }
      #check_title { font-size: 28px; }
      .form-row p { font-size: 16px; }
      input.url-input, input.visits-input, textarea.text-output { width: 90%; }
      ::placeholder { font-size: 12px; }
    }
</style>
<script>
  (function() {
  document.addEventListener('DOMContentLoaded', function() {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile/i.test(navigator.userAgent) || window.innerWidth <= 700;
    let backgroundUrl;
    try {
      backgroundUrl = new URL(isMobile ? "${BACKGROUND_VERTICAL}" : "${BACKGROUND}");
      backgroundUrl.searchParams.append('t', Date.now()); 
    } catch (err) {
      console.error('Failed to parse background URL:', err);
      backgroundUrl = "none";
    }
    document.body.style.backgroundImage = \`url("\${backgroundUrl.href}")\`;
  })})();
</script>
`;

// 头部横幅 (静态)
const topBanner = `
<div class="top-banner">
  <div class="brand">
      <a href="/">
          <img src="${HOME_ICON}" alt="logo" class="top-banner-logo">
          <h2 class="top-banner-title">${TITLE}</h2>
      </a>
  </div>
</div>
`;

// 基础页面布局函数 (核心)
function getLayout(pageTitle, contentHtml, extraHeadHtml = '') {
  return `
<!DOCTYPE HTML>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="description" content="Burn After Reading Short Link Service">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="icon" href="${HOME_ICON}">
  <title>${pageTitle} | ${TITLE}</title>
  ${styles}
  ${extraHeadHtml}
</head>
<body>
  ${topBanner}
  <table width="100%" height="100%" cellpadding="20">
    <tr>
      <td align="center" valign="middle">
        <div class="container">
          ${contentHtml}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// 首页内容
export function getHomepage() {
  const content = `
<h1 id="check_title"><span class="gorgeous-blue-gradient">阅后即焚</span> 共享箱</h1>
<form method="POST" action="/" class="form-row">
    <p>输入你希望分享的网址、密码或任意文本内容</p>
    <!-- 【修改点 1】将 type="url" 变更为 type="text"，允许输入任何文本 -->
    <input type="text" name="url" class="url-input" placeholder="https://... 或 敏感密码/文本内容" required>

    <div class="settings-row">
        <div class="setting-item">
            <p>最大访问次数</p>
            <input type="number" name="visits" min="1" max="99" class="visits-input" value="1" placeholder="1-99次, 留空不限">
        </div>

        <div class="setting-item">
            <p>过期设置</p>
            <div class="expire-toggle">
                <label>
                    <input type="checkbox" name="no_expire" id="expireToggle">
                    <span class="slider"></span>
                </label>
                <p id="label_status" style="font-size: 14px; margin-top: 8px;">12小时后销毁</p>
            </div>
        </div>
    </div>

    <!-- Turnstile 小部件容器 -->
    <div class="cf-turnstile" data-sitekey="${TURNSTILE_SITE_KEY}" data-size="flexible" style="margin-top: 20px;"></div>

    <button type="submit" class="copy-button">生成链接</button>
</form>
<script>
  const toggle = document.getElementById('expireToggle');
  const statusLabel = document.getElementById('label_status');
  toggle.addEventListener('change', function() {
    if (this.checked) {
      statusLabel.textContent = '1星期后销毁';
      statusLabel.style.color = '#ff4d4d';
    } else {
      statusLabel.textContent = '12小时销毁';
      statusLabel.style.color = '#5cb85c';
    }
  });
  statusLabel.style.color = '#5cb85c';
</script>
`;
  const turnstileScript = `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
  return getLayout('创建链接', content, turnstileScript);
}

// 成功页面内容
export function getSuccessPage(shortUrl) {
  const content = `
<h1>创建成功!</h1>
<p>你的私密提取链接是:</p>
<input type="text" id="shortUrl" value="${shortUrl}" readonly>
<button id="copyButton" class="copy-button">复制</button>
<p style="margin-top: 20px;"><a href="/">创建另一个</a></p>
<script>
  const copyButton = document.getElementById('copyButton');
  copyButton.addEventListener('click', () => {
    const urlInput = document.getElementById('shortUrl');
    urlInput.select();
    urlInput.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(urlInput.value).then(() => {
      copyButton.textContent = '已复制!';
      copyButton.style.backgroundColor = '#5cb85c';
      setTimeout(() => {
        copyButton.textContent = '复制';
        copyButton.style.backgroundColor = '#2c7cb0';
      }, 2000);
    }).catch(err => {
      alert('复制失败: ' + err);
    });
  });
</script>
`;
  return getLayout('创建成功', content);
}

// 【修改点 2】新增：展示非网址内容的文本显示页面
export function getTextViewPage(textRaw) {
  const safeText = encodeHTML(textRaw);
  const content = `
<h1>🔒 收到一条私密信息</h1>
<p style="color: #ff4d4d; font-size: 16px; font-weight: bold;">⚠️ 注意：本页面关闭或刷新后，内容将彻底销毁！</p>
<textarea class="text-output" id="textOutput" readonly>${safeText}</textarea>
<br>
<button id="copyTextButton" class="copy-button">一键复制内容</button>
<p style="margin-top: 20px;"><a href="/">我也要发一条</a></p>
<script>
  const copyTextBtn = document.getElementById('copyTextButton');
  copyTextBtn.addEventListener('click', () => {
    const txtArea = document.getElementById('textOutput');
    txtArea.select();
    navigator.clipboard.writeText(txtArea.value).then(() => {
      copyTextBtn.textContent = '内容已成功复制!';
      copyTextBtn.style.backgroundColor = '#5cb85c';
      setTimeout(() => {
        copyTextBtn.textContent = '一键复制内容';
        copyTextBtn.style.backgroundColor = '#2c7cb0';
      }, 2000);
    }).catch(err => {
      alert('复制失败: ' + err);
    });
  });
</script>
`;
  return getLayout('查看私密信息', content);
}

// 错误页面内容
export function getErrorPage(message) {
  const safeMessage = encodeHTML(message);
  const content = `
<h1 style="color: #d9534f;">操作失败</h1>
<p style="font-size: 22px;">${safeMessage}</p>
<a href="/" class="copy-button" style="text-decoration: none; display: inline-block; margin-top: 20px;">返回首页</a>
`;
  return getLayout('错误', content);
}

function encodeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

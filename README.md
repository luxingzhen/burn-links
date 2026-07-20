# 🔒 阅后即焚共享箱 (Burn After Reading Share Box)

一个基于 **Cloudflare Workers** + **KV** 搭建的轻量级私密信息与短链接分享工具。

不仅支持网址缩短与重定向，更支持直接分享敏感文本、服务器密码、Token 等内容。支持自定义最大访问次数、过期销毁、Cloudflare Turnstile 人机验证与恶意爬虫阻断。

👉 **在线演示站点**：[https://js.srfwq.top/](https://js.srfwq.top/)

---

## ✨ 核心特性

- 📝 **全类型支持**：智能识别输入内容。若是网址则自动执行 `302` 重定向；若是普通文本/密码，则渲染精美卡片并提供一键复制。
- 💥 **阅后即焚/限制次数**：支持自定义最大访问次数（默认为 1 次，上限 99 次），达到限制后数据立即从 KV 中彻底注销。
- ⏳ **灵活过期机制**：支持默认 12 小时自动销毁，或手动开启开关设置为 1 星期（7天）后销毁。
- 🛡️ **安全防护**：
  - 集成 **Cloudflare Turnstile** 人机验证，防止被恶意脚本刷爆。
  - 内置 **Bot Block** 爬虫阻断与 `robots.txt` 搜索引擎屏蔽规则。
  - 同源 Referer 校验，防止跨站伪造请求。
- ⚡ **零成本极速部署**：完全运行在 Cloudflare Workers 边缘网络上，无需自备服务器。

---

## 🚀 部署指南

只需 5 个步骤，即可拥有属于你自己的阅后即焚短链接服务。

### 步骤 1: Fork 本项目

点击本项目页面右上角的 **Fork** 按钮，将此项目复制到你自己的 GitHub 仓库中。

### 步骤 2: 创建 Cloudflare KV 命名空间

我们需要一个 KV 命名空间来存储短链接的数据。

1. 登录到 [Cloudflare 仪表板](https://dash.cloudflare.com/)。
2. 在左侧导航栏中，选择 **Workers & Pages** -> **KV**。
3. 点击 **Create a namespace** 按钮。
4. 名称随意（例如 `short_links`），然后点击 **Add**。
5. 创建成功后，你会看到新创建的命名空间列表。**复制它的 `ID`**，我们稍后会用到。

### 步骤 3: 创建 Cloudflare API 令牌

为了让 GitHub Actions 有权限部署 Worker，我们需要创建一个 API 令牌。

1. 直接访问 [https://dash.cloudflare.com/?to=/:account/api-tokens](https://dash.cloudflare.com/?to=/:account/api-tokens)
2. 点击 **Create Token**。
3. 在下方找到 **Custom token** -> **Create Custom Token**，点击 **Get Started**。
4. 为你的自定义令牌的设置名称（确保自己能知道用处）。在 **Permissions** 中，点击 **Select item...** 并选择 **Workers Script** 并确保权限为**Edit**。
5. 再点击 **+Add more**，点击 **Select item...** 并选择 **Workers KV Storage** 并确保权限为**Edit**。
6. 点击 **Continue to summary**到摘要页面，点击 **Create Token**。
7. **立即保存生成的令牌**！这是它唯一一次完整显示。妥善保管，如果没来得及保存就删了创个新的。

> **警告**: API 令牌非常敏感，请勿泄露给任何人或提交到代码仓库中。

### 步骤 4: 创建 Cloudflare Turnstile （可选）

人机验证是防止滥用的重要手段。

1. 登录到 [Cloudflare 仪表板](https://dash.cloudflare.com/)。
2. 在左侧导航栏中，选择 **Turnstile**。
3. 点击 **Add widget** 按钮。并正确添加你的主机名。
4. 点击 **Create** 后，你会看到 Site Key 和 Secret Key。复制他们，并稍后添加到机密中。


### 步骤 4: 在 GitHub 中配置 Secrets

这是最关键的一步，我们将把从 Cloudflare 获取的凭证安全地提供给 GitHub Actions。

1. 进入你 Fork 后的 GitHub 仓库页面。
2. 点击 **Settings** -> **Secrets and variables** -> **Actions**。
3. 点击 **New repository secret** 按钮，依次添加以下三个 Secret：

    *   **`CF_API_TOKEN`**:
        *   **值**: 在 **步骤 3** 中创建并复制的 API 令牌。

    *   **`CF_ACCOUNT_ID`**:
        *   **值**: 不需要设置，Action会自动获取（当然你想设置也可以）。

    *   **`CF_KV_NAMESPACE_ID`**:
        *   **值**: 在 **步骤 2** 中创建并复制的 KV 命名空间 ID。

    *   **`WORKER_NAME`**:
        *   **值**: 你希望为 Worker 设置的名称。

    *   **`CUSTOM_DOMAIN`**:
        *   **值**: 为 Worker 设置的自定义域。（可选）
    
    *   **`CF_TURNSTILE_SITE_KEY`**:
        *   **值**: Turnstile Site Key。（可选）

    *   **`CF_TURNSTILE_SECRET_KEY`**:
        *   **值**: Turnstile Secret Key。（可选）

> **注意**: 注意是设置到 Secrets 而不是 Variables。

### 步骤 5: 运行部署 Action

一切准备就绪！现在我们来执行部署。

1. 在你的 GitHub 仓库页面，点击顶部的 **Actions** 标签。
2. 在左侧列表中，点击 **Deploy to Cloudflare Workers** 工作流。
3. 点击 **Run workflow** 下拉按钮。
4. 点击绿色的 **Run workflow** 按钮。

等待几分钟，当工作流执行成功后，服务就上线了！

**访问地址**: `https://<你填写的Worker名称>.<你的Cloudflare子域>.workers.dev`

## 🎨 自定义配置

你可以通过修改 `wrangler.toml.template` 文件来个性化你的站点。

```toml
[vars]
# 默认过期时间（秒），12小时 = 43200秒
DEFAULT_TTL_SECONDS = 43200 
# 站点图标链接，留空则使用 Cloudflare 默认图标
HOME_ICON = "" 
# 站点主标题
TITLE = "阅后即焚"
# PC 端背景图 API 或链接
BACKGROUND = ""
# 移动端背景图 API 或链接
BACKGROUND_VERTICAL = ""
```

修改后，重新运行 GitHub Action 即可生效。

## 🛠️ 技术栈

- [Cloudflare Workers](https://workers.cloudflare.com/): Serverless 执行环境
- [Cloudflare KV](https://developers.cloudflare.com/workers/learning/how-kv-works/): 全球分布式键值存储
- [itty-router](https://github.com/kwhitley/itty-router): 轻量级 Worker 路由器
- [nanoid](https://github.com/ai/nanoid): 小巧、安全的 URL友好型唯一ID生成器
- [GitHub Actions](https://github.com/features/actions): CI/CD 自动化部署

## 📄 许可

本项目采用 [MIT License](./LICENSE) 开源

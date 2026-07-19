import { Router } from 'itty-router';
import { customAlphabet } from 'nanoid';
import * as pageBuilder from './features/htmlBuilder.js';
import { ResponseBuilder } from './features/response.js';
import { blockBots } from './features/botBlocker.js';

// 使用不易混淆的字符集
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

const router = Router();

// 阻断爬虫
router.all('*', blockBots);

// robots.txt
router.get('/robots.txt', () => {
  const robotsTxt = `User-agent: *\nDisallow: /`;
  return new Response(robotsTxt, {
    headers: { 'Content-Type': 'text/plain' },
  });
});

// 首页
router.get('/', (request, env) => {
	const response = new ResponseBuilder(request, env);
	const html = pageBuilder.getHomepage();
	return response.html(html);
});

// 处理创建请求
router.post('/', async (request, env) => {
  const response = new ResponseBuilder(request, env);
  const url = new URL(request.url);
	const referer = request.headers.get('Referer');

  const formData = await request.formData();
	const token = formData.get('cf-turnstile-response');
	const ip = request.headers.get('CF-Connecting-IP');

	if (!token) {
		return response.error('人机验证失败，请刷新页面重试。', 400);
	}

	try {
		const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				secret: env.TURNSTILE_SECRET_KEY,
				response: token,
				remoteip: ip,
			}),
		});

		const outcome = await turnstileResponse.json();
		if (!outcome.success) {
			console.error('Turnstile verification failed:', outcome['error-codes']?.join(', '));
			return response.error('人机验证失败，请刷新页面重试。', 403);
		}
	} catch (err) {
		console.error('Error verifying Turnstile:', err);
		return response.error('无法验证请求来源，请稍后重试。', 500);
	}

	// 如果 Referer 头存在，它必须来自同源
	if (referer) {
		try {
			const refererOrigin = new URL(referer).origin;
			if (refererOrigin !== url.origin) {
				return response.error('不允许跨站请求。', 403);
			}
		} catch (err) {
			// 如果 Referer 格式不正确，也视为无效请求
			return response.error('无效的来源页面。', 400);
		}
	}

	const targetUrl = formData.get('url'); // 这里现在包含网址或任意纯文本
	const visitsInput = formData.get('visits');
	const noExpire = formData.get('no_expire') === 'on';

	// 【修改点 1】放宽限制：智能处理输入数据，不再一刀切地阻断非 URL 文本
	if (!targetUrl || targetUrl.trim() === '') {
		return response.error('提交的内容不能为空。', 400);
	}

	// 如果输入的内容碰巧符合 URL 格式，我们额外检查是否恶意循环指向本站
	try {
		const checkUrl = new URL(targetUrl.trim());
		if (['http:', 'https:'].includes(checkUrl.protocol) && checkUrl.hostname === url.hostname) {
			return response.error('不允许创建指向本站的循环链接。', 400);
		}
	} catch (err) {
		// 如果无法转为 URL，说明它是普通密码或大段文本，忽略该错误正常放行即可
	}

  let maxVisits;
	if (!visitsInput) {
		// 如果输入为空，则视为不限制次数
		maxVisits = -1;
	} else {
    // 使用正则表达式测试输入是否为纯数字
    if (!/^\d+$/.test(visitsInput)) {
      return response.error('访问次数必须是 1 到 99 之间的数字，或留空不填。', 400);
    }

		const parsedVisits = parseInt(visitsInput, 10);
		// 校验：必须是数字，且在 1-99 范围内
		if (isNaN(parsedVisits) || parsedVisits < 1 || parsedVisits > 99) {
			return response.error('访问次数必须是 1 到 99 之间的数字，或留空不填。', 400);
		}
		maxVisits = parsedVisits;
	}

  let id;
  let exists;
  do {
    id = nanoid();
    exists = await env.KV.get(id);
  } while (exists);

	const data = {
		url: targetUrl, // 统一存入 KV
		remainingVisits: maxVisits,
	};

	const options = {};
	if (!noExpire) {
		options.expirationTtl = env.DEFAULT_TTL_SECONDS || 43200;
	}

	await env.KV.put(id, JSON.stringify(data), options);

	const shortUrl = `${url.origin}/${id}`;
	const html = pageBuilder.getSuccessPage(shortUrl);

	return response.html(html);
});

// 处理跳转或文本提取展示请求
router.get('/:id', async ({ params, ...request }, env) => {
  const response = new ResponseBuilder(request, env);
	const id = params.id;
	const dataStr = await env.KV.get(id);

	if (!dataStr) {
		return response.error("此链接不存在或已被销毁。", 404);
	}

	let data;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    // 数据损坏
    await env.KV.delete(id); 
    return response.error("此链接数据已损坏。", 410);
  }

	if (data.remainingVisits !== -1) {
		if (data.remainingVisits <= 0) {
			await env.KV.delete(id);
			return response.error("此链接的访问次数已用尽。", 410);
		}

		if (data.remainingVisits === 1) {
			await env.KV.delete(id);
		} else {
			data.remainingVisits--;
			await env.KV.put(id, JSON.stringify(data));
		}
	}

	// 【修改点 2】智能分流分发：
	// 用正则判断内容是否为一个标准的 http:// 或 https:// 网址
	const contentStr = data.url ? data.url.trim() : '';
	const isStandardUrl = /^(http|https):\/\/[^\s$.?#].[^\s]*$/i.test(contentStr);

	if (isStandardUrl) {
		// 如果是标准的网址，仍然执行原有的 302 重定向跳转
		return response.redirect(contentStr, 302);
	} else {
		// 如果输入的是纯文本/密码等，渲染前面新添加的文本展示卡片 HTML
		const textHtml = pageBuilder.getTextViewPage(contentStr);
		return response.html(textHtml);
	}
});

// 404 页面
router.all('*', (request, env) => {
	const response = new ResponseBuilder(request, env);
	return response.html('404, Not Found.', 404);
});

export default {
  async fetch(request, env) {
		if (!env.KV) {
      // 兼容底层抛出错误函数的备用写法
      return new Response('服务配置错误：KV 命名空间未绑定。', { status: 500 });
		}
		return router.fetch(request, env);
	}
};

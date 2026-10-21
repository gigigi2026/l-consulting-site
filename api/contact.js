module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const endpoint = process.env.CONTACT_SCRIPT_URL || '';
  const secret = process.env.CONTACT_SECRET || '';
  const configured = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint) && secret.length >= 32;
  if (req.method === 'GET') return res.status(200).json({ ready: configured });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false }); }
  if (!configured) return res.status(503).json({ ok: false, message: '現在、受付の接続設定中です。時間をおいてお試しください。' });
  if (req.headers.origin !== 'https://l-consulting-site.vercel.app') return res.status(403).json({ ok: false, message: '公式HPから送信してください。' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || Buffer.byteLength(JSON.stringify(body)) > 24000) return res.status(400).json({ ok: false });
    const { name, email, message, requestId, website = '' } = body;
    if (website || typeof name !== 'string' || !name.trim() || name.length > 100 ||
        typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof message !== 'string' || !message.trim() || message.length > 5000 ||
        typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) return res.status(400).json({ ok: false, message: 'お名前・メールアドレス・お問い合わせ内容を確認してください。' });
    const upstream = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, name: name.trim(), email: email.trim(), message: message.trim(), requestId }), signal: AbortSignal.timeout(25000) });
    if (!upstream.ok) throw new Error('upstream');
    const result = await upstream.json();
    if (result.ok === true && result.requestId === requestId) return res.status(200).json({ ok: true, requestId });
    if (result.code === 'rate_limit') return res.status(429).json({ ok: false, message: '送信回数の上限に達しました。時間をおいてお試しください。' });
    throw new Error('not_saved');
  } catch {
    return res.status(502).json({ ok: false, message: '受付結果を確認できませんでした。入力内容を残しています。同じ内容でもう一度送信してください。' });
  }
};

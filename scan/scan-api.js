// scan-api.js — talks to the vision model. Only this file knows about OpenRouter / Gemini,
// so it can later be pointed at a backend proxy without touching the UI.
(function (global) {
  'use strict';

  const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const TIMEOUT_MS = 60000;

  class ScanError extends Error {
    constructor(code, message, raw) {
      super(message);
      // 'no-key' | 'auth' | 'credits' | 'quota' | 'no-vision' | 'timeout' | 'network' | 'http' | 'empty'
      this.code = code;
      this.raw = raw || '';
    }
  }

  // ---------- OpenRouter (OpenAI-compatible) ----------
  function openRouterRequest(dataUrl, settings, S) {
    return {
      url: ENDPOINT,
      headers: {
        'Authorization': 'Bearer ' + settings.apiKey,
        'Content-Type': 'application/json',
        'X-Title': 'WhatsInTheFridge'
      },
      body: {
        model: settings.model || S.PROVIDERS.openrouter.defaultModel,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: S.PHOTO_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }]
      }
    };
  }

  function openRouterError(status, text) {
    if (status === 401 || status === 403) return new ScanError('auth', 'API key was rejected. Check it in Settings.', text);
    if (status === 402) return new ScanError('credits', 'This model is paid and your account has no credits. Pick a model whose ID ends with ":free", or add credits on OpenRouter.', text);
    if (status === 429) return new ScanError('quota', 'Free quota or rate limit reached. Try later or switch model.', text);
    if (/image input/i.test(text)) return new ScanError('no-vision', 'This model cannot read images. Pick a model with "image" in its input modalities on openrouter.ai/models.', text);
    return new ScanError('http', `Request failed (${status}). The model ID may be wrong or unavailable.`, text);
  }

  function openRouterContent(data) {
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    return msg ? String(msg.content || '') : '';
  }

  // ---------- Google Gemini (native generateContent API) ----------
  function geminiRequest(dataUrl, settings, S) {
    const model = String(settings.model || S.PROVIDERS.gemini.defaultModel).replace(/^models\//, '');
    const m = String(dataUrl).match(/^data:([^;]+);base64,(.*)$/);
    return {
      url: GEMINI_BASE + encodeURIComponent(model) + ':generateContent',
      headers: {
        'x-goog-api-key': settings.apiKey,
        'Content-Type': 'application/json'
      },
      body: {
        contents: [{
          role: 'user',
          parts: [
            { text: S.PHOTO_PROMPT },
            { inline_data: { mime_type: m ? m[1] : 'image/jpeg', data: m ? m[2] : '' } }
          ]
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      }
    };
  }

  function geminiError(status, text) {
    let st = '', msg = '';
    try { const e = JSON.parse(text).error || {}; st = e.status || ''; msg = e.message || ''; } catch (e) { /* not JSON */ }
    if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID/i.test(text)) {
      return new ScanError('auth', 'Google rejected the API key. Check it in Settings (aistudio.google.com/apikey).', text);
    }
    if (status === 429 || st === 'RESOURCE_EXHAUSTED') {
      return new ScanError('quota', 'Gemini free quota or rate limit reached. Wait a minute, or try another Gemini model.', text);
    }
    if (status === 404 || st === 'NOT_FOUND') {
      return new ScanError('http', 'Gemini model not found. Check the model name in Google AI Studio and update it in Settings.', text);
    }
    if (/model name format/i.test(msg)) {
      return new ScanError('bad-model', 'That is not a valid Gemini model ID. Use the ID (e.g. gemini-2.5-flash), not the display name — click "Load models" in Settings to pick one.', text);
    }
    if (/location is not supported/i.test(msg)) {
      return new ScanError('http', 'Gemini API is not available in your region.', text);
    }
    return new ScanError('http', `Request failed (${status}).${msg ? ' ' + msg : ''}`, text);
  }

  function geminiContent(data) {
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts;
    if (!Array.isArray(parts)) return '';
    return parts.filter(p => p && typeof p.text === 'string' && !p.thought).map(p => p.text).join('');
  }

  const ADAPTERS = {
    openrouter: { request: openRouterRequest, error: openRouterError, content: openRouterContent },
    gemini: { request: geminiRequest, error: geminiError, content: geminiContent }
  };

  // Model IDs never contain spaces; a space usually means a display name was pasted.
  // Returns an error message, or '' when the ID looks fine.
  function checkModelId(model) {
    const m = String(model || '').trim();
    if (!m) return '';
    if (/\s/.test(m)) {
      return `"${m}" looks like a display name. Use the model ID instead (e.g. gemini-2.5-flash or google/gemma-4-31b-it:free) — click "Load models" to pick one.`;
    }
    return '';
  }

  // Lists image-capable models: [{ id, label }]. Throws ScanError.
  async function listModels(provider, apiKey, fetchImpl = global.fetch.bind(global)) {
    let res, text;
    try {
      if (provider === 'gemini') {
        if (!apiKey) throw new ScanError('no-key', 'Enter your Google AI Studio API key first.');
        res = await fetchImpl(GEMINI_BASE.replace(/\/$/, '') + '?pageSize=1000', { headers: { 'x-goog-api-key': apiKey } });
      } else {
        res = await fetchImpl('https://openrouter.ai/api/v1/models');
      }
      text = await res.text();
    } catch (e) {
      if (e instanceof ScanError) throw e;
      throw new ScanError('network', 'Network error while loading models.');
    }
    if (!res.ok) {
      throw provider === 'gemini' ? geminiError(res.status, text) : openRouterError(res.status, text);
    }
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new ScanError('http', 'Could not read the model list.', text); }

    if (provider === 'gemini') {
      return (data.models || [])
        .filter(m => m && typeof m.name === 'string'
          && (m.supportedGenerationMethods || []).includes('generateContent')
          && !/embedding|aqa|imagen|veo|tts|image-generation/i.test(m.name))
        .map(m => {
          const id = m.name.replace(/^models\//, '');
          return { id, label: m.displayName ? `${m.displayName} (${id})` : id };
        });
    }
    return (data.data || [])
      .filter(m => m && typeof m.id === 'string' && /:free$/.test(m.id)
        && m.architecture && (m.architecture.input_modalities || []).includes('image')
        && (m.architecture.output_modalities || ['text']).includes('text'))
      .map(m => ({ id: m.id, label: m.name ? `${m.name} (${m.id})` : m.id }));
  }

  // Returns { names, raw, ms }. Throws ScanError.
  async function recognizeImage(dataUrl, settings, fetchImpl = global.fetch.bind(global)) {
    const S = global.ScanCore;
    const provider = settings && ADAPTERS[settings.provider] ? settings.provider : 'openrouter';
    const label = S.PROVIDERS[provider].label;
    if (!settings || !settings.apiKey) {
      throw new ScanError('no-key', `Please save your ${label} API key in Settings first.`);
    }
    const modelErr = checkModelId(settings.model);
    if (modelErr) throw new ScanError('bad-model', modelErr);

    const adapter = ADAPTERS[provider];
    const req = adapter.request(dataUrl, settings, S);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const t0 = Date.now();
    let res;
    try {
      res = await fetchImpl(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body),
        signal: controller.signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw new ScanError('timeout', `The model took too long (${TIMEOUT_MS / 1000}s). Try again or pick another model.`);
      }
      throw new ScanError('network', 'Network error — check your connection.');
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    const ms = Date.now() - t0;
    if (!res.ok) throw adapter.error(res.status, text);

    let content = '';
    try { content = adapter.content(JSON.parse(text)); } catch (e) { content = ''; }

    const names = S.parseNames(content);
    if (!names.length) {
      throw new ScanError('empty', 'No food items were recognized. Try a clearer photo, or add items manually.', content || text);
    }
    return { names, raw: content, ms };
  }

  global.ScanApi = { recognizeImage, listModels, checkModelId, ScanError, ENDPOINT, GEMINI_BASE };
})(window);

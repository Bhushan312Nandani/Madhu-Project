// backend/services/aiModeration.js
// Message validation & spam/abuse filtering using Hugging Face Inference API + intelligent NLP heuristics

/**
 * Validates whether a contact inquiry is a genuine, polite, coherent customer inquiry
 * rather than spam, abuse, random keystrokes/gibberish, or irrelevant junk.
 * 
 * @param {string} message - Customer inquiry text
 * @param {string} [name] - Customer name
 * @param {string} [phone] - Customer phone
 * @returns {Promise<{ isValid: boolean, reason?: string, confidence?: number, category?: string }>}
 */
export async function validateMessageWithAI(message, name = "", phone = "") {
  if (!message || typeof message !== "string") {
    return {
      isValid: false,
      reason: "Message cannot be empty. Please enter your question or inquiry.",
    };
  }

  const trimmed = message.trim();

  // ─── 1. Basic length & word count checks ──────────────────────────────────
  if (trimmed.length < 6) {
    return {
      isValid: false,
      reason: "Message is too short. Please write at least 6 characters describing your inquiry.",
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return {
      isValid: false,
      reason: "Please write a complete inquiry with at least 2–3 meaningful words.",
    };
  }

  // ─── 2. Keystroke mashing & Gibberish detection ─────────────────────────────
  // Detect same character repeated 5+ times (e.g. "aaaaaa", "zzzzzz", "......")
  if (/(.)\1{4,}/i.test(trimmed)) {
    return {
      isValid: false,
      reason: "Please avoid repeated characters and write a genuine inquiry.",
    };
  }

  // Detect keyboard row smashing (e.g. "asdfghjkl", "qwertyuiop", "zxcvbnm")
  const keyboardMashes = [
    /asdfgh/i, /sdfghj/i, /dfghjk/i, /qwerty/i, /wertyu/i,
    /zxcvbn/i, /123456/i, /abcdef/i, /qazwsx/i
  ];
  if (keyboardMashes.some(pattern => pattern.test(trimmed))) {
    return {
      isValid: false,
      reason: "Please write a clear message about products, orders, or inquiries instead of random keys.",
    };
  }

  // Ratio of vowels to consonants in alphabetic characters (detect random consonant strings like "bcdfghjkl")
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (lettersOnly.length > 10) {
    const vowels = (lettersOnly.match(/[aeiou]/g) || []).length;
    const vowelRatio = vowels / lettersOnly.length;
    if (vowelRatio < 0.12 && lettersOnly.length > 12) {
      return {
        isValid: false,
        reason: "Message appears to be unreadable random characters. Please write a clear message in English or Urdu.",
      };
    }
  }

  // ─── 3. Abusive, Scam & Spam blacklist ────────────────────────────────────
  const spamPatterns = [
    /\b(crypto|bitcoin|forex|invest\s+\$\d+|casino|betting|porn|xxx|viagra|loan\s+approved|click\s+here\s+now)\b/i,
    /\b(hack|whatsapp\s+hack|free\s+money|lottery\s+winner|earn\s+\$\d+)\b/i,
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        reason: "Inappropriate or spam promotional content is not allowed.",
      };
    }
  }

  // ─── 4. Hugging Face Serverless Inference API ──────────────────────────────
  // Use Hugging Face zero-shot classification to verify message relevance
  const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "";
  
  try {
    const modelEndpoint = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli";
    const candidateLabels = [
      "customer inquiry about cooking oils or products",
      "bulk wholesale or export order inquiry",
      "random spam or abusive nonsense"
    ];

    const headers = { "Content-Type": "application/json" };
    if (hfToken) {
      headers["Authorization"] = `Bearer ${hfToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for fast response

    const response = await fetch(modelEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        inputs: trimmed,
        parameters: { candidate_labels: candidateLabels },
      }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = await response.json();
      if (data && data.labels && data.scores) {
        const topLabel = data.labels[0];
        const topScore = data.scores[0];

        // If Hugging Face is confident (> 65%) that it's spam or abusive nonsense
        if (topLabel.includes("spam or abusive") && topScore > 0.65) {
          return {
            isValid: false,
            reason: "Message was identified as spam or irrelevant by AI moderation. Please describe your product or order inquiry.",
            confidence: topScore,
          };
        }

        return {
          isValid: true,
          confidence: topScore,
          category: topLabel,
        };
      }
    }
  } catch (hfErr) {
    // If Hugging Face is unreachable or rate-limited, the local heuristics above already passed!
    console.warn("[AI Moderation] Hugging Face API skipped or fallback:", hfErr.message);
  }

  // Default passed through NLP heuristics
  return {
    isValid: true,
    confidence: 0.9,
    category: "Customer Inquiry",
  };
}

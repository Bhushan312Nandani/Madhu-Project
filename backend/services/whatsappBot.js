// backend/services/whatsappBot.js
// Full WhatsApp Admin Bot — controls entire store via WhatsApp messages
// SECURE: Only admin phone number can issue commands

import prisma from "../lib/prisma.js";
import { generateProductInfo } from "./geminiVision.js";
import { uploadProductImage, deleteImage, urlToKey } from "./s3Upload.js";
import { sendWhatsAppMessage, downloadWhatsAppMedia } from "./whatsappApi.js";

// Admin number (from env — set to 03332529504 or with country code 923332529504)
const ADMIN_NUMBERS = (process.env.WHATSAPP_ADMIN_NUMBERS || "")
  .split(",")
  .map(n => n.trim().replace(/^\+/, "").replace(/^0/, "92"));

// ─── Main Handler ────────────────────────────────────────────────────────────

/**
 * Process an incoming WhatsApp message
 * @param {object} message - Meta webhook message object
 */
export async function handleWhatsAppMessage(message) {
  const from = message.from; // e.g. "923332529504"

  // Security: Only admin number allowed
  if (!isAdmin(from)) {
    console.warn(`[WA Bot] Unauthorized access attempt from: ${from}`);
    await sendWhatsAppMessage(from,
      "⛔ Access denied. This is a private admin bot.\n\nFor orders or queries, visit our website."
    );
    return;
  }

  const msgType = message.type;

  try {
    // ─── Image message → Add Product ─────────────────────────────────────────
    if (msgType === "image") {
      await handleImageMessage(from, message.image, message.image?.caption || "");
      return;
    }

    // ─── Text message → Parse Command ────────────────────────────────────────
    if (msgType === "text") {
      const text = message.text.body.trim();
      await handleTextCommand(from, text);
      return;
    }

    await sendWhatsAppMessage(from, "ℹ️ Send an image to add a product, or text a command.\n\nSend *help* to see all commands.");

  } catch (err) {
    console.error("[WA Bot] Handler error:", err);
    await sendWhatsAppMessage(from, `❌ Error: ${err.message}\n\nPlease try again or check the command format.`);

    // Log the error
    await prisma.whatsappLog.create({
      data: { from, message: JSON.stringify(message), action: "error", success: false, response: err.message }
    }).catch(() => {});
  }
}

// ─── Image Handler (Add Product) ─────────────────────────────────────────────

async function handleImageMessage(from, imageObj, caption) {
  await sendWhatsAppMessage(from, "🔄 Processing image... AI is analyzing your product...");

  // 1. Download image from WhatsApp
  const imageBuffer = await downloadWhatsAppMedia(imageObj.id);

  // 2. Generate product info with Gemini Vision
  await sendWhatsAppMessage(from, "🤖 Gemini AI generating product description...");
  const productInfo = await generateProductInfo(imageBuffer, "image/jpeg", caption);

  // 3. Upload to S3
  await sendWhatsAppMessage(from, "☁️ Uploading to AWS S3...");
  const { url: imageUrl, key } = await uploadProductImage(imageBuffer, productInfo.slug);

  // 4. Parse price from caption (e.g. "sarson oil 500ml 850")
  const price = extractPrice(caption) || 0;
  const weight = extractWeight(caption) || productInfo.weight || "";
  const name = extractName(caption) || productInfo.name;

  // 5. Create product in DB
  let slug = productInfo.slug || slugify(name);
  // Ensure slug is unique
  const existingSlug = await prisma.product.findUnique({ where: { slug } });
  if (existingSlug) slug = `${slug}-${Date.now()}`;

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      description: productInfo.description,
      shortDesc: productInfo.shortDesc,
      price: price > 0 ? price : 0,
      stock: 100,
      category: productInfo.category || "oils",
      images: [imageUrl],
      mainImage: imageUrl,
      benefits: productInfo.benefits || [],
      tags: productInfo.tags || [],
      weight,
      aiDescription: productInfo.description,
      isActive: price > 0, // only activate if price is set
    }
  });

  const status = price > 0 ? "✅ *LIVE* on website!" : "⚠️ *Saved as DRAFT* (set price to activate)";

  await sendWhatsAppMessage(from,
    `✅ *Product Added Successfully!*\n\n` +
    `📦 *Name:* ${product.name}\n` +
    `💰 *Price:* ${price > 0 ? `PKR ${price}` : "Not set — send: price ${product.id} 850"}\n` +
    `🏷️ *Category:* ${product.category}\n` +
    `📝 *Description:* ${productInfo.shortDesc}\n` +
    `🔑 *Benefits:* ${(productInfo.benefits || []).slice(0, 3).join(", ")}\n` +
    `🆔 *Product ID:* ${product.id}\n\n` +
    `${status}\n\n` +
    `To update price: *price ${product.id} 850*\n` +
    `To set stock: *stock ${product.id} 50*`
  );

  await logAction(from, `add_product:${product.id}`, true, product.name);
}

// ─── Text Command Handler ─────────────────────────────────────────────────────

async function handleTextCommand(from, text) {
  const lower = text.toLowerCase().trim();
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  // ─── HELP ──────────────────────────────────────────────────────────────────
  if (cmd === "help" || cmd === "commands") {
    await sendWhatsAppMessage(from, HELP_TEXT);
    return;
  }

  // ─── STATS ─────────────────────────────────────────────────────────────────
  if (cmd === "stats" || cmd === "dashboard") {
    await handleStats(from);
    return;
  }

  // ─── ORDERS ────────────────────────────────────────────────────────────────
  if (cmd === "orders") {
    const period = parts[1] || "today";
    await handleOrders(from, period);
    return;
  }

  // ─── LIST PRODUCTS ─────────────────────────────────────────────────────────
  if (cmd === "list" && parts[1] === "products") {
    await handleListProducts(from);
    return;
  }

  // ─── PRICE UPDATE ──────────────────────────────────────────────────────────
  // Format: price <id-or-slug> <amount>
  if (cmd === "price") {
    const identifier = parts[1];
    const amount = parseFloat(parts[2]);
    if (!identifier || isNaN(amount)) {
      await sendWhatsAppMessage(from, "❌ Format: *price <product-id-or-slug> <amount>*\nExample: price sarson-oil 850");
      return;
    }
    await handlePriceUpdate(from, identifier, amount);
    return;
  }

  // ─── STOCK UPDATE ──────────────────────────────────────────────────────────
  // Format: stock <id-or-slug> <quantity>
  if (cmd === "stock") {
    const identifier = parts[1];
    const qty = parseInt(parts[2]);
    if (!identifier || isNaN(qty)) {
      await sendWhatsAppMessage(from, "❌ Format: *stock <product-id-or-slug> <quantity>*\nExample: stock sarson-oil 50");
      return;
    }
    await handleStockUpdate(from, identifier, qty);
    return;
  }

  // ─── DELETE PRODUCT ────────────────────────────────────────────────────────
  // Format: delete <id-or-slug>
  if (cmd === "delete") {
    const identifier = parts[1];
    if (!identifier) {
      await sendWhatsAppMessage(from, "❌ Format: *delete <product-id-or-slug>*");
      return;
    }
    await handleDeleteProduct(from, identifier);
    return;
  }

  // ─── ACTIVATE / DEACTIVATE ─────────────────────────────────────────────────
  if (cmd === "activate" || cmd === "deactivate") {
    const identifier = parts[1];
    await handleToggleProduct(from, identifier, cmd === "activate");
    return;
  }

  // ─── FLASH SALE ────────────────────────────────────────────────────────────
  // Format: flash <slug> <discount%> <hours>
  if (cmd === "flash") {
    const slug = parts[1];
    const discount = parseInt(parts[2]);
    const hours = parseInt(parts[3]) || 24;
    await handleFlashSale(from, slug, discount, hours);
    return;
  }

  // ─── ORDER STATUS UPDATE ───────────────────────────────────────────────────
  // Format: ship <order-id> <tracking-number>
  if (cmd === "ship") {
    const orderId = parts[1];
    const tracking = parts[2] || "";
    await handleShipOrder(from, orderId, tracking);
    return;
  }

  // ─── REVENUE ───────────────────────────────────────────────────────────────
  if (cmd === "revenue") {
    const period = parts[1] || "month";
    await handleRevenue(from, period);
    return;
  }

  // ─── PRODUCT DETAILS ───────────────────────────────────────────────────────
  if (cmd === "info") {
    const identifier = parts[1];
    await handleProductInfo(from, identifier);
    return;
  }

  // ─── UNKNOWN ───────────────────────────────────────────────────────────────
  await sendWhatsAppMessage(from,
    `❓ Unknown command: *${cmd}*\n\nSend *help* to see all available commands.`
  );
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

async function handleStats(from) {
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const [totalUsers, totalProducts, todayOrders, totalRevenue, pendingOrders] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { paymentStatus: "PAID" }
    }),
    prisma.order.count({ where: { status: "PENDING" } }),
  ]);

  const revenue = totalRevenue._sum.total || 0;

  await sendWhatsAppMessage(from,
    `📊 *MadhuShud Dashboard*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👥 Total Users: *${totalUsers}*\n` +
    `📦 Active Products: *${totalProducts}*\n` +
    `🛒 Today's Orders: *${todayOrders}*\n` +
    `⏳ Pending Orders: *${pendingOrders}*\n` +
    `💰 Total Revenue: *PKR ${Number(revenue).toLocaleString()}*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `⏰ Updated: ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`
  );
}

async function handleOrders(from, period) {
  let where = {};
  const now = new Date();

  if (period === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    where.createdAt = { gte: start };
  } else if (period === "week") {
    const start = new Date(now); start.setDate(start.getDate() - 7);
    where.createdAt = { gte: start };
  } else if (period === "month") {
    const start = new Date(now); start.setMonth(start.getMonth() - 1);
    where.createdAt = { gte: start };
  } else if (period === "pending") {
    where.status = "PENDING";
  }

  const orders = await prisma.order.findMany({
    where,
    include: { user: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (orders.length === 0) {
    await sendWhatsAppMessage(from, `📭 No orders found for: *${period}*`);
    return;
  }

  const total = orders.reduce((sum, o) => sum + Number(o.total), 0);
  let msg = `📦 *Orders (${period})* — ${orders.length} orders\n💰 Total: PKR ${total.toLocaleString()}\n━━━━━━━━━━━━━━━━━━\n`;

  orders.slice(0, 8).forEach((o, i) => {
    msg += `${i + 1}. *#${o.orderNumber?.slice(-6) || o.id.slice(-6)}* — PKR ${Number(o.total).toLocaleString()}\n`;
    msg += `   👤 ${o.user?.name || "Guest"} | 📞 ${o.user?.phone || ""}\n`;
    msg += `   Status: ${o.status} | ${new Date(o.createdAt).toLocaleDateString("en-PK")}\n`;
  });

  if (orders.length > 8) msg += `\n...and ${orders.length - 8} more orders`;

  await sendWhatsAppMessage(from, msg);
}

async function handleListProducts(from) {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, price: true, stock: true, isActive: true, slug: true }
  });

  if (products.length === 0) {
    await sendWhatsAppMessage(from, "📭 No products found.");
    return;
  }

  let msg = `📦 *Products (${products.length})*\n━━━━━━━━━━━━━━━━\n`;
  products.forEach((p, i) => {
    const status = p.isActive ? "✅" : "⏸";
    msg += `${status} ${p.name}\n   PKR ${Number(p.price)} | Stock: ${p.stock} | ID: \`${p.slug}\`\n`;
  });
  msg += `\nTo update: *price <slug> <amount>*`;

  await sendWhatsAppMessage(from, msg);
}

async function handlePriceUpdate(from, identifier, amount) {
  const product = await findProduct(identifier);
  if (!product) {
    await sendWhatsAppMessage(from, `❌ Product not found: *${identifier}*\n\nSend *list products* to see all slugs/IDs.`);
    return;
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { price: amount, isActive: true }
  });

  await sendWhatsAppMessage(from,
    `✅ *Price Updated!*\n\n📦 ${product.name}\n💰 New price: *PKR ${amount}*\n🌐 Live on website!`
  );
  await logAction(from, `price_update:${product.id}:${amount}`, true);
}

async function handleStockUpdate(from, identifier, qty) {
  const product = await findProduct(identifier);
  if (!product) {
    await sendWhatsAppMessage(from, `❌ Product not found: *${identifier}*`);
    return;
  }

  await prisma.product.update({ where: { id: product.id }, data: { stock: qty } });
  await sendWhatsAppMessage(from, `✅ *Stock Updated!*\n\n📦 ${product.name}\n📊 New stock: *${qty} units*`);
  await logAction(from, `stock_update:${product.id}:${qty}`, true);
}

async function handleDeleteProduct(from, identifier) {
  const product = await findProduct(identifier);
  if (!product) {
    await sendWhatsAppMessage(from, `❌ Product not found: *${identifier}*`);
    return;
  }

  // Soft delete (deactivate) — safer than hard delete
  await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

  await sendWhatsAppMessage(from,
    `🗑️ *Product Deactivated!*\n\n📦 ${product.name}\n\nProduct hidden from website. To restore: *activate ${identifier}*`
  );
  await logAction(from, `deactivate:${product.id}`, true);
}

async function handleToggleProduct(from, identifier, activate) {
  const product = await findProduct(identifier);
  if (!product) {
    await sendWhatsAppMessage(from, `❌ Product not found: *${identifier}*`);
    return;
  }

  await prisma.product.update({ where: { id: product.id }, data: { isActive: activate } });
  const status = activate ? "✅ ACTIVATED — Live on website!" : "⏸ DEACTIVATED — Hidden from website";
  await sendWhatsAppMessage(from, `${status}\n\n📦 ${product.name}`);
}

async function handleFlashSale(from, slug, discount, hours) {
  if (!slug || isNaN(discount) || discount < 1 || discount > 90) {
    await sendWhatsAppMessage(from, "❌ Format: *flash <slug> <discount%> <hours>*\nExample: flash sarson-oil 20 24");
    return;
  }

  const product = await findProduct(slug);
  if (!product) {
    await sendWhatsAppMessage(from, `❌ Product not found: *${slug}*`);
    return;
  }

  const salePrice = Number(product.price) * (1 - discount / 100);
  const flashSaleEnd = new Date(Date.now() + hours * 60 * 60 * 1000);

  await prisma.product.update({
    where: { id: product.id },
    data: {
      isFlashSale: true,
      flashDiscount: discount,
      salePrice: Math.round(salePrice),
      flashSaleEnd,
    }
  });

  await sendWhatsAppMessage(from,
    `🔥 *Flash Sale Started!*\n\n` +
    `📦 ${product.name}\n` +
    `💰 Original: PKR ${Number(product.price)}\n` +
    `🏷️ Sale Price: PKR ${Math.round(salePrice)} (${discount}% off)\n` +
    `⏰ Ends: ${flashSaleEnd.toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`
  );
}

async function handleShipOrder(from, orderId, tracking) {
  const order = await prisma.order.findFirst({
    where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
    include: { user: { select: { name: true } } }
  });

  if (!order) {
    await sendWhatsAppMessage(from, `❌ Order not found: *${orderId}*`);
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "SHIPPED", trackingNumber: tracking }
  });

  await sendWhatsAppMessage(from,
    `🚚 *Order Shipped!*\n\n` +
    `🆔 Order: #${order.orderNumber?.slice(-6) || order.id.slice(-6)}\n` +
    `👤 Customer: ${order.user?.name}\n` +
    `📦 Tracking: ${tracking || "Not provided"}`
  );
}

async function handleRevenue(from, period) {
  const now = new Date();
  let start;

  if (period === "today") { start = new Date(now); start.setHours(0, 0, 0, 0); }
  else if (period === "week") { start = new Date(now); start.setDate(start.getDate() - 7); }
  else { start = new Date(now); start.setMonth(start.getMonth() - 1); }

  const result = await prisma.order.aggregate({
    _sum: { total: true },
    _count: { id: true },
    where: { paymentStatus: "PAID", createdAt: { gte: start } }
  });

  await sendWhatsAppMessage(from,
    `💰 *Revenue (${period})*\n━━━━━━━━━━━━━\n` +
    `Total: *PKR ${Number(result._sum.total || 0).toLocaleString()}*\n` +
    `Orders: *${result._count.id}*\n` +
    `Avg/Order: *PKR ${result._count.id ? Math.round(Number(result._sum.total || 0) / result._count.id).toLocaleString() : 0}*`
  );
}

async function handleProductInfo(from, identifier) {
  const product = await findProduct(identifier);
  if (!product) {
    await sendWhatsAppMessage(from, `❌ Product not found: *${identifier}*`);
    return;
  }

  await sendWhatsAppMessage(from,
    `📦 *${product.name}*\n━━━━━━━━━━━━━━━\n` +
    `💰 Price: PKR ${Number(product.price)}\n` +
    `📊 Stock: ${product.stock}\n` +
    `⭐ Rating: ${Number(product.rating).toFixed(1)} (${product.reviewCount} reviews)\n` +
    `🏷️ Category: ${product.category}\n` +
    `🔥 Flash Sale: ${product.isFlashSale ? `Yes (${product.flashDiscount}% off)` : "No"}\n` +
    `✅ Active: ${product.isActive ? "Yes" : "No"}\n` +
    `📦 Sold: ${product.soldCount}\n` +
    `🆔 Slug: ${product.slug}`
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAdmin(from) {
  // Normalize: remove +, leading 0 → 92
  const normalized = from.replace(/^\+/, "").replace(/^0/, "92");
  return ADMIN_NUMBERS.includes(normalized) || ADMIN_NUMBERS.includes(from);
}

async function findProduct(identifier) {
  if (!identifier) return null;
  // Try by ID first, then slug
  return await prisma.product.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] }
  });
}

function extractPrice(text) {
  const match = text.match(/\b(\d{3,6})\b/g);
  if (!match) return null;
  // Return largest number that's a reasonable price
  const prices = match.map(Number).filter(n => n >= 50 && n <= 99999);
  return prices.length ? Math.max(...prices) : null;
}

function extractWeight(text) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|g|kg|oz|lb)\b/i);
  return match ? match[0] : null;
}

function extractName(text) {
  // Remove price and weight patterns, return remaining as name
  return text
    .replace(/\b\d{3,6}\b/g, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:ml|l|g|kg|oz|lb)\b/gi, "")
    .trim()
    .replace(/\s+/g, " ") || null;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function logAction(from, action, success, response = "") {
  await prisma.whatsappLog.create({
    data: { from, message: action, action, success, response }
  }).catch(() => {});
}

// ─── Help Text ────────────────────────────────────────────────────────────────

const HELP_TEXT = `🤖 *MadhuShud Admin Bot*
━━━━━━━━━━━━━━━━━━━━━

📦 *PRODUCTS*
• Send [Image] + caption → Auto-add product
  Caption: "sarson oil 500ml 850"
• list products → See all products
• info <slug> → Product details
• price <slug> <amount> → Update price
• stock <slug> <qty> → Update stock
• delete <slug> → Deactivate product
• activate <slug> → Re-activate product
• flash <slug> <discount%> <hours> → Flash sale

📊 *ORDERS*
• orders today / week / month / pending
• ship <order-id> <tracking>

💰 *REPORTS*
• stats → Dashboard overview
• revenue today / week / month

━━━━━━━━━━━━━━━━━━━━━
*Examples:*
→ [Photo] + "mustard oil 250ml 450"
→ price sarson-oil 900
→ flash coconut-oil 25 12
→ orders today
→ stats`;

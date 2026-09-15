// backend/prisma/seed.js
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

async function main() {
  console.log("🌱 Seeding database...");
  const dataPath = path.join(__dirname, "../data/products.json");
  const rawData = fs.readFileSync(dataPath, "utf-8");
  const products = JSON.parse(rawData);

  for (const item of products) {
    const slug = slugify(item.name) + "-" + item.id;
    const price = parseFloat(item.price) || 0;
    const salePrice = item.oldPrice ? parseFloat(item.oldPrice) : null;
    const stock = typeof item.stock === "number" ? item.stock : 50;
    const mainImage = item.image || (item.images && item.images[0]) || null;
    const images = item.images || (item.image ? [item.image] : []);

    await prisma.product.upsert({
      where: { slug },
      update: {
        name: item.name,
        description: item.description || item.name,
        price,
        salePrice,
        stock,
        category: item.category || "oils",
        images,
        mainImage,
        rating: parseFloat(item.rating) || 4.8,
        reviewCount: parseInt(item.reviews) || 10,
        sku: `SKU-${item.id}`,
      },
      create: {
        name: item.name,
        slug,
        description: item.description || item.name,
        price,
        salePrice,
        stock,
        category: item.category || "oils",
        images,
        mainImage,
        rating: parseFloat(item.rating) || 4.8,
        reviewCount: parseInt(item.reviews) || 10,
        sku: `SKU-${item.id}`,
        isFeatured: true,
      },
    });
  }

  console.log(`✅ Seeded ${products.length} products successfully!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// backend/config/db.js
// Dual-mode DB connection:
//   1. PostgreSQL via Prisma (primary — for production AWS)
//   2. MongoDB via Mongoose (fallback — for legacy/local dev)

import prisma from "../lib/prisma.js";

let mongoose = null;
let mongoConnected = false;

export const dbMode = process.env.DATABASE_URL ? "postgres" : "mongo";

const connectDB = async () => {
  // ─── PostgreSQL / Prisma ────────────────────────────────────────────────────
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$connect();
      const result = await prisma.$queryRaw`SELECT version()`;
      const version = result?.[0]?.version?.split(" ").slice(0, 2).join(" ");
      console.log(`✅ PostgreSQL Connected: ${version}`);
      console.log(`🗃️  ORM: Prisma`);
      return prisma;
    } catch (err) {
      console.error(`❌ PostgreSQL Connection Error: ${err.message}`);
      console.log("⚠️  Falling back to MongoDB...");
    }
  }

  // ─── MongoDB / Mongoose (fallback) ────────────────────────────────────────
  try {
    const mongooseModule = await import("mongoose");
    mongoose = mongooseModule.default;
    const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/madhuoil";
    const conn = await mongoose.connect(mongoURI);
    mongoConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    console.log(`🗃️  ORM: Mongoose`);
    return conn;
  } catch (err) {
    console.error(`❌ MongoDB Error: ${err.message}`);
    console.log("⚠️  Running without DB — using JSON file fallback");
    return null;
  }
};

export default connectDB;

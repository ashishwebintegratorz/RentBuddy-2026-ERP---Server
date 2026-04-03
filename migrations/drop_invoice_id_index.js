// migrations/drop_invoice_id_index.js
// Run this script once to drop the problematic 'id_1' index from invoices collection

require("dotenv").config();
const mongoose = require("mongoose");

async function dropInvoiceIdIndex() {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("✅ Connected to MongoDB");

        const db = mongoose.connection.db;
        const invoicesCollection = db.collection("invoices");

        // List all indexes
        console.log("\n📋 Current indexes on 'invoices' collection:");
        const indexes = await invoicesCollection.indexes();
        indexes.forEach((index) => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });

        // Check if id_1 index exists
        const hasIdIndex = indexes.some((idx) => idx.name === "id_1");

        if (hasIdIndex) {
            console.log("\n🗑️  Dropping 'id_1' index...");
            await invoicesCollection.dropIndex("id_1");
            console.log("✅ Successfully dropped 'id_1' index");
        } else {
            console.log("\n✅ 'id_1' index does not exist (already dropped or never existed)");
        }

        // List indexes after dropping
        console.log("\n📋 Indexes after cleanup:");
        const updatedIndexes = await invoicesCollection.indexes();
        updatedIndexes.forEach((index) => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key));
        });

        console.log("\n✅ Migration completed successfully!");
    } catch (error) {
        console.error("\n❌ Migration failed:", error);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log("\n🔌 Disconnected from MongoDB");
    }
}

// Run the migration
dropInvoiceIdIndex()
    .then(() => {
        console.log("\n🎉 All done!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n💥 Fatal error:", err);
        process.exit(1);
    });

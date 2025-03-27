import "dotenv/config";

import express from "express";
import { CronJob } from "cron";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import hypixel from "./utils/hypixel.js";
import db from "./utils/db.js";

import initWS from "./utils/socket.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.__dirname = __dirname;

const app = express();
const server = http.createServer(app);

initWS(server);

// Record the items in the database. There's nothing else in main right now, but I'm prepairing the dataset while developing the full app.
if (process.env.NODE_ENV === "production") {
    // setInterval(recordPrices, 300 * 1000); // 5 minutes
    new CronJob("*/5 * * * *", recordPrices, null, true); // Run every 5 minutes
}

async function recordPrices() {
    try {
        console.log("Fetching Skyblock Bazaar data...");
        const items = await hypixel.getSkyblockBazaar();
        console.log(`Retrieved ${items.length} items from Bazaar`);
        // console.log(items[0]);
        // return;

        // Build values and query parts
        const valueParams = [];
        const valuePlaceholders = [];
        let paramIndex = 1;
        
        items.forEach(item => {
            if (!item?.product_id || !item?.quick_status) {
                // console.warn(`Skipping invalid item: ${JSON.stringify(item)}`);
                return;
            }
            
            // Add values to params array
            valueParams.push(
                item.product_id,
                item.quick_status.sellPrice || 0,
                item.quick_status.buyPrice || 0,
                item.quick_status.sellVolume || 0,
                item.quick_status.buyVolume || 0,
                item.quick_status.sellMovingWeek || 0,
                item.quick_status.buyMovingWeek || 0
            );
            
            // Create placeholders for this row
            const placeholders = [];
            for (let i = 0; i < 7; i++) {
                placeholders.push(`$${paramIndex++}`);
            }
            
            valuePlaceholders.push(`(${placeholders.join(', ')})`);
        });

        if (valueParams.length > 0) {
            const query = `
                INSERT INTO bazaar_records (
                    item_id, 
                    sell_price, 
                    buy_price, 
                    sell_volume, 
                    buy_volume, 
                    sell_moving_week, 
                    buy_moving_week
                ) VALUES ${valuePlaceholders.join(', ')}
            `;
            
            await db.query(query, valueParams);
            console.log(`Successfully recorded ${valuePlaceholders.length} items to database`);
        } else {
            console.warn("No valid items to record");
        }
    } catch (error) {
        console.error("Failed to record bazaar prices:", error);
    }
}

app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : 0);

// Use routers from ./routes
fs.readdir(path.join(__dirname, "routers"), (err, files) => {
    files.forEach(async (file) => {
        if (file.endsWith(".js") && !file.startsWith("_")) {
            const {
                default: { startingPath, router },
            } = await import(
                pathToFileURL(path.join(__dirname, "routers", file))
            );
            app.use(startingPath, router);
        }
    });
});

// Start the server
const port = parseInt(process.env.PORT ?? 3000);
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
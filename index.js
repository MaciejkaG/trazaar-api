import "dotenv/config";

import Hypixel from "./utils/hypixel.js";
import db from "./utils/db.js";

const hypixel = new Hypixel();

// Record the items in the database. There's nothing else in main right now, but I'm prepairing the dataset while developing the full app.
setInterval(recordPrices, 300 * 1000); // 5 minutes

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
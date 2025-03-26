import "dotenv/config";

import hypixel from "./utils/hypixel.js";
import db from "./utils/db.js";

const items = await hypixel.getSkyblockBazaar();
console.log(items.length);

// Record the items in the database. There's nothing else in main right now, but I'm prepairing the dataset while developing the full app.
setInterval(recordPrices, 30000);

async function recordPrices() {
    const items = await hypixel.getSkyblockBazaar();

    const values = items.map((item) => [
        item?.productId,
        item?.status?.sellPrice,
        item?.status?.buyPrice,
        item?.status?.sellVolume,
        item?.status?.buyVolume,
        item?.status?.sellMovingWeek,
        item?.status?.buyMovingWeek,
    ]);

    if (values.length > 0) {
        await db`
        INSERT INTO bazaar_records (
            item_id, 
            sell_price, 
            buy_price, 
            sell_volume, 
            buy_volume, 
            sell_moving_week, 
            buy_moving_week
        ) VALUES ${db(values)}`;
    }
}
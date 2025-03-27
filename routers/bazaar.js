import express from "express";

import db from "../utils/db.js";

const router = express.Router();

/**
 * Get price history for a specific item within a date range
 * @route GET /api/bazaar/history/:itemId
 * @param {string} itemId - The ID of the bazaar item
 * @query {string} startDate - Start date in ISO format (YYYY-MM-DD)
 * @query {string} endDate - End date in ISO format (YYYY-MM-DD)
 * @query {string} interval - Optional data interval (hourly, daily, raw) - defaults to hourly
 * @returns {Array} Price history points
 */
router.get("/history/:itemId", async (req, res) => {
    try {
        const itemId = req.params?.itemId
            ? req.params.itemId.toUpperCase()
            : null;
        const { startDate, endDate, interval = "hourly" } = req.query;

        if (!itemId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message:
                    "Missing one or more of required parameters: itemId, startDate, and endDate",
            });
        }

        let query;
        let params = [itemId, startDate, endDate];

        // Different queries based on requested interval using TimescaleDB features
        switch (interval) {
            case "raw":
                // Return all data points without aggregation
                query = `
          SELECT 
            timestamp, 
            buy_price, 
            sell_price, 
            buy_volume, 
            sell_volume
          FROM bazaar_records
          WHERE item_id = $1 
            AND timestamp BETWEEN $2 AND $3
          ORDER BY timestamp ASC
        `;
                break;

            case "daily":
                // Return daily aggregated data using TimescaleDB time_bucket
                query = `
          SELECT 
            time_bucket('1 day', timestamp) AS timestamp,
            AVG(buy_price) AS buy_price,
            AVG(sell_price) AS sell_price,
            SUM(buy_volume) AS buy_volume,
            SUM(sell_volume) AS sell_volume
          FROM bazaar_records
          WHERE item_id = $1
            AND timestamp BETWEEN $2 AND $3
          GROUP BY time_bucket('1 day', timestamp)
          ORDER BY timestamp ASC
        `;
                break;

            case "hourly":
            default:
                // Return hourly aggregated data using TimescaleDB time_bucket
                query = `
          SELECT 
            time_bucket('1 hour', timestamp) AS timestamp,
            AVG(buy_price) AS buy_price,
            AVG(sell_price) AS sell_price,
            SUM(buy_volume) AS buy_volume,
            SUM(sell_volume) AS sell_volume
          FROM bazaar_records
          WHERE item_id = $1
            AND timestamp BETWEEN $2 AND $3
          GROUP BY time_bucket('1 hour', timestamp)
          ORDER BY timestamp ASC
        `;
                break;
        }

        const result = await db.query(query, params);

        return res.status(200).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error("Error fetching bazaar price history:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
});

/**
 * Get latest prices for all bazaar items
 * @route GET /api/bazaar/latest
 * @returns {Array} Latest price data for all items
 */
router.get("/latest", async (req, res) => {
    try {
        const query = `
      WITH latest_timestamps AS (
        SELECT 
          item_id,
          MAX(timestamp) AS max_timestamp
        FROM bazaar_records
        GROUP BY item_id
      )
      SELECT 
        h.item_id, 
        h.timestamp, 
        h.buy_price, 
        h.sell_price, 
        h.buy_volume, 
        h.sell_volume
      FROM bazaar_records h
      JOIN latest_timestamps lt 
        ON h.item_id = lt.item_id 
        AND h.timestamp = lt.max_timestamp
    `;

        const result = await db.query(query);

        return res.status(200).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error("Error fetching latest bazaar prices:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
});

/**
 * Get summary statistics for an item
 * @route GET /api/bazaar/stats/:itemId
 * @param {string} itemId - The ID of the bazaar item
 * @query {string} period - Time period (day, week, month, year) - defaults to week
 * @returns {Object} Price statistics
 */
router.get("/stats/:itemId", async (req, res) => {
    try {
        const { itemId } = req.params;
        const { period = "week" } = req.query;

        if (!itemId) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameter: itemId",
            });
        }

        let interval;
        switch (period) {
            case "day":
                interval = "1 day";
                break;
            case "week":
                interval = "7 days";
                break;
            case "month":
                interval = "30 days";
                break;
            case "year":
                interval = "365 days";
                break;
            default:
                interval = "7 days";
        }

        const query = `
      SELECT 
        MIN(buy_price) AS min_buy_price,
        MAX(buy_price) AS max_buy_price,
        AVG(buy_price) AS avg_buy_price,
        MIN(sell_price) AS min_sell_price,
        MAX(sell_price) AS max_sell_price,
        AVG(sell_price) AS avg_sell_price,
        SUM(buy_volume) AS total_buy_volume,
        SUM(sell_volume) AS total_sell_volume
      FROM bazaar_records
      WHERE item_id = $1
        AND timestamp > NOW() - INTERVAL $2
    `;

        const result = await db.query(query, [itemId, interval]);

        return res.status(200).json({
            success: true,
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error fetching bazaar stats:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
});

/**
 * Get price trends for a specific item using TimescaleDB advanced analytics
 * @route GET /api/bazaar/trends/:itemId
 * @param {string} itemId - The ID of the bazaar item
 * @query {string} period - Time period (day, week, month, year) - defaults to week
 * @returns {Object} Trend data including moving averages and price changes
 */
router.get("/trends/:itemId", async (req, res) => {
    try {
        const { itemId } = req.params;
        const { period = "week" } = req.query;

        if (!itemId) {
            return res.status(400).json({
                success: false,
                message: "Missing required parameter: itemId",
            });
        }

        let interval, windowSize;
        switch (period) {
            case "day":
                interval = "1 day";
                windowSize = "3 hours";
                break;
            case "week":
                interval = "7 days";
                windowSize = "12 hours";
                break;
            case "month":
                interval = "30 days";
                windowSize = "1 day";
                break;
            case "year":
                interval = "365 days";
                windowSize = "7 days";
                break;
            default:
                interval = "7 days";
                windowSize = "12 hours";
        }

        const query = `
      WITH time_data AS (
        SELECT 
          time_bucket('1 hour', timestamp) AS bucket,
          AVG(buy_price) AS buy_price,
          AVG(sell_price) AS sell_price
        FROM bazaar_records
        WHERE item_id = $1
          AND timestamp > NOW() - INTERVAL $2
        GROUP BY bucket
        ORDER BY bucket
      )
      SELECT 
        bucket AS timestamp,
        buy_price,
        sell_price,
        AVG(buy_price) OVER (
          ORDER BY bucket 
          ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
        ) AS buy_price_ma6,
        AVG(sell_price) OVER (
          ORDER BY bucket 
          ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
        ) AS sell_price_ma6,
        AVG(buy_price) OVER (
          ORDER BY bucket 
          ROWS BETWEEN 23 PRECEDING AND CURRENT ROW
        ) AS buy_price_ma24,
        AVG(sell_price) OVER (
          ORDER BY bucket 
          ROWS BETWEEN 23 PRECEDING AND CURRENT ROW
        ) AS sell_price_ma24,
        -- Calculate price changes over time
        (buy_price - LAG(buy_price, 6) OVER (ORDER BY bucket)) / 
          NULLIF(LAG(buy_price, 6) OVER (ORDER BY bucket), 0) * 100 AS buy_price_pct_change_6h,
        (sell_price - LAG(sell_price, 6) OVER (ORDER BY bucket)) / 
          NULLIF(LAG(sell_price, 6) OVER (ORDER BY bucket), 0) * 100 AS sell_price_pct_change_6h,
        (buy_price - LAG(buy_price, 24) OVER (ORDER BY bucket)) / 
          NULLIF(LAG(buy_price, 24) OVER (ORDER BY bucket), 0) * 100 AS buy_price_pct_change_24h,
        (sell_price - LAG(sell_price, 24) OVER (ORDER BY bucket)) / 
          NULLIF(LAG(sell_price, 24) OVER (ORDER BY bucket), 0) * 100 AS sell_price_pct_change_24h
      FROM time_data
    `;

        const result = await db.query(query, [itemId, interval]);

        // Calculate additional trend metrics
        const trendData = result.rows;
        const latestData =
            trendData.length > 0 ? trendData[trendData.length - 1] : null;

        // Add overall trend direction based on moving averages
        const trends = latestData
            ? {
                  short_term:
                      latestData.buy_price_ma6 > latestData.buy_price_ma24
                          ? "up"
                          : "down",
                  price_volatility: Math.abs(
                      latestData.buy_price_pct_change_24h || 0
                  ),
                  latest_change_24h: latestData.buy_price_pct_change_24h || 0,
              }
            : null;

        return res.status(200).json({
            success: true,
            data: {
                history: trendData,
                trends,
            },
        });
    } catch (error) {
        console.error("Error fetching bazaar trends:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
});

/**
 * Get volatility ranking of bazaar items
 * @route GET /api/bazaar/volatility
 * @query {string} period - Time period (day, week, month) - defaults to week
 * @query {number} limit - Limit number of results - defaults to 10
 * @returns {Array} Most volatile items by price change percentage
 */
router.get("/volatility", async (req, res) => {
    try {
        const { period = "week", limit = 10 } = req.query;

        let interval;
        switch (period) {
            case "day":
                interval = "1 day";
                break;
            case "week":
                interval = "7 days";
                break;
            case "month":
                interval = "30 days";
                break;
            default:
                interval = "7 days";
        }

        const query = `
      WITH item_stats AS (
        SELECT 
          item_id,
          time_bucket('1 day', timestamp) AS day,
          AVG(buy_price) AS avg_price
        FROM bazaar_records
        WHERE timestamp > NOW() - INTERVAL $1
        GROUP BY item_id, day
      ),
      volatility AS (
        SELECT 
          item_id,
          stddev(avg_price) / avg(avg_price) * 100 AS volatility_score,
          (MAX(avg_price) - MIN(avg_price)) / MIN(avg_price) * 100 AS price_range_pct,
          AVG(avg_price) AS average_price
        FROM item_stats
        GROUP BY item_id
        HAVING COUNT(day) > 1
      )
      SELECT 
        item_id,
        volatility_score,
        price_range_pct,
        average_price
      FROM volatility
      ORDER BY volatility_score DESC
      LIMIT $2
    `;

        const result = await db.query(query, [interval, limit]);

        return res.status(200).json({
            success: true,
            data: result.rows,
        });
    } catch (error) {
        console.error("Error fetching bazaar volatility:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
});

export default { startingPath: "/api/bazaar", router }; // Passing the starting path of the router here.

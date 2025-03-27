import { Router } from "express";
import crypto from "crypto";
import Client from "../lib/bjorn.js";

const router = Router();

// Discord OAuth2 configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_REDIRECT_URI = process.env.BASE_URL + "/api/auth/discord/callback";
const DISCORD_SCOPES = ["identify", "guilds", "guilds.join"];

// Create Discord client instance
const discordClient = new Client(DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI);

// Store states to prevent CSRF attacks
const authStates = new Map();

// Generate authorization URL for Discord
function generateAuthUrl(state) {
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: DISCORD_SCOPES.join(" "),
        state: state,
    });
    
    return `https://discord.com/api/oauth2/authorize?${params}`;
}

router.get("/auth", async (req, res) => {
    // Generate a random state for CSRF protection
    const state = crypto.randomBytes(16).toString("hex");
    
    // Store state with expiration (5 minutes)
    authStates.set(state, { 
        created: Date.now(),
        // Add user info or session data if needed
    });
    
    // Clean up expired states
    for (const [key, value] of authStates.entries()) {
        if (Date.now() - value.created > 5 * 60 * 1000) {
            authStates.delete(key);
        }
    }
    
    const authUrl = generateAuthUrl(state);
    res.redirect(authUrl);
});

router.get("/callback", async (req, res) => {
    const { code, state } = req.query;

    // Verify state to prevent CSRF attacks
    if (!authStates.has(state)) return res.status(400).send("Invalid state");
    
    // State is used only once
    authStates.delete(state);

    try {
        // Exchange code for access token
        const tokenResponse = await discordClient.getAccessToken(code);
        
        if (!tokenResponse) {
            return res.status(401).send("Failed to get access token");
        }
        
        const { access_token, refresh_token, expires_in } = tokenResponse;
        
        // Get user information
        const userData = await discordClient.getUser(access_token);
        
        // TODO: Returning a JWT
    } catch (error) {
        console.error("Discord authentication error:", error);
        res.status(500).send("Authentication failed. Server error occurred.");
    }
});

export default { startingPath: "/api/auth/discord", router };

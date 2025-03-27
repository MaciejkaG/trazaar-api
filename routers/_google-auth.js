import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import path from "path";
import { promises as fs } from "node:fs";

const router = Router();

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];
const CREDENTIALS_PATH = path.join(
    process.__dirname,
    "google-cloud-credentials.json"
);
const REDIRECT_URI = process.env.BASE_URL + "/api/auth/google/callback";

let oAuth2Client;

// Initialize OAuth client
async function initializeOAuthClient() {
    const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH));
    const { client_id, client_secret } = credentials.web;
    oAuth2Client = new OAuth2Client(client_id, client_secret, REDIRECT_URI);
}

// Initialize on startup
initializeOAuthClient();

router.get("/auth", async (req, res) => {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        state: state,
    });

    res.redirect(authUrl);
});

router.get("/callback", async (req, res) => {
    const { code, state } = req.query;

    if (!authStates.has(state)) return res.status(400).send("Invalid state");

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        const { access_token, refresh_token, expiry_date } = tokens;

        // TODO: Returning a JWT
    } catch (error) {
        console.error(error);
        res.status(500).send("Authorization failed. Server error occured.");
    }
});

export default { startingPath: "/api/auth/google", router };

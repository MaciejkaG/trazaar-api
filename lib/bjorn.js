/*
Bjorn Authentication Library
© 2025 mcjk

This is a Discord authentication library based on https://github.com/MaciejkaG/bard
It was improved, rewritten using axios instead of node-fetch and converted to the ESM syntax.
*/ 

import axios from "axios";
import packageJson from "../package.json" assert { type: "json" };

const apiEndpoint = "https://discord.com/api/v10";
const userAgent = `${packageJson.name}/${packageJson.version} (https://github.com/MaciejkaG)`;

const ax = axios.create({
    baseURL: apiEndpoint,
    headers: {
        "User-Agent": userAgent,
        "Content-Type": "application/json",
    },
});

export default class Client {
    constructor(botToken, clientId, clientSecret, redirectUri) {
        this.botToken = botToken;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    async _get(url, customHeaders = {}) {
        try {
            const result = await ax.get(url, { 
                headers: { ...ax.defaults.headers, ...customHeaders } 
            });

            if (result.status !== 200) {
                throw new Error(`Failed to fetch data from Discord API: ${result.status} ${result.statusText}`);
            }

            return result.data;
        } catch (error) {
            console.error(`GET request failed: ${error.message}`);
            throw error;
        }
    }

    async _post(url, data, customHeaders = {}) {
        try {
            const result = await ax.post(url, data, { 
                headers: { ...ax.defaults.headers, ...customHeaders } 
            });

            if (result.status !== 200) {
                throw new Error(`Failed to post data to Discord API: ${result.status} ${result.statusText}`);
            }

            return result.data;
        } catch (error) {
            console.error(`POST request failed: ${error.message}`);
            throw error;
        }
    }

    // Returns the access token by authorisation code.
    async getAccessToken(code, customHeaders = {}) {
        try {
            const data = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: this.redirectUri,
            });

            const headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                ...customHeaders
            };

            const response = await axios.post("https://discord.com/api/oauth2/token", data, {
                headers: {
                    "User-Agent": userAgent,
                    ...headers
                }
            });

            return response.data;
        } catch (error) {
            console.error("Error getting access token:", error.message);
            return null;
        }
    }

    // Returns user's basic information by access token.
    async getUser(accessToken, customHeaders = {}) {
        try {
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                ...customHeaders
            };

            return await this._get('/oauth2/@me', headers);
        } catch (error) {
            console.error("Error getting user info:", error.message);
            throw new Error(`Failed to get user info: ${error.message}`);
        }
    }

    // Returns the list of guilds of a user by access token.
    async getUserGuilds(accessToken, customHeaders = {}) {
        try {
            const headers = {
                Authorization: `Bearer ${accessToken}`,
                ...customHeaders
            };

            return await this._get('/users/@me/guilds', headers);
        } catch (error) {
            console.error("Error getting user guilds:", error.message);
            throw new Error(`Failed to get user guilds: ${error.message}`);
        }
    }

    // Joins a user to a guild by access token and user's ID
    async joinUserToGuild(accessToken, userId, guildId, customHeaders = {}) {
        try {
            const headers = {
                Authorization: `Bot ${this.botToken}`,
                ...customHeaders
            };
            
            // We can't use the standard _post helper because this is a PUT request
            const result = await ax.put(
                `/guilds/${guildId}/members/${userId}`,
                { access_token: accessToken },
                { headers }
            );
            
            return true;
        } catch (error) {
            console.error(`Error joining user to guild: ${error.message}`);
            return false;
        }
    }
}

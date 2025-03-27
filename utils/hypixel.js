// Hypixel API client
// © 2025 mcjk

import axios from "axios";

export default class Hypixel {
    constructor(options = {}) {
        this.apiKey = options.apiKey ?? process.env.HYPIXEL_API_KEY;
        this.baseUrl = "https://api.hypixel.net";
    }

    async fetch(endpoint, params = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        params.key = this.apiKey;

        try {
            const response = await axios.get(url, { params });
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            throw error;
        }
    }

    async getSkyblockBazaar() {
        const data = await this.fetch("/skyblock/bazaar");
        return Object.values(data.products);
    }

    async getSkyblockAuctions() {
        const data = await this.fetch("/skyblock/auctions");
        return data.auctions;
    }

    async getSkyblockProfiles() {
        const data = await this.fetch("/skyblock/profiles");
        return data.profiles;
    }

    async getSkyblockProfile(profileUUID) {
        const data = await this.fetch("/skyblock/profile", { profile: profileUUID });
        return data.profile;
    }

    async getPlayer(playerUUID) {
        const data = await this.fetch("/player", { uuid: playerUUID });
        return data.player;
    }
}
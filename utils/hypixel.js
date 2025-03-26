import Hypixel from "hypixel-api-reborn";

const hypixel = new Hypixel.Client(process.env.HYPIXEL_API_KEY);

export default hypixel;
import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import WebSocket from "ws";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error("SUPABASE_URL não definida no .env");
}

if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não definida no .env");
}

export const supabase = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
        realtime: {
            transport: WebSocket as unknown as WebSocketLikeConstructor
        }
    }
);
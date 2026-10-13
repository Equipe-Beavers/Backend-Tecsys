import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import WebSocket from "ws";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder-service-role-key";

export const supabase = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
        realtime: {
            transport: WebSocket as unknown as WebSocketLikeConstructor,
        },
    },
);
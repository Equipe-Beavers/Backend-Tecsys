import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import WebSocket from "ws";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// PostgreSQL-backed routes can start without Supabase credentials.
function createSupabaseClient() {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        return new Proxy({} as ReturnType<typeof createClient>, {
            get() { throw new Error("Supabase indisponível: configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env."); }
        });
    }
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor }
    });
}

export const supabase = createSupabaseClient();

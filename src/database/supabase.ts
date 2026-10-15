import { createClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import WebSocket from "ws";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Other modules still depend on Supabase. Local criteria tests must never access it.
function createSupabaseClient() {
    if (process.env.DISABLE_SUPABASE === "true") {
        return new Proxy({} as ReturnType<typeof createClient>, {
            get() { throw new Error("Supabase desativado no ambiente local de testes de critérios."); }
        });
    }
    if (!supabaseUrl) throw new Error("SUPABASE_URL não definida no .env");
    if (!supabaseServiceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não definida no .env");
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor }
    });
}

export const supabase = createSupabaseClient();

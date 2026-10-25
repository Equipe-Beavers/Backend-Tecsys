import { pool } from "../database/pool.js";
import { ApplicationUtils } from "../utils/ApplicationUtils.js";

export class ApplicationService {
    private applicationUtils: ApplicationUtils;

    constructor() {
        this.applicationUtils = new ApplicationUtils();
    }

    async listRegisters<T>(table: string): Promise<T[]> {
        const query = `SELECT * FROM ${table};`;
        const result = await pool.query(query);

        return (result.rows ?? []).map((r) => this.applicationUtils.hideSensitiveInputs<T>(r));
    }

    async findRegisterById<T>(table: string, columnId: string, id: number, entity: string): Promise<T> {
        const query = `SELECT * FROM ${table} WHERE ${columnId} = $1;`;
        const result = await pool.query(query, [id]);
        const data = result.rows[0];

        if (!data) throw new Error(`${entity} não encontrado(a).`);
        return this.applicationUtils.hideSensitiveInputs<T>(data);
    }

    async updateRegister<T>(table: string, columnId: string, id: number, dataU: Record<string, unknown>, entity: string): Promise<T> {
        const keys = Object.keys(dataU);
        const values = Object.values(dataU);

        if (keys.length === 0) {
            return this.findRegisterById<T>(table, columnId, id, entity);
        }

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");
        const query = `
            UPDATE ${table} 
            SET ${setClause} 
            WHERE ${columnId} = $${keys.length + 1} 
            RETURNING *;
        `;

        const result = await pool.query(query, [...values, id]);
        const data = result.rows[0];

        if (!data) throw new Error(`${entity} não encontrado(a)`);
        return this.applicationUtils.hideSensitiveInputs<T>(data);
    }

    async deleteRegister<T>(table: string, columnId: string, id: number, entity: string): Promise<void> {
        const query = `DELETE FROM ${table} WHERE ${columnId} = $1 RETURNING ${columnId};`;
        const result = await pool.query(query, [id]);
        const data = result.rows[0];

        if (!data) throw new Error(`${entity} não encontrado(a)`);
    }
}
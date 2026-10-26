export const assetTypes = [
    "POSTE",
    "TRANSFORMADOR",
    "SUBESTACAO",
    "DISPOSITIVO",
    "CHAVE_FUSIVEL",
    "CHAVE_SECCIONADORA",
    "RELIGADOR",
    "SECCIONADOR_AUTOMATICO",
    "REGULADOR_TENSAO",
    "BANCO_CAPACITORES",
] as const;

export type AssetType = (typeof assetTypes)[number];

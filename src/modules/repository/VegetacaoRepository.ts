import type { VegetacaoConfigDTO } from "../../interface/vegetacao.js";

export class VegetacaoRepository {
    obterConfiguracao(): VegetacaoConfigDTO {
        return {
            provider: "ESA WorldCover",
            product: "WorldCover 2021 v200",
            service: "WMS",
            baseUrl: "https://services.terrascope.be/wms/v2?",
            layer: "WORLDCOVER_2021_MAP",
            version: "1.3.0",
            format: "image/png",
            transparent: true,
            attribution: "© ESA WorldCover project 2021 © Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium",
            uso: "visualizacao",
            classes: [
                { codigo: 10, nome: "Cobertura arbórea", cor: "#006400" },
                { codigo: 20, nome: "Arbustos", cor: "#FFBB22" },
                { codigo: 30, nome: "Gramíneas", cor: "#FFFF4C" },
                { codigo: 40, nome: "Cultivos", cor: "#F096FF" },
                { codigo: 50, nome: "Área construída", cor: "#FA0000" },
                { codigo: 60, nome: "Vegetação esparsa / solo exposto", cor: "#B4B4B4" },
                { codigo: 70, nome: "Neve e gelo", cor: "#F0F0F0" },
                { codigo: 80, nome: "Água permanente", cor: "#0064C8" },
                { codigo: 90, nome: "Área úmida herbácea", cor: "#0096A0" },
                { codigo: 95, nome: "Manguezal", cor: "#00CF75" },
                { codigo: 100, nome: "Musgos e líquens", cor: "#FAE6A0" },
            ],
            observacao: "O WMS devolve imagens para visualização. Para análises de propagação, use os GeoTIFF/COG originais e um modelo de perda validado.",
        };
    }
}

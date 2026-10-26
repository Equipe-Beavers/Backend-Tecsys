import type { VegetacaoConfigDTO } from "../interface/vegetacao.js";
import { VegetacaoRepository } from "../modules/repository/VegetacaoRepository.js";

export class VegetacaoService {
    private readonly vegetacaoRepository: VegetacaoRepository;

    constructor(vegetacaoRepository?: VegetacaoRepository) {
        this.vegetacaoRepository = vegetacaoRepository ?? new VegetacaoRepository();
    }

    obterConfiguracao(): VegetacaoConfigDTO {
        return this.vegetacaoRepository.obterConfiguracao();
    }
}

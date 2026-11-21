export const findExportStudyQuery = `
    SELECT
        e.id_estudo, e.nome, e.descricao, e.tipo_delimitacao,
        e.uf, e.municipio, e.bairro, e.distribuidora, e.versao_bdgd,
        e.status, e.criado_em,
        p.nome AS nome_perfil_rf,
        ci.nome AS nome_criterio_instalacao
    FROM estudos e
    LEFT JOIN perfis_rf p ON p.id_perfil_rf = e.id_perfil_rf
    LEFT JOIN criterios_instalacao ci ON ci.id_criterio_instalacao = e.id_criterio_instalacao
    WHERE e.id_estudo = $1 AND e.id_usuario = $2
`;

export const findExportScenariosQuery = `
    SELECT
        c.id_cenario, c.id_cenario_base, c.nome, c.descricao, c.objetivo, c.status,
        c.quantidade_gateways, c.pontos_interesse, c.pontos_cobertos,
        c.pontos_nao_cobertos, c.percentual_cobertura,
        c.capacidade_utilizada_media_pct, c.custo_total_estimado,
        c.executado_em, c.criado_em,
        p.nome AS nome_perfil_rf,
        p.capacidade_max_equipamentos, p.modelo_gateway,
        p.frequencia_mhz::float8 AS frequencia_mhz,
        p.potencia_transmissao_dbm::float8 AS potencia_transmissao_dbm,
        p.sensibilidade_recepcao_dbm::float8 AS sensibilidade_recepcao_dbm,
        p.alcance_estimado_m::float8 AS alcance_estimado_m,
        p.altura_gateway_m::float8 AS altura_gateway_m,
        p.altura_dispositivo_m::float8 AS altura_dispositivo_m,
        p.quantidade_canais,
        p.custo_estimado_gateway::float8 AS custo_estimado_gateway,
        ci.nome AS nome_criterio_instalacao,
        ci.distancia_minima_ativos_m::float8 AS distancia_minima_ativos_m,
        ci.distancia_maxima_ativos_m::float8 AS distancia_maxima_ativos_m,
        ci.altura_minima_m::float8 AS altura_minima_m,
        ci.limite_gateways,
        ci.custo_maximo::float8 AS custo_maximo
    FROM cenarios c
    LEFT JOIN perfis_rf p ON p.id_perfil_rf = c.id_perfil_rf
    LEFT JOIN criterios_instalacao ci ON ci.id_criterio_instalacao = c.id_criterio_instalacao
    WHERE c.id_estudo = $1 AND c.executado_em IS NOT NULL
    ORDER BY c.id_cenario
`;

export const findExportGatewaysQuery = `
    SELECT
        cg.id_cenario, cg.id_cenario_gateway, cg.id_estudo_ponto, cg.ordem,
        cg.quantidade_pontos_atendidos, cg.capacidade_utilizada_pct,
        (cg.parametros_calculo ->> 'alcance_medio_m')::float8 AS alcance_medio_m,
        ep.rotulo, ep.id_ativo_bdgd, ep.tipo_ativo,
        ep.latitude::float8 AS latitude, ep.longitude::float8 AS longitude
    FROM cenario_gateways cg
    JOIN estudo_pontos ep ON ep.id_estudo_ponto = cg.id_estudo_ponto
    WHERE cg.id_cenario = ANY($1::bigint[])
    ORDER BY cg.id_cenario, cg.ordem NULLS LAST, cg.id_cenario_gateway
`;

export const findExportServicesQuery = `
    SELECT
        cg.id_cenario, ca.id_cenario_gateway, ca.id_estudo_ponto,
        ca.distancia_m::float8 AS distancia_m,
        ca.nivel_sinal_estimado_dbm::float8 AS nivel_sinal_estimado_dbm,
        ep.rotulo, ep.id_ativo_bdgd, ep.tipo_ativo,
        ep.latitude::float8 AS latitude, ep.longitude::float8 AS longitude
    FROM cenario_atendimentos ca
    JOIN cenario_gateways cg ON cg.id_cenario_gateway = ca.id_cenario_gateway
    JOIN estudo_pontos ep ON ep.id_estudo_ponto = ca.id_estudo_ponto
    WHERE cg.id_cenario = ANY($1::bigint[])
    ORDER BY cg.id_cenario, ca.id_cenario_gateway, ca.id_estudo_ponto
`;

export const findExportInterestPointsQuery = `
    SELECT
        id_estudo_ponto, rotulo, id_ativo_bdgd, tipo_ativo,
        latitude::float8 AS latitude, longitude::float8 AS longitude
    FROM estudo_pontos
    WHERE id_estudo = $1 AND papel IN ('interesse', 'ambos')
    ORDER BY id_estudo_ponto
`;

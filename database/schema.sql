CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  username character varying NOT NULL UNIQUE,
  email character varying NOT NULL UNIQUE,
  senha_hash character varying NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario)
);

CREATE TABLE IF NOT EXISTS perfis_rf (
  id_perfil_rf bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_usuario bigint NOT NULL,
  nome character varying NOT NULL,
  modelo_gateway character varying,
  frequencia_mhz numeric NOT NULL,
  potencia_transmissao_dbm numeric NOT NULL,
  sensibilidade_recepcao_dbm numeric NOT NULL,
  alcance_estimado_m numeric,
  altura_gateway_m numeric,
  altura_dispositivo_m numeric,
  capacidade_max_equipamentos integer,
  quantidade_canais integer,
  limite_mensagens_transmissoes integer,
  periodo_limite_mensagens character varying,
  custo_estimado_gateway numeric,
  caracteristicas_antena jsonb,
  considera_relevo boolean NOT NULL DEFAULT true,
  considera_vegetacao boolean NOT NULL DEFAULT true,
  considera_edificacoes boolean NOT NULL DEFAULT true,
  considera_obstaculos boolean NOT NULL DEFAULT true,
  parametros_adicionais jsonb,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone,
  CONSTRAINT perfis_rf_pkey PRIMARY KEY (id_perfil_rf),
  CONSTRAINT fk_perfis_rf_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS criterios_instalacao (
  id_criterio_instalacao bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_usuario bigint NOT NULL,
  nome character varying NOT NULL,
  descricao text,
  tipos_elementos_permitidos jsonb,
  tipos_elementos_proibidos jsonb,
  requer_alimentacao_eletrica boolean,
  altura_minima_m numeric,
  distancia_maxima_ativos_m numeric,
  caracteristicas_minimas_local jsonb,
  locais_autorizados jsonb,
  locais_obrigatorios jsonb,
  locais_proibidos jsonb,
  limite_gateways integer,
  custo_maximo numeric,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone,
  CONSTRAINT criterios_instalacao_pkey PRIMARY KEY (id_criterio_instalacao),
  CONSTRAINT fk_criterios_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS estudos (
  id_estudo bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_usuario bigint NOT NULL,
  tipo_delimitacao character varying NOT NULL,
  uf character varying,
  municipio character varying,
  bairro character varying,
  geom geometry,
  nome character varying NOT NULL,
  descricao text,
  distribuidora character varying,
  versao_bdgd character varying,
  nome_base_externa character varying,
  tipos_ativo_selecionados jsonb,
  status character varying NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone,
  CONSTRAINT estudos_pkey PRIMARY KEY (id_estudo),
  CONSTRAINT fk_estudos_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS estudo_pontos (
  id_estudo_ponto bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_estudo bigint NOT NULL,
  origem character varying NOT NULL,
  id_ativo_bdgd character varying,
  tipo_ativo character varying,
  rotulo character varying,
  papel character varying NOT NULL,
  prioridade character varying,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  atributos jsonb,
  geom geometry,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT estudo_pontos_pkey PRIMARY KEY (id_estudo_ponto),
  CONSTRAINT fk_estudo_pontos_estudo FOREIGN KEY (id_estudo) REFERENCES estudos(id_estudo)
);

CREATE TABLE IF NOT EXISTS cenarios (
  id_cenario bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_estudo bigint NOT NULL,
  id_perfil_rf bigint NOT NULL,
  id_criterio_instalacao bigint,
  id_cenario_base bigint,
  nome character varying NOT NULL,
  descricao text,
  objetivo character varying,
  status character varying NOT NULL,
  quantidade_gateways integer,
  pontos_interesse integer,
  pontos_cobertos integer,
  pontos_nao_cobertos integer,
  percentual_cobertura numeric,
  capacidade_utilizada_media_pct numeric,
  custo_total_estimado numeric,
  mancha_consolidada geometry,
  executado_em timestamp with time zone,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone,
  CONSTRAINT cenarios_pkey PRIMARY KEY (id_cenario),
  CONSTRAINT fk_cenarios_estudo FOREIGN KEY (id_estudo) REFERENCES estudos(id_estudo),
  CONSTRAINT fk_cenarios_perfil_rf FOREIGN KEY (id_perfil_rf) REFERENCES perfis_rf(id_perfil_rf),
  CONSTRAINT fk_cenarios_criterio FOREIGN KEY (id_criterio_instalacao) REFERENCES criterios_instalacao(id_criterio_instalacao),
  CONSTRAINT fk_cenarios_cenario_base FOREIGN KEY (id_cenario_base) REFERENCES cenarios(id_cenario)
);

CREATE TABLE IF NOT EXISTS cenario_gateways (
  id_cenario_gateway bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_cenario bigint NOT NULL,
  id_estudo_ponto bigint NOT NULL,
  ordem integer,
  quantidade_pontos_atendidos integer,
  capacidade_utilizada_pct numeric,
  custo_estimado numeric,
  parametros_calculo jsonb,
  mancha_cobertura geometry,
  CONSTRAINT cenario_gateways_pkey PRIMARY KEY (id_cenario_gateway),
  CONSTRAINT fk_cenario_gateways_cenario FOREIGN KEY (id_cenario) REFERENCES cenarios(id_cenario),
  CONSTRAINT fk_cenario_gateways_estudo_ponto FOREIGN KEY (id_estudo_ponto) REFERENCES estudo_pontos(id_estudo_ponto)
);

CREATE TABLE IF NOT EXISTS cenario_atendimentos (
  id_atendimento bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_cenario_gateway bigint NOT NULL,
  id_estudo_ponto bigint NOT NULL,
  distancia_m numeric,
  nivel_sinal_estimado_dbm numeric,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cenario_atendimentos_pkey PRIMARY KEY (id_atendimento),
  CONSTRAINT fk_atendimentos_gateway FOREIGN KEY (id_cenario_gateway) REFERENCES cenario_gateways(id_cenario_gateway),
  CONSTRAINT fk_atendimentos_estudo_ponto FOREIGN KEY (id_estudo_ponto) REFERENCES estudo_pontos(id_estudo_ponto)
);

CREATE TABLE IF NOT EXISTS distribuidoras (
  id integer NOT NULL,
  nome character varying NOT NULL,
  uf character,
  ano_bdgd integer NOT NULL,
  CONSTRAINT distribuidoras_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS municipios (
  codigo_ibge integer NOT NULL,
  nome character varying NOT NULL,
  uf character NOT NULL,
  CONSTRAINT municipios_pkey PRIMARY KEY (codigo_ibge)
);

CREATE TABLE POSICOES_GEOGRAFICAS (
    ID_POSICAO BIGSERIAL PRIMARY KEY,
    TIPO_POSICAO VARCHAR(30) NOT NULL,
    LATITUDE DOUBLE PRECISION NOT NULL,
    LONGITUDE DOUBLE PRECISION NOT NULL,
    GEOM GEOMETRY(Point, 4674),
    MUNICIPIO VARCHAR(100),
    BAIRRO VARCHAR(100),
    ID_DISTRIBUIDORA INT,
    ARE_LOC VARCHAR(50),
    DATA_INCLUSAO TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    DATA_FIM TIMESTAMP NULL,
    REGISTRO_ATUAL BOOLEAN DEFAULT TRUE,
    LOTE_CARGA VARCHAR(20),
    CONSTRAINT FK_POSICOES_GEOGRAFICAS_DISTRIBUIDORA
        FOREIGN KEY (ID_DISTRIBUIDORA)
        REFERENCES distribuidoras(id)
        ON DELETE RESTRICT
);

CREATE INDEX IDX_POSICOES_GEOGRAFICAS_GEOM 
ON POSICOES_GEOGRAFICAS USING GIST (GEOM);

CREATE INDEX IDX_POSICOES_GEOGRAFICAS_DISTRIBUIDORA 
ON POSICOES_GEOGRAFICAS (ID_DISTRIBUIDORA);

CREATE TABLE TIPOS_DISPOSITIVOS (
    ID_TIPO_DISPOSITIVO INT PRIMARY KEY,
    NOME_DISPOSITIVO VARCHAR(100) NOT NULL,
    CATEGORIA VARCHAR(50)
);

CREATE TABLE POSTES (
    ID_POSTE BIGSERIAL PRIMARY KEY,
    COD_ID VARCHAR(50) NOT NULL,
    ALTURA NUMERIC(4,1),
    MATERIAL VARCHAR(30),
    ESFORCO NUMERIC(6,1),
    ID_POSICAO BIGINT NOT NULL,
    DATA_INCLUSAO TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    DATA_FIM TIMESTAMP NULL,
    REGISTRO_ATUAL BOOLEAN DEFAULT TRUE,
    LOTE_CARGA VARCHAR(20),
    
    CONSTRAINT FK_POSTES_POSICAO 
        FOREIGN KEY (ID_POSICAO) 
        REFERENCES POSICOES_GEOGRAFICAS (ID_POSICAO)
        ON DELETE RESTRICT
);

CREATE TABLE SUBESTACOES (
    ID_SUBESTACAO BIGSERIAL PRIMARY KEY,
    COD_ID VARCHAR(50) NOT NULL,
    NOME VARCHAR(100),
    ID_POSICAO BIGINT NOT NULL,
    DATA_INCLUSAO TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    DATA_FIM TIMESTAMP NULL,
    REGISTRO_ATUAL BOOLEAN DEFAULT TRUE,
    LOTE_CARGA VARCHAR(20),
    
    CONSTRAINT FK_SUBESTACOES_POSICAO 
        FOREIGN KEY (ID_POSICAO) 
        REFERENCES POSICOES_GEOGRAFICAS (ID_POSICAO)
        ON DELETE RESTRICT
);

CREATE TABLE DISPOSITIVOS (
    ID_DISPOSITIVO BIGSERIAL PRIMARY KEY,
    COD_ID VARCHAR(50) NOT NULL,
    ID_TIPO_DISPOSITIVO INT NOT NULL,
    SUBESTACAO VARCHAR(50),
    CODIGO_CONJUNTO_ANEEL INT,
    ID_POSICAO BIGINT NOT NULL,
    DATA_INCLUSAO TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    DATA_FIM TIMESTAMP NULL,
    REGISTRO_ATUAL BOOLEAN DEFAULT TRUE,
    LOTE_CARGA VARCHAR(20),
    
    CONSTRAINT FK_DISPOSITIVOS_TIPO 
        FOREIGN KEY (ID_TIPO_DISPOSITIVO) 
        REFERENCES TIPOS_DISPOSITIVOS (ID_TIPO_DISPOSITIVO),
        
    CONSTRAINT FK_DISPOSITIVOS_POSICAO 
        FOREIGN KEY (ID_POSICAO) 
        REFERENCES POSICOES_GEOGRAFICAS (ID_POSICAO)
        ON DELETE RESTRICT
);
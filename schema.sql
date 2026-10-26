--
-- PostgreSQL database dump
--

\restrict 7w8ibt2Dr592ay5i6GXNyGRQ0HNs3G4FaIqLhmx3wV7cbG9uDNjoQ9VzvzEqvyf

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.6 (Ubuntu 18.6-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cenario_atendimentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cenario_atendimentos (
    id_atendimento bigint NOT NULL,
    id_cenario_gateway bigint NOT NULL,
    id_estudo_ponto bigint NOT NULL,
    distancia_m numeric,
    nivel_sinal_estimado_dbm numeric,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cenario_atendimentos_id_atendimento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cenario_atendimentos ALTER COLUMN id_atendimento ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cenario_atendimentos_id_atendimento_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cenario_gateways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cenario_gateways (
    id_cenario_gateway bigint NOT NULL,
    id_cenario bigint NOT NULL,
    id_estudo_ponto bigint NOT NULL,
    ordem integer,
    quantidade_pontos_atendidos integer,
    capacidade_utilizada_pct numeric,
    custo_estimado numeric,
    parametros_calculo jsonb,
    mancha_cobertura public.geometry
);


--
-- Name: cenario_gateways_id_cenario_gateway_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cenario_gateways ALTER COLUMN id_cenario_gateway ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cenario_gateways_id_cenario_gateway_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cenarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cenarios (
    id_cenario bigint NOT NULL,
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
    mancha_consolidada public.geometry,
    executado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone
);


--
-- Name: cenarios_id_cenario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cenarios ALTER COLUMN id_cenario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cenarios_id_cenario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: criterios_instalacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.criterios_instalacao (
    id_criterio_instalacao bigint NOT NULL,
    id_usuario bigint NOT NULL,
    nome character varying NOT NULL,
    descricao text,
    tipos_elementos_permitidos jsonb,
    tipos_elementos_proibidos jsonb,
    altura_minima_m numeric,
    distancia_maxima_ativos_m numeric,
    caracteristicas_minimas_local jsonb,
    locais_autorizados jsonb,
    locais_obrigatorios jsonb,
    locais_proibidos jsonb,
    limite_gateways integer,
    custo_maximo numeric,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    distancia_minima_ativos_m numeric(12,2),
    relevo jsonb,
    CONSTRAINT criterios_instalacao_distancias_faixa CHECK ((((distancia_minima_ativos_m IS NULL) OR ((distancia_minima_ativos_m >= (10)::numeric) AND (distancia_minima_ativos_m <= (500)::numeric))) AND ((distancia_maxima_ativos_m IS NULL) OR ((distancia_maxima_ativos_m >= (10)::numeric) AND (distancia_maxima_ativos_m <= (500)::numeric))))),
    CONSTRAINT criterios_instalacao_distancias_validas CHECK (((distancia_minima_ativos_m IS NULL) OR ((distancia_minima_ativos_m >= (0)::numeric) AND ((distancia_maxima_ativos_m IS NULL) OR (distancia_minima_ativos_m <= distancia_maxima_ativos_m)))))
);


--
-- Name: criterios_instalacao_id_criterio_instalacao_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.criterios_instalacao ALTER COLUMN id_criterio_instalacao ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.criterios_instalacao_id_criterio_instalacao_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispositivos (
    id_dispositivo bigint NOT NULL,
    cod_id character varying(50) NOT NULL,
    id_tipo_dispositivo integer NOT NULL,
    subestacao character varying(50),
    codigo_conjunto_aneel integer,
    id_posicao bigint NOT NULL,
    data_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    data_fim timestamp without time zone,
    registro_atual boolean DEFAULT true,
    lote_carga character varying(20)
);


--
-- Name: dispositivos_id_dispositivo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dispositivos_id_dispositivo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dispositivos_id_dispositivo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dispositivos_id_dispositivo_seq OWNED BY public.dispositivos.id_dispositivo;


--
-- Name: distribuidoras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distribuidoras (
    id bigint NOT NULL,
    nome character varying(100) NOT NULL,
    uf character varying(2) NOT NULL,
    ano_bdgd integer NOT NULL
);


--
-- Name: distribuidoras_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.distribuidoras_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: distribuidoras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.distribuidoras_id_seq OWNED BY public.distribuidoras.id;


--
-- Name: emissoes_anatel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emissoes_anatel (
    id bigint NOT NULL,
    source_key text NOT NULL,
    uid text,
    fonte_dados text DEFAULT 'LICENCIADAS'::text NOT NULL,
    status text,
    entidade text,
    fistel text,
    num_servico text,
    ato_rf text,
    num_estacao text,
    endereco text,
    complemento text,
    uf character(2),
    municipio text,
    emissao text,
    tecnologia text,
    tipo_tecnologia text,
    meio_acesso text,
    frequencia_tx_mhz double precision,
    frequencia_rx_mhz double precision,
    azimute_graus double precision,
    tipo_estacao text,
    class_infra_fisica text,
    compartilhamento_infra_fisica text,
    tipo_antena text,
    homologacao_antena text,
    ganho_antena double precision,
    frente_costas double precision,
    angulo_meia_potencia_graus double precision,
    elevacao_graus double precision,
    polarizacao text,
    altura_antena_m double precision,
    homologacao_transmissor text,
    potencia_transmissor_w double precision,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    geom public.geometry(Point,4674) NOT NULL,
    codigo_tfi text,
    data_licenciamento date,
    data_primeiro_licenciamento date,
    rede text,
    data_validade date,
    fistel_associado text,
    nome_entidade_associado text,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT emissoes_anatel_latitude_check CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT emissoes_anatel_longitude_check CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))
);


--
-- Name: emissoes_anatel_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.emissoes_anatel ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.emissoes_anatel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: estudo_pontos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estudo_pontos (
    id_estudo_ponto bigint NOT NULL,
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
    geom public.geometry,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    relevo_m double precision
);


--
-- Name: estudo_pontos_id_estudo_ponto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.estudo_pontos ALTER COLUMN id_estudo_ponto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.estudo_pontos_id_estudo_ponto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: estudos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estudos (
    id_estudo bigint NOT NULL,
    id_usuario bigint NOT NULL,
    tipo_delimitacao character varying NOT NULL,
    uf character varying,
    municipio character varying,
    bairro character varying,
    geom public.geometry,
    nome character varying NOT NULL,
    descricao text,
    distribuidora character varying,
    versao_bdgd character varying,
    nome_base_externa character varying,
    tipos_ativo_selecionados jsonb,
    status character varying NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    id_perfil_rf bigint,
    id_criterio_instalacao bigint
);


--
-- Name: estudos_id_estudo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.estudos ALTER COLUMN id_estudo ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.estudos_id_estudo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: municipios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.municipios (
    codigo_ibge integer NOT NULL,
    nome character varying(100) NOT NULL,
    uf character(2) NOT NULL
);


--
-- Name: perfis_rf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfis_rf (
    id_perfil_rf bigint NOT NULL,
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
    parametros_adicionais jsonb,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone,
    atenuacao_adicional_db numeric(8,3)
);


--
-- Name: perfis_rf_id_perfil_rf_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.perfis_rf ALTER COLUMN id_perfil_rf ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.perfis_rf_id_perfil_rf_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: posicoes_geograficas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posicoes_geograficas (
    id_posicao bigint NOT NULL,
    tipo_posicao character varying(30) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    geom public.geometry(Point,4674),
    municipio character varying(100),
    bairro character varying(100),
    data_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    data_fim timestamp without time zone,
    registro_atual boolean DEFAULT true,
    lote_carga character varying(20),
    id_distribuidora integer,
    are_loc character varying(50)
);


--
-- Name: posicoes_geograficas_id_posicao_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.posicoes_geograficas_id_posicao_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: posicoes_geograficas_id_posicao_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.posicoes_geograficas_id_posicao_seq OWNED BY public.posicoes_geograficas.id_posicao;


--
-- Name: postes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postes (
    id_poste bigint NOT NULL,
    cod_id character varying(50) NOT NULL,
    altura numeric(4,1),
    material character varying(30),
    esforco numeric(6,1),
    id_posicao bigint NOT NULL,
    data_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    data_fim timestamp without time zone,
    registro_atual boolean DEFAULT true,
    lote_carga character varying(20)
);


--
-- Name: postes_id_poste_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.postes_id_poste_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: postes_id_poste_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.postes_id_poste_seq OWNED BY public.postes.id_poste;


--
-- Name: subestacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subestacoes (
    id_subestacao bigint NOT NULL,
    cod_id character varying(50) NOT NULL,
    nome character varying(100),
    id_posicao bigint NOT NULL,
    data_inclusao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    data_fim timestamp without time zone,
    registro_atual boolean DEFAULT true,
    lote_carga character varying(20)
);


--
-- Name: subestacoes_id_subestacao_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subestacoes_id_subestacao_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subestacoes_id_subestacao_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subestacoes_id_subestacao_seq OWNED BY public.subestacoes.id_subestacao;


--
-- Name: tipos_dispositivos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tipos_dispositivos (
    id_tipo_dispositivo integer NOT NULL,
    nome_dispositivo character varying(100) NOT NULL,
    categoria character varying(50)
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id_usuario bigint NOT NULL,
    username character varying NOT NULL,
    email character varying NOT NULL,
    senha_hash character varying NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone
);


--
-- Name: usuarios_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.usuarios ALTER COLUMN id_usuario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.usuarios_id_usuario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: dispositivos id_dispositivo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos ALTER COLUMN id_dispositivo SET DEFAULT nextval('public.dispositivos_id_dispositivo_seq'::regclass);


--
-- Name: distribuidoras id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribuidoras ALTER COLUMN id SET DEFAULT nextval('public.distribuidoras_id_seq'::regclass);


--
-- Name: posicoes_geograficas id_posicao; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posicoes_geograficas ALTER COLUMN id_posicao SET DEFAULT nextval('public.posicoes_geograficas_id_posicao_seq'::regclass);


--
-- Name: postes id_poste; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postes ALTER COLUMN id_poste SET DEFAULT nextval('public.postes_id_poste_seq'::regclass);


--
-- Name: subestacoes id_subestacao; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subestacoes ALTER COLUMN id_subestacao SET DEFAULT nextval('public.subestacoes_id_subestacao_seq'::regclass);


--
-- Name: cenario_atendimentos cenario_atendimentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenario_atendimentos
    ADD CONSTRAINT cenario_atendimentos_pkey PRIMARY KEY (id_atendimento);


--
-- Name: cenario_gateways cenario_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenario_gateways
    ADD CONSTRAINT cenario_gateways_pkey PRIMARY KEY (id_cenario_gateway);


--
-- Name: cenarios cenarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenarios
    ADD CONSTRAINT cenarios_pkey PRIMARY KEY (id_cenario);


--
-- Name: criterios_instalacao criterios_instalacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.criterios_instalacao
    ADD CONSTRAINT criterios_instalacao_pkey PRIMARY KEY (id_criterio_instalacao);


--
-- Name: dispositivos dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT dispositivos_pkey PRIMARY KEY (id_dispositivo);


--
-- Name: distribuidoras distribuidoras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribuidoras
    ADD CONSTRAINT distribuidoras_pkey PRIMARY KEY (id);


--
-- Name: emissoes_anatel emissoes_anatel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emissoes_anatel
    ADD CONSTRAINT emissoes_anatel_pkey PRIMARY KEY (id);


--
-- Name: emissoes_anatel emissoes_anatel_source_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emissoes_anatel
    ADD CONSTRAINT emissoes_anatel_source_key_key UNIQUE (source_key);


--
-- Name: estudo_pontos estudo_pontos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudo_pontos
    ADD CONSTRAINT estudo_pontos_pkey PRIMARY KEY (id_estudo_ponto);


--
-- Name: estudos estudos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudos
    ADD CONSTRAINT estudos_pkey PRIMARY KEY (id_estudo);


--
-- Name: municipios municipios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.municipios
    ADD CONSTRAINT municipios_pkey PRIMARY KEY (codigo_ibge);


--
-- Name: perfis_rf perfis_rf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfis_rf
    ADD CONSTRAINT perfis_rf_pkey PRIMARY KEY (id_perfil_rf);


--
-- Name: posicoes_geograficas posicoes_geograficas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posicoes_geograficas
    ADD CONSTRAINT posicoes_geograficas_pkey PRIMARY KEY (id_posicao);


--
-- Name: postes postes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postes
    ADD CONSTRAINT postes_pkey PRIMARY KEY (id_poste);


--
-- Name: subestacoes subestacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subestacoes
    ADD CONSTRAINT subestacoes_pkey PRIMARY KEY (id_subestacao);


--
-- Name: tipos_dispositivos tipos_dispositivos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tipos_dispositivos
    ADD CONSTRAINT tipos_dispositivos_pkey PRIMARY KEY (id_tipo_dispositivo);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id_usuario);


--
-- Name: usuarios usuarios_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_username_key UNIQUE (username);


--
-- Name: idx_dispositivos_cod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_cod_id ON public.dispositivos USING btree (cod_id);


--
-- Name: idx_dispositivos_conjunto_aneel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_conjunto_aneel ON public.dispositivos USING btree (codigo_conjunto_aneel);


--
-- Name: idx_dispositivos_posicao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_posicao ON public.dispositivos USING btree (id_posicao);


--
-- Name: idx_dispositivos_registro_atual; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_registro_atual ON public.dispositivos USING btree (registro_atual) WHERE (registro_atual = true);


--
-- Name: idx_dispositivos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dispositivos_tipo ON public.dispositivos USING btree (id_tipo_dispositivo);


--
-- Name: idx_emissoes_anatel_fonte; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emissoes_anatel_fonte ON public.emissoes_anatel USING btree (fonte_dados);


--
-- Name: idx_emissoes_anatel_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emissoes_anatel_geom ON public.emissoes_anatel USING gist (geom);


--
-- Name: idx_emissoes_anatel_num_estacao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emissoes_anatel_num_estacao ON public.emissoes_anatel USING btree (num_estacao);


--
-- Name: idx_emissoes_anatel_rx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emissoes_anatel_rx ON public.emissoes_anatel USING btree (frequencia_rx_mhz);


--
-- Name: idx_emissoes_anatel_tx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emissoes_anatel_tx ON public.emissoes_anatel USING btree (frequencia_tx_mhz);


--
-- Name: idx_emissoes_anatel_uf_municipio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emissoes_anatel_uf_municipio ON public.emissoes_anatel USING btree (uf, municipio);


--
-- Name: idx_estudos_criterio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estudos_criterio ON public.estudos USING btree (id_criterio_instalacao);


--
-- Name: idx_estudos_perfil_rf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estudos_perfil_rf ON public.estudos USING btree (id_perfil_rf);


--
-- Name: idx_municipios_uf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_municipios_uf ON public.municipios USING btree (uf);


--
-- Name: idx_posicoes_geograficas_distribuidora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posicoes_geograficas_distribuidora ON public.posicoes_geograficas USING btree (id_distribuidora);


--
-- Name: idx_posicoes_geograficas_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posicoes_geograficas_geom ON public.posicoes_geograficas USING gist (geom);


--
-- Name: idx_posicoes_geograficas_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posicoes_geograficas_lookup ON public.posicoes_geograficas USING btree (latitude, longitude, tipo_posicao, lote_carga, registro_atual);


--
-- Name: idx_posicoes_geograficas_municipio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posicoes_geograficas_municipio ON public.posicoes_geograficas USING btree (municipio);


--
-- Name: idx_posicoes_geograficas_registro_atual; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posicoes_geograficas_registro_atual ON public.posicoes_geograficas USING btree (registro_atual) WHERE (registro_atual = true);


--
-- Name: idx_postes_cod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postes_cod_id ON public.postes USING btree (cod_id);


--
-- Name: idx_postes_posicao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postes_posicao ON public.postes USING btree (id_posicao);


--
-- Name: idx_postes_registro_atual; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_postes_registro_atual ON public.postes USING btree (registro_atual) WHERE (registro_atual = true);


--
-- Name: idx_subestacoes_cod_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subestacoes_cod_id ON public.subestacoes USING btree (cod_id);


--
-- Name: idx_subestacoes_posicao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subestacoes_posicao ON public.subestacoes USING btree (id_posicao);


--
-- Name: idx_subestacoes_registro_atual; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subestacoes_registro_atual ON public.subestacoes USING btree (registro_atual) WHERE (registro_atual = true);


--
-- Name: idx_tipos_dispositivos_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tipos_dispositivos_categoria ON public.tipos_dispositivos USING btree (categoria);


--
-- Name: cenario_atendimentos fk_atendimentos_estudo_ponto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenario_atendimentos
    ADD CONSTRAINT fk_atendimentos_estudo_ponto FOREIGN KEY (id_estudo_ponto) REFERENCES public.estudo_pontos(id_estudo_ponto);


--
-- Name: cenario_atendimentos fk_atendimentos_gateway; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenario_atendimentos
    ADD CONSTRAINT fk_atendimentos_gateway FOREIGN KEY (id_cenario_gateway) REFERENCES public.cenario_gateways(id_cenario_gateway);


--
-- Name: cenario_gateways fk_cenario_gateways_cenario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenario_gateways
    ADD CONSTRAINT fk_cenario_gateways_cenario FOREIGN KEY (id_cenario) REFERENCES public.cenarios(id_cenario);


--
-- Name: cenario_gateways fk_cenario_gateways_estudo_ponto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenario_gateways
    ADD CONSTRAINT fk_cenario_gateways_estudo_ponto FOREIGN KEY (id_estudo_ponto) REFERENCES public.estudo_pontos(id_estudo_ponto);


--
-- Name: cenarios fk_cenarios_cenario_base; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenarios
    ADD CONSTRAINT fk_cenarios_cenario_base FOREIGN KEY (id_cenario_base) REFERENCES public.cenarios(id_cenario);


--
-- Name: cenarios fk_cenarios_criterio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenarios
    ADD CONSTRAINT fk_cenarios_criterio FOREIGN KEY (id_criterio_instalacao) REFERENCES public.criterios_instalacao(id_criterio_instalacao);


--
-- Name: cenarios fk_cenarios_estudo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenarios
    ADD CONSTRAINT fk_cenarios_estudo FOREIGN KEY (id_estudo) REFERENCES public.estudos(id_estudo);


--
-- Name: cenarios fk_cenarios_perfil_rf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cenarios
    ADD CONSTRAINT fk_cenarios_perfil_rf FOREIGN KEY (id_perfil_rf) REFERENCES public.perfis_rf(id_perfil_rf);


--
-- Name: criterios_instalacao fk_criterios_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.criterios_instalacao
    ADD CONSTRAINT fk_criterios_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario);


--
-- Name: dispositivos fk_dispositivos_posicao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT fk_dispositivos_posicao FOREIGN KEY (id_posicao) REFERENCES public.posicoes_geograficas(id_posicao) ON DELETE RESTRICT;


--
-- Name: dispositivos fk_dispositivos_tipo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispositivos
    ADD CONSTRAINT fk_dispositivos_tipo FOREIGN KEY (id_tipo_dispositivo) REFERENCES public.tipos_dispositivos(id_tipo_dispositivo);


--
-- Name: estudo_pontos fk_estudo_pontos_estudo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudo_pontos
    ADD CONSTRAINT fk_estudo_pontos_estudo FOREIGN KEY (id_estudo) REFERENCES public.estudos(id_estudo);


--
-- Name: estudos fk_estudos_criterio_instalacao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudos
    ADD CONSTRAINT fk_estudos_criterio_instalacao FOREIGN KEY (id_criterio_instalacao) REFERENCES public.criterios_instalacao(id_criterio_instalacao);


--
-- Name: estudos fk_estudos_perfil_rf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudos
    ADD CONSTRAINT fk_estudos_perfil_rf FOREIGN KEY (id_perfil_rf) REFERENCES public.perfis_rf(id_perfil_rf);


--
-- Name: estudos fk_estudos_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudos
    ADD CONSTRAINT fk_estudos_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario);


--
-- Name: perfis_rf fk_perfis_rf_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfis_rf
    ADD CONSTRAINT fk_perfis_rf_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id_usuario);


--
-- Name: posicoes_geograficas fk_posicoes_geograficas_distribuidora; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posicoes_geograficas
    ADD CONSTRAINT fk_posicoes_geograficas_distribuidora FOREIGN KEY (id_distribuidora) REFERENCES public.distribuidoras(id) ON DELETE RESTRICT;


--
-- Name: postes fk_postes_posicao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postes
    ADD CONSTRAINT fk_postes_posicao FOREIGN KEY (id_posicao) REFERENCES public.posicoes_geograficas(id_posicao) ON DELETE RESTRICT;


--
-- Name: subestacoes fk_subestacoes_posicao; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subestacoes
    ADD CONSTRAINT fk_subestacoes_posicao FOREIGN KEY (id_posicao) REFERENCES public.posicoes_geograficas(id_posicao) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict 7w8ibt2Dr592ay5i6GXNyGRQ0HNs3G4FaIqLhmx3wV7cbG9uDNjoQ9VzvzEqvyf


# Contrato de integração — Exportação do estudo em PDF

O botão **Baixar em PDF** (tela do estudo, dentro do histórico) baixa **tudo o que há no estudo aberto**: o cenário selecionado em destaque, todos os outros cenários do estudo e o comparativo. Não há popup nem escolha para o usuário. A rota trata um único estudo e nunca agrega estudos.

## Requisição

| Item | Valor |
|---|---|
| Método | `POST` |
| Endpoint | `/estudos/:id/exportar-pdf` |
| `:id` | Inteiro ≥ 1, id do estudo aberto |
| Autenticação | Obrigatória: `Authorization: Bearer <access_token>` |
| Headers | `Authorization`, `Content-Type: application/json` (só quando enviar corpo) |
| Corpo | Opcional (JSON). Campos desconhecidos são recusados (400). |

### Corpo

| Campo | Tipo | Descrição |
|---|---|---|
| `id_cenario` | inteiro | Cenário da aba aberta (Otimizada, Alt. 1...). Sem ele, o PDF usa o cenário **Otimizada**. |
| `imagem_mapa` | string base64 (PNG/JPEG, com ou sem `data:image/...;base64,`) | Imagem do mapa **do cenário selecionado**. |
| `incluir_alternativas` | boolean (padrão `true`) | **O frontend não deve enviar.** Por padrão o PDF traz todos os cenários do estudo e o comparativo; só `false` restringe ao cenário selecionado. |
| `imagens_mapa` | objeto `{ "<id_cenario>": "<base64>" }` | Mapas dos demais cenários do estudo. Cada imagem vale apenas para o seu `id_cenario`. |

### Mapas (responsabilidade do frontend)

O backend não desenha mapas: usa as imagens enviadas. Como o PDF traz todos os cenários, envie o mapa de **cada** aba (selecionado em `imagem_mapa`, os demais em `imagens_mapa`). Capture o canvas do mapa da tela (sem menus e controles) e envie em base64:

```js
const imagem_mapa = map.getCanvas().toDataURL("image/png");   // Mapbox: criar o mapa com preserveDrawingBuffer: true
```

- Limite: cada imagem até ~10 MB em base64; corpo total até 40 MB.
- Cenário sem imagem enviada: o PDF mostra o aviso "a imagem do mapa deste cenário não foi enviada" (nunca usa o mapa de outro cenário).
- `imagens_mapa` com id de cenário que não pertence ao estudo → 400.

### Otimizada × Alt. N

Regra aplicada pelo backend (sem alterar o banco): **Otimizada** = cenário sem `id_cenario_base` de menor `id_cenario` (a recomendação automática). Os demais, na ordem de criação, são **Alt. 1, Alt. 2...**

## Resposta de sucesso — `200 OK`

Corpo **binário** (não JSON, não base64).

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="relatorio-estudo-14-alimentador-sul-14-fase-1.pdf"
Access-Control-Expose-Headers: Content-Disposition
Cache-Control: no-store
```

Nome do arquivo: `relatorio-estudo-<id>-<nome-do-estudo-sem-acentos>.pdf`.

## Erros

Corpo JSON `{ "message": "..." }`.

| HTTP | Quando |
|---|---|
| 400 | `id` inválido, campo desconhecido, imagem que não é base64/PNG/JPEG, imagem grande demais, `imagens_mapa` com chave inválida ou de cenário de outro estudo |
| 401 | Sem token, token inválido ou sessão revogada |
| 404 | Estudo inexistente **ou de outro usuário**; `id_cenario` que não pertence ao estudo |
| 409 | Estudo ainda sem resultados processados (nenhum cenário executado) |
| 413 | Corpo maior que 40 MB |
| 500 | Falha ao gerar o PDF (mensagem genérica; detalhes só no log do servidor) |

### Tratamento de falhas no frontend

Use `responseType: "blob"` (ou `response.blob()`). Em status ≠ 200, leia o corpo como texto/JSON e mostre `message`. Em 401, redirecione ao login. Em 409, avise que o estudo ainda não tem resultados. Em 500, ofereça tentar de novo.

## Exemplo

```js
const response = await fetch(`${API}/estudos/${idEstudo}/exportar-pdf`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    id_cenario: abaAtiva.idCenario,
    imagem_mapa: map.getCanvas().toDataURL("image/png"),
  }),
});
if (!response.ok) throw new Error((await response.json()).message);

const nome = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1]
  ?? `relatorio-estudo-${idEstudo}.pdf`;
const url = URL.createObjectURL(await response.blob());
Object.assign(document.createElement("a"), { href: url, download: nome }).click();
URL.revokeObjectURL(url);
```

## Conteúdo do PDF

1. Identificação do estudo · 2. Informações gerais (perfil de RF e critério de instalação) · 3. Resumo dos resultados · 4. Mapa geográfico (com legenda) · 5. Gateways propostos · 6. Ativos elétricos (por categoria, atendidos e não atendidos — lista completa) · 7. Demais cenários do estudo* · 8. Comparativo entre cenários* · 9. Considerações finais.

\* Só se o estudo tiver outros cenários. Cabeçalho do estudo em todas as páginas e rodapé com paginação.

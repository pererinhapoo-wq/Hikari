# Hikari — Guia do Teste de Carga no Preview (Grafana k6 OSS)

Este diretório contém exclusivamente o script de teste de carga controlado para o **Hikari principal** (`pererinhapoo-wq/Hikari`, branch `main`), direcionado **somente ao ambiente Preview da Vercel**.

> **Escopo atual:** este setup executa **exclusivamente a Etapa 1 (máximo de 10 VUs)** com **15s de ramp-up**, **60s de platô** e **think time aleatório de 4 a 7 segundos**. Etapas posteriores (25, 50, 100, 200, 300, 400 e 500 VUs) **não** estão automatizadas e dependem de análise de métricas e autorização separada.

---

## 1. Como instalar o Grafana k6 OSS gratuitamente (sem cartão de crédito)

O **Grafana k6 OSS** é open-source (licença Apache-2.0) e roda 100% localmente, sem conta paga, sem trial e sem cartão de crédito. Não utilize o Grafana Cloud.

### Windows
Via Winget:
```powershell
winget install Grafana.k6 --source winget
```
Ou via Chocolatey:
```powershell
choco install k6
```

### macOS
Via Homebrew:
```bash
brew install k6
```

### Linux (Debian / Ubuntu)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```
*(Alternativamente, binários estáticos oficiais estão disponíveis nas releases públicas do projeto `grafana/k6` no GitHub.)*

---

## 2. Como verificar a instalação

Após instalar, confirme que o CLI local responde normalmente:

```bash
k6 version
```

---

## 3. Como conferir cotas antes de executar (obrigatório)

**Não execute o teste** sem antes verificar os saldos disponíveis nos painéis das plataformas do ambiente conectado ao Preview:

1. **Vercel Hobby:** conferir *Usage* (*Function Invocations*, *Fluid Active CPU / Function Duration* e *Fast Data Transfer*).
2. **Neon Free:** conferir *Compute Hours (CU-hours)*, *Data Transfer* e conexões ativas atuais.
3. **Upstash Redis Free:** conferir saldo diário/mensal de *Commands* e *Bandwidth / Data Transfer*.

Não assuma estimativas anteriores como valores garantidos — se qualquer cota já estiver próxima de 75%–80%, adie o teste.

---

## 4. Como fornecer o endereço exato do Preview

1. Acesse o painel da **Vercel** no projeto `pererinhapoo-wq/Hikari`.
2. Localize o deployment **Preview** mais recente da branch `main` (gerado após o último commit).
3. Copie a URL exata do deployment Preview (ex.: `https://hikari-git-main-xxxxx.vercel.app` ou `https://hikari-xxxxxxxxx-xxxxx.vercel.app`).

**Regras de segurança aplicadas automaticamente pelo script:**
- Exige `BASE_URL` explícita e com protocolo `https://`.
- Rejeita `grokhikari.vercel.app`, `hikaritv.cc.cd`, domínios de produção, URLs do **Hikari Player**, endereços locais (`localhost`, `127.0.0.1`) e aliases curtos não identificáveis como Preview da Vercel.
- Desabilita redirecionamentos automáticos (`redirects: 0` / `maxRedirects: 0`) e aborta o teste caso qualquer resposta tente redirecionar para outro domínio.
- **Não** utiliza tokens, cookies, credenciais ou bypass de *Deployment Protection*.

*(Opcional)* Caso deseje exercitar os 4% do fluxo de perfil público (`/profile/$nick`) com nicks públicos reais já existentes no banco de Preview, passe a variável `PROFILE_NICKS` separada por vírgula. Se `PROFILE_NICKS` não for informada, o script redireciona essa fatia para `/` sem inventar usuários fictícios.

---

## 5. Como executar somente a Etapa 1 (máximo 10 VUs)

Substitua `<EXACT_VERCEL_PREVIEW_URL>` pela URL real obtida no painel da Vercel:

### Linux / macOS
```bash
BASE_URL="https://<EXACT_VERCEL_PREVIEW_URL>.vercel.app" k6 run scripts/load-test/hikari-preview.js
```

Com nicks públicos reais opcionais:
```bash
BASE_URL="https://<EXACT_VERCEL_PREVIEW_URL>.vercel.app" PROFILE_NICKS="nick_real_1,nick_real_2" k6 run scripts/load-test/hikari-preview.js
```

### Windows (PowerShell)
```powershell
$env:BASE_URL="https://<EXACT_VERCEL_PREVIEW_URL>.vercel.app"
k6 run scripts/load-test/hikari-preview.js
```

---

## 6. Como visualizar o relatório final

Ao término dos ~75 segundos (15s ramp-up + 60s platô), o k6 imprime automaticamente no terminal o relatório completo com:
- `http_reqs`: total de requisições e taxa média (`req/s`).
- `http_req_failed`: percentual de erros HTTP.
- `http_5xx_errors` / `http_5xx_rate` e `http_429_errors` / `http_429_rate`.
- `http_req_duration`: latência global com `avg`, `min`, `med` (p50), `p(90)`, `p(95)`, `p(99)` e `max`.
- `route_duration_*`: latência detalhada por rota (`home`, `anime_detail`, `browse`, `episodes`, `search`, `profile`, `calendar`).
- Status dos thresholds configurados (`abortOnFail` após `delayAbortEval` de 15s–20s para evitar falso positivo no aquecimento inicial).

Para salvar também o resumo bruto em JSON localmente (sem alterar o repositório):
```bash
BASE_URL="https://<EXACT_VERCEL_PREVIEW_URL>.vercel.app" k6 run --summary-export=/tmp/hikari-etapa1-summary.json scripts/load-test/hikari-preview.js
```

---

## 7. Como interromper manualmente o teste

A qualquer momento durante a execução, pressione **`Ctrl + C`** no terminal onde o `k6` está rodando. O processo encerra imediatamente o envio de novas requisições e exibe o resumo parcial coletado até o instante da interrupção.

---

## 8. Como conferir o consumo e logs após a Etapa 1

1. **Vercel (Deployment Preview):**
   - Abra *Logs / Runtime Logs* do deployment Preview testado.
   - Filtre pelos logs JSON estruturados da aplicação:
     - `"op":"server_fn"` (`telemetry: true`) para duração de Server Functions e eventuais exceções.
     - `"op":"redis"` (`telemetry: true`) para identificar `"status":"timeout"` ou `"status":"error"` (registrados em 100% dos casos) e eventos `"event":"background_write"` (`waitUntil`). *(Sucessos do Redis usam amostragem de 10%.)*
   - Confira em *Usage* o incremento de *Invocations*, *Active CPU* e *Bandwidth*.
2. **Neon (Banco PostgreSQL):**
   - Abra *Monitoring* no projeto Neon correspondente ao Preview.
   - Verifique pico de *Active Connections*, *Compute CPU/RAM*, latência das consultas e consumo de *Compute Hours* / *Data Transfer*.
3. **Upstash (Redis):**
   - Abra *Metrics* no console da Upstash.
   - Verifique total de comandos executados, *P99 Latency*, uso de banda (*Throughput*) e se houve erros ou aproximação das cotas do plano gratuito.

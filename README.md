## 📌 Últimas Rotas
- `POST /api/token` — Gera o token JWT com escopo restrito baseado no e-mail.
- `GET /api/wod` — Retorna o treino do dia do usuário autenticado (isolado via Bearer Token).
- `POST /api/auth/register` — Cadastra usuário (User + UserLogin) e retorna o token JWT.
- `POST /api/auth/login` — Autentica com e-mail e senha e retorna o token JWT.
- `POST /api/auth/forgot-password` — Envia por e-mail o link de recuperação de senha (válido por 15 min).
- `POST /api/auth/reset-password` — Redefine a senha usando o token recebido por e-mail.

## Datadog

O backend envia traces APM pelo `dd-trace` e contabiliza treinos efetivamente gravados
com a métrica `fitness.workout.generated`. O Express fornece as métricas APM de
requisições, erros e latência usadas no dashboard `datadog-dashboard.json`.

Configure o Datadog Agent com a chave da sua conta, APM e DogStatsD habilitados.
No `.env` da aplicação, configure `DD_SERVICE`, `DD_ENV`, `DD_VERSION`,
`DD_AGENT_HOST`, `DD_TRACE_AGENT_PORT` e `DD_DOGSTATSD_PORT` (veja `.env.example`).
Se o Agent estiver em outro container/host, `DD_AGENT_HOST` deve apontar para ele.

Crie o dashboard usando `datadog-dashboard.json` e a API de dashboards. Para isso,
use uma API key e uma application key com permissão de escrita em dashboards,
definidas apenas no terminal seguro (não as coloque no `.env` da aplicação):

```sh
export DD_SITE=datadoghq.com
curl -X POST "https://api.${DD_SITE}/api/v1/dashboard" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @datadog-dashboard.json
```

O comando retorna o dashboard criado na sua conta. As chaves não são necessárias
no frontend nem para a aplicação Node enviar telemetria ao Agent.
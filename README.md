## 📌 Últimas Rotas
- `POST /api/token` — Gera o token JWT com escopo restrito baseado no e-mail.
- `GET /api/wod` — Retorna o treino do dia do usuário autenticado (isolado via Bearer Token).
- `POST /api/auth/register` — Cadastra usuário (User + UserLogin) e retorna o token JWT.
- `POST /api/auth/login` — Autentica com e-mail e senha e retorna o token JWT.
- `POST /api/auth/forgot-password` — Envia por e-mail o link de recuperação de senha (válido por 15 min).
- `POST /api/auth/reset-password` — Redefine a senha usando o token recebido por e-mail.